"""
LLM レジストリ + 解決ロジック。

設計方針（CONCEPTS.md / プラン参照）:
  - LLM_MODELS は本ファイルでコード管理（独立 YAML は作らない）
  - Skill 定義の preferred_model / fallback_models から resolve() で実 adapter を取得
  - 「MoE Router」のような独立コンポーネントは作らない（YAGNI）
  - APP_MODE（local | cloud）に応じて利用可能モデルが変わる

ローカル LLM はプロジェクトの確定方針として Gemma 4 E2B-it（OpenVINO）一本化。
クラウド LLM は AWS Bedrock 経由 Claude（cloud_proxy）のみ。
旧 Gemini / SageMaker / Qwen の登録は削除（プラン WS1-4）。
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from app.llm.base import LLMAdapter

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# モデル登録
# ───────────────────────────────────────────────────────────

# MTP drafter のリポジトリは env で上書き可能（プラン WS1-3）。
# 未配置・未設定なら adapter 側で target 単体動作にフォールバック。
_DRAFTER_HF_REPO_DEFAULT = "google/gemma-4-E2B-it-assistant"
_DRAFTER_HF_REPO = os.environ.get(
    "LOCAL_LLM_DRAFTER_HF_REPO", _DRAFTER_HF_REPO_DEFAULT
)


LLM_MODELS: dict[str, dict[str, Any]] = {
    # ─── Local: Project Mu / KASE 用（OpenVINO + Gemma 4 E2B + MTP） ───
    # ターゲット（target）: 本格推論を担うモデル
    # HuggingFace: google/gemma-4-E2B-it
    "local_gemma_4_e2b_it": {
        "adapter": "openvino_gemma",
        "role": "target",                                     # MTP における役割
        "hf_repo": "google/gemma-4-E2B-it",
        "model_dir_env": "LOCAL_LLM_TARGET_MODEL_DIR",
        "supports_thinking": True,
        "supports_kv_cache": True,
        "supports_mtp": True,                                 # Multi-Token Prediction 対応
        "assistant_model_id": "local_gemma_4_e2b_it_assistant",
        "mtp_default_enabled": True,
        "available_in": ["local"],
        "use_case": "Project Mu: マージ判定、ルール蒸留、構造化、意味補完。MTP で最大3倍高速化",
    },
    # MTP drafter（assistant）。単独 chat 用途では使わない。
    "local_gemma_4_e2b_it_assistant": {
        "adapter": "openvino_gemma",
        "role": "drafter",
        "hf_repo": _DRAFTER_HF_REPO,
        "model_dir_env": "LOCAL_LLM_DRAFTER_MODEL_DIR",
        "target_model_id": "local_gemma_4_e2b_it",
        "available_in": ["local"],
        "drafter_only": True,
        "use_case": "MTP drafter（Speculative Decoding 用 assistant）。単体使用は非推奨",
    },
    # 後方互換 alias（旧呼出 local_gemma_4_e2b → local_gemma_4_e2b_it）
    "local_gemma_4_e2b": {
        "adapter": "openvino_gemma",
        "alias_of": "local_gemma_4_e2b_it",
        "available_in": ["local"],
        "use_case": "（旧名、local_gemma_4_e2b_it へのエイリアス）",
    },
    # ─── Bedrock 経由 Claude（cloud_proxy Lambda 用、WS3 ドキュメント整備のみ） ───
    "cloud_claude_3_5_sonnet": {
        "adapter": "cloud_proxy",
        "provider": "bedrock",
        "model_id": "cloud_claude_3_5_sonnet",
        "available_in": ["cloud"],
        "use_case": "高品質な計画立案・対話・構造化出力。Bedrock 経由 Anthropic Claude 3.5 Sonnet",
    },
    "cloud_claude_3_haiku": {
        "adapter": "cloud_proxy",
        "provider": "bedrock",
        "model_id": "cloud_claude_3_haiku",
        "available_in": ["cloud"],
        "use_case": "軽量・高速タスク。Bedrock 経由 Anthropic Claude 3 Haiku",
    },
}


DEFAULT_MODEL = "local_gemma_4_e2b_it"


# ───────────────────────────────────────────────────────────
# 解決ロジック
# ───────────────────────────────────────────────────────────


def _current_app_mode() -> str:
    """APP_MODE を取得（local | cloud）。未設定なら local（デスクトップ前提）。"""
    return os.environ.get("APP_MODE", "local").lower()


def _resolve_alias(model_id: str) -> str:
    """alias_of が定義されているモデルは実体に変換する。"""
    spec = LLM_MODELS.get(model_id)
    if spec and spec.get("alias_of"):
        return spec["alias_of"]
    return model_id


def _is_available(model_id: str) -> bool:
    """モデルが現在の環境で利用可能か判定。"""
    spec = LLM_MODELS.get(model_id)
    if not spec:
        return False
    if spec.get("drafter_only"):
        return False
    available_in = spec.get("available_in", [])
    return _current_app_mode() in available_in


def resolve(
    preferred_model: Optional[str] = None,
    fallback_models: Optional[list[str]] = None,
) -> str:
    """Skill 定義から実際に使うモデル名を解決。"""
    candidates: list[str] = []
    if preferred_model:
        candidates.append(preferred_model)
    if fallback_models:
        candidates.extend(fallback_models)
    candidates.append(DEFAULT_MODEL)

    for model_id in candidates:
        resolved = _resolve_alias(model_id)
        if _is_available(resolved):
            return resolved

    logger.warning(
        "No available LLM model found. preferred=%s, fallback=%s, mode=%s",
        preferred_model,
        fallback_models,
        _current_app_mode(),
    )
    return DEFAULT_MODEL


def get_assistant_model_id(target_model_id: str) -> Optional[str]:
    """MTP 用 drafter モデル ID を取得。"""
    target_id = _resolve_alias(target_model_id)
    spec = LLM_MODELS.get(target_id)
    if not spec or not spec.get("supports_mtp"):
        return None
    assistant_id = spec.get("assistant_model_id")
    if assistant_id and assistant_id in LLM_MODELS:
        return assistant_id
    return None


def is_mtp_enabled_by_default(model_id: str) -> bool:
    """指定モデルが MTP をデフォルトで有効化するか。"""
    resolved = _resolve_alias(model_id)
    spec = LLM_MODELS.get(resolved, {})
    return bool(spec.get("supports_mtp") and spec.get("mtp_default_enabled"))


# ───────────────────────────────────────────────────────────
# Adapter 取得
# ───────────────────────────────────────────────────────────


def get_adapter(model_id: Optional[str] = None, **kwargs: Any) -> LLMAdapter:
    """モデル名から実 adapter インスタンスを取得。"""
    if model_id is None:
        try:
            from app.config import settings

            model_id = getattr(settings, "llm_adapter", None) or DEFAULT_MODEL
        except Exception:
            model_id = DEFAULT_MODEL

    resolved_id = _resolve_alias(model_id)
    spec = LLM_MODELS.get(resolved_id)

    # 未登録モデル名は MCP plugin id とみなす（既存挙動）
    if not spec:
        from app.llm.adapters.mcp_relay import MCPRelayAdapter

        return MCPRelayAdapter(plugin_id=model_id)

    adapter_kind = spec.get("adapter", "")

    if adapter_kind == "openvino_gemma":
        from app.llm.adapters.openvino_gemma import OpenVinoGemmaAdapter

        assistant_spec: Optional[dict[str, Any]] = None
        if spec.get("supports_mtp"):
            assistant_id = spec.get("assistant_model_id")
            if assistant_id:
                assistant_spec = LLM_MODELS.get(assistant_id)
        return OpenVinoGemmaAdapter(spec=spec, assistant_spec=assistant_spec)

    if adapter_kind == "cloud_proxy":
        from app.llm.adapters.cloud_proxy import CloudProxyAdapter

        enriched_spec = {
            **spec,
            "endpoint_url": spec.get("endpoint_url")
                or os.environ.get("LLM_PROXY_URL"),
            "jwt_token": spec.get("jwt_token")
                or os.environ.get("LLM_PROXY_JWT_TOKEN"),
        }
        return CloudProxyAdapter(spec=enriched_spec)

    # フォールバック: MCP plugin として扱う
    from app.llm.adapters.mcp_relay import MCPRelayAdapter

    return MCPRelayAdapter(plugin_id=model_id)
