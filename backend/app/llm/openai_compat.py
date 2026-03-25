import logging
import time
from typing import AsyncGenerator
from openai import AsyncOpenAI
from app.llm.base import LLMAdapter
from app.llm.json_utils import ParseError, extract_json_object
from app.llm.prompt_templates import SYSTEM_PROMPT_STREAM, SYSTEM_PROMPT_STRUCTURED, format_data_context
from app.models.schemas import MaintenanceOperation

logger = logging.getLogger(__name__)

class OpenAICompatAdapter(LLMAdapter):
    def __init__(self, base_url: str, model: str, api_key: str = "none"):
        self.model = model
        self._base_url = base_url
        self._api_key = api_key
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def chat_structured(
        self, messages: list[dict], data_context: dict
    ) -> MaintenanceOperation:
        instructions = SYSTEM_PROMPT_STRUCTURED
        ctx = format_data_context(data_context)
        if ctx:
            instructions += "\n\n## 現在のデータ\n" + ctx

        sys_msg = [{"role": "system", "content": instructions}]
        current_messages = sys_msg + messages

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                result = await self._client.chat.completions.create(
                    model=self.model,
                    messages=current_messages,
                    temperature=0.1,
                    max_tokens=1024,
                )
                raw_output = result.choices[0].message.content or ""
            except Exception as e:
                logger.error("[openai_compat] call failed %d: %s", attempt, e)
                return MaintenanceOperation(
                    type="explain_only",
                    targets=[],
                    action_summary=f"LLM接続失敗: {str(e)[:120]}"
                )

            try:
                data = extract_json_object(raw_output)
                return MaintenanceOperation(**data)
            except ParseError as e:
                if attempt < max_retries:
                    current_messages.append({"role": "assistant", "content": raw_output})
                    current_messages.append({"role": "user", "content": f"JSON解析失敗: {e}. 修正してください。"})
                    continue
                else:
                    return MaintenanceOperation(
                        type="explain_only", targets=[], action_summary="JSON解析失敗"
                    )
            except Exception as e:
                return MaintenanceOperation(
                    type="explain_only", targets=[], action_summary=f"操作構築失敗: {str(e)[:120]}"
                )
        return MaintenanceOperation(type="explain_only", targets=[], action_summary="予期しないエラー")

    async def chat_stream(
        self, messages: list[dict], operation_summary: str
    ) -> AsyncGenerator[str, None]:
        last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        user_prompt = (
            f"{SYSTEM_PROMPT_STREAM}\n\n"
            f"ユーザーの指示：「{last_user_msg}」\n"
            f"システムが実行した操作内容：{operation_summary}\n\n"
            f"完了したことを親切に報告してください。"
        )

        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": user_prompt}],
                stream=True,
                temperature=0.7,
                max_tokens=256
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("[openai_compat] stream failed: %s", e)
            yield operation_summary

    async def ping(self) -> dict:
        start = time.monotonic()
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/models")
                ok = resp.status_code == 200
        except Exception:
            ok = False
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"ok": ok, "latency_ms": latency_ms}

    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        completion = await self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=max_tokens,
        )
        return completion.choices[0].message.content or ""
