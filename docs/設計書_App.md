# `App.tsx` コンポーネント設計書

## 1. 概要

`App.tsx` は、設備保全計画と実績を管理するための「星取表」アプリケーションのルートコンポーネントである。
主な機能として、階層的な設備リストの表示、年度ごとの保全状況（計画/実績）またはコストの表示、データの検索、表示項目のカスタマイズ、年度の追加・削除、そして全データのインポート・エクスポート・リセット機能を提供する。

## 2. 責任 (Responsibilities)

-   アプリケーション全体のレイアウトとUIのレンダリング。
-   初期データの読み込みと、表示に適した階層構造への変換。
-   ユーザー操作に応じたアプリケーションの状態（State）の管理と更新。
-   子コンポーネント (`TableRow`) へのデータとコールバック関数の提供。
-   以下の主要な機能ロジックの実装:
    -   表示モード切り替え（星取 / コスト）
    -   データフィルタリング（検索）
    -   表示列のカスタマイズ
    -   年度の追加・削除
    -   データのインポート/エクスポート/リセット
    -   行の展開/折りたたみ（個別/一括）
    -   ユーザーへの通知（Snackbar）と確認ダイアログの表示。

## 3. 状態 (State)

| 状態変数名                  | 型                          | 説明                                                                                             |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `maintenanceData`           | `HierarchicalData[]`        | 表示用の階層化された設備保全データ。                                                             |
| `years`                     | `number[]`                  | テーブルに表示される年度のリスト。                                                               |
| `viewMode`                  | `'status' \| 'cost'`        | テーブルの表示モード（'status': 星取、'cost': コスト）。                                          |
| `displaySettingsAnchorEl`   | `HTMLElement \| null`       | 「表示設定」メニューのアンカー要素。                                                             |
| `yearOperationsAnchorEl`    | `HTMLElement \| null`       | 「年度操作」メニューのアンカー要素。                                                             |
| `dataOperationsAnchorEl`    | `HTMLElement \| null`       | 「データ操作」メニューのアンカー要素。                                                           |
| `addYearDialogOpen`         | `boolean`                   | 「年度追加」ダイアログの開閉状態。                                                               |
| `newYearInput`              | `string`                    | 「年度追加」ダイアログで入力された新しい年度。                                                   |
| `addYearError`              | `string`                    | 「年度追加」時のバリデーションエラーメッセージ。                                                 |
| `deleteYearDialogOpen`      | `boolean`                   | 「年度削除」ダイアログの開閉状態。                                                               |
| `yearToDelete`              | `number \| string`          | 「年度削除」ダイアログで選択された年度。                                                         |
| `deleteYearError`           | `string`                    | 「年度削除」時のバリデーションエラーメッセージ。                                                 |
| `importConfirmDialogOpen`   | `boolean`                   | データインポート確認ダイアログの開閉状態。                                                       |
| `importedFileData`          | `any`                       | インポート用に読み込まれたファイルデータ。                                                       |
| `importFileInputRef`        | `RefObject<HTMLInputElement>` | インポート用の非表示 `<input type="file">` への参照。                                            |
| `resetConfirmDialogOpen`    | `boolean`                   | データリセット確認ダイアログの開閉状態。                                                         |
| `snackbarOpen`              | `boolean`                   | Snackbar（通知バー）の開閉状態。                                                                 |
| `snackbarMessage`           | `string`                    | Snackbar に表示するメッセージ。                                                                  |
| `snackbarSeverity`          | `success \| error \| ...`   | Snackbar の種別（成功、エラーなど）。                                                            |
| `searchTerm`                | `string`                    | 検索ボックスに入力された文字列。                                                                 |
| `showBomCode`               | `boolean`                   | 「BOMコード」列の表示/非表示。                                                                   |
| `showCycle`                 | `boolean`                   | 「周期」列の表示/非表示。                                                                        |
| `showSpecifications`        | `boolean`                   | 「仕様」列の表示/非表示。                                                                        |

## 4. 副作用 (Side Effects - `useEffect`)

-   **コンポーネントマウント時:**
    -   `./data/equipments.json` からRAWデータを読み込む。
    -   `transformData` ユーティリティ関数を呼び出し、RAWデータを階層構造 (`HierarchicalData[]`) と年度リスト (`number[]`) に変換する。
    -   変換されたデータを `maintenanceData` と `years` の状態にセットする。

## 5. 主要な関数とロジック

### 5.1. データ処理

