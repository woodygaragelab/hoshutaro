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
