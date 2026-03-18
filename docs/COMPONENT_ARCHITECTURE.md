# コンポーネントアーキテクチャ

## 概要

HOSHUTAROはフィーチャーベースのコンポーネントアーキテクチャを採用し、サービスManagerによる集中状態管理を行います。全コンポーネントはデスクトップ専用で、Excelライクな操作体験を提供します。

## ディレクトリ構成

### ソースコード構成 (`src/`)

```
src/
├── components/           # Reactコンポーネント（フィーチャー単位）
│   ├── EnhancedMaintenanceGrid/  # メイングリッドコンポーネント
│   ├── ModernHeader/            # ナビゲーションヘッダー
│   ├── WorkOrderLineDialog/    # WorkOrderLine編集ダイアログ
│   ├── HierarchyEditDialog/     # 階層管理
│   ├── AssetReassignDialog/     # 機器再配置
│   ├── StatusSelectionDialog/   # クイックステータス変更
│   ├── CostInputDialog/         # 費用入力
│   └── SpecificationEditDialog/ # 機器仕様編集
├── services/            # Managerクラス（ビジネスロジック）
├── hooks/              # カスタムReactフック
├── utils/              # ユーティリティ関数
├── types/              # TypeScript型定義
├── styles/             # グローバルCSS
├── theme/              # Material-UIテーマ設定
├── providers/          # Reactコンテキストプロバイダー
├── config/             # アプリケーション設定
└── data/               # 静的データ・モックデータ
```

## データフローアーキテクチャ

### コンポーネント階層（必須パターン）

```
App.tsx
└── EnhancedMaintenanceGrid
    ├── ModernHeader
    │   ├── IntegratedToolbar
    │   └── ナビゲーションメニュー
    ├── MaintenanceTableBody
    │   ├── MaintenanceTableRow（機器ベースモード）
    │   └── TaskBasedRow（作業ベースモード）
    └── ダイアログコンポーネント
        ├── WorkOrderLineDialog
        ├── HierarchyEditDialog
        ├── AssetReassignDialog
        ├── StatusSelectionDialog
        ├── CostInputDialog
        └── SpecificationEditDialog
```

### Propsフローパターン

**必須ルール**: 全てのコンポーネント統合は以下の階層に従います：

```
App.tsx → EnhancedMaintenanceGrid → IntegratedToolbar/ModernHeader → ダイアログコンポーネント
```

## コンポーネントパターン

### 1. フィーチャーベース構成（必須）

各主要コンポーネントは以下の構成に従います：

```
ComponentName/
├── ComponentName.tsx          # メインコンポーネント
├── ComponentName.css          # スタイル（必要に応じて）
├── index.ts                   # バレルエクスポート
├── README.md                  # 使用方法ドキュメント
├── types.ts                   # コンポーネント固有の型
├── SubComponent1.tsx          # 子コンポーネント
├── SubComponent2.tsx
├── utils/                     # フィーチャーユーティリティ
│   ├── featureManager.ts
│   └── featureHelpers.ts
├── __tests__/                 # テスト（コンポーネントと同階層）
│   ├── ComponentName.test.tsx
│   ├── ComponentName.integration.test.tsx
│   └── utils.test.ts
└── ComponentName.example.tsx  # 使用例
```

### 2. Manager統合パターン（最重要）

**全てのビジネスロジックはManagerクラスを使用すること：**

```typescript
// Manager統合を持つコンポーネント
const MyComponent: React.FC<Props> = ({ ...props }) => {
  // 必ずManager初期化を確認
  if (!dataStoreRef.current || !isServicesInitialized) {
    return <ErrorMessage>サービスが初期化されていません</ErrorMessage>;
  }

  const handleOperation = useCallback((data: T) => {
    try {
      const result = dataStoreRef.current!.operation(data);
      showSnackbar('更新しました', 'success');
    } catch (error) {
      console.error('[Component] Error:', error);
      showSnackbar('操作に失敗しました', 'error');
    }
  }, []);

  return (
    // コンポーネントJSX
  );
};
```

### 3. ダイアログコンポーネントパターン（標準化済み）

**全てのダイアログコンポーネントは以下の構造に従うこと：**