-   `handleUpdateItem`: 子コンポーネント (`TableRow`) でデータが更新された際に呼び出される。`maintenanceData` 内の該当アイテムを再帰的に検索し、更新する。
-   `transformData` (外部ユーティリティ): `equipments.json` のフラットなデータを、親子関係を持つ階層構造に変換し、同時にデータに含まれるすべての年度を抽出して返す。また、各階層の集計結果 (`rolledUpResults`) も計算する。
-   `filterData`: `searchTerm` に基づいて `maintenanceData` をフィルタリングする。項目名 (`task`) に一致するアイテムと、子要素に一致するアイテムを持つ親アイテムを再帰的に抽出する。

### 5.2. UI操作

-   `handleViewModeChange`: 「星取」「コスト」の表示モードを切り替える。
-   `handleMenuOpen` / `handleMenuClose`: 各種ドロップダウンメニューの開閉を制御する。
-   `handleToggle`: 特定の行の展開/折りたたみを切り替える。
-   `handleToggleAll`: すべての行を一括で展開/折りたたみする。
-   `showSnackbar` / `handleSnackbarClose`: ユーザーへの操作結果通知（成功、エラー）の表示を制御する。

### 5.3. 年度操作

-   `handleAddYear...`: 「年度追加」ダイアログを表示し、入力された年度を `years` 状態に追加する。入力値のバリデーション（4桁数字、重複チェック）も行う。
-   `handleDeleteYear...`: 「年度削除」ダイアログを表示し、選択された年度を `years` 状態から削除する。データが存在する年度は削除できないようにバリデーションを行う。

### 5.4. データ操作

-   `handleExportData`: 現在の `maintenanceData` と `years` をJSON形式のファイル (`hoshitori_data.json`) としてエクスポートする。
-   `handleImportData...`: JSONファイルのインポート処理を開始する。ファイル選択ダイアログを開き、読み込んだファイルが正しい形式か検証した後、確認ダイアログを表示する。ユーザーが確認すると、`maintenanceData` と `years` の状態をインポートしたデータで上書きする。
-   `handleResetData...`: 確認ダイアログを表示した後、`equipments.json` からデータを再読み込み・再変換し、アプリケーションの状態を初期状態に戻す。

## 6. 子コンポーネントと依存関係

### 6.1. 子コンポーネント

-   **`TableRow`**:
    -   階層データの各行を表示する責務を持つ。
    -   `App` から `item` (表示データ), `allYears`, `viewMode` などのPropsを受け取る。
    -   データの更新 (`onUpdateItem`) や行の展開/折りたたみ (`onToggle`) が発生した際に、`App` から渡されたコールバック関数を呼び出す。

### 6.2. 外部ライブラリ

-   **`react`**: コンポーネントの基本的なライフサイクルと状態管理。
-   **`@mui/material`**: UIコンポーネント（Button, Menu, Dialog, Switch, TextFieldなど）を提供。
-   **`react-icons`**: アイコン（Download, Upload, Refresh）を提供。

### 6.3. 内部モジュール

-   **`./data/equipments.json`**: アプリケーションの初期データソース。
-   **`./utils/dataTransformer.ts`**: 初期データをUI表示用の階層構造に変換するロジック。
-   **`./types.ts`**: `HierarchicalData`, `RawEquipment` などの型定義。
-   **`./App.css`**: コンポーネントのカスタムスタイル。

## 7. データフロー

1.  **初期化**: `App` コンポーネントがマウントされると、`useEffect` が `equipments.json` を読み込み、`dataTransformer` を使って `maintenanceData` と `years` stateを初期化する。
2.  **レンダリング**: `App` は `maintenanceData` を `filterData` でフィルタリングし、結果を `map` して `TableRow` コンポーネントのリストを生成する。`years` stateはテーブルヘッダーの年度列を生成するために使われる。
3.  **ユーザー操作**:
    -   ユーザーが `TableRow` 内のデータを編集すると、`onUpdateItem` コールバックが呼ばれ、`App` の `handleUpdateItem` が `maintenanceData` stateを更新する。
    -   検索、表示モード変更、列の表示切替などを行うと、関連するstateが更新され、再レンダリングがトリガーされる。
    -   年度操作やデータ操作は、対応するダイアログやメニューを通じてstateを直接変更し、UIに反映される。
4.  **再レンダリング**: いずれかのstateが更新されると、`App` コンポーネントと、影響を受ける子コンポーネントが再レンダリングされ、UIが最新の状態に保たれる。
