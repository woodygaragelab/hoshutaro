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
保守太郎の内部DB（`DATA_MODEL.md`）と型を合わせるため、以下のような形式で返却してください。フィールド名が保守太郎のもので統一されていれば、フロントエンドの表示や後続のSkill処理がシームレスに行えます。

```json
{
  "totalCount": 1500,
  "hasMore": true,
  "records": [
    {
      "id": "PMP-101",
      "name": "冷却水ポンプ B系",
      "hierarchyPath": { "製油所": "第一製油所", "エリア": "Aエリア" },
      "classificationPath": { "機器大分類": "回転機", "機器種別": "遠心ポンプ" },
      "specifications": [
        { "key": "メーカー", "value": "荏原製作所", "order": 1 },
        { "key": "ステータス", "value": "ACTIVE", "order": 2 }
      ],
      "_maximo_asset_id": "AX-3301" // 外部システムの生IDなどを退避するフィールド
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

### 4. `fetch_hierarchies` / `fetch_classifications` (マスターデータ取得) ― 推奨
外部システムからLocation階層やClassification分類ツリーを取得するToolです。初期セットアップの自動化に有用です。

```python
@mcp.tool()
def fetch_hierarchies() -> dict:
    """外部システムの設備階層マスターを取得します"""
```

```python
@mcp.tool()
def fetch_classifications() -> dict:
    """外部システムの機器分類マスターを取得します"""
```

---

## セキュリティ・認証情報の扱い方

Maximo APIのパスワードやトークン等の機密情報は、MCP Server のソースコードやファイルに書き込んではいけません。
**必ず `manifest.json` の `configSchema` 経由で保守太郎が環境変数として注入する仕組みを利用してください。**

### 具体的な設定と動作の仕組み

1. **メタデータの定義:** `manifest.json` の `configSchema` に必要なキー（例: `MAXIMO_URL`）と型（`string` や `secret`）を定義します。
2. **UIからの入力:** 保守太郎はこれを見て、プラグイン設定画面に自動的に入力フォームを生成します。`type: "secret"` に設定された項目はパスワード扱い（伏せ字）となります。
3. **プロセスの起動と注入:** ユーザーが値を設定してプラグインを起動すると、保守太郎はその値を**環境変数として**プラグインの子プロセスに注入（エクスポート）した状態で実行します。

**manifest.json の定義例:**
```json
"configSchema": {
  "MAXIMO_URL": { "type": "string", "label": "Maximo Base URL", "default": "https://maximo.example.com" },
  "MAXIMO_API_KEY": { "type": "secret", "label": "API Key", "required": true }
}
```

**Pythonプラグイン側での受け取り例:**
プラグイン側では、起動時に環境変数として渡ってくるため、コード内でOSの環境変数を読み取るだけで安全に値を利用できます。

```python
import os

MAXIMO_URL = os.getenv("MAXIMO_URL")
MAXIMO_API_KEY = os.getenv("MAXIMO_API_KEY")

if not MAXIMO_API_KEY:
    raise ValueError("API Keyが設定されていません。保守太郎のプラグイン設定画面から入力してください。")