```typescript
interface DialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: T) => void;
  initialData?: T;
}

const MyDialog: React.FC<DialogProps> = ({
  open,
  onClose,
  onSave,
  initialData
}) => {
  const [formData, setFormData] = useState<T>(initialData || defaultData);

  const handleSave = () => {
    // バリデーション
    if (!validateData(formData)) {
      return;
    }

    // 親コンポーネントの保存ハンドラを呼び出し
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      {/* ダイアログ内容 */}
    </Dialog>
  );
};
```

## 統合チェックリスト

### コンポーネント統合手順（順番に実行）

1. **コンポーネントPropsインターフェースを確認** - `readFile`ツール使用
2. **中間コンポーネントのPropsを更新** - `ExtendedMaintenanceGridProps`に追加
3. **コンポーネントのdestructuringを更新** - 関数パラメータにProps追加
4. **Propsをコンポーネントチェインで伝播** - 親から子へ
5. **App.tsxでハンドラを実装** - Manager refsとエラーハンドリング付き
6. **TypeScriptコンパイル確認** - `getDiagnostics`ツール使用

### Managerサービス統合

```typescript
// App.tsxでのハンドラパターン
const handleOperation = (data: T) => {
  // 1. Manager初期化チェック
  if (!managerRef.current || !isServicesInitialized) {
    showSnackbar('サービスが初期化されていません', 'error');
    return;
  }

  try {
    // 2. Manager操作を実行
    const result = managerRef.current.operation(data);
    
    // 3. 成功フィードバック
    showSnackbar('更新しました', 'success');
    
    // 4. 必要に応じてデータを再読み込み
    loadData();
  } catch (error) {
    // 5. エラーハンドリング
    console.error('[App] Operation Error:', error);
    showSnackbar('操作に失敗しました', 'error');
  }
};
```

## ファイル命名規則

### 厳格ルール

- **コンポーネント**: PascalCase（例: `EnhancedMaintenanceGrid.tsx`）
- **ユーティリティ/Manager**: camelCase（例: `copyPasteManager.ts`）
- **CSSファイル**: kebab-case（コンポーネントに対応、例: `enhanced-maintenance-grid.css`）
- **テストファイル**: ソース名に `.test.ts` または `.test.tsx` サフィックス
- **型定義ファイル**: camelCase（例: `maintenanceTask.ts`）
- **READMEファイル**: `README.md`

### インポート/エクスポート規則

#### バレルエクスポート（必須）

```typescript
// components/ModernHeader/index.ts
export { default as ModernHeader } from './ModernHeader';
export type { ModernHeaderProps } from './ModernHeader';
```

#### インポートの順序（強制）

```typescript
// 1. 外部ライブラリ
import React, { useState, useRef } from 'react';
import { Button, Dialog, Snackbar } from '@mui/material';

// 2. 内部モジュール（services, utils, types）
import { DataStore } from '../services/DataStore';
import { Asset, HierarchyPath } from '../types';
import { validateData } from '../utils/dataIntegrityChecker';

// 3. 相対インポート（ローカルコンポーネント、スタイル）
import { MaintenanceCell } from './MaintenanceCell';
import './EnhancedMaintenanceGrid.css';
```

## コアコンポーネント

### 1. App.tsx（ルートコンポーネント）

**責務:**

- アプリケーション初期化とサービスセットアップ
- Managerインスタンス管理
- グローバル状態の調整
- エラーバウンダリとユーザーフィードバック
- データの読み込みと永続化

**主要パターン:**

- Manager refs: `const dataStoreRef = useRef<DataStore>()`
- サービス初期化チェック
- 集中エラーハンドリング
- Snackbar通知

### 2. EnhancedMaintenanceGrid（メイングリッド）

**責務:**

- グリッドレイアウトとレンダリング
- 表示モード管理（機器ベース / 作業ベース）
- 仮想スクロールの調整
- セル編集のオーケストレーション

**主要機能:**

- デュアルレンダリングモード
- パフォーマンス最適化
- キーボードナビゲーション
- コピー＆ペースト操作

### 3. ModernHeader（ナビゲーション）

**責務:**

- 検索・フィルタリングコントロール
- 表示モード切り替え
- 時間スケール選択
- アクションメニュー（データ操作、年度管理）

**統合ポイント:**

- 検索キーワードの伝播
- フィルタ状態の管理
- アクションハンドラコールバック

### 4. ダイアログコンポーネント（6種類）

**共通パターン:**

```typescript
interface DialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: T) => void;
  initialData?: T;
}
```

**種類:**

