"""
プロンプト整形ユーティリティ。

conversational_dispatcher.py が `from app.llm.prompt_templates import
format_conversational_context, format_ui_context` で参照する。

- format_conversational_context: assets / work_orders 等のデータサマリー
- format_ui_context: 開いているダイアログとグリッド状態の UI コンテキスト
  サマリー（プラン WS1-10）
"""

from typing import Any, Optional


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


# 開いているダイアログごとの操作能力カタログ（プラン WS1-10）。
# 「ここでチャットができる操作」を LLM に明示し、UI スコープを超える指示を出さないようにする。
_DIALOG_CAPABILITIES: dict[str, str] = {
    "hierarchy": (
        "機器階層エディタを開いています。可能な操作: レベルの追加/削除/並び替え/改名、"
        "値の追加/編集/削除。階層編集以外の指示は受け付けません。"
    ),
    "assetClassification": (
        "機器分類エディタを開いています。可能な操作: 分類レベルの定義（追加/削除/並び替え/改名）"
        "および選択中機器への分類割当・一括適用。他の操作は受け付けません。"
    ),
    "workOrderClassification": (
        "作業分類エディタを開いています。可能な操作: 作業分類の追加/削除/並び替え/改名。"
        "他の操作は受け付けません。"
    ),
    "workOrderLine": (
        "明細編集ダイアログを開いています。可能な操作: 明細（WorkOrderLine）の追加/削除/複製、"
        "計画・実績日付・コストの編集、作業オーダードラフトの編集。他の操作は受け付けません。"
    ),
    "specification": (
        "機器仕様エディタを開いています。可能な操作: 仕様項目の追加/編集/削除。"
        "他の操作は受け付けません。"
    ),
    "assetReassign": (
        "機器付け替えダイアログを開いています。可能な操作: 新しい階層パスの選択と付け替え実行。"
        "他の操作は受け付けません。"
    ),
}


def format_ui_context(ui_context: Optional[dict[str, Any]]) -> str:
    """
    UI コンテキスト（開いているダイアログ + グリッド状態）を LLM 向けに整形する。

    Args:
        ui_context: {
            "currentDialog": "hierarchy" | "assetClassification" | ... | None,
            "dialogParams": { "assetId": ..., "tabIndex": ..., "selectedAssetIds": [...] },
            "gridState": { "viewMode": ..., "timeScale": ..., "displayMode": ...,
                           "editScope": ..., "selectedAssetIds": [...], "activeFilters": {...} },
        }
    """
    if not ui_context:
        return "（UI コンテキストなし — グリッド表示中。アプリ全体の操作が可能。）"

    lines: list[str] = []
    current_dialog = ui_context.get("currentDialog")
    if current_dialog:
        capability = _DIALOG_CAPABILITIES.get(
            current_dialog,
            f"ダイアログ '{current_dialog}' が開いています。",
        )
        lines.append(f"- {capability}")
        params = ui_context.get("dialogParams") or {}
        if params:
            for key in ("assetId", "dateKey", "workOrderId", "tabIndex"):
                if params.get(key) is not None:
                    lines.append(f"  - {key}: {params[key]}")
            selected = params.get("selectedAssetIds")
            if selected:
                lines.append(f"  - 選択中機器: {len(selected)} 件")
    else:
        lines.append(
            "- ダイアログは開いていません（グリッド表示中）。"
            "Excel 取込、計画推論、データ編集、ダイアログ起動を含む全操作が可能です。"
        )

    grid = ui_context.get("gridState") or {}
    if grid:
        vm = grid.get("viewMode")
        ts = grid.get("timeScale")
        dm = grid.get("displayMode")
        es = grid.get("editScope")
        bits: list[str] = []
        if vm:
            bits.append(f"viewMode={vm}")
        if ts:
            bits.append(f"timeScale={ts}")
        if dm:
            bits.append(f"displayMode={dm}")
        if es:
            bits.append(f"editScope={es}")
        if bits:
            lines.append(f"- グリッド状態: {', '.join(bits)}")
        selected = grid.get("selectedAssetIds")
        if selected:
            lines.append(f"- 選択中機器: {len(selected)} 件")
        filters = grid.get("activeFilters")
        if filters:
            keys = ", ".join(str(k) for k in list(filters.keys())[:5])
            lines.append(f"- フィルタ: {keys}")

    return "\n".join(lines) if lines else "（UI コンテキストは存在するが要約対象なし）"


# UI コンテキストに応じた intent ホワイトリスト（プラン WS1-10）。
# 分類器が UI 範囲外の intent を返した場合、ディスパッチャ側でこのテーブルを使って
# converse へオーバーライドする。
DIALOG_INTENT_WHITELIST: dict[str, set[str]] = {
    "hierarchy": {"converse", "hierarchy_edit"},
    "assetClassification": {
        "converse",
        "asset_classification_define",
        "asset_classification_assign",
    },
    "workOrderClassification": {"converse", "work_order_classification_edit"},
    "workOrderLine": {"converse", "work_order_line_edit"},
    "specification": {"converse", "specification_edit"},
    "assetReassign": {"converse", "asset_reassign"},
}


def allowed_intents_for_ui(ui_context: Optional[dict[str, Any]]) -> Optional[set[str]]:
    """
    開いているダイアログに応じた intent ホワイトリストを返す。
    ダイアログが無ければ None（=制限なし）。
    """
    if not ui_context:
        return None
    current_dialog = ui_context.get("currentDialog")
    if not current_dialog:
        return None
    return DIALOG_INTENT_WHITELIST.get(current_dialog)
