# Maximo Connector — 開発雛形

HOSHUTARO の Maximo 連携を担う MCP プラグインの**スケルトン**です。本プラグインを別チームが
実装することで、HOSHUTARO の機器・作業データを Maximo と双方向同期できるようになります。

> 本ファイル群はすべて開発開始のための雛形であり、各ツールは `NotImplementedError` を投げます。
> **モック実装（ダミーデータ）は意図的に作っていません**（プラン方針）。

## 開発の始め方

1. 仮想環境を作成し依存をインストール:
   ```bash
   cd core/plugins/maximo-connector
   python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. 環境変数を設定（実 Maximo の接続先がない場合は dev tenant を使用）:
   ```
   MAXIMO_BASE_URL=https://maximo.example.com/maximo/oslc
   MAXIMO_API_KEY=...
   MAXIMO_OBJECT_STRUCTURE=MXASSET
   ```

3. スケルトンを起動して MCP 経由で疎通確認:
   ```bash
   python -u server.py
   ```

4. `server.py` の各 `@mcp.tool()` 関数の `_not_implemented(...)` を実装に置き換えてください。
   契約（引数・戻り値スキーマ）は **`docs/13_MAXIMO_CONNECTOR_GUIDE.md`** を必読。

## 公開ツール

| ツール | 役割 |
|---|---|
| `test_connection` | 接続確認（OSLC whoami） |
| `fetch_assets` | Maximo Asset 取得（ページング対応） |
| `fetch_work_orders` | Maximo WorkOrder 取得（ページング対応） |
| `fetch_hierarchies` | Location 階層定義の取得 |
| `fetch_classifications` | Classification（Asset/WorkOrder）定義の取得 |
| `push_assets` | Asset の書き戻し（新規 POST / 既存 PATCH） |
| `push_work_orders` | WorkOrder の書き戻し |
| `compute_diff` | ローカルとリモートの差分計算（push 前プレビュー用） |

これらは `core/skills/builtin/maximo_import.yaml` / `maximo_export.yaml` から `required_servers:
[{type: "maximo-connector"}]` 経由で呼ばれます。

## 契約テスト

`core/tests/test_maximo_connector_contract.py` で `manifest.json` の妥当性と公開ツール一覧の
整合（組込 Skill との一致）を**静的に**検証します。モックサーバは起動しません。

## 注意事項

- 本コネクタは Maximo 環境への副作用を伴います。**実装時は dev tenant で検証してください**。
- `push_*` は `safety.requires_confirmation: true` のスキル経由でのみ呼ばれる想定です。
- `MAXIMO_API_KEY` は manifest.json の `configSchema.secret: true` で保存され、ログには
  出力されません。
