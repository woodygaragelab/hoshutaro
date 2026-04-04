from dataclasses import dataclass, field
from typing import Optional

@dataclass
class CellMergeInfo:
    """結合セル情報"""
    min_row: int
    min_col: int
    max_row: int
    max_col: int

@dataclass
class PhysicalGrid:
    """正規化済み物理グリッド"""
    rows: list[list[str]]
    total_rows: int
    sheet_name: str
    merge_map: dict = field(default_factory=dict)
    bold_rows: set = field(default_factory=set)
    bg_rows: set = field(default_factory=set)

@dataclass
class StructureInfo:
    """LLMによる構造検出結果"""
    header_start: int
    header_end: int
    data_start: int
    blank_row_strategy: str
    key_column: int
    forward_fill_columns: list[int]
    pattern: str
    year_context: int
    implied_hierarchy: dict[str, str] = field(default_factory=dict)
    is_target_sheet: bool = True

@dataclass
class ColumnDescriptor:
    """列記述子: 各物理列の意味"""
    col: int
    field: str
    month: Optional[int] = None
    sub: Optional[str] = None
    label: str = ""

@dataclass
class ValidationResult:
    """マッピング検証結果"""
    preview_records: list[dict]
    warnings: list[str]
    unmapped_columns: list[int]
    symbol_stats: dict[str, int]
    success: bool
