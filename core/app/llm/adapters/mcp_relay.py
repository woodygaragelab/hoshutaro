"""
MCP Relay Adapter — MCP Plugin 経由で LLM を呼ぶ汎用アダプタ。

既存 `app.services.llm_shim.DummyAdapter` の MCP プラグイン分岐ロジックを移管。
Ollama / OpenVINO / OpenAI など、MCP サーバとして実装された任意の LLM Plugin を
このアダプタで透過的に呼べる。
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class MCPRelayAdapter(LLMAdapter):
    """
    MCP Plugin として実装された LLM への汎用ブリッジ。

    Plugin の generate_text / test_connection ツールを呼ぶ。
    """

    def __init__(self, plugin_id: str) -> None:
        self.plugin_id = plugin_id

    async def _ensure_plugin_running(self) -> None:
        """MCP Plugin プロセスを起動（既存 llm_shim と同じロジック）。"""
        from app.services.mcp_hub import mcp_hub
        from app.services.plugin_manager import plugin_manager
        import sys

        if mcp_hub.get_server_status(self.plugin_id) == "running":
            return

        manifest = plugin_manager.get_plugin_manifest(self.plugin_id)
        if not manifest:
            raise RuntimeError(f"プラグイン {self.plugin_id} が見つかりません")

        config = plugin_manager.get_plugin_config(self.plugin_id)

        # 後方互換: ollama-adapter 用の環境変数上書き
        from app.config import settings

        if self.plugin_id == "ollama-adapter":
            config["OLLAMA_MODEL"] = settings.llm_model
            config["OLLAMA_BASE_URL"] = settings.llm_base_url

        command = manifest.get("command", self.plugin_id)
        if command in ("python", "python3"):
            command = sys.executable

        launch_options = {
            "command": command,
            "args": manifest.get("args", []),
            "cwd": str(plugin_manager._plugins_dir / self.plugin_id),
            "env": {
                k: str(v) for k, v in config.items() if isinstance(v, (str, int, float, bool))
            },
        }
        await mcp_hub.start_server(self.plugin_id, launch_options)

    @staticmethod
    def _extract_text(res: Any) -> str:
        """MCP CallToolResult の content[].text を取り出す。"""
        if isinstance(res, dict) and "content" in res and isinstance(res["content"], list):
            return next(
                (item.get("text", "") for item in res["content"] if item.get("type") == "text"),
                "",
            )
        if isinstance(res, dict):
            return res.get("text", "")
        return str(res)

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        await self._ensure_plugin_running()
        from app.services.mcp_hub import mcp_hub

        try:
            res = await mcp_hub.call_tool(
                self.plugin_id,
                "generate_text",
                {"messages": messages, "temperature": kwargs.get("temperature", 0.7)},
            )
            return self._extract_text(res)
        except Exception as e:
            logger.error("[%s] MCP chat failed: %s", self.plugin_id, e)
            raise RuntimeError(f"ローカル LLM での生成に失敗しました: {e}")

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        MCP Plugin が streaming に対応していれば使う、なければ単発を 1 chunk で返す。
        """
        await self._ensure_plugin_running()
        from app.services.mcp_hub import mcp_hub

        full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

        # streaming サポートチェックは Plugin の manifest 次第。
        # 現状は単発呼び出しの結果を 1 chunk として yield。
        try:
            res = await mcp_hub.call_tool(
                self.plugin_id,
                "generate_text",
                {"messages": full_messages, "temperature": kwargs.get("temperature", 0.7)},
            )
            yield self._extract_text(res)
        except Exception as e:
            logger.error("[%s] MCP stream failed: %s", self.plugin_id, e)
            yield f"[エラー: {e}]"

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        await self._ensure_plugin_running()
        from app.services.mcp_hub import mcp_hub

        full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

        try:
            res = await mcp_hub.call_tool(
                self.plugin_id,
                "generate_text",
                {"messages": full_messages, "temperature": 0.1},
            )
            text = self._extract_text(res)
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                return json.loads(text[start : end + 1])
        except Exception as e:
            logger.error("[%s] MCP classify_intent failed: %s", self.plugin_id, e)

        return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        await self._ensure_plugin_running()
        from app.services.mcp_hub import mcp_hub

        prompt = f"{user_prompt}\n\nPlease respond in valid JSON format."
        if json_schema:
            prompt += f"\nSchema: {json.dumps(json_schema)}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]

        try:
            res = await mcp_hub.call_tool(
                self.plugin_id,
                "generate_text",
                {"messages": messages, "temperature": 0.3},
            )
            return self._extract_text(res)
        except Exception as e:
            logger.error("[%s] MCP generate_structured failed: %s", self.plugin_id, e)
            raise RuntimeError(f"ローカル LLM での構造化生成に失敗しました: {e}")

    async def ping(self) -> dict:
        try:
            await self._ensure_plugin_running()
            from app.services.mcp_hub import mcp_hub

            await mcp_hub.call_tool(self.plugin_id, "test_connection", {})
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "message": str(e)}
