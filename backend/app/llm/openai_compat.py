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
    """
    OpenAI互換APIを使用するLLMアダプター。

    temperature / max_tokens はLLM設定画面のユーザー設定値をベースとし、
    用途に応じて調整する:
      - 構造化出力 (JSON): temp を低く抑える (base * 0.15 相当, 最大0.2)
      - 会話ストリーム: base をそのまま使用
      - 分類: temp を極低に (固定0.1)、tokens を抑制 (base * 0.125)
      - 完了報告: base を使用、tokens を抑制 (base * 0.125)
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

        # ── ユーザー設定値（LLM設定画面から変更可能）──
        self.temperature = temperature
        self.max_tokens = max_tokens

    # ── 用途別パラメータ算出 ──────────────────────────────────────

    def _structured_params(self) -> dict:
        """構造化JSON出力用: 低temperature、中tokens"""
        return {
            "temperature": min(self.temperature * 0.2, 0.2),
            "max_tokens": max(min(self.max_tokens // 2, 1024), 256),
        }

    def _conversation_params(self) -> dict:
        """会話ストリーム用: ユーザー設定をそのまま使用"""
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

    def _classify_params(self) -> dict:
        """インテント分類用: 極低temperature、小tokens"""
        return {
            "temperature": min(self.temperature * 0.15, 0.15),
            "max_tokens": max(self.max_tokens // 8, 256),
        }

    def _report_params(self) -> dict:
        """完了報告用: ユーザー設定temperature、小tokens"""
        return {
            "temperature": self.temperature,
            "max_tokens": max(self.max_tokens // 8, 256),
        }

    # ── 既存メソッド ─────────────────────────────────────────────

    async def chat_structured(
        self, messages: list[dict], data_context: dict
    ) -> MaintenanceOperation:
        instructions = SYSTEM_PROMPT_STRUCTURED
        ctx = format_data_context(data_context)
        if ctx:
            instructions += "\n\n## 現在のデータ\n" + ctx

        sys_msg = [{"role": "system", "content": instructions}]
        current_messages = sys_msg + messages
        params = self._structured_params()

        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                result = await self._client.chat.completions.create(
                    model=self.model,
                    messages=current_messages,
                    **params,
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

    async def chat(self, messages: list[dict]) -> str:
        params = self._structured_params()
        completion = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            **params,
        )
        return completion.choices[0].message.content or ""

    async def chat_stream(
        self, messages: list[dict], operation_summary: str
    ) -> AsyncGenerator[str, None]:
        last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        user_prompt = (
            f"{SYSTEM_PROMPT_STREAM}\n\n"
            f"ユーザーの指示：「{last_user_msg}」\n"
            f"システムが実行した操作内容（またはAIからの提案詳細）：{operation_summary}\n\n"
            f"完了したことを親切に報告してください。その際、必ず操作内容に含まれる『具体的な日付』や『対象機器』などの重要な詳細は省略せずに回答に含めてください。"
        )
        params = self._report_params()

        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": user_prompt}],
                stream=True,
                **params,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("[openai_compat] stream failed: %s", e)
            yield operation_summary

    async def pure_chat_stream(
        self, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        """純粋な会話ストリーム（プロンプト上書きなし）"""
        formatted_msgs = [{"role": "system", "content": "あなたは優秀な保全管理システムのAIアシスタント「HOSHUTARO」です。ユーザーからの質問に親切に答えてください。"}]
        for m in messages:
            role = m.get("role", "user")
            if role == "system":
                role = "assistant"
            formatted_msgs.append({"role": role, "content": m.get("content", "")})

        params = self._conversation_params()
        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=formatted_msgs,
                stream=True,
                **params,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("[openai_compat] pure stream failed: %s", e)
            yield f"[エラー: 通信に失敗しました {e}]"

    async def ping(self) -> dict:
        """openai SDK の models.list() で接続確認 + レイテンシ計測"""
        start = time.monotonic()
        try:
            models = await self._client.models.list()
            ok = True
        except Exception:
            ok = False
        latency_ms = round((time.monotonic() - start) * 1000, 2)
        return {"ok": ok, "latency_ms": latency_ms}

    async def generate_text(self, prompt: str, max_tokens: int = 0) -> str:
        tok = max_tokens if max_tokens > 0 else self.max_tokens
        completion = await self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=tok,
        )
        return completion.choices[0].message.content or ""

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 0,
        retries: int = 2,
    ) -> str:
        """
        構造化JSON出力用: system/user分離 + リトライ付き。
        ローカルLLMで空レスポンスが返る場合に自動リトライする。
        """
        tok = max_tokens if max_tokens > 0 else self.max_tokens
        params = self._structured_params()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        for attempt in range(retries + 1):
            try:
                logger.info(
                    "[generate_structured] attempt=%d, system=%d chars, user=%d chars, max_tokens=%d",
                    attempt, len(system_prompt), len(user_prompt), tok,
                )
                completion = await self._client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=params["temperature"],
                    max_tokens=tok,
                )
                result = completion.choices[0].message.content or ""
                if result.strip():
                    return result
                logger.warning("[generate_structured] 空レスポンス (attempt %d/%d)", attempt, retries)
            except Exception as e:
                logger.error("[generate_structured] エラー (attempt %d/%d): %s", attempt, retries, e)
                if attempt == retries:
                    raise

        return ""

    # ── 会話型ディスパッチャー用メソッド ──────────────────────────

    async def classify_intent(self, messages: list[dict], system_prompt: str) -> dict:
        """Call A: 軽量インテント分類（JSON出力）"""
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        params = self._classify_params()
        try:
            result = await self._client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                **params,
            )
            raw = result.choices[0].message.content or ""
            logger.info("[classify_intent] raw LLM output: %s", raw[:300])
            try:
                return extract_json_object(raw)
            except ParseError:
                logger.warning("[classify_intent] JSON parse failed, falling back to converse: %s", raw[:200])
                return {"intent": "converse", "parameters": {}, "confidence": 0.0}
        except Exception as e:
            logger.error("[classify_intent] LLM call failed: %s", e)
            return {"intent": "converse", "parameters": {}, "confidence": 0.0}

    async def conversational_stream(
        self, messages: list[dict], system_prompt: str
    ) -> AsyncGenerator[str, None]:
        """Call B: リッチ会話ストリーム（外部system prompt注入）"""
        formatted = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role = m.get("role", "user")
            if role == "system":
                role = "assistant"
            formatted.append({"role": role, "content": m.get("content", "")})

        params = self._conversation_params()
        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=formatted,
                stream=True,
                **params,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("[conversational_stream] stream failed: %s", e)
            yield f"[エラー: 通信に失敗しました {e}]"

    async def completion_report_stream(
        self, operation_summary: str, context: str = ""
    ) -> AsyncGenerator[str, None]:
        """エージェント操作完了後の追加報告ストリーム"""
        prompt = (
            "あなたは保全管理AIアシスタントです。操作完了を1〜2文で簡潔に報告してください。\n"
            "ルール: Markdown表や箇条書きは使わない。日付と機器名は省略しない。\n\n"
            f"実行した操作：{operation_summary}\n\n"
            f"完了報告を1〜2文で書いてください。"
        )
        params = self._report_params()
        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                **params,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("[completion_report_stream] stream failed: %s", e)
            yield operation_summary
