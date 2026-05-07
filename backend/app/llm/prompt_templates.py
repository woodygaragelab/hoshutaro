"""
プロンプト整形ユーティリティ。

conversational_dispatcher.py が `from app.llm.prompt_templates import format_conversational_context` で参照する。

データコンテキスト（assets, work_orders 等）から、LLM に渡すサマリー文字列を生成。
"""

from typing import Any


def format_conversational_context(data_context: dict[str, Any]) -> str:
    """
    data_context（フロントから渡される現在の機器・作業データのスナップショット）を
    LLM 向けの要約文字列に整形する。

    LLM のコンテキスト長制約（特に Gemma 4 E2B の MRCR 19.1% 等）を考慮し、
    全件ダンプではなく統計サマリー + サンプル数件に留める。

    Args:
        data_context: {
            "assets": [{"id":..., "name":...}, ...],
            "work_orders": [...],
            "selected_asset": {...},  # 任意
            "type": "excel_import" | "general" | ...,
            ...
        }

    Returns:
        LLM プロンプトに埋め込み可能な要約テキスト
    """
    if not data_context:
        return "（データコンテキストなし）"

    lines: list[str] = []

    # 機器データ統計
    assets = data_context.get("assets") or []
    if assets:
        lines.append(f"- 機器（Asset）: {len(assets)}件")
        # サンプル先頭3件のみ
        sample = assets[:3]
        for a in sample:
            name = a.get("name") or a.get("display_name") or a.get("id") or "(unnamed)"
            lines.append(f"  - {name}")
        if len(assets) > 3:
            lines.append(f"  - ... 他 {len(assets) - 3} 件")

    # 作業オーダー統計
    work_orders = data_context.get("work_orders") or []
    if work_orders:
        lines.append(f"- 作業オーダー（WorkOrder）: {len(work_orders)}件")

    # 作業ライン
    work_order_lines = data_context.get("work_order_lines") or []
    if work_order_lines:
        lines.append(f"- 作業ライン（WorkOrderLine）: {len(work_order_lines)}件")

    # 現在選択中の機器
    selected = data_context.get("selected_asset")
    if selected:
        sname = selected.get("name") or selected.get("id") or "(unnamed)"
        lines.append(f"- 選択中の機器: {sname}")

    # 操作モード（excel_import 等）
    mode = data_context.get("type")
    if mode:
        lines.append(f"- 現在の操作モード: {mode}")

    # 最近のチャット履歴件数
    history_len = data_context.get("history_length")
    if history_len:
        lines.append(f"- 直近の対話: {history_len} 往復")

    if not lines:
        return "（データコンテキストは存在するが要約対象が見つかりませんでした）"

    return "\n".join(lines)
