import logging
from typing import Dict, Any

from app.engine.state import AgentState
from app.engine.graph import maintenance_engine
from app.engine.agents.excel_import import excel_import_engine
from app.engine.agents.schedule_planner import schedule_planner_engine
from app.services.skill_loader import skill_loader
from app.services.session_manager import session_manager

logger = logging.getLogger(__name__)

async def route_and_execute(session_id: str, instruction: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    ユーザーからの指示を受け取り、適切なサブエージェント(LangGraph)へルーティングする。
    """
    context = context or {}
    logger.info(f"Orchestrator received instruction: {instruction}")
    
    # スキルローダーを使った推定
    matched_skill = skill_loader.match_skill(instruction)
    skill_name = matched_skill.name if matched_skill else ""
    if skill_name:
        logger.info(f"Skill match: {skill_name}")
    
    # 既存のキーワードマッチ+スキルマッチベース
    if "Excel" in instruction or "import" in instruction or context.get("type") == "excel_import" or skill_name == "excel_import":
        logger.info("Routing to ExcelImportAgent")
        return {
            "agent": "ExcelImportAgent",
            "status": "routed",
            "result": "Excelインポートの準備が完了しました。データルーターから処理されます。",
            "operations": []
        }
    
    if "計画" in instruction or "予測" in instruction or "次回" in instruction or "future_planning" in skill_name:
        logger.info("Routing to SchedulePlannerAgent")
        initial_state = {
            "session_id": session_id,
            "messages": [{"role": "user", "content": instruction}],
            "data_context": context,
            "instruction": instruction,
            "target_asset_id": "",
            "extracted_history": [],
            "stats_data": {},
            "prediction_text": "",
            "operations": [],
            "final_response": ""
        }
        final_state = await schedule_planner_engine.ainvoke(initial_state)
        return {
            "agent": "SchedulePlannerAgent", 
            "result": final_state.get("final_response", ""),
            "operations": final_state.get("operations", [])
        }

    # デフォルト: EditAgent (既存の maintenance_engine)
    logger.info("Routing to EditAgent (Default)")
    
    session = session_manager.get_session(session_id)
    depth = 1
    if session:
        depth = session.metadata.get("skill_thinking_depth", {}).get(skill_name or "generic_chat", 1)
        
    initial_state = AgentState(
        session_id=session_id,
        messages=[{"role": "user", "content": instruction}],
        data_context=context,
        current_skill=skill_name or "generic_chat",
        next_node="",
        operations=[],
        final_response="",
        thinking_iterations=int(depth),
        error_message=""
    )
    
    final_state = await maintenance_engine.ainvoke(initial_state)
    
    # 思考深度のフィードバック保存
    if session:
        if "skill_thinking_depth" not in session.metadata:
            session.metadata["skill_thinking_depth"] = {}
            
        final_iters = final_state.get("thinking_iterations", 1)
        s_name = skill_name or "generic_chat"
        if final_state.get("error_message"):
            session.metadata["skill_thinking_depth"][s_name] = min(5.0, float(depth) + 1.0)
        elif final_iters == int(depth) + 1:  # 一発成功の場合 (reasoning_nodeが一回通るごとに+1されるため)
            session.metadata["skill_thinking_depth"][s_name] = max(1.0, float(depth) - 0.5)

    return {
        "agent": "EditAgent", 
        "result": final_state.get("final_response", ""),
        "operations": final_state.get("operations", [])
    }
