from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.config import settings

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
    openvino_models_dir: str = r"C:\Users\kazuh\OpenVINO_Models"
    openvino_model_path: str = ""
    openvino_device: str = "AUTO"
    openvino_performance_mode: str = "LATENCY"


@router.get("/api/settings/llm")
async def get_settings():
    return {
        "llm_adapter": settings.llm_adapter,
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "llm_api_key": settings.llm_api_key if settings.llm_api_key else "none",
        "llm_temperature": settings.llm_temperature,
        "llm_max_tokens": settings.llm_max_tokens,
        "openvino_models_dir": getattr(settings, "openvino_models_dir", r"C:\Users\kazuh\OpenVINO_Models"),
        "openvino_model_path": getattr(settings, "openvino_model_path", ""),
        "openvino_device": getattr(settings, "openvino_device", "AUTO"),
        "openvino_performance_mode": getattr(settings, "openvino_performance_mode", "LATENCY"),
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
        "OPENVINO_MODELS_DIR": new_settings.openvino_models_dir,
        "OPENVINO_MODEL_PATH": new_settings.openvino_model_path,
        "OPENVINO_DEVICE": new_settings.openvino_device,
        "OPENVINO_PERFORMANCE_MODE": new_settings.openvino_performance_mode,
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
    settings.openvino_models_dir = new_settings.openvino_models_dir
    settings.openvino_model_path = new_settings.openvino_model_path
    settings.openvino_device = new_settings.openvino_device
    settings.openvino_performance_mode = new_settings.openvino_performance_mode

    # MCP環境では再起動はHubが管理するため何もしない
    return {"status": "ok"}


@router.post("/api/settings/llm/test")
async def test_llm_connection(req: LLMSettings):
    from app.services.mcp_hub import mcp_hub
    try:
        plugin_id = "openvino-adapter" if req.llm_adapter == "openvino_genai" else "ollama-adapter"
        res = await mcp_hub.call_tool(plugin_id, "test_connection", {})
        res["model_info"] = req.openvino_model_path if req.llm_adapter == "openvino_genai" else req.llm_model
        return res
    except Exception as e:
        return {"ok": False, "latency_ms": 0, "error": f"MCP Plugin '{plugin_id}' error: {str(e)}"}

class LLMModelsRequest(BaseModel):
    base_url: str
    api_key: Optional[str] = None

@router.post("/api/settings/llm/models")
async def get_llm_models(req: LLMModelsRequest):
    """
    MCPプラグインを経由してモデル一覧を取得する
    """
    from app.services.mcp_hub import mcp_hub
    try:
        models = await mcp_hub.call_tool("ollama-adapter", "list_models", {})
        return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "models": [], "error": str(e)}

@router.get("/api/settings/local_models")
async def get_local_models(base_dir: Optional[str] = None):
    """
    ローカルの共通モデルディレクトリから利用可能なモデル一覧を取得する
    """
    import os
    if not base_dir:
        base_dir = getattr(settings, "openvino_models_dir", r"C:\Users\kazuh\OpenVINO_Models")
        
    if not os.path.exists(base_dir):
        return {"ok": True, "models": []}
    
    models = []
    try:
        for entry in os.scandir(base_dir):
            if entry.is_dir():
                models.append({
                    "name": entry.name,
                    "path": entry.path.replace("\\", "/")  # JS連携のためスラッシュに
                })
        return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "models": [], "error": str(e)}