```

---

## 実装のヒント：マッピング変換の工夫

外部システム（例：MaximoやSAP）のフィールド名と、保守太郎のUIで使用される標準フィールド名（TagNo, AssetNameなど）は異なるのが普通です。
プラグイン開発者は、この**マッピング（翻訳）処理**をプラグイン側（Pythonコード等）で確実に行うことを強く推奨します。

LLM（Gemini）に数万件のデータマッピング処理を任せると、APIコストが膨大になり処理時間もかかりすぎます。必ずプログラム言語側で辞書機能を用いた高速な変換を行い、成形済みのJSON配列を保守太郎へ返してください。

---

# コードマッピング・リファレンス （DataModel v3.0.0 全変数辞書）

> **対象読者**: 外部データ連携MCPコネクタの設計者・開発者
>
> このセクションでは、保守太郎 DataModel v3.0.0 の **全エンティティ・全プロパティ** を網羅的に掲載しています。
> コネクタからの `fetch_*` / `push_*` Tool の戻り値・引数を設計する際に、この辞書を正として参照してください。

## DataModel ルートオブジェクト

保守太郎の内部データストアは、以下のトップレベル構造を持つ単一の JSON オブジェクトです。

```typescript
interface DataModel {
  version: string;                                           // "3.0.0"
  assets: { [id: string]: Asset };                           // 機器マスター (キー = Asset.id)
  workOrders: { [id: string]: WorkOrder };                   // 作業オーダー (キー = WorkOrder.id)
  workOrderLines: { [id: string]: WorkOrderLine };           // 作業明細 (キー = WorkOrderLine.id)
  hierarchy: HierarchyDefinition;                            // 機器階層マスター
  workOrderClassifications: WorkOrderClassification[];       // 作業分類マスター
  assetClassification: AssetClassificationDefinition;        // 機器分類マスター
  metadata: { lastModified: Date };                          // メタデータ
}
```

コネクタは `assets`, `workOrders`, `workOrderLines` のそれぞれに対応する `fetch_*` / `push_*` ツールを提供することになります。`hierarchy`, `workOrderClassifications`, `assetClassification` はマスターデータであり、`fetch_hierarchies` / `fetch_classifications` として提供すると初期セットアップが自動化されます。

---

## 1. Asset（機器）— 全プロパティ一覧

保守の対象となる設備や機器のマスターデータです。`fetch_assets` の `records[]` 内の各オブジェクトがこの形式に対応します。

| # | プロパティ名 | 型 | 必須 | デフォルト | 説明 | Maximoフィールド例 | SAP PMフィールド例 |
|---|---|---|---|---|---|---|---|
| 1 | `id` | `string` | ★必須 | — | ユニークなTAG No.や機器ID。保守太郎での一意キー。 | `ASSETNUM` | `EQUNR` (設備番号) |
| 2 | `name` | `string` | ★必須 | — | 機器名称。UIの表示名やツリー表示のラベル。 | `DESCRIPTION` | `EQKTX` (設備テキスト) |
| 3 | `hierarchyPath` | `object` | 任意 | `{}` | 設置場所の階層データ。キーがレベル名、値が所属値。`HierarchyDefinition.levels` のキーと一致させること。 | `LOCATION` (パース要) | `TPLNR` (保全場所) |
| 4 | `classificationPath` | `object` | 任意 | `{}` | 機器分類の階層データ。キーがレベル名、値が所属値。`AssetClassificationDefinition.levels` のキーと一致させること。 | `CLASSSTRUCTUREID` | `EQART` (設備タイプ) |
| 5 | `specifications` | `Specification[]` | 任意 | `[]` | 機器の仕様データ。キーバリュー配列。詳細は後述の `Specification` 型を参照。 | 各種属性フィールド | 区分データ群 |
| 6 | `createdAt` | `Date` (ISO 8601) | 自動 | 作成時刻 | レコード作成日時。コネクタが外部システムの作成日を渡す場合に使用。 | `STATUSDATE` | `ERDAT` |
| 7 | `updatedAt` | `Date` (ISO 8601) | 自動 | 更新時刻 | レコード最終更新日時。差分同期の基準。 | `CHANGEDATE` | `AEDAT` |

### hierarchyPath の構造

```json
{
  "製油所": "第一製油所",
  "エリア": "Aエリア",
  "ユニット": "U-100"
}
```
- キーは `HierarchyDefinition.levels[].key` と一致する必要があります
- 値が空文字やnullの場合、保守太郎は自動的に `"階層未設定"` に正規化します
- 全ての階層レベルキーが含まれていない場合も `"階層未設定"` で補完されます

### classificationPath の構造

```json
{
  "機器大分類": "回転機",
  "機器種別": "遠心ポンプ",
  "機器型式": "P-100型"
}
```
- キーは `AssetClassificationDefinition.levels[].key` と一致する必要があります
- `hierarchyPath` と同じ `{ [levelKey: string]: string }` 型です

### Specification 型（specifications 配列の要素）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `key` | `string` | ★必須 | 仕様項目名（例: `"メーカー"`, `"吐出量"`, `"Status"`） |
| 2 | `value` | `string` | ★必須 | 仕様値（例: `"荏原製作所"`, `"150 L/min"`, `"ACTIVE"`） |
| 3 | `order` | `number` | ★必須 | 表示順序（0始まり、重複不可推奨） |

> **注意**: `specifications` は型安全のため、値はすべて `string` で格納します。数値や日付も文字列に変換してください。

### 拡張フィールド（`_` プレフィックス）

アンダースコア始まりの任意のキーを追加可能です。これらは保守太郎のUIには表示されませんが、JSONとして保持され、後続の `push_*` 処理で外部システムへの逆マッピングに利用できます。

```json
{
  "_maximo_asset_id": "AX-3301",
  "_maximo_site_id": "PLANT01",
  "_sap_equipment_no": "000000012345"
}
```

---

## 2. WorkOrder（作業オーダー）— 全プロパティ一覧

複数の「作業明細（WorkOrderLine）」を束ねる親となる管理単位です。

| # | プロパティ名 | 型 | 必須 | デフォルト | 説明 | Maximoフィールド例 | SAP PMフィールド例 |
|---|---|---|---|---|---|---|---|
| 1 | `id` | `string` | ★必須 | — | ユニークな作業番号。保守太郎での一意キー。 | `WONUM` | `AUFNR` (オーダー番号) |
| 2 | `name` | `string` | ★必須 | — | 作業名称 / パッケージ名。 | `DESCRIPTION` | `KTEXT` (短テキスト) |
| 3 | `ClassificationId` | `string` | 任意 | `""` | 保守区分ID。`WorkOrderClassification.id` への外部キー。 | `WORKTYPE` | `ILART` (保全活動タイプ) |
| 4 | `CreatedAt` | `Date` (ISO 8601) | 任意 | 作成時刻 | レコード作成日時。 | `REPORTDATE` | `ERDAT` |
| 5 | `UpdatedAt` | `Date` (ISO 8601) | 任意 | 更新時刻 | レコード最終更新日時。 | `CHANGEDATE` | `AEDAT` |

---

## 3. WorkOrderLine（作業明細）— 全プロパティ一覧

保守太郎のメイン画面（ガントチャート / 星取表）に表示される **1 Event × 1 Asset** のスケジュール実績データです。

| # | プロパティ名 | 型 | 必須 | デフォルト | 説明 | Maximoフィールド例 | SAP PMフィールド例 |
|---|---|---|---|---|---|---|---|
| 1 | `id` | `string` | ★必須 | — | ユニークID。 | `WONUM + TASKID` | `AUFNR + VORNR` |
| 2 | `name` | `string` | ★必須 | — | 作業内容。 | `DESCRIPTION` | `LTXA1` (工程テキスト) |
| 3 | `WorkOrderId` | `string` | ★必須 | — | 親WorkOrderのid (外部キー)。 | `WONUM` (親) | `AUFNR` (親) |
| 4 | `AssetId` | `string` | ★必須 | — | 対象AssetのId (外部キー)。 | `ASSETNUM` | `EQUNR` |
| 5 | `PlanScheduleStart` | `Date` (ISO 8601) | 任意 | `null` | 予定開始日時。 | `SCHEDSTART` | `GSTRP` (計画開始日) |
| 6 | `PlanScheduleEnd` | `Date` (ISO 8601) | 任意 | `null` | 予定終了日時。 | `SCHEDFINISH` | `GLTRP` (計画終了日) |
| 7 | `ActualScheduleStart` | `Date` (ISO 8601) | 任意 | `null` | 実績開始日時。 | `ACTSTART` | `GSTRI` (実績開始日) |
| 8 | `ActualScheduleEnd` | `Date` (ISO 8601) | 任意 | `null` | 実績終了日時。 | `ACTFINISH` | `GLTRI` (実績終了日) |
| 9 | `Planned` | `boolean` | 任意 | `false` | 計画に組み込まれているか。 | `STATUS` の派生 | `STTXT` の派生 |
| 10 | `Actual` | `boolean` | 任意 | `false` | 実施されたか（完了か）。 | `STATUS` の派生 | `STTXT` の派生 |
| 11 | `PlanCost` | `number` | 任意 | `0` | 予定費用 (>= 0)。 | `ESTINTLABCOST` | `ANFKO` |
| 12 | `ActualCost` | `number` | 任意 | `0` | 実績費用 (>= 0)。 | `ACTINTLABCOST` | `ISTKO` |
| 13 | `PlannedManhours` | `number` | 任意 | `undefined` | 予定工数 (hours, >= 0)。 | `ESTDUR` | `ARBEI` (標準値) |
| 14 | `ActualManhours` | `number` | 任意 | `undefined` | 実績工数 (hours, >= 0)。 | `ACTLABHRS` | `ISMNW` (実績工数) |
| 15 | `CreatedAt` | `Date` (ISO 8601) | 自動 | 作成時刻 | レコード作成日時。 | `REPORTDATE` | `ERDAT` |
| 16 | `UpdatedAt` | `Date` (ISO 8601) | 自動 | 更新時刻 | レコード最終更新日時。 | `CHANGEDATE` | `AEDAT` |

### schedule フィールド（v3.0.0 拡張）

内部的に集約タイムライン用に `schedule` プロパティを使用する場合があります。コネクタから直接設定する必要はなく、保守太郎の内部処理で自動計算されます。

```typescript
schedule?: {
  [dateKey: string]: {    // 例: "2026-05", "2026-Q2"
    planned: boolean;
    actual: boolean;
    planCost: number;
    actualCost: number;
  }
};
```

---

## 4. WorkOrderClassification（作業分類マスター）— 全プロパティ一覧

WorkOrder の種類（保守区分）を定義するマスターデータです。最大20個程度のフラットなリスト。

| # | プロパティ名 | 型 | 必須 | 説明 | Maximoフィールド例 | SAP PMフィールド例 |
|---|---|---|---|---|---|---|
| 1 | `id` | `string` | ★必須 | ユニークID（例: `"01"`, `"02"`）。`WorkOrder.ClassificationId` がこの値を参照する。 | `WORKTYPE` 値 | `ILART` 値 |
| 2 | `name` | `string` | ★必須 | 分類名（例: `"年次点検"`, `"オーバーホール"`, `"SDM"`）。 | `WORKTYPEDESC` | `ILATX` |
| 3 | `order` | `number` | ★必須 | 表示順序（1始まり）。 | — | — |

```json
[
  { "id": "01", "name": "年次点検", "order": 1 },
  { "id": "02", "name": "オーバーホール", "order": 2 },
  { "id": "03", "name": "SDM", "order": 3 },
  { "id": "04", "name": "日常点検", "order": 4 }
]
```

---

## 5. HierarchyDefinition（機器階層マスター）— 全プロパティ一覧

機器 (Asset) が「どこに」設置されているかを定義するツリー構造のマスターデータです。

### HierarchyDefinition

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `levels` | `HierarchyLevel[]` | ★必須 | 階層レベルの配列。ルート（上位）から順番に定義。 |

### HierarchyLevel（levels配列の要素）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `key` | `string` | ★必須 | レベル名（例: `"製油所"`, `"エリア"`, `"ユニット"`）。`Asset.hierarchyPath` のキーと一致。 |
| 2 | `values` | `TreeLevelValue[]` | ★必須 | そのレベルに属する値の配列。 |

### TreeLevelValue（values配列の要素）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `value` | `string` | ★必須 | ノード値（例: `"第一製油所"`, `"Aエリア"`）。 |
| 2 | `parentValue` | `string` | 任意 | 親ノードの `value`。ルートレベルでは省略。 |

**完全なJSON例:**
```json
{
  "levels": [
    {
      "key": "製油所",
      "values": [
        { "value": "第一製油所" },
        { "value": "第二製油所" }
      ]
    },
    {
      "key": "エリア",
      "values": [
        { "value": "Aエリア", "parentValue": "第一製油所" },
        { "value": "Bエリア", "parentValue": "第一製油所" },
        { "value": "Cエリア", "parentValue": "第二製油所" }
      ]
    },
    {
      "key": "ユニット",
      "values": [
        { "value": "U-100", "parentValue": "Aエリア" },
        { "value": "U-200", "parentValue": "Bエリア" }
      ]
    }
  ]
}
```

---

## 6. AssetClassificationDefinition（機器分類マスター）— 全プロパティ一覧

機器 (Asset) が「どのような種類の」設備であるかを定義するツリー構造のマスターデータです。
構造は「機器階層マスター (HierarchyDefinition)」と全く同じです。

### AssetClassificationDefinition

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `levels` | `AssetClassificationLevel[]` | ★必須 | 分類レベルの配列。大分類から順番に定義。 |

### AssetClassificationLevel（levels配列の要素）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `key` | `string` | ★必須 | レベル名（例: `"機器大分類"`, `"機器種別"`, `"機器型式"`）。`Asset.classificationPath` のキーと一致。 |
| 2 | `values` | `TreeLevelValue[]` | ★必須 | そのレベルに属する値の配列。（`TreeLevelValue` は上記 §5 と同一型） |

**完全なJSON例:**
```json
{
  "levels": [
    {
      "key": "機器大分類",
      "values": [
        { "value": "回転機" },
        { "value": "静機器" },
        { "value": "電気計装" }
      ]
    },
    {
      "key": "機器種別",
      "values": [
        { "value": "遠心ポンプ", "parentValue": "回転機" },
        { "value": "コンプレッサー", "parentValue": "回転機" },
        { "value": "熱交換器", "parentValue": "静機器" },
        { "value": "塔槽類", "parentValue": "静機器" }
      ]
    }
  ]
}
```

---

## 7. コネクタ I/F — 同期結果・差分プレビュー型

`push_*` ツールからの戻り値や、差分プレビュー機能で使用されるデータ型の全プロパティです。

### SyncResult（同期結果）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `connectorId` | `string` | ★必須 | コネクタのID。 |
| 2 | `entity` | `string` | ★必須 | エンティティ種別（`"assets"`, `"workOrders"`, `"workOrderLines"`）。 |
| 3 | `direction` | `"import" \| "export"` | ★必須 | 同期方向。 |
| 4 | `status` | `"success" \| "partial" \| "failed"` | ★必須 | 全体ステータス。 |
| 5 | `summary.total` | `number` | ★必須 | 処理対象の総件数。 |
| 6 | `summary.created` | `number` | ★必須 | 新規作成された件数。 |
| 7 | `summary.updated` | `number` | ★必須 | 更新された件数。 |
| 8 | `summary.skipped` | `number` | ★必須 | スキップされた件数。 |
| 9 | `summary.failed` | `number` | ★必須 | 失敗した件数。 |
| 10 | `errors` | `SyncError[]` | ★必須 | エラー詳細の配列。 |
| 11 | `startedAt` | `string` (ISO 8601) | ★必須 | 同期開始時刻。 |
| 12 | `completedAt` | `string` (ISO 8601) | ★必須 | 同期完了時刻。 |
| 13 | `durationMs` | `number` | ★必須 | 処理所要時間 (ミリ秒)。 |

### SyncError（同期エラー詳細）

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `recordId` | `string` | ★必須 | エラー対象のレコードID。 |
| 2 | `field` | `string` | 任意 | エラーが発生したフィールド名。 |
| 3 | `errorCode` | `string` | ★必須 | エラーコード（例:`"AUTH_FAILED"`, `"RECORD_LOCKED"`）。 |
| 4 | `message` | `string` | ★必須 | 人間可読なエラーメッセージ。 |
| 5 | `severity` | `"warning" \| "error" \| "critical"` | ★必須 | エラー重大度。 |

### DiffRecord（差分プレビュー）

`push_*` の前にユーザーに差分を表示する際に使用します。

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `id` | `string` | ★必須 | 対象レコードID。 |
| 2 | `entity` | `string` | ★必須 | エンティティ種別。 |
| 3 | `action` | `"create" \| "update" \| "delete" \| "unchanged"` | ★必須 | 変更種別。 |
| 4 | `source` | `object \| null` | ★必須 | 保守太郎側の現在値。 |
| 5 | `target` | `object \| null` | ★必須 | 外部システム側の現在値。 |
| 6 | `changes` | `{ field, oldValue, newValue }[]` | ★必須 | 変更されたフィールドの詳細。 |

### BatchProgress（バッチ進捗）

大量データ同期時の進捗通知に使用します。

| # | プロパティ名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | `entity` | `string` | ★必須 | エンティティ種別。 |
| 2 | `currentBatch` | `number` | ★必須 | 現在のバッチ番号。 |
| 3 | `totalBatches` | `number` | ★必須 | 総バッチ数。 |
| 4 | `processedRecords` | `number` | ★必須 | 処理済みレコード数。 |
| 5 | `totalRecords` | `number` | ★必須 | 総レコード数。 |
| 6 | `percentage` | `number` | ★必須 | 進捗率 (0–100)。 |
| 7 | `estimatedTimeRemainingMs` | `number` | ★必須 | 推定残り時間 (ミリ秒)。 |
| 8 | `errors` | `SyncError[]` | ★必須 | 現在のバッチで発生したエラー。 |

---

## 8. ConnectorConfig — フィールドマッピング設計リファレンス

保守太郎は内部的に `ConnectorConfig` を保持し、フィールド単位のマッピング設定を管理します。コネクタ開発者がこの構造をそのまま実装する必要はありませんが、マッピングの設計ガイドとして参照してください。

### EntityFieldMapping

| # | プロパティ名 | 型 | 説明 |
|---|---|---|---|
| 1 | `sourceEntity` | `string` | 保守太郎側エンティティ名（`"assets"`, `"workOrders"`, `"workOrderLines"`） |
| 2 | `targetEntity` | `string` | 外部側エンティティ名（例: `"MXASSET"`, `"AUFK"`） |
| 3 | `targetObjectStructure` | `string` | Maximo Object Structure名（例: `"MXAPIASSET"`）、SAP BAPI名等 |
| 4 | `direction` | `"import" \| "export" \| "bidirectional"` | マッピング方向 |
| 5 | `keyField` | `{ source, target }` | 主キーのマッピング（例: `{ source: "id", target: "ASSETNUM" }`） |
| 6 | `fields` | `FieldMap[]` | 個別フィールドのマッピング配列 |
| 7 | `transformers` | `FieldTransformer[]` | カスタム変換定義（任意） |

### FieldMap（個別フィールドマッピング）

| # | プロパティ名 | 型 | 説明 |
|---|---|---|---|
| 1 | `source` | `string` | 保守太郎フィールドパス（ドット記法: `"specifications[0].value"`） |
| 2 | `target` | `string` | 外部システムフィールドパス（例: `"MANUFACTURER"`） |
| 3 | `direction` | `"import" \| "export" \| "bidirectional"` | フィールド単位の方向 |
| 4 | `required` | `boolean` | 必須フィールドか |
| 5 | `defaultValue` | `any` | デフォルト値（外部が空の場合に使用） |
| 6 | `transform` | `string` | 変換タイプ: `"none"`, `"date_iso"`, `"date_maximo"`, `"number"`, `"boolean"`, `"custom"` |

---

## 9. 内部DataStore Tool リファレンス

Skill Engine から呼び出される DataStore Tool の一覧です。コネクタが `fetch_*` でデータを返すと、これらの内部ツールを通じてデータストアに書き込まれます。

| Tool名 | 説明 | 引数 |
|---|---|---|
| `datastore.query_assets` | 機器データを検索 | `filter?: string` |
| `datastore.query_work_orders` | WorkOrderデータを検索 | `filter?: string` |
| `datastore.query_work_order_lines` | WorkOrderLineデータを検索 | `filter?: string` |
| `datastore.import_records` | レコードをインポート | `entity: string`, `records: array` |
| `datastore.export_records` | レコードをエクスポート | `entity: string`, `filter?: string` |
| `datastore.get_statistics` | データ統計を取得 | — |
| `datastore.backup` | データをバックアップ | — |

---

## 10. マッピングコード実装例

### Maximo → 保守太郎（Asset）

```python
def map_maximo_to_hoshutaro(maximo_records: list[dict]) -> list[dict]:
    """
    MaximoのAPIレスポンス（辞書のリスト）を
    保守太郎標準フォーマット(DATA_MODEL.md)のリストへ変換する
    """
    mapped_records = []
    
    for record in maximo_records:
        hoshutaro_record = {
            "id": record.get("ASSETNUM", "UNKNOWN_ID"),
            "name": record.get("DESCRIPTION", ""),
            
            # 設置場所の階層（MaximoのLocation等を適宜パースして生成）
            "hierarchyPath": {
                "Location": record.get("LOCATION", "UNKNOWN")
            },
            
            # 機器の種類（Maximoのクラス等をパースして生成）
            "classificationPath": {
                "Class": record.get("CLASSSTRUCTUREID", "UNDEFINED")
            },
            
            # 任意の仕様や状態データを配列で格納
            "specifications": [
                {"key": "Status", "value": record.get("STATUS", "ACTIVE"), "order": 1},
                {"key": "Manufacturer", "value": record.get("MANUFACTURER", ""), "order": 2},
                {"key": "LastUpdated", "value": record.get("CHANGEDATE", ""), "order": 3}
            ],
            
            # 外部キー退避（更新API呼び出し時や差分判定などに必要）
            "_maximo_asset_id": record.get("ASSETID", ""),
            "_maximo_site_id": record.get("SITEID", ""),
        }
        mapped_records.append(hoshutaro_record)
        
    return mapped_records
