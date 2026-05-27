# Maximo Connector — 開発契約ガイド

HOSHUTARO の **Maximo 連携プラグイン** を別チームが開発するための契約書です。
このドキュメントは「MCP プラグインとして公開する各ツールの引数・戻り値スキーマ」を定義します。

開発の起点は `core/plugins/maximo-connector/` のスケルトン（プラン WS2）。各ツール関数は
`NotImplementedError` を投げる雛形になっており、本ガイドの仕様で実装してください。
**ダミーデータを返すモック実装は作らないでください**（プラン方針）。

> 参照すべきデータ型: [`docs/DATA_MODEL.md`](./DATA_MODEL.md)（v3.0.0）

---

## 1. 配置と起動

| 項目 | 値 |
|---|---|
| プラグイン ID | `maximo-connector` |
| ディレクトリ | `core/plugins/maximo-connector/` |
| エントリ | `python -u server.py`（MCP stdio transport） |
| 必須環境変数 | `MAXIMO_BASE_URL`, `MAXIMO_API_KEY` |
| 任意環境変数 | `MAXIMO_OBJECT_STRUCTURE`（既定 `MXASSET`）, `MAXIMO_TIMEOUT_SEC`（既定 `30`） |

manifest.json の `configSchema` で UI から設定可能。`MAXIMO_API_KEY` は `secret: true`。

---

## 2. 公開ツール

すべて `@mcp.tool()` で公開。`server.py` 上の関数シグネチャと一致させること。

### 2-1. `test_connection() -> dict`

OSLC エンドポイントへの接続確認。

**Returns**:
```json
{
  "ok": true,
  "latency_ms": 42.5,
  "endpoint": "https://maximo.example.com/maximo/oslc",
  "error": null
}
```
失敗時は `ok: false`、`error` に詳細メッセージ。

### 2-2. `fetch_assets(object_structure, page_size, page_token, filter_expr) -> dict`

Maximo Asset の取得（ページング対応）。

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `object_structure` | string | × | 既定は env `MAXIMO_OBJECT_STRUCTURE`。 |
| `page_size` | int | × | 既定 200。最大 1000。 |
| `page_token` | string | × | 前回呼出で返された `next_page_token`。 |
| `filter_expr` | string | × | OSLC `oslc.where` に渡す式。 |

**Returns** — `records` は `DataModel.Asset` 配列:
```json
{
  "records": [
    {
      "id": "PMP-101",
      "name": "冷却水ポンプ B系",
      "hierarchyPath": { "Site": "PLANT1", "Area": "A" },
      "classificationPath": { "AssetType": "ROT_PUMP" },
      "specifications": [{ "key": "メーカー", "value": "荏原製作所", "order": 1 }]
    }
  ],
  "next_page_token": "abc==",
  "total": 12345
}
```

### 2-3. `fetch_work_orders(page_size, page_token, filter_expr) -> dict`

Maximo WorkOrder の取得（ページング対応）。`records` は `DataModel.WorkOrder` 配列。

```json
{
  "records": [
    {
      "id": "WO-2026-001",
      "name": "2026年度 ボイラー設備年次点検",
      "ClassificationId": "01"
    }
  ],
  "next_page_token": null,
  "total": 87
}
```

### 2-4. `fetch_hierarchies() -> dict`

Location 階層定義の取得。

```json
{
  "levels": [
    { "key": "Site", "order": 1, "values": ["PLANT1", "PLANT2"] },
    { "key": "Area", "order": 2, "values": ["A", "B"] }
  ]
}
```

### 2-5. `fetch_classifications() -> dict`

Classification 定義の取得。

```json
{
  "asset_classification": {
    "levels": [
      { "key": "AssetType", "order": 1, "values": ["ROT_PUMP", "BOILER"] }
    ]
  },
  "work_order_classifications": [
    { "id": "01", "name": "年次点検", "order": 1 },
    { "id": "02", "name": "月次点検", "order": 2 }
  ]
}
```

### 2-6. `push_assets(records: list[dict]) -> dict`

Asset を Maximo へ書き戻し。`records` は `DataModel.Asset` 配列。

実装方針:
- 既存 (`id` で判定) は **PATCH**、新規は **POST**。
- `safety.max_records` を呼出側で 50000 件に制限済み。サーバ側で上限超過チェックは不要。
- エラーはレコード単位で集約して返す（全件ロールバックしない）。

```json
{
  "ok": true,
  "created": 12,
  "updated": 34,
  "errors": [
    { "id": "PMP-999", "message": "Maximo: classstructureid not found" }
  ]
}
```

### 2-7. `push_work_orders(records: list[dict]) -> dict`

WorkOrder を Maximo へ書き戻し。形式は `push_assets` と同様。

### 2-8. `compute_diff(local_records, remote_records?, entity) -> dict`

書き戻し前のプレビュー用差分計算。

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `local_records` | list[Asset \| WorkOrder] | ○ | 保守太郎側のスナップショット |
| `remote_records` | list[Asset \| WorkOrder] | × | 未指定なら `fetch_assets`/`fetch_work_orders` を呼ぶ |
| `entity` | string | × | `"assets"`（既定）または `"workOrders"` |

**Returns**:
```json
{
  "to_create": [ /* local にあって remote にない */ ],
  "to_update": [ /* 双方にあり差分あり */ ],
  "to_delete": [ /* remote にあって local にない */ ],
  "unchanged_count": 1024
}
```

---

## 3. テスト方針

### 契約の静的検証

`core/tests/test_maximo_connector_contract.py` が以下を検証します:
- `manifest.json` の `tools` 配列に上記 8 ツールが網羅されている
- `configSchema` に必須キー (`MAXIMO_BASE_URL`, `MAXIMO_API_KEY`) が存在
- 内蔵 Skill (`core/skills/builtin/maximo_*.yaml`) の `required_servers` と一致

このテストは MCP サーバを起動しません（モックも作りません）。

### 実装後の統合テスト

実装着手後は、別途以下を整備してください（本リポジトリ外でも可）:
- Maximo dev tenant への `test_connection` 疎通
- 小規模 fetch（`page_size=10`）でのレスポンス形状検証
- `compute_diff` の create/update/delete 分類ロジックの単体テスト
- `push_*` の dry-run モード（推奨: env `MAXIMO_DRY_RUN=true` で書き戻しを抑止）

---

## 4. セキュリティ・運用注意

- `MAXIMO_API_KEY` は manifest の `secret: true` で保存。ログには絶対に出力しないこと。
- `push_*` 系は HOSHUTARO 側で `safety.requires_confirmation: true` の Skill 経由のみ呼ばれます。
  ユーザー確認なしの呼出元（自動化スクリプト等）は想定外。
- レート制限・リトライは httpx の組込で。OSLC は単一接続から大量リクエストを送ると拒否される
  ことがあるため、`asyncio.Semaphore` で並列度を絞ることを推奨。
- ページング: `next_page_token` には Maximo の `oslc.pageSize` + `offset` 等の状態を base64
  でラップしたものを返す想定。任意のフォーマットで OK（ただしクライアント側は不透明扱い）。
