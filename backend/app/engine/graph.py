import logging
from langgraph.graph import StateGraph, END
from app.engine.state import AgentState
from app.engine.agent import routing_node, reasoning_node
from app.engine.tools import execute_maintenance_operation
from app.models.schemas import MaintenanceOperation

logger = logging.getLogger(__name__)

async def tool_execution_node(state: AgentState) -> dict:
    """reasoning_nodeで生成された操作を実際のDataModelに適用するノード。
    LangGraph推奨パターン: stateを変異せず、差分dictを返す。
    """
    session_id = state.get("session_id")
    ops = state.get("operations", [])
    results = []

    for op_dict in ops:
        try:
            op = MaintenanceOperation(**op_dict)
            result = execute_maintenance_operation(session_id, op)
            results.append(result)
        except Exception as e:
            logger.error(f"Tool Execution Error: {e}")
            results.append({"status": "error", "error": str(e)})

    summary = state.get("final_response", "")
    applied = sum(1 for r in results if r.get("status") == "success")
    if applied:
        summary += f" ({applied}件適用)"

    return {"final_response": summary}

def should_execute_tools(state: AgentState) -> str:
    """操作リスト（JSONコマンド）が存在する場合はToolノードへ、なければ終了"""
    if state.get("operations") and len(state["operations"]) > 0:
        return "tools"
    return END

def create_maintenance_graph():
    """LangGraphのStateGraphを構築し、コンパイルして返す"""
    workflow = StateGraph(AgentState)
    
    # ノード追加
    workflow.add_node("routing", routing_node)
    workflow.add_node("reasoning", reasoning_node)
    workflow.add_node("tools", tool_execution_node)
    
    # エッジ追加
    workflow.set_entry_point("routing")
    workflow.add_edge("routing", "reasoning")
    
    workflow.add_conditional_edges(
        "reasoning",
        should_execute_tools,
        {
            "tools": "tools",
            END: END
        }
    )
    
    workflow.add_edge("tools", END)
    
    return workflow.compile()

# アプリケーション起動時にキャッシュしておく
maintenance_engine = create_maintenance_graph()

async def execute_engine(session_id: str, messages: list[dict], data_context: dict) -> AgentState:
    """
    グラフのエントリ関数
    """
    initial_state = AgentState(
        session_id=session_id,
        messages=messages,
        data_context=data_context,
        current_skill="",
        next_node="",
        operations=[],
        final_response=""
    )
    
    final_state = await maintenance_engine.ainvoke(initial_state)
    return final_state
