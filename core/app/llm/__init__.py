"""
LLM抽象化レイヤ。

Skill / Orchestrator / conversational_dispatcher は本パッケージ経由で LLM を呼ぶ。
具体的なプロバイダ実装は adapters/ 配下。

主要エクスポート:
    LLMAdapter: 全アダプタが実装する ABC
    get_adapter(name): registry から adapter を解決
"""

from app.llm.base import LLMAdapter
from app.llm.registry import (
    get_adapter,
    resolve,
    get_assistant_model_id,
    is_mtp_enabled_by_default,
    LLM_MODELS,
    DEFAULT_MODEL,
)

__all__ = [
    "LLMAdapter",
    "get_adapter",
    "resolve",
    "get_assistant_model_id",
    "is_mtp_enabled_by_default",
    "LLM_MODELS",
    "DEFAULT_MODEL",
]
