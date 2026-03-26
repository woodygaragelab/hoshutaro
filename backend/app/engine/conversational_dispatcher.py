"""
会話型ディスパッチャー: 並列LLM呼び出し管理。

Call A (classify_intent): 軽量インテント分類（JSON, temp=0.1, 256 tokens）
Call B (conversational_stream): リッチ会話ストリーム（temp=0.7, 1024 tokens）

この2つを asyncio で並列起動し、chat.py の event_generator() が
Call B のストリームを SSE で即座に送信しつつ、Call A の結果を待つ。
"""

import asyncio
import logging
from typing import AsyncGenerator, Optional

from pydantic import BaseModel, Field
from typing import Literal

from app.llm.base import LLMAdapter
from app.llm.conversational_prompts import (
    CONVERSATIONAL_SYSTEM_PROMPT,
    CLASSIFIER_SYSTEM_PROMPT,
)
from app.llm.prompt_templates import format_conversational_context

logger = logging.getLogger(__name__)


class IntentResult(BaseModel):
    """Call A のインテント分類結果"""
    intent: Literal["converse", "schedule_planning", "data_editing", "excel_import"] = "converse"
    parameters: dict = Field(default_factory=dict)
    confidence: float = 0.0


async def create_parallel_dispatch(
    user_message: str,
    data_context: dict,
    conversation_history: list[dict],
    adapter: LLMAdapter,
) -> tuple[asyncio.Task, AsyncGenerator[str, None]]:
    """
    Call A (classify_intent) と Call B (conversational_stream) を並列準備する。

    Returns:
        intent_task: Call A の asyncio.Task（await で IntentResult 相当の dict を取得）
        conv_stream: Call B の AsyncGenerator（async for で消費）
    """
    # 1. データサマリー生成
    context_summary = format_conversational_context(data_context)

    # 2. プロンプト組み立て
    rich_prompt = CONVERSATIONAL_SYSTEM_PROMPT.format(
        data_context_summary=context_summary
    )
    classifier_prompt = CLASSIFIER_SYSTEM_PROMPT.format(
        data_context_summary=context_summary
    )

    # 3. messages 構築（履歴 + 最新メッセージ）
    messages = list(conversation_history) + [
        {"role": "user", "content": user_message}
    ]

    # 4. Call A を asyncio.Task として並列起動
    intent_task = asyncio.create_task(
        _classify_with_fallback(adapter, messages, classifier_prompt)
    )

    # 5. Call B はジェネレータとして返す（消費は呼び出し側が行う）
    conv_stream = adapter.conversational_stream(messages, rich_prompt)

    return intent_task, conv_stream


async def _classify_with_fallback(
    adapter: LLMAdapter,
    messages: list[dict],
    classifier_prompt: str,
) -> dict:
    """
    Call A のラッパー。LLM呼び出し失敗やJSON解析失敗を
    converse へフォールバックさせる。confidence < 0.7 も converse に上書き。
    """
    try:
        raw_result = await adapter.classify_intent(messages, classifier_prompt)
    except Exception as e:
        logger.error("classify_intent failed: %s", e)
        return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    # confidence 閾値チェック
    intent = raw_result.get("intent", "converse")
    confidence = raw_result.get("confidence", 0.0)

    if confidence < 0.5 and intent != "converse":
        logger.info(
            "Intent '%s' has low confidence %.2f (< 0.5), overriding to 'converse'",
            intent,
            confidence,
        )
        raw_result["intent"] = "converse"

    return raw_result
