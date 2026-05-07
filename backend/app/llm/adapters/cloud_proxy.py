"""
Cloud Proxy Adapter（スタブ）— AWS Lambda llm-proxy 経由で外部 LLM API を呼ぶ。

Track D（AWS Cloud + 認証 + 繋ぎ層）で本格実装予定。

実装すべき内容（プラン参照）:
  - apps/lambdas/llm-proxy への HTTPS リクエスト（JWT 認証）
  - provider 別ルーティング（google_ai_studio / dashscope / together_ai / bedrock）
  - SSE レスポンス受信（Lambda Function URL Response Streaming）
  - Context Caching API 統合（Gemini Pro 等）
  - レート制限・リトライ
"""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class CloudProxyAdapter(LLMAdapter):
    """
    AWS Lambda llm-proxy 経由のクラウド LLM アダプタ（Track D で実装）。

    現状はスタブ。
    """

    def __init__(self, spec: dict[str, Any]) -> None:
        self.spec = spec
        self.provider = spec.get("provider", "")
        self.model_id = spec.get("model_id", "")
        logger.info(
            "CloudProxyAdapter initialized (stub) provider=%s, model_id=%s",
            self.provider,
            self.model_id,
        )

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        raise NotImplementedError(
            "CloudProxyAdapter is a stub. Will be implemented in Track D (Cloud + 繋ぎ層)."
        )

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        if False:
            yield ""
        raise NotImplementedError("CloudProxyAdapter.conversational_stream not implemented yet.")

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        raise NotImplementedError("CloudProxyAdapter.classify_intent not implemented yet.")

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        raise NotImplementedError("CloudProxyAdapter.generate_structured not implemented yet.")

    async def ping(self) -> dict:
        return {
            "ok": False,
            "message": "CloudProxyAdapter is a stub. Track D implementation pending.",
        }
