"""
Maximo Connector — MCP プラグインスケルトン（プラン WS2）。

本ファイルは別チームによる Maximo 連携実装の **開発雛形** です。各ツールは
`NotImplementedError` を投げ、docstring に期待挙動・引数・戻り値スキーマを明示します。
**ダミーデータを返すモック実装は意図的に作りません**（プラン方針）。

実装契約: docs/13_MAXIMO_CONNECTOR_GUIDE.md を参照してください。

実行:
    cd core/plugins/maximo-connector
    pip install -r requirements.txt
    python -u server.py
"""

from __future__ import annotations

import logging
import os
from typing import Any

from mcp.server.fastmcp import FastMCP

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("maximo-connector")

mcp = FastMCP("maximo-connector")


# ───────────────────────────────────────────────────────────
# Configuration helpers
# ───────────────────────────────────────────────────────────


def _config() -> dict[str, str]:
    """環境変数から接続情報を読む。すべて未設定の場合もエラーにはせず、ツール内で個別検証。"""
    return {
        "base_url": os.environ.get("MAXIMO_BASE_URL", ""),
        "api_key": os.environ.get("MAXIMO_API_KEY", ""),
        "object_structure": os.environ.get("MAXIMO_OBJECT_STRUCTURE", "MXASSET"),
        "timeout_sec": os.environ.get("MAXIMO_TIMEOUT_SEC", "30"),
    }


def _not_implemented(tool_name: str, expected: str) -> Any:
    """別チーム実装ポイントを示す統一エラー。期待挙動の要約を含む。"""
    raise NotImplementedError(
        f"[maximo-connector] '{tool_name}' は未実装です（別チーム実装ポイント）。"
        f"期待挙動: {expected}。詳細は docs/13_MAXIMO_CONNECTOR_GUIDE.md を参照。"
    )


# ───────────────────────────────────────────────────────────
# Tools — すべて NotImplementedError（モック実装は作らない）
# ───────────────────────────────────────────────────────────


@mcp.tool()
def test_connection() -> dict:
    """Maximo REST/OSLC エンドポイントへの接続確認。

    実装ポイント:
        - MAXIMO_BASE_URL + MAXIMO_API_KEY を使った最小 GET（例: /maximo/oslc/whoami）
        - 200 → ok=True、それ以外 → ok=False + エラー詳細

    Returns:
        { "ok": bool, "latency_ms": float, "endpoint": str, "error"?: str }
    """
    return _not_implemented(
        "test_connection",
        "OSLC whoami への GET でレイテンシ + 接続可否を返す",
    )


@mcp.tool()
def fetch_assets(
    object_structure: str | None = None,
    page_size: int = 200,
    page_token: str | None = None,
    filter_expr: str | None = None,
) -> dict:
    """Maximo Asset を取得（ページング対応）。

    実装ポイント:
        - object_structure 未指定なら MAXIMO_OBJECT_STRUCTURE を使う
        - OSLC `?oslc.select=assetnum,description,location,classstructureid,...`
        - filter_expr は OSLC `oslc.where` に渡す
        - 戻りは docs/DATA_MODEL.md の Asset スキーマに準拠

    Returns:
        {
          "records": [ { "id": str, "name": str, "hierarchyPath": dict, "specifications": list, ... } ],
          "next_page_token": str | None,
          "total": int
        }
    """
    return _not_implemented(
        "fetch_assets",
        "OSLC で Asset を取得し DATA_MODEL.md の Asset 形式で返す",
    )


@mcp.tool()
def fetch_work_orders(
    page_size: int = 200,
    page_token: str | None = None,
    filter_expr: str | None = None,
) -> dict:
    """Maximo Work Order を取得（ページング対応）。

    Returns:
        {
          "records": [ { "name": str, "classificationId": str, ... } ],
          "next_page_token": str | None,
          "total": int
        }
    """
    return _not_implemented(
        "fetch_work_orders",
        "OSLC で WorkOrder を取得し DATA_MODEL.md の WorkOrder 形式で返す",
    )


@mcp.tool()
def fetch_hierarchies() -> dict:
    """Maximo の階層（Location/Classification）定義を取得。

    Returns:
        { "levels": [ { "key": str, "order": int, "values": [str, ...] } ] }
    """
    return _not_implemented(
        "fetch_hierarchies",
        "OSLC で Location 階層構造を取得し HierarchyDefinition 形式で返す",
    )


@mcp.tool()
def fetch_classifications() -> dict:
    """Maximo の分類定義（Asset / WorkOrder 用）を取得。

    Returns:
        {
          "asset_classification": { "levels": [...] },
          "work_order_classifications": [ { "id": str, "name": str, "order": int } ]
        }
    """
    return _not_implemented(
        "fetch_classifications",
        "Classification 階層と作業分類を取得して保守太郎の分類定義形式で返す",
    )


@mcp.tool()
def push_assets(records: list[dict]) -> dict:
    """保守太郎側の Asset 変更を Maximo に書き戻す。

    実装ポイント:
        - records は DATA_MODEL.md の Asset スキーマ
        - 新規は POST、既存は PATCH（assetnum で判定）
        - max_records 超過は呼び出し側で制限済みとみなす

    Returns:
        { "ok": bool, "created": int, "updated": int, "errors": [ { "id": str, "message": str } ] }
    """
    return _not_implemented(
        "push_assets",
        "Asset を POST/PATCH で書き戻し、作成/更新件数とエラーを返す",
    )


@mcp.tool()
def push_work_orders(records: list[dict]) -> dict:
    """保守太郎側の WorkOrder 変更を Maximo に書き戻す。"""
    return _not_implemented(
        "push_work_orders",
        "WorkOrder を POST/PATCH で書き戻し、作成/更新件数とエラーを返す",
    )


@mcp.tool()
def compute_diff(
    local_records: list[dict],
    remote_records: list[dict] | None = None,
    entity: str = "assets",
) -> dict:
    """ローカル（保守太郎）と Maximo 側の差分を計算（push 前のプレビュー用）。

    実装ポイント:
        - remote_records が None なら fetch_assets / fetch_work_orders を呼んで取得
        - 主キー（id / name）で突き合わせ、create / update / delete を分類

    Returns:
        {
          "to_create": [...], "to_update": [...], "to_delete": [...],
          "unchanged_count": int
        }
    """
    return _not_implemented(
        "compute_diff",
        "ローカルとリモートを突き合わせ create/update/delete のレコード集合を返す",
    )


# ───────────────────────────────────────────────────────────
# Entry point
# ───────────────────────────────────────────────────────────


if __name__ == "__main__":
    cfg = _config()
    if not cfg["base_url"]:
        logger.warning(
            "[maximo-connector] MAXIMO_BASE_URL 未設定。実装後は環境変数で接続情報を渡してください。"
        )
    if not cfg["api_key"]:
        logger.warning("[maximo-connector] MAXIMO_API_KEY 未設定。")
    logger.info("[maximo-connector] スケルトン起動。各ツールは NotImplementedError を返します。")
    mcp.run()
