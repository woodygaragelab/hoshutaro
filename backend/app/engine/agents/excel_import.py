"""
Excel Import Agent (LangGraph StateGraph)

フロー:
  analyze_node: Phase 1-2  (LLM 2回: 構造検出 + 列記述子)
    → waiting_user (ユーザー確認待ち) or error → END
  
  convert_node: Phase 3 (LLM 0回: 決定論的チャンク変換)
    → done → END
"""
import logging
from typing import Dict, Any
from dataclasses import asdict
from langgraph.graph import StateGraph, END

from app.engine.state import ExcelImportState
from app.services.excel_converter import (
    analyze_excel_full,
    execute_chunk_conversion,
)

logger = logging.getLogger(__name__)


async def analyze_node(state: ExcelImportState) -> Dict[str, Any]:
    """
    Phase 1-2: 構造解析 + マッピング生成 + 検証プレビュー
    LLM呼び出し2回のみ。
    """
    logger.info("ExcelImport: Phase 1-2 開始 (構造解析 + 列マッピング)")
    try:
        file_bytes = state["file_bytes"]
        filename = state.get("filename", "unknown.xlsx")
        
        results = await analyze_excel_full(file_bytes, filename)
        
        sheets_data = []
        overall_summary = f"ファイル: {filename} ({len(results)} シート解析完了)"
        total_total_rows = 0
        
        for result in results:
            grid = result["grid"]
            structure = result["structure"]
            descriptors = result["descriptors"]
            symbol_mapping = result["symbol_mapping"]
            validation = result["validation"]
            
            # 人間が読めるサマリーを生成
            summary_parts = [
                f"シート: {grid.sheet_name}",
                f"データ開始: Row {structure.data_start}",
                f"パターン: {structure.pattern}",
            ]
            if structure.year_context > 0:
                summary_parts.append(f"年度: {structure.year_context}")
            
            col_summary = []
            for d in descriptors:
                if d.field != "ignore":
                    label = d.label or d.field
                    if d.month is not None:
                        label = f"{d.month}月" + (f"-{d.sub}" if d.sub else "")
                    col_summary.append(f"Col{d.col}→{label}")
            summary_parts.append(f"マッピング: {', '.join(col_summary[:10])}" + (f" 他{len(col_summary)-10}列" if len(col_summary) > 10 else ""))
            
            summary = " | ".join(summary_parts)
            
            # structure/descriptors をJSON-serializable に変換
            structure_dict = {
                "header_start": structure.header_start,
                "header_end": structure.header_end,
                "data_start": structure.data_start,
                "blank_row_strategy": structure.blank_row_strategy,
                "key_column": structure.key_column,
                "forward_fill_columns": structure.forward_fill_columns,
                "pattern": structure.pattern,
                "year_context": structure.year_context,
                "implied_hierarchy": structure.implied_hierarchy,
            }
            descriptors_list = [
                {"col": d.col, "field": d.field, "month": d.month, "sub": d.sub, "label": d.label}
                for d in descriptors
            ]
            
            sheets_data.append({
                "sheet_name": grid.sheet_name,
                "summary": summary,
                "total_rows": grid.total_rows,
                "structure_info": structure_dict,
                "descriptors_info": descriptors_list,
                "symbol_mapping": symbol_mapping,
                "preview_records": validation.preview_records,
                "warnings": validation.warnings,
            })
            total_total_rows += grid.total_rows
        
        return {
            "status": "waiting_user",
            "analysis_results": results,  # grid等のオブジェクトを含む（メモリ上のみ）
            "summary": overall_summary,
            "total_rows": total_total_rows,
            "sheets": sheets_data,
            "processed_rows": 0,
            "extracted_assets": [],
            "extracted_work_orders": [],
            "extracted_wo_lines": [],
            "error_rows": [],
        }
        
    except Exception as e:
        logger.error(f"Excel Analyze Error: {e}", exc_info=True)
        return {
            "status": "error",
            "error_message": str(e),
        }


def route_after_analyze(state: ExcelImportState) -> str:
    """解析結果に基づくルーティング"""
    status = state.get("status")
    if status == "error":
        return END
    if status == "waiting_user":
        return END  # ユーザー確認待ちで一旦停止
    return "convert"


async def convert_node(state: ExcelImportState) -> Dict[str, Any]:
    """
    Phase 3: チャンク変換。LLM呼び出しゼロ。
    全行を500行チャンクで処理し、結果を蓄積する。
    """
    logger.info("ExcelImport: Phase 3 開始 (チャンク変換)")
    try:
        analysis_results = state.get("analysis_results")
        if not analysis_results:
            return {"status": "error", "error_message": "解析結果がありません"}
        
        chunk_size = 500
        total_rows = state.get("total_rows", 0)
        
        # 蓄積済みデータ
        all_assets = {a["id"]: a for a in state.get("extracted_assets", [])}
        all_wos = {wo["name"]: wo for wo in state.get("extracted_work_orders", [])}
        all_wol = list(state.get("extracted_wo_lines", []))
        all_errors = list(state.get("error_rows", []))
        
        chunk_result = execute_chunk_conversion(
            analysis_results, chunk_size=chunk_size,
        )
            
        # 結果をマージ
        for asset in chunk_result["assets"]:
            all_assets[asset["id"]] = asset
        for wo in chunk_result["work_orders"]:
            all_wos[wo["name"]] = wo
        all_wol.extend(chunk_result["work_order_lines"])
        all_errors.extend(chunk_result["error_rows"])
        
        logger.info(
            "ExcelImport: 全チャンク処理完了 (assets=%d, wos=%d, wols=%d)",
            len(all_assets), len(all_wos), len(all_wol),
        )
        
        return {
            "status": "done",
            "processed_rows": total_rows,
            "extracted_assets": list(all_assets.values()),
            "extracted_work_orders": list(all_wos.values()),
            "extracted_wo_lines": all_wol,
            "error_rows": all_errors,
        }
        
    except Exception as e:
        logger.error(f"Excel Convert Error: {e}", exc_info=True)
        return {"status": "error", "error_message": str(e)}


def create_excel_import_graph():
    workflow = StateGraph(ExcelImportState)
    
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("convert", convert_node)
    
    workflow.set_entry_point("analyze")
    
    workflow.add_conditional_edges(
        "analyze",
        route_after_analyze,
        {
            END: END,
            "convert": "convert",
        }
    )
    
    workflow.add_edge("convert", END)
    
    return workflow.compile()


excel_import_engine = create_excel_import_graph()
