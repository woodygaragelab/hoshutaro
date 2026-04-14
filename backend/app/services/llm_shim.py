import json
import logging
from typing import Optional, Any
from app.services.gemini_client import gemini_client

logger = logging.getLogger(__name__)

def extract_json_object(text: str) -> Optional[dict]:
    """Extremely naive JSON object extractor."""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
    return None

def extract_json_array(text: str) -> Optional[list]:
    """Extremely naive JSON array extractor."""
    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
    except Exception as e:
        logger.error(f"Failed to parse JSON array: {e}")
    return None

class DummyAdapter:
    """A wrapper for existing agent logic to route directly to Gemini Client or MCP Plugins."""
    
    async def _ensure_plugin_running(self, plugin_id: str):
        from app.services.mcp_hub import mcp_hub
        from app.services.plugin_manager import plugin_manager
        import sys
        if mcp_hub.get_server_status(plugin_id) != "running":
            manifest = plugin_manager.get_plugin_manifest(plugin_id)
            if not manifest:
                raise RuntimeError(f"プラグイン {plugin_id} が見つかりません")
            config = plugin_manager.get_plugin_config(plugin_id)
            # 現在の .env の値を config に上書き優先してあげる (LLM_MODEL等)
            from app.config import settings
            if plugin_id == "ollama-adapter":
                config["OLLAMA_MODEL"] = settings.llm_model
                config["OLLAMA_BASE_URL"] = settings.llm_base_url
            command = manifest.get("command", plugin_id)
            if command in ("python", "python3"):
                command = sys.executable
            launch_options = {
                "command": command,
                "args": manifest.get("args", []),
                "cwd": str(plugin_manager._plugins_dir / plugin_id),
                "env": {k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))}
            }
            await mcp_hub.start_server(plugin_id, launch_options)

    async def chat(self, messages: list[dict]) -> str:
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        from app.config import settings
        
        if settings.llm_adapter == "gemini":
            from app.services.gemini_client import gemini_client
            return await gemini_client.generate_text(prompt)
            
        plugin_id = settings.llm_adapter
        await self._ensure_plugin_running(plugin_id)
        
        from app.services.mcp_hub import mcp_hub
        try:
            res = await mcp_hub.call_tool(plugin_id, "generate_text", {"messages": messages, "temperature": 0.7})
            content = res.get("text", "") if isinstance(res, dict) else str(res)
            # 抽出処理: MCP の CallToolResult の場合
            if isinstance(res, dict) and "content" in res and isinstance(res["content"], list):
                content = next((item.get("text", "") for item in res["content"] if item.get("type", "") == "text"), "")
            return content
        except Exception as e:
            logger.error(f"[{plugin_id}] MCP chat routing failed: {e}")
            raise RuntimeError(f"ローカルLLMでの生成に失敗しました: {e}")

    async def generate_structured(self, system_prompt: str, user_prompt: str, json_schema: dict = None, retries: int = 1) -> str:
        prompt = f"{user_prompt}\n\nPlease respond in valid JSON format."
        if json_schema:
            prompt += f"\nSchema: {json.dumps(json_schema)}"
            
        from app.config import settings
        if settings.llm_adapter == "gemini":
            from app.services.gemini_client import gemini_client
            return await gemini_client.generate_text(prompt, system_instruction=system_prompt)
            
        plugin_id = settings.llm_adapter
        await self._ensure_plugin_running(plugin_id)
        
        from app.services.mcp_hub import mcp_hub
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            res = await mcp_hub.call_tool(plugin_id, "generate_text", {"messages": messages, "temperature": 0.3})
            content = res.get("text", "") if isinstance(res, dict) else str(res)
            if isinstance(res, dict) and "content" in res and isinstance(res["content"], list):
                content = next((item.get("text", "") for item in res["content"] if item.get("type", "") == "text"), "")
            return content
        except Exception as e:
            logger.error(f"[{plugin_id}] MCP generate_structured routing failed: {e}")
            raise RuntimeError(f"ローカルLLMでの構造化生成に失敗しました: {e}")

    async def ping(self):
        from app.config import settings
        if settings.llm_adapter == "gemini":
            from app.services.gemini_client import gemini_client
            return await gemini_client.test_connection()
            
        plugin_id = settings.llm_adapter
        await self._ensure_plugin_running(plugin_id)
        from app.services.mcp_hub import mcp_hub
        try:
            res = await mcp_hub.call_tool(plugin_id, "test_connection", {})
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "message": str(e)}

def get_llm_adapter(*args, **kwargs) -> DummyAdapter:
    return DummyAdapter()
