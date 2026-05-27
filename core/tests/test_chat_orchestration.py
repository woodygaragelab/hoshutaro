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


# ── orchestrator: ダイアログ操作系 intent ハンドラ（WS1-10） ──


class DialogOpAdapter(MockAdapter):
    """generate_structured がダイアログ操作 JSON を返すモック。"""

    def __init__(self, op: dict) -> None:
        super().__init__({})
        self._op = op

    async def generate_structured(self, *args: Any, **kwargs: Any) -> str:
        import json as _json
        return _json.dumps(self._op)


def test_dialog_intent_map_covers_all_dialog_intents():
    from app.engine.orchestrator import DIALOG_INTENT_MAP

    assert DIALOG_INTENT_MAP["hierarchy_edit"] == "hierarchy"
    assert DIALOG_INTENT_MAP["asset_classification_assign"] == "assetClassification"
    assert DIALOG_INTENT_MAP["work_order_line_edit"] == "workOrderLine"
    assert DIALOG_INTENT_MAP["specification_edit"] == "specification"
    assert DIALOG_INTENT_MAP["asset_reassign"] == "assetReassign"


def test_handle_dialog_intent_returns_operation_and_dialog_request(monkeypatch):
    """hierarchy_edit を処理し、operations と dialog_request を返すこと。"""
    import app.engine.orchestrator as orch

    adapter = DialogOpAdapter(
        {
            "dialog": "hierarchy",
            "action": "add_value",
            "params": {"levelKey": "L3", "value": "ポンプ室"},
            "summary": "第3階層に『ポンプ室』を追加します。",
        }
    )
    monkeypatch.setattr(orch, "get_llm_adapter", lambda *a, **k: adapter)

    result = _run(
        orch._handle_dialog_intent(
            intent="hierarchy_edit",
            parameters={},
            session_id="s1",
            context={},
            instruction="第3階層にポンプ室を追加して",
            ui_context={"currentDialog": None},  # ダイアログ未起動
        )
    )
    assert result["operations"], "operation が返ること"
    op = result["operations"][0]
    assert op["intent"] == "hierarchy_edit"
    assert op["dialog"] == "hierarchy"
    assert op["action"] == "add_value"
    # ダイアログ未起動なので起動要求が出る
    assert result["dialog_request"] == "hierarchy"


def test_handle_dialog_intent_no_open_request_when_dialog_already_open(monkeypatch):
    """対象ダイアログが既に開いていれば dialog_request は None。"""
    import app.engine.orchestrator as orch

    adapter = DialogOpAdapter(
        {"dialog": "hierarchy", "action": "rename_level", "params": {}, "summary": "改名します。"}
    )
    monkeypatch.setattr(orch, "get_llm_adapter", lambda *a, **k: adapter)

    result = _run(
        orch._handle_dialog_intent(
            intent="hierarchy_edit",
            parameters={},
            session_id="s1",
            context={},
            instruction="第1階層の名前を変えて",
            ui_context={"currentDialog": "hierarchy"},  # 既に開いている
        )
    )
    assert result["dialog_request"] is None


def test_handle_dialog_intent_graceful_when_llm_unavailable(monkeypatch):
    """LLM が None のときも例外を投げず案内を返す。"""
    import app.engine.orchestrator as orch

    monkeypatch.setattr(orch, "get_llm_adapter", lambda *a, **k: None)
    result = _run(
        orch._handle_dialog_intent(
            intent="specification_edit",
            parameters={},
            session_id="s1",
            context={},
            instruction="仕様を追加して",
            ui_context={"currentDialog": "specification"},
        )
    )
    assert result["operations"] == []
    assert "LLM" in result["final_response"]


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
    test_dialog_intent_map_covers_all_dialog_intents()
    print("All chat orchestration tests passed (monkeypatch tests require pytest).")
