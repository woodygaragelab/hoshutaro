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

class ExcelImportState(TypedDict):
    session_id: str
    filename: str
    file_bytes: bytes
    status: str               # "pending" | "analyzing" | "waiting_user" | "processing" | "done" | "error"
    error_message: str
    
    # Phase 1-2 の解析結果（analyze_excel_full()の戻り値リストを保持）
    analysis_results: Optional[list[dict]]  # 各シートごとの grid, structure, descriptors, symbol_mapping, validation
    
    # サマリー情報（フロントエンドに返す全シート統合分）
    summary: str
    total_rows: int
    
    # 解析された各シートの情報（フロントエンド送信用）
    sheets: list[dict]

    
    # チャンク処理の進捗
    processed_rows: int
    extracted_assets: list[dict]
    extracted_work_orders: list[dict]
    extracted_wo_lines: list[dict]
    error_rows: list[dict]
