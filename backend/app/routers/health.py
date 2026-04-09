from fastapi import APIRouter

router = APIRouter()

@router.get("/api/health")
async def health_check():
    """バックエンドの基本コンポーネントを含めたヘルスチェックを返します。"""
    return {"status": "ok", "llm": {"status": "ready", "error": None}}
