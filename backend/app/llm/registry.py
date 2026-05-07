"""
LLM レジストリ + 解決ロジック。

設計方針（CONCEPTS.md / プラン参照）:
  - LLM_MODELS は本ファイルでコード管理（独立 YAML は作らない）
  - Skill 定義の preferred_model / fallback_models から resolve() で実 adapter を取得
  - 「MoE Router」のような独立コンポーネントは作らない（YAGNI）
  - APP_MODE（local | cloud）に応じて利用可能モデルが変わる
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

LLM_MODELS: dict[str, dict[str, Any]] = {
    # ─── Local: Project Mu / KASE 用（OpenVINO + Gemma 4 E2B + MTP） ───
    # ターゲット（target）: 本格推論を担うモデル
    # HuggingFace: google/gemma-4-E2B-it
    #   - base 版（google/gemma-4-E2B、無印）は事前学習のみで instruction following が弱く、
    #     HOSHUTARO のフェーズ1（Thinking）/フェーズ2（JSON 出力）/フェーズ3（連想推論）
    #     全てで品質不足のため採用しない。詳細は docs/PROJECT_MU.md を参照。
    #   - 配布方式: 初回起動時に HuggingFace Hub から ~/.hoshutaro/models/ にダウンロード
    #     （Tauri 本体には同梱しない）
    "local_gemma_4_e2b_it": {
        "adapter": "openvino_gemma",
        "role": "target",                                     # MTP における役割
        "hf_repo": "google/gemma-4-E2B-it",
        "model_dir_env": "LOCAL_LLM_TARGET_MODEL_DIR",
        "supports_thinking": True,
        "supports_kv_cache": True,
        "supports_mtp": True,                                 # ★ Multi-Token Prediction 対応
        "assistant_model_id": "local_gemma_4_e2b_it_assistant",  # ★ MTP drafter（assistant）参照
        "mtp_default_enabled": True,                          # ★ デフォルトで MTP 有効
        "available_in": ["local"],
        "use_case": "Project Mu: マージ判定、ルール蒸留、構造化、意味補完。MTP で最大3倍高速化",
    },
    # MTP drafter（assistant）: ターゲットの推論を加速する 4-layer 軽量モデル
    # HuggingFace: google/gemma-4-E2B-it-assistant
    # 単独 chat 用途では使わない（生成品質はターゲットが保証）。
    "local_gemma_4_e2b_it_assistant": {
        "adapter": "openvino_gemma",
        "role": "drafter",                                    # MTP drafter（assistant）役
        "hf_repo": "google/gemma-4-E2B-it-assistant",
        "model_dir_env": "LOCAL_LLM_DRAFTER_MODEL_DIR",
        "target_model_id": "local_gemma_4_e2b_it",
        "available_in": ["local"],
        "drafter_only": True,                                 # ★ resolve() で単体選択不可にするフラグ
        "use_case": "MTP drafter（Speculative Decoding 用 assistant）。単体使用は非推奨",
    },
    # 後方互換: 既存呼び出し（local_gemma_4_e2b）が壊れないよう alias を残す
    # 内部では local_gemma_4_e2b_it を指す
    "local_gemma_4_e2b": {
        "adapter": "openvino_gemma",
        "alias_of": "local_gemma_4_e2b_it",
        "available_in": ["local"],
        "use_case": "（旧名、local_gemma_4_e2b_it へのエイリアス。Track C で削除予定）",
    },
    "local_qwen2_2b_openvino": {
        "adapter": "openvino_qwen",
        "model_dir_env": "LOCAL_QWEN_MODEL_DIR",
        "available_in": ["local"],
        "use_case": "Gemma 4 E2B fallback",
    },
    # ─── 既存ビルトイン: Gemini API（直接呼び出し） ───
    "gemini": {
        "adapter": "gemini",
        "model_id_env": "GEMINI_MODEL",
        "available_in": ["local", "cloud"],
        "use_case": "既存ビルトイン、後方互換",
    },
    # ─── Cloud Proxy: Lambda llm-proxy 経由（従量課金 API） ───
    "cloud_gemini_pro": {
        "adapter": "cloud_proxy",
        "provider": "google_ai_studio",
        "model_id": "gemini-2.5-pro",
        "available_in": ["local", "cloud"],
        "use_case": "計画立案、対話調整、説明生成",
        "supports_context_caching": True,
    },
    "cloud_gemini_flash": {
        "adapter": "cloud_proxy",
        "provider": "google_ai_studio",
        "model_id": "gemini-1.5-flash",
        "available_in": ["local", "cloud"],
        "use_case": "ローカル LLM フォールバック、軽量タスク",
    },
    "cloud_qwen3_plus": {
        "adapter": "cloud_proxy",
        "provider": "dashscope",
        "model_id": "qwen3-plus",
        "available_in": ["local", "cloud"],
        "use_case": "計画立案（日本語特化）",
    },
    # ─── SageMaker（自前ホスト時のみ） ───
    "sagemaker_qwen35_a3b": {
        "adapter": "sagemaker",
        "endpoint_env": "SAGEMAKER_QWEN_A3B_ENDPOINT",
        "available_in": ["cloud"],
        "use_case": "SageMaker 自前ホスト時の代替",
    },
}


DEFAULT_MODEL = "gemini"  # 後方互換: 既存 .env の LLM_ADAPTER=gemini と整合


# ───────────────────────────────────────────────────────────
# 解決ロジック
# ───────────────────────────────────────────────────────────


def _current_app_mode() -> str:
    """APP_MODE を取得（local | cloud）。未設定なら local とみなす（Tauri デスクトップ前提）。"""
    return os.environ.get("APP_MODE", "local").lower()


def _resolve_alias(model_id: str) -> str:
    """alias_of が定義されているモデルは実体に変換する（後方互換）。"""
    spec = LLM_MODELS.get(model_id)
    if spec and spec.get("alias_of"):
        return spec["alias_of"]
    return model_id


def _is_available(model_id: str) -> bool:
    """モデルが現在の環境で利用可能か判定。"""
    spec = LLM_MODELS.get(model_id)
    if not spec:
        return False
    # drafter_only モデルは単体選択不可（target からのみ参照）
    if spec.get("drafter_only"):
        return False
    available_in = spec.get("available_in", [])
    return _current_app_mode() in available_in


def resolve(
    preferred_model: Optional[str] = None,
    fallback_models: Optional[list[str]] = None,
) -> str:
    """
    Skill 定義の preferred_model / fallback_models から、現環境で利用可能なモデルを解決。

    Args:
        preferred_model: Skill が指定する第一選択
        fallback_models: 第一選択不可時の候補リスト

    Returns:
        実際に使うモデル名（LLM_MODELS のキー、alias 解決済み）
    """
    candidates: list[str] = []
    if preferred_model:
        candidates.append(preferred_model)
    if fallback_models:
        candidates.extend(fallback_models)
    candidates.append(DEFAULT_MODEL)  # 最後の砦

    for model_id in candidates:
        resolved = _resolve_alias(model_id)
        if _is_available(resolved):
            return resolved

    # 何も見つからない（通常は DEFAULT_MODEL が available_in に local|cloud を含む）
    logger.warning(
        "No available LLM model found. preferred=%s, fallback=%s, mode=%s",
        preferred_model,
        fallback_models,
        _current_app_mode(),
    )
    return DEFAULT_MODEL


def get_assistant_model_id(target_model_id: str) -> Optional[str]:
    """
    MTP（Multi-Token Prediction）用 assistant（drafter）モデル ID を取得。

    Args:
        target_model_id: ターゲットモデル ID

    Returns:
        assistant model ID（drafter）、未対応モデルなら None
    """
    target_id = _resolve_alias(target_model_id)
    spec = LLM_MODELS.get(target_id)
    if not spec or not spec.get("supports_mtp"):
        return None
    assistant_id = spec.get("assistant_model_id")
    if assistant_id and assistant_id in LLM_MODELS:
        return assistant_id
    return None


def is_mtp_enabled_by_default(model_id: str) -> bool:
    """指定モデルが MTP（Multi-Token Prediction）をデフォルトで有効化するか。"""
    resolved = _resolve_alias(model_id)
    spec = LLM_MODELS.get(resolved, {})
    return bool(spec.get("supports_mtp") and spec.get("mtp_default_enabled"))


# ───────────────────────────────────────────────────────────
# Adapter 取得
# ───────────────────────────────────────────────────────────


def get_adapter(model_id: Optional[str] = None, **kwargs: Any) -> LLMAdapter:
    """
    モデル名から実 adapter インスタンスを取得。

    Args:
        model_id: LLM_MODELS のキー。None なら settings.llm_adapter（後方互換）か DEFAULT_MODEL
        **kwargs: adapter に渡すオプション（wait_timeout 等）

    Returns:
        LLMAdapter インスタンス
    """
    # 後方互換: model_id 未指定時は settings.llm_adapter を見る（既存 llm_shim.get_llm_adapter() と同じ挙動）
    if model_id is None:
        try:
            from app.config import settings

            model_id = getattr(settings, "llm_adapter", None) or DEFAULT_MODEL
        except Exception:
            model_id = DEFAULT_MODEL

    # alias 解決（local_gemma_4_e2b → local_gemma_4_e2b_it 等）
    resolved_id = _resolve_alias(model_id)
    spec = LLM_MODELS.get(resolved_id)

    # 未登録モデル名の場合は MCP plugin id とみなす（既存 llm_shim の挙動）
    if not spec:
        from app.llm.adapters.mcp_relay import MCPRelayAdapter

        return MCPRelayAdapter(plugin_id=model_id)

    # OpenVINO Gemma の場合、MTP assistant モデルも spec に含めて渡す
    adapter_kind = spec.get("adapter", "")

    if adapter_kind == "gemini":
        from app.llm.adapters.gemini import GeminiAdapter

        return GeminiAdapter()

    if adapter_kind == "openvino_gemma":
        from app.llm.adapters.openvino_gemma import OpenVinoGemmaAdapter

        # MTP target モデルなら assistant spec も渡す（Speculative Decoding 用）
        assistant_spec: Optional[dict[str, Any]] = None
        if spec.get("supports_mtp"):
            assistant_id = spec.get("assistant_model_id")
            if assistant_id:
                assistant_spec = LLM_MODELS.get(assistant_id)
        return OpenVinoGemmaAdapter(spec=spec, assistant_spec=assistant_spec)

    if adapter_kind == "openvino_qwen":
        # スタブ: OpenVINO Qwen 対応は Track B で実装
        from app.llm.adapters.openvino_gemma import OpenVinoGemmaAdapter

        return OpenVinoGemmaAdapter(spec=spec)

    if adapter_kind == "cloud_proxy":
        from app.llm.adapters.cloud_proxy import CloudProxyAdapter

        return CloudProxyAdapter(spec=spec)

    if adapter_kind == "sagemaker":
        from app.llm.adapters.sagemaker import SageMakerAdapter

        return SageMakerAdapter(spec=spec)

    # フォールバック: MCP plugin として扱う
    from app.llm.adapters.mcp_relay import MCPRelayAdapter

    return MCPRelayAdapter(plugin_id=model_id)
