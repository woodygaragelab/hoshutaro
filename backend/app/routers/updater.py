"""
Updater Router — アプリ更新チェック REST API

アプリ本体の更新チェック・適用エンドポイント。
"""

import logging
from fastapi import APIRouter

from app.services.update_checker import update_checker

router = APIRouter(prefix="/api/updates", tags=["updates"])
logger = logging.getLogger(__name__)


@router.get("/check")
async def check_update():
    """アプリ更新チェック"""
    return await update_checker.check_for_update()


@router.post("/apply")
async def apply_update():
    """
    更新適用 (staging dir にダウンロード)。
    実際の差し替えは Launcher 再起動時に実行される。
    """
    # まず更新チェック
    info = await update_checker.check_for_update()
    if not info.get("available"):
        return {"status": "up_to_date", "message": "最新バージョンです"}

    download_url = info.get("downloadUrl")
    if not download_url:
        return {"status": "error", "message": "ダウンロードURLが見つかりません"}

    return await update_checker.download_update(download_url)
