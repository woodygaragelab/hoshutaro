"""
Chat Router — AI チャット REST API（orchestrator 経由、プラン WS1-5 / WS1-9 / WS1-10）

`/api/chat/completions` は会話ストリームと intent ベースのエージェント実行を統括する。

設計:
  - Call B (conversational_stream) と Call A (classify_intent) を並列起動し、
    会話 chunk を SSE で即座に送信。
  - Call A の分類結果に応じて orchestrator.execute_agent でエージェント実行
    （excel_import / schedule_planning / data_editing / 拡張 intent）。
  - UI コンテキスト（currentDialog 等）に応じて分類後ホワイトリスト適用。
  - LLM 未準備時は keyword_fallback で最小限のルーティングを試みる。

SSE イベント:
  - text_delta: 会話 chunk
  - intent_classified: { intent, confidence, parameters, out_of_scope_reason? }
  - tool_call: エージェント実行開始
  - tool_result: { final_response, operations }
  - proposal_pending: ユーザー確認待ちの提案
  - proposal_executed: 提案実行完了
  - dialog_open_request: フロントにダイアログ起動を依頼（将来用）
  - status: 状態メッセージ
  - error: エラー
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.engine.orchestrator import (
    execute_agent,
    keyword_fallback,
    prepare_dispatch,
)
from app.services.session_manager import session_manager

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessagePayload]
    # フロントエンドのグリッドデータスナップショット
    data_context: Optional[dict] = None
    # UI コンテキスト（プラン WS1-10）。currentDialog / dialogParams / gridState を含む。
    ui_context: Optional[dict] = Field(default=None)


def _sse(payload: dict[str, Any]) -> dict[str, str]:
    """SSE 1 メッセージ。"""
    return {"data": json.dumps(payload, ensure_ascii=False)}


@router.post("/api/chat/completions")
async def chat_completions(body: ChatRequest, request: Request):
    try:
        session_id = body.session_id
        session = session_manager.get_session(session_id)

        messages_for_llm = [{"role": m.role, "content": m.content} for m in body.messages]
        user_msg = messages_for_llm[-1]["content"] if messages_for_llm else ""

        # data_context をセッションに同期
        if body.data_context:
            session.data_model.update(body.data_context)

        # 会話履歴にユーザーメッセージを追加
        if user_msg:
            session.append_message("user", user_msg)

        async def event_generator():
            try:
                if not user_msg:
                    yield _sse({"type": "text_delta", "delta": "（メッセージが空です）"})
                    yield {"data": "[DONE]"}
                    return

                # ── 並列 LLM ディスパッチ準備 ──
                intent_task, conv_stream, adapter = await prepare_dispatch(
                    session_id=session_id,
                    instruction=user_msg,
                    context=body.data_context or {},
                    ui_context=body.ui_context,
                )

                if adapter is None or conv_stream is None or intent_task is None:
                    # LLM 未準備: keyword_fallback で最小限のルーティング、なければ案内メッセージ。
                    yield _sse(
                        {
                            "type": "status",
                            "message": "LLM が初期化されていません。設定 → LLM 接続でモデルを確認してください。",
                        }
                    )
                    fb = await keyword_fallback(
                        session_id, user_msg, body.data_context or {}
                    )
                    msg = fb.get("result") or (
                        "ローカル LLM が起動していないため、"
                        "セットアップ画面でモデルを取得してください。"
                    )
                    yield _sse({"type": "text_delta", "delta": msg})
                    if fb.get("operations"):
                        yield _sse(
                            {
                                "type": "tool_result",
                                "agent": fb.get("agent", ""),
                                "final_response": msg,
                                "operations": fb["operations"],
                            }
                        )
                    session.append_message("assistant", msg)
                    yield {"data": "[DONE]"}
                    return

                # ── Call B (会話ストリーム) を流しつつ、Call A (intent) を背景待ち ──
                yield _sse({"type": "status", "message": "ローカルLLMで思考中..."})

                collected_text: list[str] = []
                try:
                    async for chunk in conv_stream:
                        if chunk:
                            collected_text.append(chunk)
                            yield _sse({"type": "text_delta", "delta": chunk})
                except Exception as e:
                    logger.exception("Conversational stream failed")
                    yield _sse({"type": "text_delta", "delta": f"\n[会話ストリームエラー: {e}]"})

                # ── 分類結果を取得 ──
                try:
                    intent_result = await asyncio.wait_for(intent_task, timeout=10.0)
                except asyncio.TimeoutError:
                    logger.warning("intent classification timed out, defaulting to converse")
                    intent_result = {"intent": "converse", "parameters": {}, "confidence": 0.0}

                intent = intent_result.get("intent", "converse")
                yield _sse(
                    {
                        "type": "intent_classified",
                        "intent": intent,
                        "confidence": intent_result.get("confidence", 0.0),
                        "parameters": intent_result.get("parameters", {}),
                        "out_of_scope_reason": intent_result.get("out_of_scope_reason"),
                    }
                )

                # converse はエージェント実行なし — 会話ストリームのみで完結
                if intent == "converse":
                    final = "".join(collected_text)
                    session.append_message("assistant", final or "[会話応答]")
                    yield {"data": "[DONE]"}
                    return

                # excel_import は専用 API（/api/data/import/excel）に誘導
                if intent == "excel_import":
                    guide = (
                        "Excel ファイルの取込はエージェントバーの添付アイコンから"
                        "ファイルを選択してください。"
                    )
                    yield _sse({"type": "text_delta", "delta": "\n\n" + guide})
                    session.append_message("assistant", guide)
                    yield {"data": "[DONE]"}
                    return

                # ── エージェント実行（schedule_planning / data_editing / ダイアログ操作系） ──
                yield _sse({"type": "tool_call", "intent": intent})
                result = await execute_agent(
                    intent=intent,
                    parameters=intent_result.get("parameters", {}),
                    session_id=session_id,
                    context=body.data_context or {},
                    instruction=user_msg,
                    ui_context=body.ui_context,
                )

                final_response = result.get("final_response", "")
                operations = result.get("operations", [])

                # ダイアログ起動要求（プラン WS1-10）— フロントが該当ダイアログを開く
                dialog_request = result.get("dialog_request")
                if dialog_request:
                    yield _sse(
                        {
                            "type": "dialog_open_request",
                            "dialog": dialog_request,
                            "intent": intent,
                        }
                    )

                # schedule_planning の保留提案を検出して proposal_pending を発行
                pending = session.metadata.get("pending_schedule_ops")
                if intent == "schedule_planning" and pending:
                    yield _sse(
                        {
                            "type": "proposal_pending",
                            "final_response": final_response,
                            "pending_operations": pending,
                        }
                    )
                else:
                    yield _sse(
                        {
                            "type": "tool_result",
                            "intent": intent,
                            "final_response": final_response,
                            "operations": operations,
                        }
                    )

                if final_response:
                    yield _sse({"type": "text_delta", "delta": "\n\n" + final_response})
                    session.append_message("assistant", final_response)

                yield {"data": "[DONE]"}

            except asyncio.CancelledError:
                logger.info("Client disconnected")
            except Exception as e:
                logger.error("Chat stream generic error: %s", e, exc_info=True)
                yield _sse({"type": "error", "message": str(e)})
                yield {"data": "[DONE]"}

        return EventSourceResponse(event_generator())

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Chat error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
