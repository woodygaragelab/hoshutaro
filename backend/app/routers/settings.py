from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.llm.factory import reset_llm_adapter

router = APIRouter()

# backend/ ディレクトリ基準で .env パスを解決
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class LLMSettings(BaseModel):
    llm_adapter: str
    llm_base_url: str
    llm_model: str
    llm_api_key: Optional[str] = None
    llm_temperature: float
    llm_max_tokens: int


@router.get("/api/settings/llm")
async def get_settings():
    return {
        "llm_adapter": settings.llm_adapter,
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "llm_api_key": settings.llm_api_key if settings.llm_api_key else "none",
        "llm_temperature": settings.llm_temperature,
        "llm_max_tokens": settings.llm_max_tokens,
    }


@router.put("/api/settings/llm")
async def update_settings(new_settings: LLMSettings):
    keys_map = {
        "LLM_ADAPTER": new_settings.llm_adapter,
        "LLM_BASE_URL": new_settings.llm_base_url,
        "LLM_MODEL": new_settings.llm_model,
        "LLM_API_KEY": new_settings.llm_api_key or "none",
        "LLM_TEMPERATURE": str(new_settings.llm_temperature),
        "LLM_MAX_TOKENS": str(new_settings.llm_max_tokens),
        "SKILLS_PATH": settings.skills_path,
    }

    with open(_ENV_PATH, "w", encoding="utf-8") as f:
        for k, v in keys_map.items():
            f.write(f"{k}={v}\n")

    # インメモリ設定も更新
    settings.llm_adapter = new_settings.llm_adapter
    settings.llm_base_url = new_settings.llm_base_url
    settings.llm_model = new_settings.llm_model
    settings.llm_api_key = new_settings.llm_api_key or "none"
    settings.llm_temperature = new_settings.llm_temperature
    settings.llm_max_tokens = new_settings.llm_max_tokens

    reset_llm_adapter()
    return {"status": "ok"}


class LLMTestRequest(BaseModel):
    base_url: str
    model: str
    api_key: Optional[str] = None


@router.post("/api/settings/llm/test")
async def test_llm_connection(req: LLMTestRequest):
    try:
        from app.llm.openai_compat import OpenAICompatAdapter
        adapter = OpenAICompatAdapter(
            base_url=req.base_url, model=req.model, api_key=req.api_key or "none"
        )
        res = await adapter.ping()
        res["model_info"] = req.model
        return res
    except Exception as e:
        return {"ok": False, "latency_ms": 0, "error": str(e)}

class LLMModelsRequest(BaseModel):
    base_url: str
    api_key: Optional[str] = None

@router.post("/api/settings/llm/models")
async def get_llm_models(req: LLMModelsRequest):
    """
    指定されたbase_urlとapi_keyを用いて、利用可能なモデル一覧を取得する
    """
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(base_url=req.base_url, api_key=req.api_key or "none")
        models_response = await client.models.list()
        # idプロパティを持つモデルオブジェクトのリストからidのリストを抽出
        model_ids = sorted([model.id for model in models_response.data])
        return {"ok": True, "models": model_ids}
    except Exception as e:
        return {"ok": False, "models": [], "error": str(e)}
