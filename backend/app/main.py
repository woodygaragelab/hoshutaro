import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, settings
from app.llm.factory import get_llm_adapter

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="HOSHUTARO AI Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(settings.router)

@app.on_event("startup")
async def startup_event():
    # バックグラウンドでLLMアダプタの非同期ロード（初期化）を開始
    try:
        get_llm_adapter()
    except RuntimeError:
        pass # ロード中の例外は無視して次に進める
