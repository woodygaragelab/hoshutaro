# 2. 外部システム連携コネクタの開発

保守太郎を既存のEAMシステム（Maximo, SAP PMRなど）や社内データベースと同期するためのプラグインを **「コネクタ」** と呼びます。

このドキュメントでは、コネクタ・プラグインとして保守太郎にスムーズに統合されるために実装すべき要件を解説します。コネクタも `1_GETTING_STARTED.md` と同じく **MCP Server** として実装しますが、提供する機能（Tool）の役割が定められています。

---

## コネクタの責務

コネクタプラグインは以下の責任を持ちます：
1. **外部システム（Maximoなど）と安全に通信する**
2. **外部データを保守太郎のデータ形式へ自動的に変換する（またはその逆）**
3. **データ変更時の差分計算を容易にするフォーマットで取得結果（JSON）を提供する**

---

## 必須ツール（Tool）仕様

保守太郎のフロントエンドやSkill Engineが期待している主なTool群は以下の通りです。これらを `@mcp.tool()` （あるいは他の言語のMCP SDKで提供するハンドラ）として実装し、`manifest.json` の `tools` リストに記載してください。

### 1. `test_connection` (接続確認)
```python
@mcp.tool()
def test_connection() -> dict:
    """外部システムへの接続状態をテストします"""
```
**戻り値の形式:**
```json
{
  "ok": true,
  "message": "Maximo APIへの接続に成功しました。"
}
```
※ 認証に失敗した場合は `{"ok": false, "message": "エラー内容"}`。保守太郎のUIで設定画面からこのToolがテスト用ボタンとして叩かれます。

### 2. `fetch_assets` / `fetch_work_orders` (データ取得)
外部システムから「機器(Asset)」「作業(WorkOrder)」のマスタやトランザクションデータを取得するToolです。

**引数の推奨事項:**
- `page_size` と `page_num`（ページネーションへの対応）
- `updated_since`（差分取得のためのタイムスタンプ）

**戻り値の形式（保守太郎のDataModelに合わせたJSON）:**
保守太郎の内部DBと型を合わせるため、以下のような形式で返却してください。フィールド名が保守太郎のUIやDataStoreのものと同一であれば、後続のSkill処理がとても楽になります。

```json
{
  "totalCount": 1500,
  "hasMore": true,
  "records": [
    {
      "TagNo": "PMP-101",        // 保守太郎上の必須キー
      "AssetName": "冷却水ポンプ B系",
      "Classification": "PUMP",
      "Status": "ACTIVE",
      "external_id_": "AX-3301"  // 外部システムの生IDなどを退避するフィールド
    }
  ]
}
```

### 3. `push_work_orders` (データ書込・エクスポート)
保守太郎側でユーザーが編集した結果を、外部システムへ反映させるToolです。
変更されたレコードのリストを受け取り、外部API（POST/PUT等）を呼び出して同期します。

**戻り値の形式（SyncResult）:**
```json
{
  "status": "success",
  "summary": {
    "total": 5, "updated": 4, "failed": 1
  },
  "errors": [
    {
      "recordId": "W-9001",
      "message": "完了ステータスのものは変更できません"
    }
  ]
}
```

---

## セキュリティ・認証情報の扱い方

Maximo APIのパスワードやトークン等の機密情報は、MCP Server のソースコードやファイルに書き込んではいけません。
**必ず `manifest.json` の `configSchema` 経由で保守太郎が環境変数として注入する仕組みを利用してください。**

**manifest.json の例:**
```json
"configSchema": {
  "MAXIMO_URL": { "type": "string", "label": "Maximo Base URL" },
  "MAXIMO_API_KEY": { "type": "secret", "label": "API Key", "required": true }
}
```

**Python側の受け取り例:**
```python
import os

url = os.getenv("MAXIMO_URL")
api_key = os.getenv("MAXIMO_API_KEY")

if not api_key:
    raise ValueError("API Keyが設定されていません")
```

---

## 実装のヒント：マッピング変換の工夫

外部システム(Maximo)のフィールド名と、保守太郎のUIで使われるフィールド名(TagNo, AssetNameなど)は異なるのが普通です。
プラグイン開発者は、この**マッピング（翻訳）**をプラグイン側で行うことを推奨します。

LLM（Gemini）にその変換処理をさせると、レコード数万件の変換にはコストと時間がかかりすぎます。Pythonコード側で辞書型を高速に変換してから返すようにしてください。
