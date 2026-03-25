from typing import TypedDict, Any, Optional

class AgentState(TypedDict):
    session_id: str
    messages: list[dict]  # LLMとの会話履歴
    data_context: dict    # セッションから引き出した現在のDataModel（サマリー）
    current_skill: str    # 推定されたスキル名
    next_node: str        # 次のルーティング先
    operations: list[dict] # 提案された/実行されたMaintenanceOperationのリスト
    final_response: str   # ユーザーへの最終返答
    thinking_iterations: int # 現在の推論試行回数
    error_message: str    # リトライ時のエラーフィードバック

class ColumnMappingDict(TypedDict):
    col_index: int
    field_name: str
    is_date: bool
    month: Optional[int]

class ExcelImportState(TypedDict):
    session_id: str
    filename: str
    file_bytes: bytes
    status: str             # "pending", "analyzing", "waiting_user", "processing", "done", "error"
    error_message: str
    header_row_index: int
    summary: str
    mappings: list[ColumnMappingDict]
    symbol_mapping: dict    # "○" -> "planned" 等
    total_rows: int
    processed_rows: int
    extracted_data: list[dict]