```

### Maximo → 保守太郎（WorkOrder + WorkOrderLine）

```python
def map_maximo_wo_to_hoshutaro(maximo_wo: dict) -> tuple[dict, list[dict]]:
    """
    Maximoの作業オーダー（タスク含む）を
    保守太郎の WorkOrder + WorkOrderLine に分割変換する
    """
    wo = {
        "id": maximo_wo.get("WONUM", ""),
        "name": maximo_wo.get("DESCRIPTION", ""),
        "ClassificationId": map_worktype(maximo_wo.get("WORKTYPE", "")),
        "CreatedAt": maximo_wo.get("REPORTDATE", ""),
        "UpdatedAt": maximo_wo.get("CHANGEDATE", ""),
    }
    
    lines = []
    for idx, task in enumerate(maximo_wo.get("WOACTIVITY", []), start=1):
        line = {
            "id": f"{wo['id']}-{task.get('TASKID', idx)}",
            "name": task.get("DESCRIPTION", ""),
            "WorkOrderId": wo["id"],
            "AssetId": task.get("ASSETNUM", ""),
            "PlanScheduleStart": task.get("SCHEDSTART"),
            "PlanScheduleEnd": task.get("SCHEDFINISH"),
            "ActualScheduleStart": task.get("ACTSTART"),
            "ActualScheduleEnd": task.get("ACTFINISH"),
            "Planned": True,
            "Actual": task.get("STATUS") == "COMP",
            "PlanCost": float(task.get("ESTINTLABCOST", 0) or 0),
            "ActualCost": float(task.get("ACTINTLABCOST", 0) or 0),
            "PlannedManhours": float(task.get("ESTDUR", 0) or 0),
            "ActualManhours": float(task.get("ACTLABHRS", 0) or 0),
        }
        lines.append(line)
    
    return wo, lines


