"""
LLM registry の Cloud models / cloud_proxy adapter dispatch のテスト
(Track D Sprint 3 Slice C)。

Sprint 3 で追加した cloud_claude_3_5_sonnet / cloud_claude_3_haiku の resolve、
get_adapter 経由の CloudProxyAdapter 生成、env からの endpoint_url / jwt_token
補完を検証する。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.llm import registry  # noqa: E402
from app.llm.adapters.cloud_proxy import CloudProxyAdapter  # noqa: E402


# ----------------------------------------------------- LLM_MODELS catalog


def test_cloud_claude_3_5_sonnet_is_registered():
    spec = registry.LLM_MODELS.get("cloud_claude_3_5_sonnet")
    assert spec is not None, "cloud_claude_3_5_sonnet must be registered"
    assert spec["adapter"] == "cloud_proxy"
    assert spec["provider"] == "bedrock"
    # model_id は Lambda 側 BEDROCK_MODEL_MAP のキーと一致する必要がある
    assert spec["model_id"] == "cloud_claude_3_5_sonnet"
    assert "local" in spec["available_in"]


def test_cloud_claude_3_haiku_is_registered():
    spec = registry.LLM_MODELS.get("cloud_claude_3_haiku")
    assert spec is not None
    assert spec["adapter"] == "cloud_proxy"
    assert spec["model_id"] == "cloud_claude_3_haiku"


# ----------------------------------------------------- resolve()


def test_resolve_picks_cloud_claude_when_preferred():
    with patch.dict(os.environ, {"APP_MODE": "local"}, clear=False):
        result = registry.resolve(
            preferred_model="cloud_claude_3_5_sonnet",
            fallback_models=[],
        )
    assert result == "cloud_claude_3_5_sonnet"


def test_resolve_falls_back_to_default_for_unknown_model():
    with patch.dict(os.environ, {"APP_MODE": "local"}, clear=False):
        result = registry.resolve(
            preferred_model="no_such_model_xyz",
            fallback_models=["another_missing"],
        )
    assert result == registry.DEFAULT_MODEL


def test_resolve_skips_unavailable_drafter_only_models():
    # drafter_only=True のモデルは _is_available で弾かれる
    with patch.dict(os.environ, {"APP_MODE": "local"}, clear=False):
        result = registry.resolve(
            preferred_model="local_gemma_4_e2b_it_assistant",
            fallback_models=["cloud_claude_3_5_sonnet"],
        )
    assert result == "cloud_claude_3_5_sonnet"


# ----------------------------------------------------- get_adapter()


def test_get_adapter_returns_cloud_proxy_adapter_for_claude():
    with patch.dict(
        os.environ,
        {
            "LLM_PROXY_URL": "https://test.lambda-url.us-west-2.on.aws/",
            "LLM_PROXY_JWT_TOKEN": "test.jwt.token",
        },
        clear=False,
    ):
        adapter = registry.get_adapter("cloud_claude_3_5_sonnet")
    assert isinstance(adapter, CloudProxyAdapter)
    assert adapter.model_id == "cloud_claude_3_5_sonnet"
    assert adapter.endpoint_url == "https://test.lambda-url.us-west-2.on.aws/"
    # _jwt_token は private だが、CloudProxyAdapter は spec から読み取るので
    # 内部状態は spec 経由で間接的に検証する
    assert adapter.spec["jwt_token"] == "test.jwt.token"


def test_get_adapter_spec_endpoint_overrides_env_var():
    """spec で明示的な endpoint_url が渡された場合は env よりも優先される (test seam)。"""
    # registry.get_adapter() は LLM_MODELS から spec を読むので、ここでは
    # 直接 CloudProxyAdapter に渡したときに spec 優先が効くことを確認する。
    spec = {
        "endpoint_url": "https://explicit.example.com/",
        "jwt_token": "explicit.token",
        "model_id": "cloud_claude_3_haiku",
    }
    with patch.dict(
        os.environ,
        {
            "LLM_PROXY_URL": "https://env.example.com/",
            "LLM_PROXY_JWT_TOKEN": "env.token",
        },
        clear=False,
    ):
        # registry の enriched_spec のロジックを模倣 (spec 優先)
        enriched = {
            **spec,
            "endpoint_url": spec.get("endpoint_url")
                or os.environ.get("LLM_PROXY_URL"),
            "jwt_token": spec.get("jwt_token")
                or os.environ.get("LLM_PROXY_JWT_TOKEN"),
        }
        adapter = CloudProxyAdapter(spec=enriched)
    assert adapter.endpoint_url == "https://explicit.example.com/"
    assert adapter.spec["jwt_token"] == "explicit.token"


def test_get_adapter_uses_env_when_spec_lacks_endpoint():
    # LLM_MODELS の cloud_claude_3_5_sonnet は endpoint_url を持たないので
    # env からの補完が走る経路を検証する。
    with patch.dict(
        os.environ,
        {
            "LLM_PROXY_URL": "https://env-only.lambda-url.us-west-2.on.aws/",
            "LLM_PROXY_JWT_TOKEN": "env-only-token",
        },
        clear=False,
    ):
        adapter = registry.get_adapter("cloud_claude_3_haiku")
    assert isinstance(adapter, CloudProxyAdapter)
    assert adapter.endpoint_url == "https://env-only.lambda-url.us-west-2.on.aws/"
    assert adapter.spec["jwt_token"] == "env-only-token"


# Allow `python core/tests/test_llm_registry_cloud.py` direct execution
if __name__ == "__main__":
    test_cloud_claude_3_5_sonnet_is_registered()
    test_cloud_claude_3_haiku_is_registered()
    test_resolve_picks_cloud_claude_when_preferred()
    test_resolve_falls_back_to_default_for_unknown_model()
    test_resolve_skips_unavailable_drafter_only_models()
    test_get_adapter_returns_cloud_proxy_adapter_for_claude()
    test_get_adapter_spec_endpoint_overrides_env_var()
    test_get_adapter_uses_env_when_spec_lacks_endpoint()
    print("All llm_registry cloud tests passed.")
