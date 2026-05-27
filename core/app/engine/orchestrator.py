import logging
from typing import Dict, Any, Optional, AsyncGenerator
import asyncio

from app.engine.state import AgentState
from app.engine.graph import maintenance_engine
from app.engine.agents.schedule_planner import schedule_planner_engine
from app.engine.conversational_dispatcher import create_parallel_dispatch
from app.services.skill_loader import skill_loader
from app.services.session_manager import session_manager
from app.llm import get_adapter as get_llm_adapter
from app.llm.json_utils import extract_json_object

# ユーザー確認を示すキーワードパターン
_CONFIRMATION_KEYWORDS = {"はい", "お願い", "OK", "ok", "Ok", "yes", "よろしく", "それで", "実行", "追加して", "進めて"}

logger = logging.getLogger(__name__)


async def prepare_dispatch(
    session_id: str,
    instruction: str,
    context: Dict[str, Any],
    ui_context: Optional[Dict[str, Any]] = None,
) -> tuple[Optional[asyncio.Task], Optional[AsyncGenerator[str, None]], Any]:
    """
    並列LLM呼び出しを準備し、intent_task と conv_stream を返す。

    Args:
        session_id: セッション ID
        instruction: ユーザー発話
        context: data_context（assets/workOrders/workOrderLines のスナップショット）
        ui_context: UI コンテキスト（currentDialog/dialogParams/gridState）。プラン WS1-10。

    Returns:
        intent_task: Call A の asyncio.Task（await で分類結果 dict を取得）。LLM不可時は None。
        conv_stream: Call B の AsyncGenerator。LLM不可時は None。
        adapter: LLMAdapter インスタンス。LLM不可時は None。
    """
    session = session_manager.get_session(session_id)
    history = session.get_recent_history(10)
    # registry.get_adapter は wait_timeout を受け取らないため互換用の **kwargs 経由
    adapter = get_llm_adapter()

    if adapter:
        intent_task, conv_stream = await create_parallel_dispatch(
            instruction, context, history, adapter, ui_context=ui_context
        )
        return intent_task, conv_stream, adapter
    else:
        logger.warning("LLM adapter not available, falling back to keyword match")
        return None, None, None


# intent → 対象ダイアログ種別（プラン WS1-10）。チャットからのダイアログ操作のルーティング。
DIALOG_INTENT_MAP: Dict[str, str] = {
    "hierarchy_edit": "hierarchy",
    "asset_classification_define": "assetClassification",
    "asset_classification_assign": "assetClassification",
    "work_order_classification_edit": "workOrderClassification",
    "work_order_line_edit": "workOrderLine",
    "specification_edit": "specification",
    "asset_reassign": "assetReassign",
}


