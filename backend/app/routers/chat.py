import json
import logging
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.services.session_manager import session_manager
from app.llm.factory import get_llm_adapter
from app.engine.graph import execute_engine

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
                yield {"data": json.dumps({"type": "status", "message": "AIが思考中..."})}
                
                messages_for_llm = [{"role": m.role, "content": m.content} for m in body.messages]
                
                # LangGraphエンジン実行
                state = await execute_engine(session_id, messages_for_llm, dict(session.data_model))
                
                # DataModelが更新された場合は結果を通知
                if state.get("operations") and len(state["operations"]) > 0:
                    yield {"data": json.dumps({"type": "op_summary", "summary": state.get("final_response", "")})}
                    # TODO: 本来は `data_model_update` 等としてフロントに送信する
                    # yield {"data": json.dumps({"type": "data_model_update", "data": session.data_model})}
                
                try:
                    # アダプターの chat_stream を用いて、アクション完了報告などを親切にストリームする
                    stream = adapter.chat_stream(messages_for_llm, state.get("final_response", "思考を完了しました。"))
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
