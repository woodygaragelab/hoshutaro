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
    llm_temperature: float
    llm_max_tokens: int


@router.get("/api/settings/llm")
async def get_settings():
    return {
        "llm_adapter": settings.llm_adapter,
        "llm_temperature": settings.llm_temperature,
        "llm_max_tokens": settings.llm_max_tokens,
    }


@router.put("/api/settings/llm")
async def update_settings(new_settings: LLMSettings):
    keys_map = {
        "LLM_ADAPTER": new_settings.llm_adapter,
        "LLM_TEMPERATURE": str(new_settings.llm_temperature),
        "LLM_MAX_TOKENS": str(new_settings.llm_max_tokens),
        "SKILLS_PATH": settings.skills_path,
    }

    # 既存の .env を読み込んでマージする
    existing_env = {}
    if _ENV_PATH.exists():
        with open(_ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    existing_env[k.strip()] = v.strip()

    # 新しい設定で上書き
    existing_env.update(keys_map)

    with open(_ENV_PATH, "w", encoding="utf-8") as f:
        for k, v in existing_env.items():
            f.write(f"{k}={v}\n")

    # インメモリ設定も更新
    settings.llm_adapter = new_settings.llm_adapter
    settings.llm_temperature = new_settings.llm_temperature
    settings.llm_max_tokens = new_settings.llm_max_tokens

    # plugins.jsonに設定を反映し、対応するMCPサーバを起動/再起動する
    from app.services.plugin_manager import plugin_manager
    from app.services.mcp_hub import mcp_hub

    plugin_id = new_settings.llm_adapter

    if plugin_id != "gemini":
        manifest = plugin_manager.get_plugin_manifest(plugin_id)
        if manifest:
            import sys
            config = plugin_manager.get_plugin_config(plugin_id)
            command = manifest.get("command", plugin_id)
            if command in ("python", "python3"):
                command = sys.executable
            
            launch_options = {
                "command": command,
                "args": manifest.get("args", []),
                "cwd": str(plugin_manager._plugins_dir / plugin_id),
                "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
            }
            if mcp_hub.get_server_status(plugin_id) == "running":
                await mcp_hub.restart_server(plugin_id, launch_options)
            else:
                await mcp_hub.start_server(plugin_id, launch_options)

    # 選択されていない全てのLLMアダプタを停止する
    for pid in list(mcp_hub._servers.keys()):
        manifest = plugin_manager.get_plugin_manifest(pid)
        if manifest and manifest.get("category") == "llm-adapter" and pid != plugin_id:
            if mcp_hub.get_server_status(pid) == "running":
                try:
                    await mcp_hub.stop_server(pid)
                except Exception:
                    pass

    return {"status": "ok"}


class LLMStartRequest(BaseModel):
    adapter: str
    plugin_config: dict

@router.post("/api/settings/llm/start")
async def start_llm_adapter(req: LLMStartRequest):
    from app.services.mcp_hub import mcp_hub
    
    plugin_id = req.adapter

    if plugin_id == "gemini":
        return {"ok": True}

    # 選択されていないアダプタを停止
    for pid in list(mcp_hub._servers.keys()):
        if pid != plugin_id and mcp_hub.get_server_status(pid) == "running":
            try:
                await mcp_hub.stop_server(pid)
            except Exception:
                pass

    from app.services.plugin_manager import plugin_manager
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if manifest:
        import sys
        config = req.plugin_config
        command = manifest.get("command", plugin_id)
        if command in ("python", "python3"):
            command = sys.executable
        launch_options = {
            "command": command,
            "args": manifest.get("args", []),
            "cwd": str(plugin_manager._plugins_dir / plugin_id),
            "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
        }
        
        # 常に新しい未保存設定を反映するために再起動
        if mcp_hub.get_server_status(plugin_id) == "running":
            await mcp_hub.stop_server(plugin_id)
            
        try:
            await mcp_hub.start_server(plugin_id, launch_options)
            
            # 起動後にウォームアップ（モデルのメモリロードやOpenVINOのコンパイル等）を実施
            # これをしないと、初回生成(Test時)にレイテンシが集中してしまうため
            try:
                await mcp_hub.call_tool(plugin_id, "test_connection", {})
            except Exception as e:
                # ウォームアップ失敗でもプロセス自体は起動成功とみなす
                pass
                
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": f"{plugin_id} の起動に失敗しました: {e}"}
    else:
        return {"ok": False, "error": f"{plugin_id} が見つかりません。"}


class LLMTestRequest(BaseModel):
    adapter: str
    plugin_config: dict

@router.post("/api/settings/llm/test")
async def test_llm_connection(req: LLMTestRequest):
    from app.services.gemini_client import gemini_client
    from app.services.mcp_hub import mcp_hub
    
    plugin_id = req.adapter
    prompt = "こんにちは！短い挨拶を1文で返してください。"

    if plugin_id == "gemini":
        try:
            # gemini_clientの内部機能でテストを実施
            res_text = await gemini_client.generate_text(
                prompt=prompt,
                temperature=0.0,
                max_tokens=15
            )
            return {
                "ok": True, 
                "latency_ms": 0, 
                "model_info": "Gemini System Tuning",
                "response_text": res_text.strip()
            }
        except Exception as e:
            return {"ok": False, "latency_ms": 0, "error": str(e)}

    # MCP Pluginのgenerate_textをコールする
    if mcp_hub.get_server_status(plugin_id) != "running":
        return {"ok": False, "error": "アダプターが起動していません。先に「起動」ボタンを押してください。"}

    try:
        config = req.plugin_config
        tool_args = {"prompt": prompt, "temperature": 0.0, "max_tokens": 15}
        
        test_result = await mcp_hub.call_tool(plugin_id, "generate_text", tool_args)
        
        # CallToolResult から dict または文字列を抽出
        res_text = ""
        if isinstance(test_result, dict):
            if "structuredContent" in test_result and isinstance(test_result["structuredContent"], dict):
                result_obj = test_result["structuredContent"].get("result", "")
                if isinstance(result_obj, dict):
                    res_text = result_obj.get("text", result_obj.get("response", str(result_obj)))
                else:
                    res_text = str(result_obj)
            elif "content" in test_result and isinstance(test_result["content"], list):
                text_content = next((item.get("text", "") for item in test_result["content"] if item.get("type", "") == "text"), "")
                try:
                    import json
                    parsed = json.loads(text_content.replace('"', '"')) # Try JSON parsing fallback
                    if isinstance(parsed, dict) and "text" in parsed:
                        res_text = parsed["text"]
                    else:
                        res_text = text_content
                except Exception:
                    res_text = text_content
        elif isinstance(test_result, str):
            try:
                import json
                parsed = json.loads(test_result)
                if isinstance(parsed, dict) and "text" in parsed:
                    res_text = parsed["text"]
                else:
                    res_text = test_result
            except Exception:
                res_text = test_result
        else:
            res_text = str(test_result)
            
        model_info = config.get("LLM_MODEL", config.get("OLLAMA_MODEL", "Unknown"))
        return {"ok": True, "model_info": model_info, "response_text": str(res_text).strip()}
    except Exception as e:
        return {"ok": False, "latency_ms": 0, "error": f"MCP Plugin '{plugin_id}' error: {str(e)}"}

class ToolCallRequest(BaseModel):
    adapter: str
    plugin_config: dict
    tool_name: str
    tool_args: dict

@router.post("/api/settings/llm/tool")
async def call_llm_tool(req: ToolCallRequest):
    """
    フロントエンドから任意のMCPプラグインのツールを呼び出す
    """
    from app.services.mcp_hub import mcp_hub
    
    plugin_id = req.adapter
    from app.services.plugin_manager import plugin_manager
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if not manifest:
        return {"ok": False, "error": f"{plugin_id} が見つかりません。"}

    import sys
    config = req.plugin_config
    
    command = manifest.get("command", plugin_id)
    if command in ("python", "python3"):
        command = sys.executable
        
    launch_options = {
        "command": command,
        "args": manifest.get("args", []),
        "cwd": str(plugin_manager._plugins_dir / plugin_id),
        "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
    }
    
    if mcp_hub.get_server_status(plugin_id) != "running":
        try:
            await mcp_hub.start_server(plugin_id, launch_options)
        except Exception as e:
            return {"ok": False, "error": f"{plugin_id} の起動に失敗しました: {e}"}

    try:
        res = await mcp_hub.call_tool(plugin_id, req.tool_name, req.tool_args)
        
        result_data = res
        if isinstance(res, dict):
            if "structuredContent" in res and isinstance(res["structuredContent"], dict):
                result_data = res["structuredContent"].get("result", {})
            elif "content" in res and isinstance(res["content"], list):
                try:
                    import json
                    text_content = next((item.get("text", "") for item in res["content"] if item.get("type", "") == "text"), "{}")
                    result_data = json.loads(text_content.replace("'", '"'))
                except Exception:
                    result_data = {"ok": True, "raw": res}
                    
        return {"ok": True, "result": result_data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

class LLMModelsRequest(BaseModel):
    adapter: str
    plugin_config: dict

@router.post("/api/settings/llm/models")
async def get_llm_models(req: LLMModelsRequest):
    """
    MCPプラグインを経由してモデル一覧を取得する
    """
    from app.services.mcp_hub import mcp_hub
    
    plugin_id = req.adapter
    if plugin_id == "gemini":
        return {"ok": True, "models": ["gemini-1.5-pro"]}

    from app.services.plugin_manager import plugin_manager
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if not manifest:
        return {"ok": False, "models": [], "error": f"{plugin_id} が見つかりません。"}

    import sys
    config = req.plugin_config
    
    command = manifest.get("command", plugin_id)
    if command in ("python", "python3"):
        command = sys.executable
        
    launch_options = {
        "command": command,
        "args": manifest.get("args", []),
        "cwd": str(plugin_manager._plugins_dir / plugin_id),
        "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
    }
    
    # 常に画面の新しい設定を反映するために一時的に再起動
    if mcp_hub.get_server_status(plugin_id) == "running":
        await mcp_hub.stop_server(plugin_id)
        
    try:
        await mcp_hub.start_server(plugin_id, launch_options)
    except Exception as e:
        return {"ok": False, "models": [], "error": f"{plugin_id} の起動に失敗しました: {e}"}

    try:
        models_result = await mcp_hub.call_tool(plugin_id, "list_models", {})
        
        # MCP の CallToolResult 構造からリストを抽出する
        models = []
        if isinstance(models_result, dict):
            # 優先して structuredContent を確認
            if "structuredContent" in models_result and isinstance(models_result["structuredContent"], dict):
                models = models_result["structuredContent"].get("result", [])
            elif "content" in models_result and isinstance(models_result["content"], list):
                models = [item.get("text", "") for item in models_result["content"] if item.get("type", "") == "text"]
        elif isinstance(models_result, list):
            models = models_result
            
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
        base_dir = r"C:\Users\kazuh\OpenVINO_Models"
        
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
