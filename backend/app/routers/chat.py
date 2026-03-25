import json
import logging
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.session_manager import session_manager
from app.llm.factory import get_llm_adapter
from app.engine.orchestrator import route_and_execute
from app.engine.agents.excel_import import excel_import_engine

router = APIRouter()
logger = logging.getLogger(__name__)

class ChatMessagePayload(BaseModel):
    role: str
    content: str
    
class ChatRequest(BaseModel):
    session_id: str
    messages: list[ChatMessagePayload]

@router.post("/api/chat/completions")
async def chat_completions(body: ChatRequest, request: Request):
    try:
        session_id = body.session_id
        session = session_manager.get_session(session_id)
        
        adapter = get_llm_adapter()
        if not adapter:
            raise HTTPException(status_code=503, detail="LLM is not ready")

        async def event_generator():
            try:
                # Excelインポート待機中の場合
                if hasattr(session, "import_state") and session.import_state and session.import_state.get("status") == "waiting_user":
                    # ユーザーからの承認とみなす
                    yield {"data": json.dumps({"type": "text_delta", "delta": "Excelインポートを開始します...\n"})}
                    session.import_state["status"] = "process_chunks"
                    
                    from app.services.excel_converter import chunk_process_excel
                    result = chunk_process_excel(
                        session.import_state["file_bytes"],
                        {
                            "header_row_index": session.import_state["header_row_index"],
                            "mappings": session.import_state["mappings"],
                            "symbol_mapping": session.import_state.get("symbol_mapping", {})
                        },
                        chunk_size=10000,
                        start_row=session.import_state.get("processed_rows", 0)
                    )
                    
                    session.import_state = None # リセット
                    
                    extracted = result.get("extracted_data", [])
                    if extracted:
                        lines = session.data_model.setdefault("workOrderLines", [])
                        for row in extracted:
                            if "id" not in row:
                                row["id"] = f"WOL-IMP-{len(lines)}"
                            lines.append(row)
                        
                        yield {"data": json.dumps({"type": "text_delta", "delta": f"インポート完了: {len(extracted)}件のデータを取り込みました。\n"})}
                        yield {"data": json.dumps({"type": "data_model_update", "data": session.data_model})}
                    
                    yield {"data": "[DONE]"}
                    return

                yield {"data": json.dumps({"type": "status", "message": "AIが思考中..."})}
                
                messages_for_llm = [{"role": m.role, "content": m.content} for m in body.messages]
                
                # オーケストレーター実行 (入力から適切なAgentへ分岐)
                user_msg = messages_for_llm[-1]["content"] if messages_for_llm else ""
                result = await route_and_execute(session_id, user_msg, dict(session.data_model))
                
                ops = result.get("operations", [])
                final_res = result.get("result", "")
                
                # DataModelが更新された場合は結果を通知
                if ops and len(ops) > 0:
                    yield {"data": json.dumps({"type": "op_summary", "summary": final_res})}
                    yield {"data": json.dumps({"type": "data_model_update", "data": session.data_model})}
                
                try:
                    # アダプターの chat_stream を用いて、アクション完了報告などを親切にストリームする
                    stream = adapter.chat_stream(messages_for_llm, final_res or "思考を完了しました。")
                    async for chunk in stream:
                        payload = {
                            "type": "text_delta",
                            "delta": chunk
                        }
                        yield {"data": json.dumps(payload)}
                except Exception as e:
                    logger.error(f"LLM Stream Error: {e}")
                    yield {"data": json.dumps({"type": "text_delta", "delta": f"\n[ストリームエラー: {e}]"})}

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
