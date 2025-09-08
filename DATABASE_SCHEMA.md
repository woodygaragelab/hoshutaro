# HOSHUTARO データベース構造設計メモ (仮)

このドキュメントは、HOSHUTAROアプリケーションで利用するデータ構造を定義します。データはJSON形式のファイルで管理することを想定しています。

---

## 1. 機器マスターデータ (`equipments.json`)

機器の仕様、階層、整備履歴などを管理するメインのデータ。
トップレベルは、検索パフォーマンスを考慮し、機器番号をキーとしたオブジェクトで構成されます。

### データ構造

```json
{
  "[equipmentId]": {
    "id": "string",
    "hierarchy": {
      "[key: string]": "string"
    },
    "specifications": [
      {
        "key": "string",
        "value": "string",
        "order": "number"
      }
    ],
    "maintenances": {
      "[YYYY-MM-DD: string]": {
        "planned": "boolean",
        "actual": "boolean",
        "cost": "number | null"
      }
    }
  }
}
```

### フィールド解説

- **`[equipmentId]` (キー)**: 機器番号。データ全体で一意。
- **`id`**: オブジェクト内にも機器番号を保持します。
- **`hierarchy`**: 機器の階層情報（例: 工場、ラインなど）を格納するオブジェクト。キーと値は柔軟に設定可能です。
- **`specifications`**: 機器の仕様情報を格納するオブジェクトの配列。
  - `key`: 仕様名（例: "メーカー"）。
  - `value`: 仕様値（例: "A社"）。
  - `order`: 表示順を制御するための数値。星取表でのソートに使用します。
- **`maintenances`**: 整備情報を格納するオブジェクト。
  - `[YYYY-MM-DD]` (キー): 年月日。
  - `planned`: 整備**計画**の有無を示すフラグ。
  - `actual`: 整備**実績**の有無を示すフラグ。
  - `cost`: (将来的な拡張用) 整備にかかったコスト。

---

## 2. 編集履歴データ (`edit_history.json`)

データの競合を避けるため、機器データに対する読み書きの履歴を記録します。

### データ構造

```json
[
  {
    "historyId": "string",
    "equipmentId": "string",
    "action": "'read' | 'write'",
    "timestamp": "string (ISO 8601)",
    "userId": "string"
  }
]
```

### フィールド解説

- **`historyId`**: 履歴データの一意なID。
- **`equipmentId`**: 操作対象の機器番号。
- **`action`**: 操作の種類 (`read` または `write`)。
- **`timestamp`**: 操作が行われた日時。
- **`userId`**: 操作を行ったユーザーのID（認証機能と連携）。

---

このデータ構造を元に、今後のUI開発およびバックエンド連携を進めていきます。
