"""
チャット駆動オーケストレーションの単体テスト（プラン WS1-9 / WS1-10）。

検証対象:
  - conversational_dispatcher._classify_with_fallback の UI コンテキストホワイトリスト
    （currentDialog=hierarchy のとき schedule_planning は out_of_scope へ）
  - prompt_templates.format_ui_context のサマリー生成
  - prompt_templates.allowed_intents_for_ui のホワイトリスト取得

LLM は MockAdapter（LLMAdapter ABC を実装）で差し替え、ネットワーク呼出なしで検証する。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.engine.conversational_dispatcher import _classify_with_fallback  # noqa: E402
from app.llm.base import LLMAdapter  # noqa: E402
from app.llm.prompt_templates import (  # noqa: E402
    allowed_intents_for_ui,
    format_ui_context,
)


class MockAdapter(LLMAdapter):
    """LLM をモック化し、`classify_intent` が固定 dict を返す。"""

    def __init__(self, intent_payload: dict[str, Any]) -> None:
        self._intent = intent_payload

    async def chat(self, messages: list[dict], **kwargs: Any) -> str:
        return ""

    async def conversational_stream(
        self, messages: list[dict], system_prompt: str, **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        if False:  # pragma: no cover — AsyncGenerator のための yield 形式
            yield ""

    async def classify_intent(
        self, messages: list[dict], system_prompt: str, **kwargs: Any
    ) -> dict:
        return dict(self._intent)

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Optional[dict] = None,
        retries: int = 1,
        **kwargs: Any,
    ) -> str:
        return ""

    async def ping(self) -> dict:
        return {"ok": True}


def _run(coro):
    return asyncio.run(coro)


# ── format_ui_context ──────────────────────────────────────


def test_format_ui_context_no_dialog():
    text = format_ui_context(None)
    assert "UI コンテキストなし" in text


def test_format_ui_context_with_hierarchy_dialog():
    text = format_ui_context(
        {
            "currentDialog": "hierarchy",
            "dialogParams": {"tabIndex": 0},
            "gridState": {"viewMode": "asset-based"},
        }
    )
    assert "機器階層エディタ" in text
    # ホワイトリストの内容（hierarchy_edit のみ）がプロンプト指示として現れる
    assert "他の操作は受け付けません" not in text or "階層編集以外" in text


def test_format_ui_context_with_grid_state():
    text = format_ui_context(
        {"currentDialog": None, "gridState": {"viewMode": "asset-based", "timeScale": "month"}}
    )
    assert "ダイアログは開いていません" in text
    assert "viewMode=asset-based" in text
    assert "timeScale=month" in text


# ── allowed_intents_for_ui ─────────────────────────────────


def test_allowed_intents_none_for_no_dialog():
    assert allowed_intents_for_ui(None) is None
    assert allowed_intents_for_ui({"currentDialog": None}) is None


def test_allowed_intents_hierarchy_dialog():
    allowed = allowed_intents_for_ui({"currentDialog": "hierarchy"})
    assert allowed == {"converse", "hierarchy_edit"}


def test_allowed_intents_asset_classification_dialog():
    allowed = allowed_intents_for_ui({"currentDialog": "assetClassification"})
    assert allowed == {
        "converse",
        "asset_classification_define",
        "asset_classification_assign",
    }


# ── _classify_with_fallback ───────────────────────────────


def test_classifier_passes_through_when_intent_in_whitelist():
    """ダイアログが開いていて、intent もホワイトリスト内なら通す。"""
    adapter = MockAdapter({"intent": "hierarchy_edit", "parameters": {}, "confidence": 0.9})
    result = _run(
        _classify_with_fallback(
            adapter, [{"role": "user", "content": "第3階層に追加"}], "", {"currentDialog": "hierarchy"}
        )
    )
    assert result["intent"] == "hierarchy_edit"
    assert "out_of_scope_reason" not in result


def test_classifier_overrides_to_converse_for_out_of_scope():
    """hierarchy ダイアログ中に schedule_planning は許可されず converse へ。"""
    adapter = MockAdapter(
        {"intent": "schedule_planning", "parameters": {}, "confidence": 0.9}
    )
    result = _run(
        _classify_with_fallback(
            adapter,
            [{"role": "user", "content": "次回の保守を予測して"}],
            "",
            {"currentDialog": "hierarchy"},
        )
    )
    assert result["intent"] == "converse"
    assert "out_of_scope_reason" in result
    assert "hierarchy" in result["out_of_scope_reason"]


def test_classifier_allows_schedule_planning_without_dialog():
    """ダイアログが開いていなければ schedule_planning は通る。"""
    adapter = MockAdapter(
        {"intent": "schedule_planning", "parameters": {}, "confidence": 0.9}
    )
    result = _run(
        _classify_with_fallback(
            adapter, [{"role": "user", "content": "次回の保守を予測して"}], "", None
        )
    )
    assert result["intent"] == "schedule_planning"


def test_classifier_low_confidence_overrides_to_converse():
    adapter = MockAdapter(
        {"intent": "schedule_planning", "parameters": {}, "confidence": 0.2}
    )
    result = _run(
        _classify_with_fallback(
            adapter, [{"role": "user", "content": "..."}], "", None
        )
    )
    assert result["intent"] == "converse"


def test_classifier_falls_back_on_adapter_error():
    """adapter.classify_intent が例外を投げたら converse 0.0 にフォールバック。"""

    class BoomAdapter(MockAdapter):
        async def classify_intent(self, *args: Any, **kwargs: Any) -> dict:
            raise RuntimeError("LLM down")

    adapter = BoomAdapter({})
    result = _run(_classify_with_fallback(adapter, [], "", None))
    assert result == {"intent": "converse", "parameters": {}, "confidence": 0.0}


if __name__ == "__main__":
    test_format_ui_context_no_dialog()
    test_format_ui_context_with_hierarchy_dialog()
    test_format_ui_context_with_grid_state()
    test_allowed_intents_none_for_no_dialog()
    test_allowed_intents_hierarchy_dialog()
    test_allowed_intents_asset_classification_dialog()
    test_classifier_passes_through_when_intent_in_whitelist()
    test_classifier_overrides_to_converse_for_out_of_scope()
    test_classifier_allows_schedule_planning_without_dialog()
    test_classifier_low_confidence_overrides_to_converse()
    test_classifier_falls_back_on_adapter_error()
    print("All chat orchestration tests passed.")
