"""
会話型ディスパッチャー: 並列LLM呼び出し管理。

Call A (classify_intent): 軽量インテント分類（JSON, temp=0.1, 256 tokens）
Call B (conversational_stream): リッチ会話ストリーム（temp=0.7, 1024 tokens）

この2つを asyncio で並列起動し、chat.py の event_generator() が
Call B のストリームを SSE で即座に送信しつつ、Call A の結果を待つ。

UI コンテキスト対応（プラン WS1-10）:
- prompt_templates.format_ui_context で「開いているダイアログ + グリッド状態」を要約
- 分類後に prompt_templates.allowed_intents_for_ui で UI ホワイトリスト適用
"""

import asyncio
import logging
from typing import AsyncGenerator, Literal, Optional

from pydantic import BaseModel, Field

from app.llm.base import LLMAdapter
from app.llm.conversational_prompts import (
    CONVERSATIONAL_SYSTEM_PROMPT,
    CLASSIFIER_SYSTEM_PROMPT,
)
from app.llm.prompt_templates import (
    format_conversational_context,
    format_ui_context,
    allowed_intents_for_ui,
)

logger = logging.getLogger(__name__)


IntentLiteral = Literal[
    "converse",
    "schedule_planning",
    "data_editing",
    "excel_import",
    "hierarchy_edit",
    "asset_classification_define",
    "asset_classification_assign",
    "work_order_classification_edit",
    "work_order_line_edit",
    "specification_edit",
    "asset_reassign",
]


class IntentResult(BaseModel):
    """Call A のインテント分類結果"""
    intent: IntentLiteral = "converse"
    parameters: dict = Field(default_factory=dict)
    confidence: float = 0.0


async def create_parallel_dispatch(
    user_message: str,
    data_context: dict,
    conversation_history: list[dict],
    adapter: LLMAdapter,
    ui_context: Optional[dict] = None,
) -> tuple[asyncio.Task, AsyncGenerator[str, None]]:
    """
    Call A (classify_intent) と Call B (conversational_stream) を並列準備する。

    Returns:
        intent_task: Call A の asyncio.Task（await で IntentResult 相当の dict を取得）
        conv_stream: Call B の AsyncGenerator（async for で消費）
    """
    # 1. データサマリー + UI コンテキストサマリー
    context_summary = format_conversational_context(data_context)
    ui_summary = format_ui_context(ui_context)

    # 2. プロンプト組み立て
    rich_prompt = CONVERSATIONAL_SYSTEM_PROMPT.format(
        data_context_summary=context_summary,
        ui_context_summary=ui_summary,
    )
    classifier_prompt = CLASSIFIER_SYSTEM_PROMPT.format(
        data_context_summary=context_summary,
        ui_context_summary=ui_summary,
    )

    # 3. messages 構築（履歴 + 最新メッセージ）
    messages = list(conversation_history) + [
        {"role": "user", "content": user_message}
    ]

    # 4. Call A を asyncio.Task として並列起動
    intent_task = asyncio.create_task(
        _classify_with_fallback(adapter, messages, classifier_prompt, ui_context)
    )

    # 5. Call B はジェネレータとして返す（消費は呼び出し側が行う）
    conv_stream = adapter.conversational_stream(messages, rich_prompt)

    return intent_task, conv_stream


async def _classify_with_fallback(
    adapter: LLMAdapter,
    messages: list[dict],
    classifier_prompt: str,
    ui_context: Optional[dict] = None,
) -> dict:
    """
    Call A のラッパー。LLM呼び出し失敗やJSON解析失敗を converse へフォールバックさせる。
    confidence < 0.5 も converse に上書き。UI コンテキストで許可されない intent も
    converse へオーバーライド（プラン WS1-10）。
    """
    try:
        raw_result = await adapter.classify_intent(messages, classifier_prompt)
    except Exception as e:
        logger.error("classify_intent failed: %s", e)
        return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    intent = raw_result.get("intent", "converse")
    confidence = raw_result.get("confidence", 0.0)

    if confidence < 0.5 and intent != "converse":
        logger.info(
            "Intent '%s' has low confidence %.2f (< 0.5), overriding to 'converse'",
            intent,
            confidence,
        )
        raw_result["intent"] = "converse"
        intent = "converse"

    # UI コンテキストの intent ホワイトリスト適用
    allowed = allowed_intents_for_ui(ui_context)
    if allowed is not None and intent not in allowed:
        current_dialog = (ui_context or {}).get("currentDialog")
        logger.info(
            "Intent '%s' not allowed in UI '%s' (allowed=%s) — overriding to converse",
            intent,
            current_dialog,
            sorted(allowed),
        )
        raw_result["intent"] = "converse"
        raw_result["out_of_scope_reason"] = (
            f"現在 '{current_dialog}' ダイアログが開いているため "
            f"'{intent}' は実行できません。ダイアログを閉じてからお試しください。"
        )

    return raw_result
