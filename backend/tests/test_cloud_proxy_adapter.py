"""
CloudProxyAdapter のユニットテスト (Track D Sprint 3 Slice B)。

httpx.AsyncClient を unittest.mock で差し替えてテスト。respx 等の追加 dep 不要。
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

# Allow `from app...` imports when running from repo root
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.llm.adapters.cloud_proxy import CloudProxyAdapter  # noqa: E402


def _make_adapter(**overrides: Any) -> CloudProxyAdapter:
    spec = {
        "provider": "cloud",
        "model_id": "cloud_claude_3_5_sonnet",
        "endpoint_url": "https://fake.lambda-url.us-west-2.on.aws/",
        "jwt_token": "fake.jwt.token",
        "timeout": 5.0,
    }
    spec.update(overrides)
    return CloudProxyAdapter(spec)


def _mock_async_client(response_status: int, response_json: Any):
    """
    httpx.AsyncClient を async-context-manager として mock。
    """
    response = MagicMock()
    response.status_code = response_status
    response.json.return_value = response_json
    response.text = json.dumps(response_json) if isinstance(response_json, dict) else str(response_json)

    client_instance = AsyncMock()
    client_instance.post = AsyncMock(return_value=response)

    client_cls = MagicMock()
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client_instance)
    cm.__aexit__ = AsyncMock(return_value=None)
    client_cls.return_value = cm
    return client_cls, client_instance


# --------------------------------------------------------------------- chat


def test_chat_returns_content_on_success():
    adapter = _make_adapter()
    client_cls, client_instance = _mock_async_client(
        200,
        {
            "ok": True,
            "model": "cloud_claude_3_5_sonnet",
            "provider": "bedrock",
            "content": "Hello from Bedrock",
            "stopReason": "end_turn",
        },
    )
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(adapter.chat([{"role": "user", "content": "hi"}]))
    assert result == "Hello from Bedrock"
    client_instance.post.assert_awaited_once()
    args, kwargs = client_instance.post.call_args
    assert args[0] == "https://fake.lambda-url.us-west-2.on.aws/"
    assert kwargs["json"]["model"] == "cloud_claude_3_5_sonnet"
    assert kwargs["headers"]["Authorization"] == "Bearer fake.jwt.token"


def test_chat_raises_when_endpoint_url_missing():
    adapter = _make_adapter(endpoint_url=None)
    try:
        asyncio.run(adapter.chat([{"role": "user", "content": "hi"}]))
    except RuntimeError as e:
        assert "endpoint_url not configured" in str(e)
    else:
        raise AssertionError("expected RuntimeError")


def test_chat_raises_when_no_jwt_configured():
    adapter = _make_adapter(jwt_token=None, jwt_provider=None)
    try:
        asyncio.run(adapter.chat([{"role": "user", "content": "hi"}]))
    except RuntimeError as e:
        assert "JWT token not configured" in str(e)
    else:
        raise AssertionError("expected RuntimeError")


def test_chat_uses_jwt_provider_when_token_static_missing():
    received_tokens: list[str] = []
    counter = {"n": 0}

    def provider() -> str:
        counter["n"] += 1
        return f"dynamic.token.{counter['n']}"

    adapter = _make_adapter(jwt_token=None, jwt_provider=provider)
    client_cls, client_instance = _mock_async_client(
        200,
        {"ok": True, "content": "ok"},
    )

    async def capture():
        await adapter.chat([{"role": "user", "content": "1"}])
        await adapter.chat([{"role": "user", "content": "2"}])

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        asyncio.run(capture())

    # provider should be called for each request (no caching)
    for call in client_instance.post.await_args_list:
        received_tokens.append(call.kwargs["headers"]["Authorization"])
    assert received_tokens == ["Bearer dynamic.token.1", "Bearer dynamic.token.2"]


def test_chat_raises_on_http_error_status():
    adapter = _make_adapter()
    client_cls, _ = _mock_async_client(
        401,
        {"ok": False, "code": "UNAUTHORIZED", "message": "認証トークンが無効です。"},
    )
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        try:
            asyncio.run(adapter.chat([{"role": "user", "content": "hi"}]))
        except RuntimeError as e:
            assert "HTTP 401" in str(e)
        else:
            raise AssertionError("expected RuntimeError")


def test_chat_raises_when_response_ok_false():
    adapter = _make_adapter()
    client_cls, _ = _mock_async_client(
        200,
        {"ok": False, "code": "BEDROCK_AND_FALLBACK_FAILED", "message": "両方失敗"},
    )
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        try:
            asyncio.run(adapter.chat([{"role": "user", "content": "hi"}]))
        except RuntimeError as e:
            assert "BEDROCK_AND_FALLBACK_FAILED" in str(e)
            assert "両方失敗" in str(e)
        else:
            raise AssertionError("expected RuntimeError")


# ------------------------------------------------------ conversational_stream


def test_conversational_stream_yields_single_chunk():
    adapter = _make_adapter()
    client_cls, _ = _mock_async_client(
        200,
        {"ok": True, "content": "ストリーミング (buffered)"},
    )

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for chunk in adapter.conversational_stream(
            [{"role": "user", "content": "hi"}],
            system_prompt="You are HOSHUTARO.",
        ):
            chunks.append(chunk)
        return chunks

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        chunks = asyncio.run(collect())
    assert chunks == ["ストリーミング (buffered)"]


# ------------------------------------------------------------ classify_intent


def test_classify_intent_returns_parsed_json():
    adapter = _make_adapter()
    payload = {"intent": "search_assets", "parameters": {"q": "P-101"}, "confidence": 0.92}
    client_cls, _ = _mock_async_client(200, {"ok": True, "content": json.dumps(payload)})
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(
            adapter.classify_intent(
                [{"role": "user", "content": "P-101 を探して"}],
                system_prompt="classifier prompt",
            )
        )
    assert result == payload


def test_classify_intent_raises_on_invalid_json():
    adapter = _make_adapter()
    client_cls, _ = _mock_async_client(200, {"ok": True, "content": "not a json"})
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        try:
            asyncio.run(
                adapter.classify_intent(
                    [{"role": "user", "content": "test"}],
                    system_prompt="",
                )
            )
        except RuntimeError as e:
            assert "failed to parse JSON" in str(e)
        else:
            raise AssertionError("expected RuntimeError")


# ----------------------------------------------------------- generate_structured


def test_generate_structured_includes_schema_hint():
    adapter = _make_adapter()
    schema = {"type": "object", "properties": {"name": {"type": "string"}}}
    client_cls, client_instance = _mock_async_client(
        200, {"ok": True, "content": '{"name":"foo"}'}
    )
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(
            adapter.generate_structured(
                system_prompt="sys",
                user_prompt="give me foo",
                json_schema=schema,
            )
        )
    assert result == '{"name":"foo"}'
    sent_messages = client_instance.post.call_args.kwargs["json"]["messages"]
    # sys + schema hint + user
    assert len(sent_messages) == 3
    assert sent_messages[0]["role"] == "system"
    assert "JSON Schema" in sent_messages[1]["content"]
    assert sent_messages[2]["role"] == "user"


def test_generate_structured_retries_on_failure():
    adapter = _make_adapter()

    response_ok = MagicMock()
    response_ok.status_code = 200
    response_ok.json.return_value = {"ok": True, "content": "{}"}
    response_ok.text = '{"ok": true, "content": "{}"}'

    client_instance = AsyncMock()
    # 1 回目 RuntimeError、2 回目 成功
    client_instance.post = AsyncMock(side_effect=[RuntimeError("transient"), response_ok])

    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client_instance)
    cm.__aexit__ = AsyncMock(return_value=None)
    client_cls = MagicMock(return_value=cm)

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(
            adapter.generate_structured(
                system_prompt="",
                user_prompt="hi",
                retries=1,
            )
        )
    assert result == "{}"
    assert client_instance.post.await_count == 2


# ---------------------------------------------------- conversational_stream (true SSE)


def _make_streaming_response_mock(status_code: int, sse_lines: list[str]):
    """
    httpx.AsyncClient.stream(...) を mimicする async context manager mock。
    """
    response = MagicMock()
    response.status_code = status_code
    response.aread = AsyncMock(return_value=b"")

    async def aiter_lines():
        for line in sse_lines:
            yield line

    response.aiter_lines = aiter_lines

    stream_cm = MagicMock()
    stream_cm.__aenter__ = AsyncMock(return_value=response)
    stream_cm.__aexit__ = AsyncMock(return_value=None)

    client_instance = AsyncMock()
    client_instance.stream = MagicMock(return_value=stream_cm)

    client_cls_cm = MagicMock()
    client_cls_cm.__aenter__ = AsyncMock(return_value=client_instance)
    client_cls_cm.__aexit__ = AsyncMock(return_value=None)

    client_cls = MagicMock(return_value=client_cls_cm)
    return client_cls, client_instance


def test_conversational_stream_yields_each_chunk_when_streaming_enabled():
    adapter = _make_adapter(streaming=True)
    sse = [
        'data: {"type":"chunk","text":"Hel"}',
        "",
        'data: {"type":"chunk","text":"lo"}',
        "",
        "event: done",
        'data: {"ok":true,"model":"cloud_claude_3_5_sonnet"}',
        "",
    ]
    client_cls, _ = _make_streaming_response_mock(200, sse)

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for c in adapter.conversational_stream(
            [{"role": "user", "content": "hi"}],
            system_prompt="sys",
        ):
            chunks.append(c)
        return chunks

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(collect())
    assert result == ["Hel", "lo"]


def test_conversational_stream_raises_on_error_event():
    adapter = _make_adapter(streaming=True)
    sse = [
        "event: error",
        'data: {"code":"BEDROCK_STREAM_FAILED","message":"Throttled by Bedrock"}',
        "",
    ]
    client_cls, _ = _make_streaming_response_mock(200, sse)

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for c in adapter.conversational_stream(
            [{"role": "user", "content": "hi"}],
            system_prompt="",
        ):
            chunks.append(c)
        return chunks

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        try:
            asyncio.run(collect())
        except RuntimeError as e:
            assert "BEDROCK_STREAM_FAILED" in str(e)
            assert "Throttled by Bedrock" in str(e)
        else:
            raise AssertionError("expected RuntimeError")


def test_conversational_stream_raises_on_http_error_when_streaming():
    adapter = _make_adapter(streaming=True)
    client_cls, _ = _make_streaming_response_mock(401, [])

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for c in adapter.conversational_stream(
            [{"role": "user", "content": "hi"}],
            system_prompt="",
        ):
            chunks.append(c)
        return chunks

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        try:
            asyncio.run(collect())
        except RuntimeError as e:
            assert "HTTP 401" in str(e)
        else:
            raise AssertionError("expected RuntimeError")


def test_conversational_stream_skips_non_chunk_messages():
    """`type` が 'chunk' でない data line は無視される (将来の拡張に備えて defensive)。"""
    adapter = _make_adapter(streaming=True)
    sse = [
        'data: {"type":"meta","info":"warmup"}',
        "",
        'data: {"type":"chunk","text":"actual"}',
        "",
        "event: done",
        'data: {"ok":true}',
        "",
    ]
    client_cls, _ = _make_streaming_response_mock(200, sse)

    async def collect() -> list[str]:
        chunks: list[str] = []
        async for c in adapter.conversational_stream(
            [{"role": "user", "content": "hi"}],
            system_prompt="",
        ):
            chunks.append(c)
        return chunks

    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(collect())
    assert result == ["actual"]


# ------------------------------------------------------------------- ping


def test_ping_returns_ok_true_on_successful_chat():
    adapter = _make_adapter()
    client_cls, _ = _mock_async_client(200, {"ok": True, "content": "pong"})
    with patch("app.llm.adapters.cloud_proxy.httpx.AsyncClient", client_cls):
        result = asyncio.run(adapter.ping())
    assert result == {"ok": True, "message": "pong"}


def test_ping_returns_ok_false_when_chat_raises():
    adapter = _make_adapter(endpoint_url=None)
    result = asyncio.run(adapter.ping())
    assert result["ok"] is False
    assert "endpoint_url not configured" in result["message"]


# Allow `python backend/tests/test_cloud_proxy_adapter.py` direct execution
if __name__ == "__main__":
    test_chat_returns_content_on_success()
    test_chat_raises_when_endpoint_url_missing()
    test_chat_raises_when_no_jwt_configured()
    test_chat_uses_jwt_provider_when_token_static_missing()
    test_chat_raises_on_http_error_status()
    test_chat_raises_when_response_ok_false()
    test_conversational_stream_yields_single_chunk()
    test_conversational_stream_yields_each_chunk_when_streaming_enabled()
    test_conversational_stream_raises_on_error_event()
    test_conversational_stream_raises_on_http_error_when_streaming()
    test_conversational_stream_skips_non_chunk_messages()
    test_classify_intent_returns_parsed_json()
    test_classify_intent_raises_on_invalid_json()
    test_generate_structured_includes_schema_hint()
    test_generate_structured_retries_on_failure()
    test_ping_returns_ok_true_on_successful_chat()
    test_ping_returns_ok_false_when_chat_raises()
    print("All cloud_proxy adapter tests passed.")
