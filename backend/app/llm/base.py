"""
LLMAdapter ABC: 全 LLM Plugin が実装する統一インターフェース。

このクラスは Strategy パターン。Skill / Orchestrator から見ると、
どのプロバイダ（Gemini / OpenVINO / SageMaker / Lambda Proxy）が裏で動いていても
同じ呼び方で使える。

NOTE: 「LLM Adapter」は内部実装パターン名（CONCEPTS.md 参照）。
対外的にはすべて「Plugin (category=llm)」と呼ぶ。
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Any, Optional


class LLMAdapter(ABC):
    """
    LLM プロバイダ向け統一インターフェース。

    実装側は最低限以下を提供する:
      - chat: 単発の chat completion
      - conversational_stream: SSE 用ストリーミング
      - classify_intent: 構造化 intent 分類
      - generate_structured: JSON Schema 準拠の構造化出力
      - ping: ヘルスチェック

    chat_structured は省略可（使うなら Skill 側でスキーマを渡す）。
    """

    @abstractmethod
    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        """
        単発の chat completion。

        Args:
            messages: [{"role": "system|user|assistant", "content": str}, ...]
            **kwargs: temperature, max_tokens 等のプロバイダ別オプション

        Returns:
            アシスタントの応答テキスト
        """
        ...

    @abstractmethod
    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        会話ストリーミング（Call B）。SSE 経由でフロントへ送る。

        Args:
            messages: 会話履歴 + 最新ユーザーメッセージ
            system_prompt: rich_prompt（CONVERSATIONAL_SYSTEM_PROMPT を data_context で format したもの）

        Yields:
            chunk テキスト
        """
        # AsyncGenerator なので yield の例示として
        if False:
            yield ""
        ...

    @abstractmethod
    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        """
        Intent 分類（Call A、軽量・JSON 出力）。

        Args:
            messages: 会話履歴 + 最新ユーザーメッセージ
            system_prompt: classifier_prompt（CLASSIFIER_SYSTEM_PROMPT を format したもの）

        Returns:
            {"intent": str, "parameters": dict, "confidence": float}
            失敗時は呼び出し側で fallback する想定（adapter 自身は raise）
        """
        ...

    @abstractmethod
    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        """
        JSON Schema 準拠の構造化出力。

        Args:
            system_prompt: システムプロンプト
            user_prompt: ユーザープロンプト
            json_schema: 出力スキーマ（プロバイダが対応していれば強制）
            retries: 失敗時の再試行回数

        Returns:
            JSON 文字列（呼び出し側でパースする）
        """
        ...

    @abstractmethod
    async def ping(self) -> dict:
        """
        ヘルスチェック。

        Returns:
            {"ok": bool, "message": str (optional)}
        """
        ...

    async def chat_structured(
        self,
        messages: list[dict],
        data_context: dict,
        **kwargs: Any,
    ) -> Any:
        """
        構造化された MaintenanceOperation 等の生成（既存 agent.py 互換）。

        デフォルト実装: generate_structured を使う。
        プロバイダ固有の最適化があればオーバーライド。
        """
        from app.models.schemas import MaintenanceOperation

        # 既存の agent.py:reasoning_node の挙動に合わせて
        # 呼び出し側は MaintenanceOperation を受け取る想定。
        # デフォルトは generate_structured で JSON を生成し、
        # MaintenanceOperation でパースする。
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        system_messages = [m["content"] for m in messages if m.get("role") == "system"]
        system_prompt = "\n\n".join(system_messages) if system_messages else ""

        json_text = await self.generate_structured(
            system_prompt=system_prompt,
            user_prompt=last_user,
            json_schema=MaintenanceOperation.model_json_schema(),
            **kwargs,
        )

        import json

        try:
            data = json.loads(json_text)
            return MaintenanceOperation(**data)
        except Exception as e:
            raise RuntimeError(f"chat_structured: failed to parse MaintenanceOperation: {e}")
