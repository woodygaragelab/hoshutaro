from fastapi import APIRouter
from app.llm.factory import get_llm_loading_status

router = APIRouter()

@router.get("/api/health")
async def health_check():
    """LLMの準備状況等を含めたヘルスチェックを返します。"""
    loading_status = get_llm_loading_status()
    return {"status": "ok", "llm": loading_status}