async def execute_agent(
    intent: str,
    parameters: dict,
    session_id: str,
    context: Dict[str, Any],
    instruction: str = "",
    ui_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    分類結果に基づきReActエージェント / ダイアログ操作ハンドラを実行する。

    Returns:
        {
          "final_response": str,
          "operations": list[dict],
          "dialog_request": str | None,   # フロントに開かせたいダイアログ種別
        }
    """
    session = session_manager.get_session(session_id)
    history = session.get_recent_history(10)
    messages = history + [{"role": "user", "content": instruction}]

    # ── ダイアログ操作系 intent（プラン WS1-10） ──
    if intent in DIALOG_INTENT_MAP or intent == "dialog_open_then_edit":
        return await _handle_dialog_intent(
            intent, parameters, session_id, context, instruction, ui_context
        )

    if intent == "schedule_planning":
        # ── 保留中の提案がある場合: ユーザー確認を検知して即実行 ──
        pending_ops = session.metadata.get("pending_schedule_ops")
        if pending_ops:
            is_confirmation = any(kw in instruction for kw in _CONFIRMATION_KEYWORDS)
            if is_confirmation:
                logger.info("SchedulePlanner: User confirmed pending proposal — executing %d ops", len(pending_ops))
                # tool_execution_node と同じロジックで保留opsを実行
                from app.engine.tools import execute_maintenance_operation
                from app.models.schemas import MaintenanceOperation
                results = []
                for op_dict in pending_ops:
                    try:
                        op = MaintenanceOperation(**op_dict)
                        result = execute_maintenance_operation(session_id, op)
                        results.append(result)
                    except Exception as e:
                        logger.error("Pending op execution error: %s", e)
                        results.append({"status": "error", "error": str(e)})

                session.metadata.pop("pending_schedule_ops", None)
                applied = sum(1 for r in results if r.get("status") == "success")
                action_summary = pending_ops[0].get("action_summary", "") if pending_ops else ""
                return {
                    "final_response": f"{action_summary} ({applied}件適用)",
                    "operations": pending_ops if applied > 0 else [],
                }
            else:
                # 確認ではなく修正指示等 → 保留opsをクリアして通常フローへ
                logger.info("SchedulePlanner: Pending proposal exists but user did not confirm — re-running planner")
                session.metadata.pop("pending_schedule_ops", None)

        # ── 通常の SchedulePlanner ReActループ実行 ──
        logger.info("Executing SchedulePlanner ReAct loop")
        initial_state = {
            "session_id": session_id,
            "messages": messages,
            "data_context": context,
            "instruction": instruction,
            "target_asset_id": parameters.get("target_asset_id", ""),
            "user_specified_days": parameters.get("specified_days"),
            "extracted_history": [],
            "stats_data": {},
            "prediction_text": "",
            "operations": [],
            "final_response": "",
            "retry_count": 0,
            "error_message": "",
        }
        final_state = await schedule_planner_engine.ainvoke(initial_state)
        return {
            "final_response": final_state.get("final_response", ""),
            "operations": final_state.get("operations", []),
        }

    if intent == "data_editing":
        logger.info("Executing EditAgent ReAct loop")
        depth = 1
        if session:
            depth = session.metadata.get("skill_thinking_depth", {}).get("generic_chat", 1)

        initial_state = AgentState(
            session_id=session_id,
            messages=messages,
            data_context=context,
            current_skill="data_editing",
            next_node="",
            operations=[],
            final_response="",
            thinking_iterations=int(depth),
            error_message="",
        )
        final_state = await maintenance_engine.ainvoke(initial_state)

        # 思考深度フィードバック
        if session:
            if "skill_thinking_depth" not in session.metadata:
                session.metadata["skill_thinking_depth"] = {}
            final_iters = final_state.get("thinking_iterations", 1)
            if final_state.get("error_message"):
                session.metadata["skill_thinking_depth"]["generic_chat"] = min(5.0, float(depth) + 1.0)
            elif final_iters == int(depth) + 1:
                session.metadata["skill_thinking_depth"]["generic_chat"] = max(1.0, float(depth) - 0.5)

        return {
            "final_response": final_state.get("final_response", ""),
            "operations": final_state.get("operations", []),
        }

    if intent == "excel_import":
        logger.info("Excel import requested via chat — delegating to ExcelImportAgent")
        return {
            "final_response": "Excelファイルのインポートは、エージェントバーの添付アイコンからファイルを選択してください。",
            "operations": [],
            "dialog_request": None,
        }

    # converse or unknown — エージェント実行なし
    return {"final_response": "", "operations": [], "dialog_request": None}


# ========== ダイアログ操作系 intent ハンドラ（プラン WS1-10） ==========

# 各ダイアログで許可される操作（LLM へのガイド + バリデーション用）。
_DIALOG_OPERATIONS: Dict[str, list[str]] = {
    "hierarchy": [
        "add_level", "delete_level", "reorder_level", "rename_level",
        "add_value", "edit_value", "delete_value",
    ],
    "assetClassification": [
        "add_level", "delete_level", "reorder_level", "rename_level",
        "add_value", "edit_value", "delete_value", "assign_to_assets",
    ],
    "workOrderClassification": [
        "add_classification", "delete_classification",
        "reorder_classification", "rename_classification",
    ],
    "workOrderLine": [
        "add_line", "delete_line", "duplicate_line", "edit_line",
        "edit_work_order",
    ],
    "specification": ["add_spec", "edit_spec", "delete_spec"],
    "assetReassign": ["select_path", "execute_reassign"],
}

_DIALOG_OP_SCHEMA = {
    "type": "object",
    "properties": {
        "dialog": {
            "type": "string",
            "description": "対象ダイアログ種別（hierarchy / assetClassification / "
            "workOrderClassification / workOrderLine / specification / assetReassign）",
        },
        "action": {"type": "string", "description": "実行する操作名"},
        "params": {
            "type": "object",
            "description": "操作のパラメタ（levelKey / value / assetId 等）",
        },
        "summary": {"type": "string", "description": "ユーザー向けの操作要約（1 文）"},
    },
    "required": ["dialog", "action", "summary"],
}


async def _handle_dialog_intent(
    intent: str,
    parameters: dict,
    session_id: str,
    context: Dict[str, Any],
    instruction: str,
    ui_context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    ダイアログ操作系 intent を処理（プラン WS1-10）。

    チャット指示を LLM で「ダイアログ操作」に構造化し、フロントに渡す operation を返す。
    実際の編集はフロントの各ダイアログ（HierarchyEditDialog 等）が onSave 経路で適用する。
    ダイアログ未起動なら dialog_request でフロントにダイアログ起動を依頼する。
    """
    ui_context = ui_context or {}
    current_dialog = ui_context.get("currentDialog")

    # intent → 対象ダイアログ。dialog_open_then_edit は LLM に判定させる。
    target_dialog = DIALOG_INTENT_MAP.get(intent)

    adapter = get_llm_adapter()
    if adapter is None:
        return {
            "final_response": "LLM が利用できないため、ダイアログ操作を解釈できませんでした。"
            "セットアップ画面でモデルを取得してください。",
            "operations": [],
            "dialog_request": target_dialog if target_dialog != current_dialog else None,
        }

    allowed = _DIALOG_OPERATIONS.get(target_dialog or "", [])
    allowed_hint = (
        f"対象ダイアログ: {target_dialog}。許可される action: {', '.join(allowed)}。"
        if target_dialog
        else "ユーザーの指示から適切なダイアログ（hierarchy / assetClassification / "
        "workOrderClassification / workOrderLine / specification / assetReassign）を選んでください。"
    )
    system_prompt = (
        "あなたは HOSHUTARO のダイアログ操作アシスタントです。"
        "ユーザーの自然言語指示を、ダイアログで実行する 1 つの構造化操作に変換してください。\n"
        + allowed_hint
        + "\nJSON のみで応答し、説明文やコードブロックは出力しないこと。"
    )

    try:
        raw = await adapter.generate_structured(
            system_prompt=system_prompt,
            user_prompt=instruction,
            json_schema=_DIALOG_OP_SCHEMA,
            max_new_tokens=512,
        )
    except NotImplementedError as e:
        logger.warning("dialog intent: LLM unavailable: %s", e)
        return {
            "final_response": "LLM が未準備のため操作を生成できませんでした。",
            "operations": [],
            "dialog_request": target_dialog if target_dialog != current_dialog else None,
        }
    except Exception as e:
        logger.error("dialog intent generation failed: %s", e)
        return {
            "final_response": f"操作の生成に失敗しました: {e}",
            "operations": [],
            "dialog_request": None,
        }

    op = extract_json_object(raw) or {}
    resolved_dialog = op.get("dialog") or target_dialog
    action = op.get("action", "")
    summary = op.get("summary") or "ダイアログ操作を提案しました。"

    operation = {
        "intent": intent,
        "dialog": resolved_dialog,
        "action": action,
        "params": op.get("params", {}),
    }
    # ダイアログが開いていなければフロントに起動を依頼
    needs_open = bool(resolved_dialog) and resolved_dialog != current_dialog

    return {
        "final_response": summary,
        "operations": [operation],
        "dialog_request": resolved_dialog if needs_open else None,
    }


# ========== フォールバック: LLM不可時のキーワードマッチ ==========

async def keyword_fallback(
    session_id: str, instruction: str, context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    LLMアダプタが利用不可の場合に使用する既存のキーワードマッチルーティング。
    """
    matched_skill = skill_loader.match_skill(instruction)
    skill_name = matched_skill.name if matched_skill else ""

    if "Excel" in instruction or "import" in instruction or context.get("type") == "excel_import" or skill_name == "excel_import":
        return {
            "agent": "ExcelImportAgent",
            "result": "Excelインポートの準備が完了しました。データルーターから処理されます。",
            "operations": [],
        }

    if "計画" in instruction or "予測" in instruction or "次回" in instruction or "future_planning" in skill_name:
        initial_state = {
            "session_id": session_id,
            "messages": [{"role": "user", "content": instruction}],
            "data_context": context,
            "instruction": instruction,
            "target_asset_id": "",
            "user_specified_days": None,
            "extracted_history": [],
            "stats_data": {},
            "prediction_text": "",
            "operations": [],
            "final_response": "",
            "retry_count": 0,
            "error_message": "",
        }
        final_state = await schedule_planner_engine.ainvoke(initial_state)
        return {
            "agent": "SchedulePlannerAgent",
            "result": final_state.get("final_response", ""),
            "operations": final_state.get("operations", []),
        }

    return {
        "agent": "GenericChat",
        "result": "",
        "operations": [],
    }

