import logging
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

from app.engine.state import ExcelImportState, ColumnMappingDict
from app.services.excel_converter import analyze_excel_structure, infer_mapping_with_llm, chunk_process_excel

logger = logging.getLogger(__name__)

async def parse_structure_node(state: ExcelImportState) -> Dict[str, Any]:
    """
    Phase 1 & 2: 構造解析とLLMマッピング提案
    """
    logger.info("ExcelImport: Phase1 & 2 (Structure parsing and Mapping)")
    try:
        # Phase 1: 構造解析とプレビュー取得
        file_bytes = state["file_bytes"]
        struct_res = analyze_excel_structure(file_bytes)
        preview_data = struct_res["preview_data"]
        total_rows = struct_res["total_rows"]
        
        # Phase 2: LLMによるマッピング
        filename = state.get("filename", "unknown.xlsx")
        analysis = await infer_mapping_with_llm(filename, preview_data)
        
        # PydanticモデルをDictリストに変換
        mappings = [m.model_dump() for m in analysis.mappings]
        
        return {
            "status": "waiting_user",
            "header_row_index": analysis.header_row_index,
            "summary": analysis.summary,
            "mappings": mappings,
            "total_rows": total_rows,
            "processed_rows": 0,
            "extracted_data": []
        }
    except Exception as e:
        logger.error(f"Excel Parse Error: {e}")
        return {"status": "error", "error_message": str(e)}

async def generate_mapping_node(state: ExcelImportState) -> Dict[str, Any]:
    """
    マッピング完了後、ユーザー承認を待つノード (通過用)
    実際には parse_structure_node で推論まで終わらせているため、単なるパススルー。
    """
    logger.info(f"Mapping Node: Current status is {state.get('status')}")
    return {}

def should_continue_or_wait(state: ExcelImportState) -> str:
    """
    ステータスに応じたルーティング
    """
    status = state.get("status")
    if status == "error":
        return END
    if status == "waiting_user":
        return END
    return "process_chunks"

async def process_chunks_node(state: ExcelImportState) -> Dict[str, Any]:
    """
    Phase 3: LLM不要のチャンク処理
    今回は同期的に全チャンク(1ファイル分)を処理するサンプル実装とする
    """
    logger.info("ExcelImport: Phase3 (Processing chunk)")
    try:
        analysis_dict = {
            "header_row_index": state.get("header_row_index"),
            "mappings": state.get("mappings"),
            "symbol_mapping": state.get("symbol_mapping", {"○": "planned", "●": "actual", "◎": "completed"})
        }
        
        # 全行を一括（チャンク10000として）処理
        result = chunk_process_excel(
            state["file_bytes"], 
            analysis_dict,
            chunk_size=10000,
            start_row=state.get("processed_rows", 0)
        )
        
        prev_data = state.get("extracted_data", [])
        new_data = prev_data + result["extracted_data"]
        
        new_processed = state.get("processed_rows", 0) + result["processed_count"]
        status = "done" if result["is_done"] else "processing"
        
        return {
            "status": status,
            "processed_rows": new_processed,
            "extracted_data": new_data
        }
    except Exception as e:
        logger.error(f"Excel Process Error: {e}")
        return {"status": "error", "error_message": str(e)}

def create_excel_import_graph():
    workflow = StateGraph(ExcelImportState)
    
    workflow.add_node("parse", parse_structure_node)
    workflow.add_node("map", generate_mapping_node)
    workflow.add_node("process", process_chunks_node)
    
    # 解析プロセスのエントリー
    workflow.set_entry_point("parse")
    workflow.add_edge("parse", "map")
    
    # ユーザー確認のため一旦停止するか判定
    workflow.add_conditional_edges(
        "map",
        should_continue_or_wait,
        {
            END: END,
            "process_chunks": "process"
        }
    )
    
    workflow.add_edge("process", END)
    
    return workflow.compile()

excel_import_engine = create_excel_import_graph()
