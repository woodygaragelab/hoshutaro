"""
Plugins Router — プラグイン管理 REST API

プラグインのインストール、アンインストール、起動/停止、設定管理。
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.plugin_manager import plugin_manager
from app.services.mcp_hub import mcp_hub
from app.services.licensing import license_manager

router = APIRouter(prefix="/api/plugins", tags=["plugins"])
logger = logging.getLogger(__name__)


# ── Response/Request Models ──────────────────────────

class PluginConfigUpdate(BaseModel):
    config: dict


# ── Endpoints ────────────────────────────────────────

@router.get("")
async def list_plugins():
    """インストール済みプラグイン一覧 + ステータス"""
    installed = plugin_manager.list_installed()
    for plugin in installed:
        plugin["status"] = mcp_hub.get_server_status(plugin["id"])
    return {"plugins": installed}


@router.get("/registry")
async def get_registry():
    """利用可能プラグイン一覧 (plugin-registry.json)"""
    registry = await plugin_manager.fetch_registry()
    installed_ids = {p["id"] for p in plugin_manager.list_installed()}
    
    for plugin in registry.get("plugins", []):
        plugin["installed"] = plugin["id"] in installed_ids
    
    return registry


@router.post("/{plugin_id}/install")
async def install_plugin(plugin_id: str):
    """プラグインをインストール"""
    # ライセンスチェック
    if not await license_manager.check_plugin_access(plugin_id):
        raise HTTPException(status_code=403, detail="このプラグインのライセンスがありません")
    
    result = await plugin_manager.install_plugin(plugin_id)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.delete("/{plugin_id}")
async def uninstall_plugin(plugin_id: str):
    """プラグインをアンインストール"""
    # 実行中なら先に停止
    if mcp_hub.get_server_status(plugin_id) == "running":
        await mcp_hub.stop_server(plugin_id)
    
    result = plugin_manager.uninstall_plugin(plugin_id)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/{plugin_id}/start")
async def start_plugin(plugin_id: str):
    """プラグインを起動"""
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if not manifest:
        raise HTTPException(status_code=404, detail=f"プラグイン {plugin_id} が見つかりません")
    
    config = plugin_manager.get_plugin_config(plugin_id)
    
    import sys
    command = manifest.get("command", plugin_id)
    if command in ("python", "python3"):
        command = sys.executable

    # 起動オプションの構築 (manifestの定義 + ユーザー設定をenvへ)
    # config 内の値はPluginの設定値なので、それを環境変数として渡す
    launch_options = {
        "command": command,
        "args": manifest.get("args", []),
        "cwd": str(plugin_manager._plugins_dir / plugin_id),
        "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
    }
    
    try:
        await mcp_hub.start_server(plugin_id, launch_options)
        return {"status": "started", "plugin_id": plugin_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{plugin_id}/stop")
async def stop_plugin(plugin_id: str):
    """プラグインを停止"""
    try:
        await mcp_hub.stop_server(plugin_id)
        return {"status": "stopped", "plugin_id": plugin_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{plugin_id}/config")
async def get_plugin_config(plugin_id: str):
    """プラグインの設定を取得"""
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if not manifest:
        raise HTTPException(status_code=404, detail=f"プラグイン {plugin_id} が見つかりません")
    
    config = plugin_manager.get_plugin_config(plugin_id)
    return {
        "manifest": manifest,
        "config": config,
    }


@router.put("/{plugin_id}/config")
async def update_plugin_config(plugin_id: str, body: PluginConfigUpdate):
    """プラグインの設定を更新"""
    manifest = plugin_manager.get_plugin_manifest(plugin_id)
    if not manifest:
        raise HTTPException(status_code=404, detail=f"プラグイン {plugin_id} が見つかりません")
    
    plugin_manager.save_plugin_config(plugin_id, body.config)
    
    # 実行中なら再起動して新設定を適用
    if mcp_hub.get_server_status(plugin_id) == "running":
        import sys
        command = manifest.get("command", plugin_id)
        if command in ("python", "python3"):
            command = sys.executable
        launch_options = {
            "command": command,
            "args": manifest.get("args", []),
            "cwd": str(plugin_manager._plugins_dir / plugin_id),
            "env": {k: str(v) for k, v in body.config.items() if isinstance(v, (str, int, float, bool))}
        }
        await mcp_hub.restart_server(plugin_id, launch_options)
    
    return {"status": "updated", "plugin_id": plugin_id}


@router.get("/updates/check")
async def check_updates():
    """プラグイン更新チェック"""
    updates = await plugin_manager.check_plugin_updates()
    return {"updates": updates}


@router.get("/tools/all")
async def list_all_tools():
    """全起動中プラグインの Tool 一覧"""
    tools = await mcp_hub.list_tools()
    return {"tools": [t.to_dict() for t in tools]}


@router.get("/license")
async def get_license_info():
    """ライセンス情報を取得"""
    info = license_manager.get_info()
    return info.to_dict()
