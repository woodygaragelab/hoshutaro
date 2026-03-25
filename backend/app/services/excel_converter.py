import logging
import io
import openpyxl
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.llm.factory import get_llm_adapter

logger = logging.getLogger(__name__)

class ColumnMapping(BaseModel):
    col_index: int = Field(description="列番号（0始まり）")
    field_name: str = Field(description="DataModelのフィールド名（例: AssetId, WorkOrderName, ActualCost）")
    is_date: bool = Field(default=False, description="この列が日付や月を表すか")
    month: int = Field(default=None, description="日付列であればその月（4月なら4）")

class ExcelAnalysisResult(BaseModel):
    header_row_index: int = Field(description="ヘッダー行の行番号（0始まり）")
    summary: str = Field(description="どのようなデータが格納されているかの説明")
    mappings: List[ColumnMapping] = Field(description="抽出した列マッピングのリスト")

def expand_merged_cells(sheet):
    """セル結合を解除し、左上の値を結合範囲全体にコピーする"""
    merged_ranges = list(sheet.merged_cells.ranges)
    for merged_range in merged_ranges:
        min_col, min_row, max_col, max_row = merged_range.bounds
        top_left_value = sheet.cell(row=min_row, column=min_col).value
        sheet.unmerge_cells(str(merged_range))
        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                sheet.cell(row=r, column=c, value=top_left_value)

def analyze_excel_structure(file_bytes: bytes) -> Dict[str, Any]:
    """Phase 1: Excelファイルの展開と構造の一次解析 (プレビュー作成)"""
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = wb.active
    
    # 結合セルの展開
    expand_merged_cells(sheet)
    
    preview_data = []
    total_rows = 0
    for i, row in enumerate(sheet.iter_rows(values_only=True)):
        total_rows += 1
        if i < 15:
            row_str = [str(cell) if cell is not None else "" for cell in row]
            preview_data.append(row_str)
            
    return {
        "preview_data": preview_data,
        "total_rows": total_rows,
        "sheet_name": sheet.title
    }

async def infer_mapping_with_llm(filename: str, preview_data: List[List[str]]) -> ExcelAnalysisResult:
    """Phase 2: プレビューデータに基づくLLMによるマッピング推論"""
    adapter = get_llm_adapter()
    if not adapter:
        raise Exception("LLM adapter not initialized")
        
    system_prompt = (
        "あなたは保全システムのデータ取込みアシスタントです。"
        "提供されるExcelの冒頭15行のテキスト配列から、ヘッダー行(header_row_index)を特定し、"
        "各列がDataModelのどのフィールドに該当するか推論してください。\n"
        "【主要フィールド】AssetId, WorkOrderName, PlanCost, ActualCost\n"
        "※星取表（4月、5月...等の列）の場合は、列ごとに 'is_date': true, 'month': N 等を出力してください。\n"
        "タイトル行等の不要行はヘッダーではないことに注意してください。\n\n"
        "必ず以下のJSON形式のみを出力してください:\n"
        '{"header_row_index": <int>, "summary": "<str>", "mappings": [{"col_index": <int>, "field_name": "<str>", "is_date": <bool>, "month": <int|null>}, ...]}'
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Filename: {filename}\nPreview Data:\n{preview_data}"}
    ]
    
    from app.llm.json_utils import extract_json_object
    raw_text = await adapter.generate_text(
        prompt=f"{system_prompt}\n\nFilename: {filename}\nPreview Data:\n{preview_data}",
        max_tokens=1024
    )
    data = extract_json_object(raw_text)
    return ExcelAnalysisResult(**data)

def chunk_process_excel(file_bytes: bytes, analysis_dict: Dict[str, Any], chunk_size: int = 500, start_row: int = 0) -> Dict[str, Any]:
    """
    Phase 3: 確定したマッピングに基づいてデータを変換 (ジェネレータ・チャンク用)
    実際にはジェネレータではなく、指定した範囲(start_rowから+chunk_size)の変換済みリストを返す同期関数。
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = wb.active
    expand_merged_cells(sheet) # チャンク単位で再読込するなら再度展開が必要
    
    header_idx = analysis_dict.get("header_row_index", 0)
    mappings = analysis_dict.get("mappings", [])
    symbol_mapping = analysis_dict.get("symbol_mapping", {"○": "planned", "●": "actual", "◎": "completed"}) # とりあえずデフォルト
    
    converted_lines = []
    processed_count = 0
    end_row = start_row + chunk_size
    
    # イテレータ
    for index, row in enumerate(sheet.iter_rows(min_row=start_row + 1, max_row=end_row, values_only=True)):
        actual_row_idx = start_row + index
        if actual_row_idx <= header_idx:
            processed_count += 1
            continue
            
        if all((cell is None or str(cell).strip() == "") for cell in row):
            processed_count += 1
            continue
            
        base_line = {}
        monthly_flags = {}
        
        for mapping in mappings:
            col_idx = mapping.get("col_index", 0)
            if col_idx < len(row):
                cell_val = row[col_idx]
                if cell_val is None:
                    continue
                    
                val_str = str(cell_val).strip()
                if not val_str:
                    continue
                    
                if mapping.get("is_date") and mapping.get("month") is not None:
                    monthly_flags[mapping.get("month")] = val_str
                else:
                    base_line[mapping.get("field_name")] = val_str
                    
        # マッピングに基づくデータ分割展開
        if monthly_flags:
            year = analysis_dict.get("year_context", datetime.now().year)
            for month, flag in monthly_flags.items():
                copied = dict(base_line)
                copied["PlanScheduleStart"] = f"{year}-{month:02d}-01"
                copied["Remarks"] = flag
                
                # 簡単なシンボル解釈
                meaning = symbol_mapping.get(flag, "")
                if "planned" in meaning or flag in ["○", "◎"]:
                    copied["Planned"] = True
                if "actual" in meaning or "completed" in meaning or flag in ["●", "実績", "済", "◎"]:
                    copied["ActualCost"] = copied.get("PlanCost", 1000)
                    
                converted_lines.append(copied)
        else:
            if base_line:
                converted_lines.append(base_line)
                
        processed_count += 1
        
    return {
        "status": "success",
        "extracted_data": converted_lines,
        "processed_count": processed_count,
        "is_done": processed_count < chunk_size  # chunk_sizeに満たないなら処理完了
    }
