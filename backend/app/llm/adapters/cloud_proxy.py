"""
Cloud Proxy Adapter — AWS Lambda llm-proxy 経由でクラウド大規模 LLM を呼ぶ
(Track D Sprint 3 Slice B)。

amplify/functions/llm-proxy (PR #67) で deploy された Lambda Function URL に
POST して、Bedrock Runtime API または Anthropic Direct API 経由で応答を得る。

設定:
  spec = {
      "provider": "cloud",
      "model_id": "cloud_claude_3_5_sonnet",
      "endpoint_url": "https://xxx.lambda-url.us-west-2.on.aws/",
      "jwt_token": "<Cognito Access Token>",           # 静的に渡す or
      "jwt_provider": lambda: "<token>",                # コールバックで都度取得
      "timeout": 60.0,
  }

設計判断:
  - Slice 3-A の Lambda handler は本 Sprint 内では **buffered response** を返すため、
    `conversational_stream` は内部で `chat` を呼んで一括 yield する暫定実装にする。
    真の SSE streaming への切替は Slice 3-D で handler 側の
    `awslambda.streamifyResponse` 適用と同時に行う。
  - JWT は adapter 内では取得しない (refresh も含めて呼び出し側の責務)。
    spec["jwt_token"] を **毎回再評価** することで、フロント側が JWT を更新
    していれば adapter は最新トークンを使える。
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator, Callable, Optional

import httpx

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


class CloudProxyAdapter(LLMAdapter):
    """AWS Lambda llm-proxy 経由のクラウド LLM アダプタ。"""

    def __init__(self, spec: dict[str, Any]) -> None:
        self.spec = spec
        self.provider = spec.get("provider", "cloud")
        self.model_id = spec.get("model_id", "")
        self.endpoint_url: Optional[str] = spec.get("endpoint_url")
        self._jwt_token: Optional[str] = spec.get("jwt_token")
        self._jwt_provider: Optional[Callable[[], str]] = spec.get("jwt_provider")
        self.timeout = float(spec.get("timeout", 60.0))
        logger.info(
            "CloudProxyAdapter initialized provider=%s model_id=%s endpoint=%s",
            self.provider,
            self.model_id,
            self.endpoint_url,
        )

    # ------------------------------------------------------------------ private

    def _get_token(self) -> str:
        if self._jwt_provider is not None:
            return self._jwt_provider()
        if self._jwt_token:
            return self._jwt_token
        raise RuntimeError(
            "CloudProxyAdapter: JWT token not configured "
            "(provide spec['jwt_token'] or spec['jwt_provider'])"
        )

    async def _request(self, messages: list[dict], **kwargs: Any) -> dict[str, Any]:
        if not self.endpoint_url:
            raise RuntimeError("CloudProxyAdapter: endpoint_url not configured")

        body = {
            "model": self.model_id,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.1),
            "maxTokens": kwargs.get("max_tokens", 1024),
        }
        headers = {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(self.endpoint_url, json=body, headers=headers)

        if response.status_code != 200:
            try:
                detail = response.json()
            except Exception:  # noqa: BLE001 — fallback raw text
                detail = response.text
            raise RuntimeError(
                f"CloudProxyAdapter: HTTP {response.status_code}: {detail}"
            )

        data = response.json()
        if not data.get("ok"):
            code = data.get("code", "UNKNOWN")
            msg = data.get("message", "unknown error")
            raise RuntimeError(f"CloudProxyAdapter: provider error [{code}]: {msg}")
        return data

    # ------------------------------------------------------------------ public

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        data = await self._request(messages, **kwargs)
        return str(data.get("content", ""))

    async def conversational_stream(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        # Slice 3-A の handler は buffered response。真の SSE は Slice 3-D で切替。
        combined: list[dict] = []
        if system_prompt:
            combined.append({"role": "system", "content": system_prompt})
        combined.extend(messages)
        text = await self.chat(combined, **kwargs)
        yield text

    async def classify_intent(
        self,
        messages: list[dict],
        system_prompt: str,
        **kwargs: Any,
    ) -> dict:
        combined: list[dict] = []
        if system_prompt:
            combined.append({"role": "system", "content": system_prompt})
        combined.extend(messages)
        text = await self.chat(combined, **kwargs)
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError) as e:
            raise RuntimeError(
                f"CloudProxyAdapter.classify_intent: failed to parse JSON: {e}; "
                f"response={text!r}"
            )

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if json_schema:
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "以下の JSON Schema に従って、説明文を付けずに JSON のみを出力してください。\n"
                        f"```json\n{json.dumps(json_schema, ensure_ascii=False)}\n```"
                    ),
                }
            )
        messages.append({"role": "user", "content": user_prompt})

        last_err: Optional[Exception] = None
        for attempt in range(retries + 1):
            try:
                return await self.chat(messages, **kwargs)
            except Exception as e:  # noqa: BLE001 — retry layer
                last_err = e
                logger.warning(
                    "CloudProxyAdapter.generate_structured attempt %d failed: %s",
                    attempt + 1,
                    e,
                )
        assert last_err is not None
        raise last_err

    async def ping(self) -> dict:
        try:
            text = await self.chat(
                [{"role": "user", "content": "ping"}],
                max_tokens=8,
            )
            return {"ok": True, "message": text[:64]}
        except Exception as e:  # noqa: BLE001 — health check should not raise
            return {"ok": False, "message": str(e)}
