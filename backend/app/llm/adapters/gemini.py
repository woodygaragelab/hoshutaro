"""
Gemini Adapter — 既存の GeminiClient を LLMAdapter インターフェースでラップ。

後方互換のため、既存の `app.services.gemini_client.gemini_client` をそのまま使う。
新規開発で Gemini を直接呼ぶ場合は CloudProxyAdapter（Lambda llm-proxy 経由）を推奨。
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class GeminiAdapter(LLMAdapter):
    """
    既存 GeminiClient をラップ。

    NOTE: GeminiClient は `app.services.gemini_client` に存在する。
    このアダプタは「既存機能の後方互換」のためであり、本格的な機能拡張は
    CloudProxyAdapter（Lambda 経由）で行う。
    """

    def __init__(self) -> None:
        # 遅延 import（循環参照回避 + 起動時 Gemini API key 検証を遅延）
        self._client = None

    def _get_client(self):
        if self._client is None:
            from app.services.gemini_client import gemini_client

            self._client = gemini_client
        return self._client

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        client = self._get_client()
        prompt = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages
        )
        return await client.generate_text(prompt)

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        Gemini のストリーミング応答。

        既存 GeminiClient に streaming API がない場合は単発呼び出しの結果を chunk として yield する。
        Track B で本格的なストリーミング対応に拡張予定。
        """
        client = self._get_client()
        prompt = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages
        )

        # 既存 GeminiClient に streaming があれば使う、なければフォールバック
        if hasattr(client, "stream_text"):
            async for chunk in client.stream_text(prompt, system_instruction=system_prompt):
                yield chunk
        else:
            text = await client.generate_text(prompt, system_instruction=system_prompt)
            # 単発呼び出しを 1 chunk として yield
            yield text

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        client = self._get_client()
        prompt = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages
        )

        raw = await client.generate_text(prompt, system_instruction=system_prompt)

        # JSON抽出（既存 llm_shim と同様のナイーブ抽出）
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                return json.loads(raw[start : end + 1])
        except Exception as e:
            logger.error("classify_intent: JSON parse failed: %s", e)

        # フォールバック
        return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        client = self._get_client()
        prompt = f"{user_prompt}\n\nPlease respond in valid JSON format."
        if json_schema:
            prompt += f"\nSchema: {json.dumps(json_schema)}"

        return await client.generate_text(prompt, system_instruction=system_prompt)

    async def ping(self) -> dict:
        client = self._get_client()
        try:
            return await client.test_connection()
        except Exception as e:
            return {"ok": False, "message": str(e)}
