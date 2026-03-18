# Interface Definitions & API Guidelines

## Core Interface Reference

このプロジェクトで作業する際は、必ず以下のインターフェース定義書を参照してください：

**📋 メインインターフェース定義書**: `docs/INTERFACE_SPECIFICATION.md`

この定義書には以下が含まれています：
- データモデル層の全インターフェース（Task、Asset、TaskAssociation等）
- サービス層の全クラスとメソッド（TaskManager、AssetManager等）
- コンポーネント層のProps定義
- エラーハンドリングとパフォーマンス最適化のインターフェース

## 開発時の必須チェック項目

### 新機能開発時
1. **データモデル**: 既存の型定義（Task、Asset、TaskAssociation）に準拠
2. **サービス層**: 既存のManagerクラスのパターンに従う
3. **コンポーネント**: 定義されたPropsインターフェースを使用
4. **エラーハンドリング**: 標準のエラータイプを使用

### 既存機能修正時
1. **インターフェース互換性**: 既存のインターフェースを破壊しない
2. **型安全性**: TypeScriptの型定義を厳密に守る
3. **命名規則**: 既存のパターンに合わせる

## 重要なインターフェース

### データモデル
- `Task`: 独立した保守作業エンティティ
- `Asset`: 動的階層を持つ機器エンティティ
- `TaskAssociation`: 多対多の作業-機器関連付け
- `HierarchyDefinition`: 1-10レベルの動的階層構造

### サービス層
- `TaskManager`: 作業のCRUD操作
- `AssetManager`: 機器管理と階層操作
- `AssociationManager`: 関連付けとスケジュール管理
- `ViewModeManager`: 表示モード切り替えとデータ変換

### 表示モード
- `EquipmentBasedRow`: 機器ベース表示の行データ
- `TaskBasedRow`: 作業ベース表示の行データ
- `AggregatedStatus`: 時間集約されたステータス

## 制約事項
- 階層レベル: 1-10レベル
- 作業分類: 01-20
- パフォーマンス: 50,000機器、365時間列対応
- 編集スコープ: 機器ベース（単一機器）vs 作業ベース（全関連機器）

## 参照方法
コード作業前に必ず `docs/INTERFACE_SPECIFICATION.md` を確認し、適切なインターフェースを使用してください。