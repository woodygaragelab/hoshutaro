from abc import ABC, abstractmethod
from typing import AsyncGenerator
import logging
from app.models.schemas import MaintenanceOperation
from app.llm.json_utils import ParseError, extract_json_object
from app.llm.prompt_templates import SYSTEM_PROMPT_STREAM, SYSTEM_PROMPT_STRUCTURED, format_data_context

logger = logging.getLogger(__name__)


class LLMAdapter(ABC):
    """
    LLMアダプターの抽象基底クラス。
    
    API呼び出しや推論実行のプリミティブと、JSONリトライやストリームプロンプト構築などの
    高度なビジネスロジック（オーケストレーション）を分離する。
    """

    temperature: float = 0.7
    max_tokens: int = 2048

    # ── ハードウェア固有の抽象プリミティブ ─────────────────────

    @abstractmethod
    async def _generate_text_raw(self, messages: list[dict], temperature: float, max_tokens: int, json_schema: dict | None = None) -> str:
        """各デバイス・API固有のテキスト生成処理"""

    @abstractmethod
    async def _generate_stream_raw(self, messages: list[dict], temperature: float, max_tokens: int) -> AsyncGenerator[str, None]:
        """各デバイス・API固有のストリーミング生成処理"""

    @abstractmethod
    async def ping(self) -> dict:
        """
        接続確認およびレイテンシ測定
        Returns: {"ok": bool, "latency_ms": float, ...}
        """

    # ── 用途別パラメータ算出 ──────────────────────────────────────

    def _structured_params(self) -> dict:
        """構造化JSON出力用: 低temperature"""
        return {
            "temperature": min(self.temperature * 0.2, 0.2),
            "max_tokens": self.max_tokens,
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

    # ── 具象オーケストレーションメソッド ────────────────────────────

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
                raw_output = await self._generate_text_raw(current_messages, **params, json_schema=MaintenanceOperation.model_json_schema())
            except Exception as e:
                logger.error("[base_adapter] call failed %d: %s", attempt, e)
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
        return await self._generate_text_raw(messages, **params)

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
            stream = self._generate_stream_raw(
                messages=[{"role": "user", "content": user_prompt}],
                **params
            )
            async for chunk in stream:
                yield chunk
        except Exception as e:
            logger.error("[base_adapter] stream failed: %s", e)
            yield operation_summary

    async def generate_text(self, prompt: str, max_tokens: int = 0) -> str:
        tok = max_tokens if max_tokens > 0 else self.max_tokens
        return await self._generate_text_raw(
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
            max_tokens=tok
        )

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: dict | None = None,
        max_tokens: int = 0,
        retries: int = 2,
    ) -> str:
        tok = max_tokens if max_tokens > 0 else self.max_tokens
        params = self._structured_params()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        for attempt in range(retries + 1):
            try:
                result = await self._generate_text_raw(messages, temperature=params["temperature"], max_tokens=tok, json_schema=json_schema)
                if result.strip():
                    return result
                logger.warning("[generate_structured] 空レスポンス (attempt %d/%d)", attempt, retries)
                import asyncio
                await asyncio.sleep(1.0)
            except Exception as e:
                logger.error("[generate_structured] エラー (attempt %d/%d): %s", attempt, retries, e)
                if attempt == retries:
                    raise
                import asyncio
                await asyncio.sleep(2.0)
        return ""

    async def classify_intent(self, messages: list[dict], system_prompt: str) -> dict:
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        params = self._classify_params()
        try:
            raw = await self._generate_text_raw(full_messages, **params)
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
        formatted = [{"role": "system", "content": system_prompt}]
        for m in messages:
            role = m.get("role", "user")
            if role == "system":
                role = "assistant"
            formatted.append({"role": role, "content": m.get("content", "")})

        params = self._conversation_params()
        try:
            stream = self._generate_stream_raw(messages=formatted, **params)
            async for chunk in stream:
                yield chunk
        except Exception as e:
            logger.error("[conversational_stream] stream failed: %s", e)
            yield f"[エラー: 通信に失敗しました {e}]"

    async def pure_chat_stream(
        self, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        formatted_msgs = [{"role": "system", "content": "あなたは優秀な保全管理システムのAIアシスタント「HOSHUTARO」です。ユーザーからの質問に親切に答えてください。"}]
        for m in messages:
            role = m.get("role", "user")
            if role == "system":
                role = "assistant"
            formatted_msgs.append({"role": role, "content": m.get("content", "")})

        params = self._conversation_params()
        try:
            stream = self._generate_stream_raw(messages=formatted_msgs, **params)
            async for chunk in stream:
                yield chunk
        except Exception as e:
            logger.error("[base_adapter] pure stream failed: %s", e)
            yield f"[エラー: 通信に失敗しました {e}]"

    async def completion_report_stream(
        self, operation_summary: str, context: str = ""
    ) -> AsyncGenerator[str, None]:
        prompt = (
            "あなたは保全管理AIアシスタントです。操作完了を1〜2文で簡潔に報告してください。\n"
            "ルール: Markdown表や箇条書きは使わない。日付と機器名は省略しない。\n\n"
            f"実行した操作：{operation_summary}\n\n"
            f"完了報告を1〜2文で書いてください。"
        )
        params = self._report_params()
        try:
            stream = self._generate_stream_raw(
                messages=[{"role": "user", "content": prompt}],
                **params
            )
            async for chunk in stream:
                yield chunk
        except Exception as e:
            logger.error("[completion_report_stream] stream failed: %s", e)
            yield operation_summary
