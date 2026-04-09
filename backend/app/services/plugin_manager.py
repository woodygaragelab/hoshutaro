"""
Plugin Manager — プラグインのインストール・管理

GitHub Private Repository からのプラグインダウンロード、
インストール、アンインストール、バージョン管理を行う。
"""

import json
import logging
import platform
import shutil
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class PluginManager:
    """プラグインのインストール・管理"""

    _instance: "PluginManager | None" = None

    def __new__(cls) -> "PluginManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, "_initialized"):
            self._home = Path(settings.hoshutaro_home)
            self._plugins_dir = self._home / "plugins"
            self._plugins_dir.mkdir(parents=True, exist_ok=True)
            self._registry_cache: dict | None = None
            self._initialized = True

    # ── GitHub API ────────────────────────────────────────────

    async def _github_request(self, url: str, accept: str = "application/json") -> httpx.Response:
        """PAT認証付きGitHub APIリクエスト"""
        headers: dict[str, str] = {}
        if settings.github_pat:
            headers["Authorization"] = f"Bearer {settings.github_pat}"
        headers["Accept"] = accept
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            return response

    # ── レジストリ ────────────────────────────────────────────

    async def fetch_registry(self) -> dict:
        """plugin-registry.json を読み込み"""
        registry_path = self._home.parent / "plugin-registry.json"
        if registry_path.exists():
            return json.loads(registry_path.read_text(encoding="utf-8"))
        
        # ローカルにない場合はGitHubから取得
        try:
            resp = await self._github_request(
                f"https://api.github.com/repos/woodygaragelab/hoshutaro/contents/plugin-registry.json"
            )
            content = resp.json()
            if "content" in content:
                import base64
                decoded = base64.b64decode(content["content"]).decode("utf-8")
                return json.loads(decoded)
        except Exception as e:
            logger.warning("[PluginManager] レジストリ取得失敗: %s", e)
        
        return {"registryVersion": "1.0.0", "plugins": []}

    # ── インストール済みプラグイン ─────────────────────────────

    def list_installed(self) -> list[dict]:
        """インストール済みプラグイン一覧"""
        plugins = []
        for plugin_dir in self._plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue
            manifest_path = plugin_dir / "manifest.json"
            if manifest_path.exists():
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    manifest["_installed"] = True
                    manifest["_path"] = str(plugin_dir)
                    plugins.append(manifest)
                except Exception as e:
                    logger.warning("[PluginManager] %s の manifest 読み込み失敗: %s", plugin_dir.name, e)
        return plugins

    def get_plugin_manifest(self, plugin_id: str) -> dict | None:
        """指定プラグインの manifest を取得"""
        manifest_path = self._plugins_dir / plugin_id / "manifest.json"
        if manifest_path.exists():
            return json.loads(manifest_path.read_text(encoding="utf-8"))
        return None

    # ── インストール ──────────────────────────────────────────

    async def install_plugin(self, plugin_id: str) -> dict:
        """プラグインをインストール (GitHub Release から DL)"""
        registry = await self.fetch_registry()
        plugin_info = None
        for p in registry.get("plugins", []):
            if p["id"] == plugin_id:
                plugin_info = p
                break
        
        if not plugin_info:
            return {"status": "error", "message": f"プラグイン {plugin_id} がレジストリに見つかりません"}

        repo = plugin_info["repository"]
        tag = plugin_info["releaseTag"]
        
        try:
            # ─ Local Dev Override ─
            import sys
            workspace_dir = Path("C:/Users/kazuh")
            local_src = workspace_dir / repo.split('/')[-1]
            if local_src.exists() and local_src.is_dir():
                logger.info(f"[PluginManager] Local dev override: copying from {local_src}")
                
                plugin_dir = self._plugins_dir / plugin_id
                if plugin_dir.exists():
                    shutil.rmtree(plugin_dir)
                shutil.copytree(local_src, plugin_dir)
                
                return {"status": "installed", "path": str(plugin_dir)}
            
            # GitHub Releases API でリリース情報取得
            release_url = f"https://api.github.com/repos/{repo}/releases/tags/{tag}"
            release_resp = await self._github_request(release_url)
            release_data = release_resp.json()
            
            # プラットフォーム判定
            current_platform = self._get_platform()
            pattern = plugin_info.get("artifactPattern", "")
            expected_name = pattern.replace("{platform}", current_platform).replace("{version}", tag.lstrip("v"))
            
            # マッチするアセットを探す
            asset_url = None
            for asset in release_data.get("assets", []):
                if asset["name"] == expected_name or current_platform in asset["name"]:
                    asset_url = asset["url"]
                    break
            
            if not asset_url:
                return {"status": "error", "message": f"プラットフォーム {current_platform} 用のアセットが見つかりません"}
            
            # ダウンロード
            binary_resp = await self._github_request(asset_url, accept="application/octet-stream")
            
            # 展開
            plugin_dir = self._plugins_dir / plugin_id
            if plugin_dir.exists():
                shutil.rmtree(plugin_dir)
            plugin_dir.mkdir(parents=True)
            
            with zipfile.ZipFile(BytesIO(binary_resp.content)) as zf:
                zf.extractall(plugin_dir)
            
            logger.info("[PluginManager] %s をインストールしました", plugin_id)
            return {"status": "installed", "path": str(plugin_dir)}

        except Exception as e:
            logger.error("[PluginManager] %s のインストールに失敗: %s", plugin_id, e)
            return {"status": "error", "message": str(e)}

    # ── アンインストール ──────────────────────────────────────

    def uninstall_plugin(self, plugin_id: str) -> dict:
        """プラグインをアンインストール"""
        plugin_dir = self._plugins_dir / plugin_id
        if not plugin_dir.exists():
            return {"status": "error", "message": f"プラグイン {plugin_id} が見つかりません"}
        
        try:
            shutil.rmtree(plugin_dir)
            logger.info("[PluginManager] %s をアンインストールしました", plugin_id)
            return {"status": "uninstalled"}
        except Exception as e:
            logger.error("[PluginManager] %s のアンインストールに失敗: %s", plugin_id, e)
            return {"status": "error", "message": str(e)}

    # ── プラグイン設定 ────────────────────────────────────────

    def get_plugin_config(self, plugin_id: str) -> dict:
        """プラグインの接続設定を取得"""
        config_path = self._home / "config" / "plugins.json"
        if config_path.exists():
            all_config = json.loads(config_path.read_text(encoding="utf-8"))
            return all_config.get("servers", {}).get(plugin_id, {})
        return {}

    def save_plugin_config(self, plugin_id: str, config: dict) -> None:
        """プラグインの接続設定を保存"""
        config_dir = self._home / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        config_path = config_dir / "plugins.json"
        
        all_config = {"servers": {}}
        if config_path.exists():
            all_config = json.loads(config_path.read_text(encoding="utf-8"))
        
        all_config.setdefault("servers", {})[plugin_id] = config
        config_path.write_text(json.dumps(all_config, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── 更新チェック ──────────────────────────────────────────

    async def check_plugin_updates(self) -> list[dict]:
        """全プラグインの更新チェック"""
        updates = []
        installed = self.list_installed()
        registry = await self.fetch_registry()
        
        for plugin in installed:
            registry_entry = next(
                (p for p in registry.get("plugins", []) if p["id"] == plugin["id"]),
                None
            )
            if registry_entry and registry_entry["version"] != plugin["version"]:
                updates.append({
                    "id": plugin["id"],
                    "currentVersion": plugin["version"],
                    "latestVersion": registry_entry["version"],
                })
        return updates

    # ── Utility ───────────────────────────────────────────────

    @staticmethod
    def _get_platform() -> str:
        """現在のプラットフォームを判定"""
        system = platform.system().lower()
        if system == "windows":
            return "windows"
        elif system == "darwin":
            return "darwin"
        else:
            return "linux"


# シングルトンインスタンス
plugin_manager = PluginManager()