# ヘルパー: Maximo WORKTYPE → 保守太郎 ClassificationId
WORKTYPE_MAP = {
    "PM": "01",   # 年次点検
    "CM": "02",   # 故障修理
    "OH": "03",   # オーバーホール
    "SDM": "04",  # SDM
}

def map_worktype(maximo_worktype: str) -> str:
    return WORKTYPE_MAP.get(maximo_worktype, "99")
```

### 保守太郎 → Maximo（逆変換・エクスポート）

```python
def map_hoshutaro_to_maximo(hoshutaro_asset: dict) -> dict:
    """
    保守太郎のAssetをMaximoのPOST/PUTフォーマットに逆変換する
    """
    specs = {s["key"]: s["value"] for s in hoshutaro_asset.get("specifications", [])}
    
    maximo_record = {
        "ASSETNUM": hoshutaro_asset["id"],
        "DESCRIPTION": hoshutaro_asset["name"],
        "STATUS": specs.get("Status", "ACTIVE"),
        "MANUFACTURER": specs.get("Manufacturer", ""),
        "LOCATION": _flatten_hierarchy(hoshutaro_asset.get("hierarchyPath", {})),
    }
    
    # _maximo_xxx フィールドがあれば内部IDを復元
    if "_maximo_asset_id" in hoshutaro_asset:
        maximo_record["ASSETID"] = hoshutaro_asset["_maximo_asset_id"]
    
    return maximo_record


