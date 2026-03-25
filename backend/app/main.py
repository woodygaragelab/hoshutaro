import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, settings, chat
from app.llm.factory import get_llm_adapter

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: バックグラウンドでLLMアダプタの初期化を開始
    try:
        get_llm_adapter()
    except RuntimeError:
        pass  # ロード中の例外は無視して次に進める
    yield
    # shutdown: 必要に応じてクリーンアップ


app = FastAPI(title="HOSHUTARO AI Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(settings.router)
app.include_router(chat.router)
