import asyncio
import sys

# Windows 環境で asyncio.create_subprocess_exec 等を使用する際の NotImplementedError 回避策
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, settings, chat, data, plugins, skills, updater


logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: バックグラウンドでLLMアダプタの初期化を開始
    # MCP Hub is now managing LLMs
    pass
    yield
    # shutdown: MCP Hub の全サーバーを停止
    from app.services.mcp_hub import mcp_hub
    await mcp_hub.shutdown_all()


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
app.include_router(data.router)
app.include_router(plugins.router)
app.include_router(skills.router)
app.include_router(updater.router)

# touch
# touch for mcp_hub
# trigger reload