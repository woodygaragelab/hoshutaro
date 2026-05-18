"""
LLM Shim — 後方互換ラッパ。

【重要】このモジュールは過去の暫定実装である `DummyAdapter` を提供していたが、
正式な `app.llm.LLMAdapter` ABC とレジストリ（`app.llm.registry`）が用意された
ため、本モジュールはそれらへの薄いラッパとなった。

新規コードは `from app.llm import get_adapter, resolve, LLMAdapter` を直接使うこと。
既存の `from app.services.llm_shim import get_llm_adapter, extract_json_object` は
当面後方互換として動作する（廃止予定: Track C 完了時）。
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.llm import LLMAdapter, get_adapter

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────
# JSON 抽出ユーティリティ（既存呼び出しを維持）
# ───────────────────────────────────────────────────────────


def extract_json_object(text: str) -> Optional[dict]:
    """Extremely naive JSON object extractor."""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
    except Exception as e:
        logger.error("Failed to parse JSON: %s", e)
    return None


def extract_json_array(text: str) -> Optional[list]:
    """Extremely naive JSON array extractor."""
    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
    except Exception as e:
        logger.error("Failed to parse JSON array: %s", e)
    return None


# ───────────────────────────────────────────────────────────
# 後方互換: get_llm_adapter() — 既存呼び出し元を変えずに新 registry を返す
# ───────────────────────────────────────────────────────────


def get_llm_adapter(*args: Any, **kwargs: Any) -> LLMAdapter:
    """
    後方互換ラッパ。

    既存呼び出し元（例: `orchestrator.prepare_dispatch` の `get_llm_adapter(wait_timeout=2.0)`）
    がそのまま動くよう、引数は受け取るが現状無視。`app.llm.registry.get_adapter()` に委譲する。

    新規コードは `from app.llm import get_adapter` を直接使うこと。
    """
    # wait_timeout 等の後方互換引数は当面無視。Track C で必要なら registry に取り込む。
    return get_adapter()