- **WorkOrderLineDialog**: WorkOrderLine編集（スケジュール / 費用 / 工数管理）
- **HierarchyEditDialog**: 階層構造の変更
- **AssetReassignDialog**: 機器の再配置
- **StatusSelectionDialog**: クイックステータス変更
- **CostInputDialog**: 費用データ入力
- **SpecificationEditDialog**: 機器仕様の編集

## 状態管理

### Managerパターン（シングルトン型）

```typescript
// App.tsxで利用可能なManager
const dataStoreRef = useRef<DataStore>();
const hierarchyManagerRef = useRef<HierarchyManager>();
const taskManagerRef = useRef<TaskManager>();
const assetManagerRef = useRef<AssetManager>();
const workOrderManagerRef = useRef<WorkOrderManager>();
const workOrderLineManagerRef = useRef<WorkOrderLineManager>();
const viewModeManagerRef = useRef<ViewModeManager>();
const undoRedoManagerRef = useRef<UndoRedoManager>();
const editHandlersRef = useRef<EditHandlers>();
```

### コンポーネント状態のルール

1. **ローカル状態**: UI専用の状態には `useState` を使用
2. **ビジネスロジック**: 必ずManagerサービスを使用
3. **導出状態**: 計算値には `useMemo` を使用
4. **副作用**: 適切なクリーンアップ付きの `useEffect` を使用

## スタイリングアーキテクチャ

### CSS構成

- **グローバルスタイル**: `src/styles/` ディレクトリ
- **コンポーネントスタイル**: コンポーネントと同階層に配置
- **テーマ**: `src/theme/` のMaterial-UIテーマ
- **レスポンシブ**: デスクトップ専用（1280px以上のビューポート）

### スタイリングパターン

```typescript
// Material-UI sx propによるコンポーネント固有スタイル
<Box sx={{ 
  display: 'flex', 
  gap: 2, 
  p: 2 
}}>

// 複雑なスタイリングにはCSSモジュール
import styles from './Component.module.css';
<div className={styles.container}>
```

## テストアーキテクチャ

### テスト構成

- **配置**: ソースファイルの隣に `__tests__/` サブディレクトリ
- **命名**: ソースファイル名に適切なサフィックスを付加
- **種類**: ユニットテスト、統合テスト、プロパティベーステスト

### テストパターン

```typescript
// コンポーネントテストパターン
describe('ComponentName', () => {
  it('正しくレンダリングされること', () => {
    render(<ComponentName {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('ユーザー操作を正しく処理すること', () => {
    const onSave = jest.fn();
    render(<ComponentName onSave={onSave} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onSave).toHaveBeenCalled();
  });
});
```

## パフォーマンスパターン

### メモ化戦略

```typescript
// コンポーネントのメモ化
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => 
    expensiveTransformation(data), [data]
  );

  const handleClick = useCallback((id: string) => {
    // ハンドラロジック
  }, []);

  return <div>{/* コンポーネントJSX */}</div>;
});
```

### 仮想スクロール

```typescript
// 大規模データセットの処理
import { FixedSizeList as List } from 'react-window';

const VirtualizedGrid = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={35}
    itemData={items}
  >
    {Row}
  </List>
);
```

## デバッグパターン

### コンポーネントのデバッグ

```typescript
// デバッグログパターン
useEffect(() => {
  console.log('[ComponentName] Props変更:', { 
    prop1, 
    prop2, 
    timestamp: new Date().toISOString() 
  });
}, [prop1, prop2]);

// パフォーマンスモニタリング
useEffect(() => {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    console.log(`[ComponentName] レンダリング時間: ${endTime - startTime}ms`);
  };
});
```

## ドキュメント要件

### コンポーネントドキュメント

各コンポーネントに必須：

- **README.md**: 使用例と統合ガイド
- **Propsインターフェース**: 完全なTypeScript型定義
- **使用例**: 複雑なコンポーネント用の `.example.tsx` ファイル
- **テスト**: 包括的なテストカバレッジ

### コードコメント

```typescript
/**
 * 機器再配置をバリデーション付きで処理
 * @param assetId - 対象機器ID
 * @param newHierarchyPath - 移動先の階層パス
 * @returns 操作結果のPromise
 */
const handleReassignment = async (
  assetId: string, 
  newHierarchyPath: HierarchyPath
): Promise<OperationResult> => {
  // 実装
};
```

本コンポーネントアーキテクチャにより、保守性・拡張性・パフォーマンスに優れたコードを実現し、開発・統合のための明確なパターンを提供します。
