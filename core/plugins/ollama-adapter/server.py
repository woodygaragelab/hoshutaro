import json
import logging
import os
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from mcp.server.fastmcp import FastMCP

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ollama-adapter")

# Initialize FastMCP Server
mcp = FastMCP("ollama-adapter")

import httpx

def get_client() -> tuple[AsyncOpenAI, str]:
    """Environment variable からクライアントを初期化"""
    base_url = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
    model = os.environ.get("LLM_MODEL", "llama3.1")
    api_key = os.environ.get("LLM_API_KEY", "none")
    
    # HTTPにフォールバック（空文字や不要なスラッシュ対策）
    if not base_url:
        base_url = "http://localhost:11434/v1"
        
    os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1"
    
    http_client = httpx.AsyncClient(trust_env=False)
    client = AsyncOpenAI(base_url=base_url, api_key=api_key, http_client=http_client)
    return client, model


@mcp.tool()
async def test_connection() -> dict:
    """End-point接続と死活監視（Ping）を行う"""
    client, _ = get_client()
    try:
        models = await client.models.list()
        model_names = [m.id for m in models.data]
        return {"ok": True, "models": model_names}
    except Exception as e:
        logger.error(f"test_connection error: {str(e)}")
        return {"ok": False, "error": str(e), "models": []}


@mcp.tool()
async def list_models() -> List[str]:
    """利用可能なモデルの一覧を取得する"""
    client, _ = get_client()
    try:
        models = await client.models.list()
        return [m.id for m in models.data]
    except Exception as e:
        logger.error(f"list_models error: {str(e)}")
        return []


@mcp.tool()
async def generate_text(
    prompt: Optional[str] = None,
    messages: Optional[List[Dict[str, str]]] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    """プロンプトを基にテキストを生成する"""
    client, default_model = get_client()
    use_model = model or default_model
    
    if messages is None:
        if prompt is None:
            raise ValueError("Either prompt or messages must be provided")
        messages = [{"role": "user", "content": prompt}]
        
    try:
        completion = await client.chat.completions.create(
            model=use_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return completion.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"generate_text error: {str(e)}")
        raise RuntimeError(f"Ollama/OpenAI completion failed: {str(e)}")


if __name__ == "__main__":
    import asyncio
    import sys
    
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    mcp.run()