def _flatten_hierarchy(hierarchy_path: dict) -> str:
    """階層パスをMaximoのLOCATION文字列に結合"""
    return " > ".join(hierarchy_path.values()) if hierarchy_path else ""
```

---

## 付録: 全変数クイックリファレンス（フラット一覧）

コネクタ開発時のチェックリストとしてお使いください。

### Asset 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `id` | string | ★ |
| `name` | string | ★ |
| `hierarchyPath` | `{ [key: string]: string }` | |
| `classificationPath` | `{ [key: string]: string }` | |
| `specifications` | `{ key: string, value: string, order: number }[]` | |
| `createdAt` | Date | 自動 |
| `updatedAt` | Date | 自動 |
| `_<prefix>_*` | any | 拡張 |

### WorkOrder 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `id` | string | ★ |
| `name` | string | ★ |
| `ClassificationId` | string | |
| `CreatedAt` | Date | |
| `UpdatedAt` | Date | |

### WorkOrderLine 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `id` | string | ★ |
| `name` | string | ★ |
| `WorkOrderId` | string | ★ |
| `AssetId` | string | ★ |
| `PlanScheduleStart` | Date | |
| `PlanScheduleEnd` | Date | |
| `ActualScheduleStart` | Date | |
| `ActualScheduleEnd` | Date | |
| `Planned` | boolean | |
| `Actual` | boolean | |
| `PlanCost` | number | |
| `ActualCost` | number | |
| `PlannedManhours` | number | |
| `ActualManhours` | number | |
| `CreatedAt` | Date | 自動 |
| `UpdatedAt` | Date | 自動 |

### WorkOrderClassification 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `id` | string | ★ |
| `name` | string | ★ |
| `order` | number | ★ |

### HierarchyDefinition 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `levels[].key` | string | ★ |
| `levels[].values[].value` | string | ★ |
| `levels[].values[].parentValue` | string | |

### AssetClassificationDefinition 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `levels[].key` | string | ★ |
| `levels[].values[].value` | string | ★ |
| `levels[].values[].parentValue` | string | |

### SyncResult 変数一覧
| 変数名 | 型 | 必須 |
|---|---|---|
| `connectorId` | string | ★ |
| `entity` | string | ★ |
| `direction` | string | ★ |
| `status` | string | ★ |
| `summary.total` | number | ★ |
| `summary.created` | number | ★ |
| `summary.updated` | number | ★ |
| `summary.skipped` | number | ★ |
| `summary.failed` | number | ★ |
| `errors[].recordId` | string | ★ |
| `errors[].field` | string | |
| `errors[].errorCode` | string | ★ |
| `errors[].message` | string | ★ |
| `errors[].severity` | string | ★ |
| `startedAt` | string | ★ |
| `completedAt` | string | ★ |
| `durationMs` | number | ★ |
