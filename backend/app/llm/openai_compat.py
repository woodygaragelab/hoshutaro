import logging
import time
from typing import AsyncGenerator
from openai import AsyncOpenAI
from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class OpenAICompatAdapter(LLMAdapter):
    """
    OpenAI互換APIを使用するLLMアダプター。
    """

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "none",
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        self.model = model
        self._base_url = base_url
        self._api_key = api_key
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)

        # ── ユーザー設定値 ──
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def _generate_text_raw(self, messages: list[dict], temperature: float, max_tokens: int, json_schema: dict | None = None) -> str:
        """各デバイス・API固有のテキスト生成処理"""
        import copy
        current_messages = copy.deepcopy(messages)

        # JSON Schemaが要求されている場合
        if json_schema is not None:
            import json
            schema_str = json.dumps(json_schema, ensure_ascii=False, indent=2)
            schema_instruction = f"\n\n【必須出力フォーマット】\n以下のJSON Schemaに100%従ったJSONのみを出力してください。\n```json\n{schema_str}\n```"
            
            # システムプロンプトの末尾にテキストベースで制約を注入する（汎用互換API向けフォールバック）
            if current_messages and current_messages[0].get("role") == "system":
                current_messages[0]["content"] += schema_instruction
            else:
                current_messages.insert(0, {"role": "system", "content": schema_instruction})
                
        # HACK: 一部のモデル向けRoleマッピング補正をここで行うべきか？
        # base.py で既に role='system' -> 'assistant' の補正を入れている箇所があるので問題なし。
        completion = await self._client.chat.completions.create(
            model=self.model,
            messages=current_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            # response_format は互換サーバー(vLLM等)によっては未対応のため安全にテキストでフォールバック
        )
        return completion.choices[0].message.content or ""

    async def _generate_stream_raw(self, messages: list[dict], temperature: float, max_tokens: int) -> AsyncGenerator[str, None]:
        """各デバイス・API固有のストリーミング生成処理"""
        stream = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def ping(self) -> dict:
        """openai SDK の models.list() で接続確認 + レイテンシ計測"""
        start = time.monotonic()
        try:
            await self._client.models.list()
            ok = True
        except Exception:
            ok = False
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"ok": ok, "latency_ms": latency_ms}
