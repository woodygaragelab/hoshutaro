"""
SageMaker Adapter（スタブ）— AWS SageMaker Real-time Endpoint 経由で LLM を呼ぶ。

NOTE: 現行プランでは Cloud LLM は CloudProxyAdapter（Lambda llm-proxy 経由、従量課金 API）
を主軸とする方針のため、SageMaker は「自前ホストが必要になった場合の代替」位置付け。

実装すべき内容（必要となった場合）:
  - boto3 sagemaker-runtime クライアント
  - Endpoint への InvokeEndpoint / InvokeEndpointWithResponseStream
  - LMI コンテナ（vLLM backend）の API 形式に合わせた payload 整形
"""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class SageMakerAdapter(LLMAdapter):
    """
    SageMaker Real-time Endpoint 経由の LLM アダプタ（スタブ）。

    通常は CloudProxyAdapter を使う。SageMaker はオンプレミス的に LLM を AWS で常駐させたい
    特殊要件向け。
    """

    def __init__(self, spec: dict[str, Any]) -> None:
        self.spec = spec
        self.endpoint_env = spec.get("endpoint_env", "")
        logger.info("SageMakerAdapter initialized (stub) endpoint_env=%s", self.endpoint_env)

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        raise NotImplementedError(
            "SageMakerAdapter is a stub. Use CloudProxyAdapter (Lambda llm-proxy) instead, "
            "unless self-hosted SageMaker is explicitly required."
        )

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        if False:
            yield ""
        raise NotImplementedError("SageMakerAdapter.conversational_stream not implemented yet.")

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        raise NotImplementedError("SageMakerAdapter.classify_intent not implemented yet.")

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        raise NotImplementedError("SageMakerAdapter.generate_structured not implemented yet.")

    async def ping(self) -> dict:
        return {"ok": False, "message": "SageMakerAdapter is a stub."}
