from abc import ABC, abstractmethod
from typing import AsyncGenerator
from app.models.schemas import MaintenanceOperation


class LLMAdapter(ABC):
    """
    LLMアダプターの抽象基底クラス。

    temperature / max_tokens はLLM設定画面のユーザー設定値を保持する。
    各サブクラスは用途に応じてこれらをベースに調整して使用する。
    """

    temperature: float = 0.7
    max_tokens: int = 2048

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
    async def chat(self, messages: list[dict]) -> str:
        """
        非ストリーミングのチャット補完。テキスト文字列を返す。
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

    @abstractmethod
    async def classify_intent(self, messages: list[dict], system_prompt: str) -> dict:
        """
        Call A: 軽量インテント分類（JSON出力、temp=0.1, max_tokens=256）。
        並列ディスパッチのインテント分類側。
        """

    @abstractmethod
    async def conversational_stream(self, messages: list[dict], system_prompt: str) -> AsyncGenerator[str, None]:
        """
        Call B: リッチ会話ストリーム（性格・ドメイン知識付き、temp=0.7）。
        外部からsystem_promptを注入可能にしたpure_chat_streamの強化版。
        """

    @abstractmethod
    async def completion_report_stream(self, operation_summary: str, context: str = "") -> AsyncGenerator[str, None]:
        """
        エージェント操作完了後の追加報告ストリーム。
        操作結果を自然な言葉で報告する。
        """
