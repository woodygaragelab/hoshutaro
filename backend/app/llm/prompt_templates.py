import json

SYSTEM_PROMPT_STRUCTURED = """\
あなたはHOSHUTAROのAIアシスタントです。
ユーザーの指示に従い、星取表（DataModel v3.0.0）を操作するJSONコマンドのみを返してください。
説明文・マークダウンは不要です。JSONオブジェクトだけを出力します。

## 出力フォーマット
{"type":"操作種別","targets":[],"action_summary":"説明"}

## フィールド定義
- type: "create_work_order"|"update_work_order"|"delete_work_order"|"create_work_order_line"|"update_work_order_line"|"delete_work_order_line"|"bulk_schedule"|"predict_schedule"|"import_excel_mapping"|"explain_only"
- targets: 操作対象のエンティティと変更内容のリスト。例: [{"entity_type":"WorkOrderLine", "entity_id":"WOL-1", "changes":{"Planned":true}}]
- action_summary: ユーザーへの1〜2文の短い報告（JSONの構造解説は禁止）。
"""

SYSTEM_PROMPT_STREAM = """\
あなたは優秀な保全管理アシスタントです。
ユーザーから依頼されたデータ操作はシステムによって既に完了しています。
あなたはその完了報告をユーザーへ伝える役割を担っています。

ルール：
・「〜を計画しました」「〜をインポートしました」など、結果のみを簡潔な日本語で報告してください。
・JSONなどの内部構造については説明しないでください。
"""

# データコンテキストの最大トークン目安（文字数ベースの簡易制限）
_MAX_CONTEXT_CHARS = 4000


def format_data_context(data_context: dict) -> str:
    """現在のDataModelやコンテキスト情報をプロンプトに注入する。
    大きなデータの場合はサマリーに圧縮してトークン爆発を防ぐ。
    """
    if not data_context:
        return ""

    full = json.dumps(data_context, ensure_ascii=False, default=str)
    if len(full) <= _MAX_CONTEXT_CHARS:
        return full

    # 大きすぎる場合はキーと件数のサマリーに圧縮
    summary_parts = []
    for key, value in data_context.items():
        if isinstance(value, list):
            summary_parts.append(f"{key}: {len(value)}件")
        elif isinstance(value, dict):
            summary_parts.append(f"{key}: {{...}} ({len(value)} keys)")
        else:
            summary_parts.append(f"{key}: {repr(value)[:100]}")
    return "[データサマリー] " + ", ".join(summary_parts)


def format_conversational_context(data_context: dict) -> str:
    """データを人間が読みやすいサマリーに変換（会話型Dispatcher向け）。

    format_data_context() がLLM構造化入力向けなのに対し、
    こちらはユーザー会話向けの自然言語サマリーを生成する。
    """
    import logging
    _logger = logging.getLogger(__name__)
    
    if not data_context:
        _logger.warning("format_conversational_context: data_context is empty/None")
        return "データが読み込まれていません。"

    _logger.info("format_conversational_context: keys=%s", list(data_context.keys()))

    parts = []

    # 機器一覧
    assets = data_context.get("assets", [])
    asset_map = {}  # id -> name
    if assets:
        for a in assets:
            aid = a.get("id", "")
            aname = a.get("name", "")
            if aid:
                asset_map[aid] = aname
        ids = [f"{a.get('id', '?')}({a.get('name', '')})" for a in assets[:10]]
        label = ", ".join(ids)
        if len(assets) > 10:
            label += f" 他{len(assets) - 10}件"
        parts.append(f"登録機器: {len(assets)}件 — {label}")

    # 作業種別一覧
    wo = data_context.get("workOrders", [])
    wo_map = {}  # id -> name
    if wo:
        for w in wo:
            wid = w.get("id", "")
            wname = w.get("name", "")
            if wid:
                wo_map[wid] = wname
        names = list(set(w.get("name", "") for w in wo if w.get("name")))
        if names:
            parts.append(f"作業種別: {', '.join(names[:10])}")

    # 作業明細 — 機器ごとにグループ化
    wol = data_context.get("workOrderLines", [])
    if wol:
        parts.append(f"作業明細: 全{len(wol)}件")

        # 機器ごとにグループ化して詳細表示
        from collections import defaultdict
        by_asset = defaultdict(list)
        for line in wol:
            aid = line.get("AssetId", "不明")
            by_asset[aid].append(line)
        
        for aid in sorted(by_asset.keys())[:8]:  # 上位8機器まで
            lines = by_asset[aid]
            aname = asset_map.get(aid, "")
            label = f"{aid}({aname})" if aname else aid
            
            # 各ラインの日付と作業名
            details = []
            for line in sorted(lines, key=lambda ln: ln.get("PlanScheduleStart", "") or "")[:5]:
                plan = line.get("PlanScheduleStart", "")
                actual = line.get("ActualScheduleStart", "") or line.get("ActualStart", "")
                woid = line.get("WorkOrderId", "")
                woname = wo_map.get(woid, woid)
                
                if plan:
                    plan_str = plan[:10] if isinstance(plan, str) else str(plan)[:10]
                else:
                    plan_str = "未定"
                
                actual_str = ""
                if actual:
                    actual_str = f", 実績:{actual[:10] if isinstance(actual, str) else str(actual)[:10]}"
                
                details.append(f"  {woname}: 計画{plan_str}{actual_str}")
            
            parts.append(f"  {label} ({len(lines)}件):\n" + "\n".join(details))

    if not parts:
        return "データが読み込まれていますが、詳細情報はありません。"

    summary = "現在のデータ:\n" + "\n".join(f"- {p}" for p in parts)
    _logger.info("format_conversational_context output length: %d chars", len(summary))
    return summary
