from abc import ABC, abstractmethod
from typing import AsyncGenerator
from app.models.schemas import MaintenanceOperation


class LLMAdapter(ABC):
    """
    LLMアダプターの抽象基底クラス。
    """

    @abstractmethod
    async def chat_structured(
        self,
        messages: list[dict],
        data_context: dict,
    ) -> MaintenanceOperation:
        """
        フェーズ1: データ操作コマンドをJSON構造で取得。
        """

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[dict],
        operation_summary: str,
    ) -> AsyncGenerator[str, None]:
        """
        フェーズ2: 日本語の説明をストリーミングで返す（チャット表示用）。
        """

    @abstractmethod
    async def ping(self) -> dict:
        """
        接続確認 + レイテンシ計測。
        Returns: {"ok": bool, "latency_ms": float}
        """

    @abstractmethod
    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        """
        テキスト生成。LangGraphノードから呼ばれる汎用メソッド。
        """
