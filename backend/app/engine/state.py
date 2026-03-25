from typing import TypedDict, Any

class AgentState(TypedDict):
    session_id: str
    messages: list[dict]  # LLMとの会話履歴
    data_context: dict    # セッションから引き出した現在のDataModel（サマリー）
    current_skill: str    # 推定されたスキル名
    next_node: str        # 次のルーティング先
    operations: list[dict] # 提案された/実行されたMaintenanceOperationのリスト
    final_response: str   # ユーザーへの最終返答
