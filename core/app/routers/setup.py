"""
初回起動時のモデルダウンロード API。

エンドポイント:
  GET  /api/setup/status                  モデル配置状況とジョブ状態
  POST /api/setup/download_models         ダウンロード起動（非同期）
  GET  /api/setup/download_progress       SSE で進捗ストリーミング
"""

from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.mu.setup import get_setup_manager

router = APIRouter(prefix="/api/setup", tags=["setup"])


class DownloadRequest(BaseModel):
    include_drafter: bool = True
    force: bool = False
    hf_token: Optional[str] = None


@router.get("/status")
def get_status() -> dict:
    return get_setup_manager().detail()


@router.post("/download_models")
async def trigger_download(body: DownloadRequest) -> dict:
    mgr = get_setup_manager()
    started = await mgr.trigger_download(
        include_drafter=body.include_drafter,
        force=body.force,
        hf_token=body.hf_token,
    )
    return {
        "started": started,
        "state": mgr.status.state,
        "detail": mgr.detail(),
    }


@router.get("/download_progress")
async def stream_progress() -> StreamingResponse:
    mgr = get_setup_manager()

    async def event_generator():
        async for ev in mgr.progress_stream():
            yield f"data: {json.dumps(ev, default=str)}\n\n"
        yield "event: end\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
