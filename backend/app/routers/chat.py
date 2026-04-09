"""
Chat Router — AI チャット REST API

Phase 5B: Gemini Client を優先 LLM として使用。
旧 llm/ アダプタは Gemini が利用不可の場合のフォールバックとして維持。
"""

import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.session_manager import session_manager
from app.services.gemini_client import gemini_client

# Legacy MCP LLM fallback
from app.services.mcp_hub import mcp_hub

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessagePayload]
    data_context: dict = None  # フロントエンドから送信されるグリッドデータ


@router.post("/api/chat/completions")
async def chat_completions(body: ChatRequest, request: Request):
    try:
        session_id = body.session_id
        session = session_manager.get_session(session_id)

        # ── LLM 選択: 設定値とGemini Clientの状態に基づいて判定 ──
        from app.config import settings
        use_gemini = (settings.llm_adapter == "gemini") and gemini_client.is_ready

        async def event_generator():
            try:
                messages_for_llm = [{"role": m.role, "content": m.content} for m in body.messages]
                user_msg = messages_for_llm[-1]["content"] if messages_for_llm else ""

                # フロントエンドから送信されたデータコンテキストをセッションに同期
                if body.data_context:
                    session.data_model.update(body.data_context)
                    dc = body.data_context
                    logger.info(
                        "data_context received: assets=%d, workOrders=%d, workOrderLines=%d",
                        len(dc.get("assets", [])),
                        len(dc.get("workOrders", [])),
                        len(dc.get("workOrderLines", [])),
                    )
                else:
                    logger.warning("No data_context in request. session.data_model keys: %s", list(session.data_model.keys()))

                # ── 前処理: 会話履歴に追加 ──
                session.append_message("user", user_msg)

                # ═══════ Gemini Primary Path ═══════
                if use_gemini:
                    yield {"data": json.dumps({"type": "status", "message": "Gemini が思考中..."})}

                    # Build system prompt with data context
                    data_summary = ""
                    if body.data_context:
                        dc = body.data_context
                        data_summary = (
                            f"\n\n[データコンテキスト] "
                            f"機器: {len(dc.get('assets', []))}件, "
                            f"作業: {len(dc.get('workOrders', []))}件, "
                            f"明細: {len(dc.get('workOrderLines', []))}件"
                        )

                    system_prompt = (
                        "あなたは「保守太郎」の AI アシスタントです。"
                        "設備保全計画に関する質問に答え、データ操作を支援してください。"
                        "日本語で回答してください。"
                        + data_summary
                    )

                    # Build conversation prompt
                    conversation = "\n".join(
                        f"{'ユーザー' if m['role'] == 'user' else 'アシスタント'}: {m['content']}"
                        for m in messages_for_llm
                    )

                    try:
                        async for chunk in gemini_client.generate_text_stream(
                            conversation,
                            system_instruction=system_prompt,
                            temperature=0.7,
                            max_tokens=2048,
                        ):
                            yield {"data": json.dumps({"type": "text_delta", "delta": chunk})}

                        session.append_message("assistant", "[Gemini response streamed]")
                    except Exception as e:
                        logger.error("Gemini streaming error: %s", e)
                        # Gemini 失敗 → フォールバックメッセージ
                        error_msg = f"\n[Gemini エラー: {e}]"
                        yield {"data": json.dumps({"type": "text_delta", "delta": error_msg})}

                    yield {"data": "[DONE]"}
                    return

                # ═══════ Legacy MCP LLM Path (フォールバック) ═══════
                yield {"data": json.dumps({"type": "status", "message": "ローカルLLMで思考中..."})}

                from app.config import settings
                plugin_id = "openvino-adapter" if settings.llm_adapter == "openvino_genai" else "ollama-adapter"
                
                try:
                    res = await mcp_hub.call_tool(plugin_id, "generate_text", {"messages": messages_for_llm})
                    content = res.get("text", "")
                    
                    if content:
                        for i in range(0, len(content), 2):
                            yield {"data": json.dumps({"type": "text_delta", "delta": content[i:i+2]})}
                            await asyncio.sleep(0.01)
                    session.append_message("assistant", content)
                except Exception as e:
                    logger.error("MCP LLM fallback error: %s", e)
                    yield {"data": json.dumps({"type": "text_delta", "delta": f"\\n[ローカルLLM エラー: {e}]"})}

                yield {"data": "[DONE]"}

            except asyncio.CancelledError:
                logger.info("Client disconnected")
            except Exception as e:
                logger.error(f"Chat stream generic error: {e}", exc_info=True)
                yield {"data": json.dumps({"type": "error", "message": str(e)})}
                yield {"data": "[DONE]"}

        return EventSourceResponse(event_generator())

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
