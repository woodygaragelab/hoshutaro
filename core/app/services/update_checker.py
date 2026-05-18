"""
Update Checker — アプリ本体の更新チェックサービス

GitHub Releases API から最新リリースを取得し、
現在のバージョンと比較して更新の有無を判定する。
"""

import logging
import re
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _parse_version(tag: str) -> tuple[int, ...]:
    """'v1.2.3' や '1.2.3' を (1, 2, 3) タプルに変換"""
    cleaned = re.sub(r"^v", "", tag.strip())
    parts = []
    for p in cleaned.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def _is_newer(latest_tag: str, current_tag: str) -> bool:
    """latest_tag が current_tag より新しいか判定"""
    return _parse_version(latest_tag) > _parse_version(current_tag)


def _get_current_version() -> str:
    """現在のアプリバージョンを取得"""
    version_file = Path(settings.hoshutaro_home) / "version.json"
    if version_file.exists():
        import json
        data = json.loads(version_file.read_text(encoding="utf-8"))
        return data.get("version", "0.0.0")

    # Fallback: package.json から取得
    package_json = Path(__file__).parent.parent.parent.parent / "package.json"
    if package_json.exists():
        import json
        data = json.loads(package_json.read_text(encoding="utf-8"))
        return data.get("version", "0.0.0")

    return "0.0.0"


def _detect_platform() -> str:
    """現在のプラットフォームを検出"""
    import platform
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "darwin":
        return "darwin"
    else:
        return "linux"


class UpdateChecker:
    """アプリ本体の更新チェッカー"""

    REPO = "woodygaragelab/hoshutaro"

    def __init__(self):
        self._github_pat = settings.github_pat

    async def _github_request(self, path: str) -> httpx.Response:
        """PAT 認証付き GitHub API リクエスト"""
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self._github_pat:
            headers["Authorization"] = f"Bearer {self._github_pat}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            return await client.get(
                f"https://api.github.com{path}",
                headers=headers,
                follow_redirects=True,
            )

    async def check_for_update(self) -> dict:
        """
        最新リリースをチェック。

        Returns:
            {
                "available": bool,
                "latestVersion": str | None,
                "currentVersion": str,
                "releaseNotes": str | None,
                "downloadUrl": str | None,
            }
        """
        current = _get_current_version()

        try:
            resp = await self._github_request(f"/repos/{self.REPO}/releases/latest")
            if resp.status_code != 200:
                logger.warning("GitHub API returned %d for update check", resp.status_code)
                return {"available": False, "currentVersion": current}

            latest = resp.json()
            latest_tag = latest.get("tag_name", "v0.0.0")

            if _is_newer(latest_tag, current):
                # Find platform-specific asset
                platform = _detect_platform()
                download_url = None
                for asset in latest.get("assets", []):
                    if platform in asset.get("name", "").lower():
                        # PATを使ってAPI領域からバイナリを取得するためURLを確保
                        download_url = asset.get("url")
                        break

                return {
                    "available": True,
                    "latestVersion": latest_tag.lstrip("v"),
                    "currentVersion": current,
                    "releaseNotes": latest.get("body", ""),
                    "downloadUrl": download_url,
                }

            return {"available": False, "currentVersion": current}

        except Exception as e:
            logger.error("Update check failed: %s", e)
            return {"available": False, "currentVersion": current}

    async def download_update(self, download_url: str) -> dict:
        """
        更新ファイル(ZIP)をダウンロードして staging ディレクトリに展開する。
        """
        staging_dir = Path(settings.hoshutaro_home) / "update" / "staging"
        if staging_dir.exists():
            import shutil
            shutil.rmtree(staging_dir)
        staging_dir.mkdir(parents=True, exist_ok=True)

        logger.info("Update download requested: %s → %s", download_url, staging_dir)

        try:
            # PAT認証と application/octet-stream アクセプトでバイナリ取得
            headers = {"Accept": "application/octet-stream"}
            if self._github_pat:
                headers["Authorization"] = f"Bearer {self._github_pat}"
                
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.get(download_url, headers=headers, follow_redirects=True)
                resp.raise_for_status()
                
                # インメモリでZIP解凍し、stagingへ展開
                import zipfile
                from io import BytesIO
                with zipfile.ZipFile(BytesIO(resp.content)) as zf:
                    zf.extractall(staging_dir)
                    
            return {
                "status": "staged",
                "staging_dir": str(staging_dir),
                "message": "アップデートの準備が完了しました。再起動時に適用されます。",
            }
        except Exception as e:
            logger.error("Failed to download and extract update: %s", e)
            return {
                "status": "error",
                "message": f"アップデートのダウンロードに失敗しました: {e}"
            }


# Singleton
update_checker = UpdateChecker()
