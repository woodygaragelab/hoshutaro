import logging
from typing import Dict, Any, TypedDict, List
from langgraph.graph import StateGraph, END
from datetime import datetime, timedelta

from app.engine.state import AgentState
from app.services.planning_engine import analyze_periodicity, generate_predictive_schedule
from app.engine.graph import tool_execution_node

logger = logging.getLogger(__name__)

class PlannerState(TypedDict):
    session_id: str
    messages: list[dict]
    data_context: dict
    instruction: str
    target_asset_id: str
    extracted_history: list[dict]
    stats_data: dict
    prediction_text: str
    operations: list[dict]
    final_response: str

async def extract_history_node(state: PlannerState) -> Dict[str, Any]:
    """
    対象Assetの過去履歴を抽出する
    """
    logger.info("Planner: Extracting history")
    data_ctx = state.get("data_context", {})
    wol_lines = data_ctx.get("workOrderLines", [])
    
    # ユーザー指示からざっくりIDを抽出する（本来はLLM引数抽出やSkillContextから）
    inst = state.get("instruction", "")
    target_id = ""
    # "P-101の次回"などで含まれていれば雑に探す
    # 実装簡略化のため、今回は全体、もしくはinstructionから文字マッチしたAssetを探す
    for line in wol_lines:
        asset_id = line.get("AssetId", "")
        if asset_id and asset_id in inst:
            target_id = asset_id
            break

    return {"target_asset_id": target_id, "extracted_history": wol_lines}

async def analyze_stats_node(state: PlannerState) -> Dict[str, Any]:
    """過去履歴の周期性を分析する"""
    logger.info("Planner: Analyzing stats")
    lines = state.get("extracted_history", [])
    target_id = state.get("target_asset_id")
    
    # planning_engine の関数呼び出し
    stats = analyze_periodicity(lines, target_id)
    return {"stats_data": stats}

async def generate_prediction_node(state: PlannerState) -> Dict[str, Any]:
    """LLMを用いて予測結果を自然言語で説明する"""
    logger.info("Planner: Generating LLM prediction")
    stats = state.get("stats_data", {})
    inst = state.get("instruction", "")
    
    # 予測テキスト生成
    pred_text = await generate_predictive_schedule(stats, inst)
    
    return {"prediction_text": pred_text, "final_response": pred_text}

async def propose_operation_node(state: PlannerState) -> Dict[str, Any]:
    """予測された日付を基に次回保全計画(DataModel操作)を提案する"""
    logger.info("Planner: Proposing operation")
    stats = state.get("stats_data", {})
    target_id = state.get("target_asset_id") or "ASSET-UNKNOWN"
    
    avg_days = stats.get("avg_days", 0)
    latest = stats.get("latest_date")
    ops = []
    
    if avg_days > 0 and latest:
        try:
            latest_dt = datetime.strptime(latest, "%Y-%m-%d")
            next_dt = latest_dt + timedelta(days=int(avg_days))
            next_dt_str = next_dt.strftime("%Y-%m-%d")
            
            # MaintenanceOperation スキーマに基づく作成提案
            ops.append({
                "type": "create_work_order_line",
                "targets": [{
                    "entity_type": "workOrderLine",
                    "entity_id": f"WOL-PREDICT-{int(datetime.now().timestamp())}",
                    "changes": {
                        "AssetId": target_id,
                        "WorkOrderName": "次回予測保全",
                        "PlanScheduleStart": next_dt_str,
                        "Planned": True,
                        "Remarks": "統計予測に基づく自動生成"
                    }
                }],
                "action_summary": f"{target_id} の次回保全 ({next_dt_str}) をスケジュールしました。"
            })
        except Exception as e:
            logger.error(f"Prediction logic error: {e}")
            
    # ops があれば final_response にアクションサマリも付加する
    summary = state.get("final_response", "")
    if ops:
        summary += f"\n\n[自動提案] {ops[0]['action_summary']}"
        
    return {"operations": ops, "final_response": summary}

def should_execute_tools(state: PlannerState) -> str:
    if state.get("operations") and len(state["operations"]) > 0:
        return "tools"
    return END

def create_schedule_planner_graph():
    workflow = StateGraph(PlannerState)
    
    workflow.add_node("extract", extract_history_node)
    workflow.add_node("analyze", analyze_stats_node)
    workflow.add_node("predict", generate_prediction_node)
    workflow.add_node("propose", propose_operation_node)
    
    # graph.py と同じインターフェースのノードを流用 (PlannerStateもdictとしては互換)
    workflow.add_node("tools", tool_execution_node)
    
    workflow.set_entry_point("extract")
    workflow.add_edge("extract", "analyze")
    workflow.add_edge("analyze", "predict")
    workflow.add_edge("predict", "propose")
    
    workflow.add_conditional_edges(
        "propose",
        should_execute_tools,
        {
            "tools": "tools",
            END: END
        }
    )
    workflow.add_edge("tools", END)
    
    return workflow.compile()

schedule_planner_engine = create_schedule_planner_graph()
