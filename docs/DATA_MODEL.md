# 保守太郎 Data Model (v3.0.0)

コネクタ経由で外部システムとデータをやり取りする際、保守太郎はこの JSON フォーマット（DataModel v3.0.0）に準拠したデータを期待します。
プラグイン開発者は、ツールの戻り値を以下の形式に合わせて生成してください。

---

## 1. 機器 (Asset)

保守の対象となる設備や機器のマスターデータです。

```json
{
  "id": "PMP-101",             // ★必須: ユニークなTAG No. や 機器ID
  "name": "冷却水ポンプ B系",    // 必須: 機器名称
  
  // 階層データ (どこに設置されているか)
  "hierarchyPath": {
    "製油所": "第一製油所",
    "エリア": "Aエリア"
  },
  
  // 機器分類 (どのような種類の機器か)
  "classificationPath": {
    "機器大分類": "回転機",
    "機器種別": "遠心ポンプ"
  },
  
  // 仕様データ (自由記述のキーバリュー)
  "specifications": [
    { "key": "メーカー", "value": "荏原製作所", "order": 1 },
    { "key": "吐出量", "value": "150 L/min", "order": 2 }
  ]
}
```

---

## 2. 作業オーダー (WorkOrder)

複数の「作業明細（WorkOrderLine）」を束ねる親となる管理単位です。例えば「年次点検」というパッケージで、複数の機器に対する点検をまとめます。

```json
{
  "id": "WO-2026-001",           // ★必須: ユニークな作業番号 (WONUM 等)
  "name": "2026年度 ボイラー設備年次点検", // 必須: 作業名称
  "ClassificationId": "01",      // 保守区分ID（例: "01" = 年次点検）
  "CreatedAt": "2026-04-01T00:00:00Z",
  "UpdatedAt": "2026-04-01T00:00:00Z"
}
```

---

## 3. 作業明細 (WorkOrderLine)

保守太郎のメイン画面（ガントチャート/星取表）に表示される **1 Event × 1 Asset** のスケジュール実績データです。

```json
{
  "id": "WOL-9988",              // ★必須: ユニークID
  "name": "ベアリング交換",      // 必須: 作業内容
  "WorkOrderId": "WO-2026-001",  // ★必須: 親となる WorkOrder の id
  "AssetId": "PMP-101",          // ★必須: 対象となる Asset の id
  
  // スケジュール情報 (ISO 8601 文字列)
  "PlanScheduleStart": "2026-05-10T09:00:00Z",
  "PlanScheduleEnd": "2026-05-12T17:00:00Z",
  "ActualScheduleStart": "2026-05-14T09:00:00Z",
  "ActualScheduleEnd": "2026-05-16T17:00:00Z",
  
  // フラグ
  "Planned": true,               // 計画に組み込まれているか
  "Actual": true,                // 実施されたか（完了か）
  
  // コストと工数
  "PlanCost": 50000,             // 予定費用 (>= 0)
  "ActualCost": 52000,           // 実績費用 (>= 0)
  "PlannedManhours": 16,         // 予定工数
  "ActualManhours": 18           // 実績工数
}
```

---

## 4. 作業分類マスター (WorkOrderClassification)

WorkOrder の種類（保守区分）を定義するマスターデータです。（最大20個程度のフラットなリスト）

```json
[
  {
    "id": "01",
    "name": "年次点検",
    "order": 1
  },
  {
    "id": "02",
    "name": "オーバーホール",
    "order": 2
  }
]
```

---

## 5. 機器階層マスター (HierarchyDefinition)

機器 (Asset) が「どこに」設置されているかを定義するツリー構造のマスターデータです。
ルートに近い上位階層（レベル）から順番に配列で定義します。親ノードの指定 (`parentValue`) により親子の関係を構築します。

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
        { "value": "Bエリア", "parentValue": "第一製油所" }
      ]
    }
  ]
}
```

---

## 6. 機器分類マスター (AssetClassificationDefinition)

機器 (Asset) が「どのような種類の」設備であるかを定義するツリー構造のマスターデータです。
構造は「機器階層マスター」と全く同じです。

```json
{
  "levels": [
    {
      "key": "機器大分類",
      "values": [
        { "value": "回転機" },
        { "value": "静機器" }
      ]
    },
    {
      "key": "機器種別",
      "values": [
        { "value": "遠心ポンプ", "parentValue": "回転機" },
        { "value": "熱交換器", "parentValue": "静機器" }
      ]
    }
  ]
}
```

---

## プラグインでの運用アドバイス

- **マスタデータのフェッチ**: コネクタを開発する際は `fetch_assets` や `fetch_work_orders` だけでなく、可能であれば外部システムからマスターデータを引っ張ってくる `fetch_hierarchies` などのツールを公開しておくことで、初期セットアップが自動化できます。
- **外部システムIDの保持**: Maximo側の内部IDなどを `_maximo_system_id: 1234` のように、JSON仕様にないアンダースコア始まりの拡張キーとして忍ばせることは、後で `push` する際の紐付けに便利です。
