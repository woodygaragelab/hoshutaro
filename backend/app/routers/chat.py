import json
import logging
import asyncio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.session_manager import session_manager
from app.llm.factory import get_llm_adapter, get_llm_loading_status
from app.engine.orchestrator import prepare_dispatch, execute_agent, keyword_fallback

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
        
        adapter = get_llm_adapter(wait_timeout=2.0)
        if not adapter:
            status = get_llm_loading_status()
            err_msg = status.get("error") or "LLM Initialization Timeout"
            raise HTTPException(status_code=503, detail=f"LLM is not ready: {err_msg}")

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

                # ── 特殊パス: Excelインポート待機中 ──
                # ユーザーがまだ確認していない場合は通常の会話として処理
                # Phase 3の実行は /api/data/import/confirm エンドポイント経由で行う

                # ── 通常パス: 並列LLM呼び出し ──
                yield {"data": json.dumps({"type": "status", "message": "AIが思考中..."})}

                intent_task, conv_stream, llm_adapter = await prepare_dispatch(
                    session_id, user_msg, dict(session.data_model)
                )

                if intent_task is None:
                    # LLM不可 → キーワードフォールバック
                    result = await keyword_fallback(session_id, user_msg, dict(session.data_model))
                    final_res = result.get("result", "")
                    ops = result.get("operations", [])
                    agent_name = result.get("agent", "")

                    if ops:
                        yield {"data": json.dumps({"type": "op_summary", "summary": final_res})}
                        yield {"data": json.dumps({"type": "data_model_update", "data": session.data_model})}

                    if agent_name == "GenericChat" and hasattr(adapter, "pure_chat_stream"):
                        async for chunk in adapter.pure_chat_stream(messages_for_llm):
                            yield {"data": json.dumps({"type": "text_delta", "delta": chunk})}
                    elif final_res:
                        for i in range(0, len(final_res), 2):
                            yield {"data": json.dumps({"type": "text_delta", "delta": final_res[i:i+2]})}
                            await asyncio.sleep(0.01)

                    yield {"data": "[DONE]"}
                    return

                # ═══════ Step 1: Call B の会話ストリームを即座にユーザーへ送信 ═══════
                # 🔀 条件付き並列: Call Bストリーム中にCall Aが完了していれば
                #    エージェントを先行起動してレイテンシを削減する
                full_response = ""
                agent_task = None  # エージェント先行起動タスク
                try:
                    async for chunk in conv_stream:
                        full_response += chunk
                        yield {"data": json.dumps({"type": "text_delta", "delta": chunk})}

                        # Call Aが先に完了している場合、エージェントを先行起動
                        if agent_task is None and intent_task.done():
                            try:
                                early_result = intent_task.result()
                                early_intent = early_result.get("intent", "converse")
                                early_confidence = early_result.get("confidence", 0.0)
                                if early_intent != "converse" and early_confidence >= 0.5:
                                    logger.info(
                                        "Early agent launch: intent=%s, confidence=%.2f (during conv stream)",
                                        early_intent, early_confidence
                                    )
                                    agent_task = asyncio.create_task(
                                        execute_agent(
                                            early_intent,
                                            early_result.get("parameters", {}),
                                            session_id,
                                            dict(session.data_model),
                                            user_msg,
                                        )
                                    )
                            except Exception:
                                pass  # intent_taskのエラーは後段で処理
                except Exception as e:
                    logger.error("Conv stream error: %s", e)
                    full_response += f"\n[ストリームエラー: {e}]"
                    yield {"data": json.dumps({"type": "text_delta", "delta": f"\n[ストリームエラー: {e}]"})}

                session.append_message("assistant", full_response)

                # ═══════ Step 2: Call A の結果を取得 ═══════
                intent_result = await intent_task
                intent = intent_result.get("intent", "converse")
                confidence = intent_result.get("confidence", 0.0)
                parameters = intent_result.get("parameters", {})

                logger.info(
                    "Dispatch result: intent=%s, confidence=%.2f, params=%s",
                    intent, confidence, parameters
                )

                if intent == "converse" or confidence < 0.5:
                    # 会話のみで終了（Call B の応答が最終回答）
                    # 先行起動したエージェントがあればキャンセル
                    if agent_task is not None:
                        agent_task.cancel()
                        logger.info("Cancelled speculative agent task (converse path)")
                    yield {"data": "[DONE]"}
                    return

                # ═══════ Step 3: エージェント ReActループ実行 ═══════
                # 先行起動済みならawait、未起動なら今起動
                if agent_task is None:
                    agent_task = asyncio.create_task(
                        execute_agent(
                            intent, parameters, session_id, dict(session.data_model), user_msg
                        )
                    )
                agent_result = await agent_task

                ops = agent_result.get("operations", [])
                final_res = agent_result.get("final_response", "")

                if ops:
                    # Step 4: 完了報告ストリーム
                    try:
                        async for chunk in llm_adapter.completion_report_stream(final_res):
                            yield {"data": json.dumps({"type": "text_delta", "delta": chunk})}
                    except Exception as e:
                        logger.error("Completion report stream error: %s", e)
                        yield {"data": json.dumps({"type": "text_delta", "delta": f"\n{final_res}"})}

                    yield {"data": json.dumps({"type": "data_model_update", "data": session.data_model})}
                elif final_res:
                    # ReActの"情報不足"パス → 質問/提案テキストを擬似ストリーム
                    for i in range(0, len(final_res), 2):
                        yield {"data": json.dumps({"type": "text_delta", "delta": final_res[i:i+2]})}
                        await asyncio.sleep(0.01)

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
