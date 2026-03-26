import logging
from typing import Dict, Any, Optional, AsyncGenerator
import asyncio

from app.engine.state import AgentState
from app.engine.graph import maintenance_engine, tool_execution_node
from app.engine.agents.excel_import import excel_import_engine
from app.engine.agents.schedule_planner import schedule_planner_engine
from app.engine.conversational_dispatcher import create_parallel_dispatch
from app.services.skill_loader import skill_loader
from app.services.session_manager import session_manager
from app.llm.factory import get_llm_adapter

# ユーザー確認を示すキーワードパターン
_CONFIRMATION_KEYWORDS = {"はい", "お願い", "OK", "ok", "Ok", "yes", "よろしく", "それで", "実行", "追加して", "進めて"}

logger = logging.getLogger(__name__)


async def prepare_dispatch(
    session_id: str, instruction: str, context: Dict[str, Any]
) -> tuple[Optional[asyncio.Task], Optional[AsyncGenerator[str, None]], Any]:
    """
    並列LLM呼び出しを準備し、intent_task と conv_stream を返す。

    Returns:
        intent_task: Call A の asyncio.Task（await で分類結果 dict を取得）。LLM不可時は None。
        conv_stream: Call B の AsyncGenerator。LLM不可時は None。
        adapter: LLMAdapter インスタンス。LLM不可時は None。
    """
    session = session_manager.get_session(session_id)
    history = session.get_recent_history(10)
    adapter = get_llm_adapter(wait_timeout=2.0)

    if adapter:
        intent_task, conv_stream = await create_parallel_dispatch(
            instruction, context, history, adapter
        )
        return intent_task, conv_stream, adapter
    else:
        logger.warning("LLM adapter not available, falling back to keyword match")
        return None, None, None


async def execute_agent(
    intent: str,
    parameters: dict,
    session_id: str,
    context: Dict[str, Any],
    instruction: str = "",
) -> Dict[str, Any]:
    """
    分類結果に基づきReActエージェントを実行する。

    Returns:
        {"final_response": str, "operations": list[dict]}
    """
    session = session_manager.get_session(session_id)
    history = session.get_recent_history(10)
    messages = history + [{"role": "user", "content": instruction}]

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
            "final_response": "Excelファイルのインポートは、画面上部のインポートボタンからファイルをアップロードしてください。",
            "operations": [],
        }

    # converse or unknown — エージェント実行なし
    return {"final_response": "", "operations": []}


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
