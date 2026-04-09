import logging
from app.engine.state import AgentState
from app.services.llm_shim import get_llm_adapter
from app.models.schemas import MaintenanceOperation

logger = logging.getLogger(__name__)

async def routing_node(state: AgentState) -> dict:
    """メッセージの内容から必要なスキル（処理ルート）を決定する。
    LangGraph推奨パターン: stateを変異せず、差分dictを返す。
    """
    messages = state.get("messages", [])
    last_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")

    # 簡易ルールベースのルーティング（将来的にはLLMを用いたルーティングも可）
    if "計画" in last_msg or "予測" in last_msg:
        skill = "future_planning"
    elif "インポート" in last_msg or "Excel" in last_msg:
        skill = "excel_import"
    elif "提案" in last_msg:
        skill = "future_planning"
    else:
        skill = "generic_chat"

    return {"current_skill": skill}


async def reasoning_node(state: AgentState) -> dict:
    """LLMを呼び出し、必要な操作手順(JSON)または返答を生成する。"""
    adapter = get_llm_adapter()
    if not adapter:
        return {"final_response": "LLMが初期化されていません", "error_message": ""}

    skill = state.get("current_skill", "generic_chat")
    iterations = state.get("thinking_iterations", 1)
    
    logger.info(f"[Agent] Reasoning with skill: {skill} (Iteration: {iterations})")

    messages = list(state.get("messages", []))
    err_msg = state.get("error_message", "")
    if err_msg:
        # リトライ時のフィードバック注入
        messages.append({
            "role": "user",
            "content": f"前回の操作生成でエラーが発生しました。修正して再出力してください。\nエラー内容:\n{err_msg}"
        })

    if skill in ["future_planning", "excel_import"]:
        # 構造化データ（JSON操作コマンド）の生成を要求
        try:
            op: MaintenanceOperation = await adapter.chat_structured(messages, state.get("data_context", {}))
            return {
                "operations": [op.model_dump()],
                "final_response": op.action_summary,
                "error_message": "",
                "thinking_iterations": iterations + 1
            }
        except Exception as e:
            logger.error(f"Reasoning Error: {e}")
            # エラー情報をstateに返し、再推論の判断をgraphに委ねる
            return {
                "error_message": str(e),
                "thinking_iterations": iterations + 1
            }
    else:
        # 一般的なチャットの場合（簡易的なテキスト生成）
        last_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        try:
            res = await adapter.generate_text(prompt=f"ユーザーの質問「{last_msg}」に短く答えてください。", max_tokens=512)
            return {"final_response": res, "operations": [], "error_message": ""}
        except Exception as e:
            return {"final_response": f"エラー: {e}", "operations": [], "error_message": str(e)}

