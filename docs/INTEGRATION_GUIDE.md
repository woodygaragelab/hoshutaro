# HOSHUTARO 統合開発ガイド

> **本書はHOSHUTAROの統合パターン・サービス層・ダイアログ統合の全てを包括するガイドです。**

## 概要

HOSHUTAROは Manager Pattern を採用し、8つのManagerサービスでビジネスロジックを管理しています。
本ガイドでは、Manager初期化、データフロー、コンポーネント統合パターン、ダイアログ統合パターン、およびエラーハンドリングについて説明します。

---

## 1. Manager Services 一覧

| Manager | ファイル | 役割 |
|---|---|---|
| DataStore | `src/services/DataStore.ts` | JSONデータの読み書き、バリデーション、データ永続化 |
| TaskManager | `src/services/TaskManager.ts` | 作業の定義と管理（CRUD操作） |
| AssetManager | `src/services/AssetManager.ts` | 機器の管理、階層パス・機器分類パス管理 |
| WorkOrderManager | `src/services/WorkOrderManager.ts` | WorkOrderの管理、作業分類との関連付け |
| WorkOrderLineManager | `src/services/WorkOrderLineManager.ts` | WorkOrderLineの管理、スケジュール・工数管理 |
| HierarchyManager | `src/services/HierarchyManager.ts` | 動的階層構造の管理、機器の階層移動 |
| ViewModeManager | `src/services/ViewModeManager.ts` | 表示モード切り替え、データ変換 |
| UndoRedoManager | `src/services/UndoRedoManager.ts` | 元に戻す/やり直し機能、履歴管理 |
| EditHandlers | `src/services/EditHandlers.ts` | 統一された編集処理、編集範囲管理 |
| ErrorHandler | `src/services/ErrorHandler.ts` | エラー検知・回復・通知 |

---

## 2. 初期化パターン

### App.tsxでの初期化順序

初期化順序に依存関係があるため、以下の順序を厳守してください。

```typescript
// Step 1: UndoRedoManagerを最初に初期化
undoRedoManagerRef.current = new UndoRedoManager();

// Step 2: DataStoreとErrorHandlerを初期化
dataStoreRef.current = new DataStore();
errorHandlerRef.current = new ErrorHandler();

// Step 3: 基本Managerを初期化（UndoRedoManagerを渡す）
taskManagerRef.current = new TaskManager([], undoRedoManagerRef.current);
assetManagerRef.current = new AssetManager(undoRedoManagerRef.current);
workOrderManagerRef.current = new WorkOrderManager(undoRedoManagerRef.current);
workOrderLineManagerRef.current = new WorkOrderLineManager(undoRedoManagerRef.current);

// Step 4: HierarchyManagerを初期化（AssetManagerが必要）
hierarchyManagerRef.current = new HierarchyManager(
  assetManagerRef.current,
  { levels: [] },
  undoRedoManagerRef.current
);

// Step 5: EditHandlersを初期化（WorkOrderLineManagerが必要）
editHandlersRef.current = new EditHandlers(workOrderLineManagerRef.current);

// Step 6: ViewModeManagerを最後に初期化（全データが必要）
viewModeManagerRef.current = new ViewModeManager(tasks, assets, workOrders, workOrderLines, hierarchy);
```

> [!IMPORTANT]
> UndoRedoManager → 基本Manager → 依存Manager の順序を崩すと初期化エラーが発生します。

### 初期化完了フラグ

```typescript
const [isServicesInitialized, setIsServicesInitialized] = useState(false);

// 全Manager初期化後にフラグを設定
setIsServicesInitialized(true);
```

---

## 3. サービス層インターフェース

### TaskManager

```typescript
class TaskManager {
  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task;
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task;
  deleteTask(id: string): void;
  getTask(id: string): Task | undefined;
  getAllTasks(): Record<string, Task>;
}
```

### AssetManager

```typescript
class AssetManager {
  createAsset(assetData: Omit<Asset, 'createdAt' | 'updatedAt'>): Asset;
  updateAsset(id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt'>>): Asset;
  deleteAsset(id: string): void;
  getAsset(id: string): Asset | undefined;
  getAllAssets(): Record<string, Asset>;
  getAssetsByHierarchy(hierarchyPath: Partial<HierarchyPath>): Asset[];
  getAssetsByClassification(classificationPath: Partial<AssetClassificationPath>): Asset[];
  updateSpecifications(assetId: string, specs: Specification[]): Asset;
}
```

### WorkOrderManager

```typescript
class WorkOrderManager {
  createWorkOrder(data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): WorkOrder;
  updateWorkOrder(id: string, updates: Partial<WorkOrder>): WorkOrder;
  deleteWorkOrder(id: string): void;
  getWorkOrder(id: string): WorkOrder | undefined;
  getAllWorkOrders(): Record<string, WorkOrder>;
  getWorkOrdersByClassification(classificationId: string): WorkOrder[];
}
```

### WorkOrderLineManager

```typescript
class WorkOrderLineManager {
  createLine(data: Omit<WorkOrderLine, 'id' | 'createdAt' | 'updatedAt'>): WorkOrderLine;
  updateLine(id: string, updates: Partial<WorkOrderLine>): WorkOrderLine;
  deleteLine(id: string): void;
  getLine(id: string): WorkOrderLine | undefined;
  getLinesByAsset(assetId: string): WorkOrderLine[];
  getLinesByTask(taskId: string): WorkOrderLine[];
  getLinesByWorkOrder(workOrderId: string): WorkOrderLine[];
  updateSchedule(id: string, dateKey: string, entry: WorkOrderSchedule[string]): void;
  bulkUpdateSchedule(updates: { id: string; dateKey: string; entry: WorkOrderSchedule[string] }[]): void;
  updateManhours(id: string, manhours: number): void;
}
```

### HierarchyManager

```typescript
class HierarchyManager {
  addLevel(level: HierarchyLevel): void;
  updateLevel(key: string, updates: Partial<HierarchyLevel>): void;
  deleteLevel(key: string): void;
  addValue(levelKey: string, value: string): void;
  removeValue(levelKey: string, value: string): void;
  reassignAssets(assetIds: string[], newHierarchyPath: HierarchyPath): void;
  getHierarchy(): HierarchyDefinition;
}
```

### ViewModeManager

```typescript
class ViewModeManager {
  switchMode(newMode: ViewMode, preserveState?: boolean): void;
  getEquipmentBasedData(): EquipmentBasedRow[];
  getTaskBasedData(timeScale?: TimeScale): TaskBasedRow[];
  getCurrentMode(): ViewMode;
  getFilteredData(filters: ViewModeState['filters']): EquipmentBasedRow[] | TaskBasedRow[];
}
```

### EditHandlers

```typescript
class EditHandlers {
  handleScheduleEdit(request: ScheduleEditRequest): number;
  handleBulkEdit(requests: ScheduleEditRequest[]): number;
  handleCopyPaste(source: CellRange, target: CellRange): number;
}
```

### UndoRedoManager

```typescript
class UndoRedoManager {
  pushState(action: HistoryAction, data: any): void;
  undo(): HistoryState | null;
  redo(): HistoryState | null;
  canUndo(): boolean;
  canRedo(): boolean;
  getHistory(): HistoryState[];
  clear(): void;
}
```

---

## 4. データフロー

### データ読み込みフロー

```
DataStore → TaskManager/AssetManager/WorkOrderManager/WorkOrderLineManager → ViewModeManager → UIコンポーネント
```

### 編集操作フロー

```
UIコンポーネント → EditHandlers → WorkOrderLineManager → UndoRedoManager → ViewModeManager → UI更新
```

### 表示モード切り替えフロー

```
UIコンポーネント → ViewModeManager.switchMode() → データ変換 → UI更新
```

---

## 5. コンポーネント統合パターン

### 統合フロー（必ず以下の順序で実装）

1. **コンポーネントのpropsインターフェースを確認する**
2. **中間コンポーネント（EnhancedMaintenanceGrid）のpropsを更新する**
3. **propsチェインを通じてpropを渡す**
4. **App.tsxでハンドラを実装する**
5. **TypeScriptコンパイルを確認する**

### コンポーネントチェイン

```
App.tsx
  └─ EnhancedMaintenanceGrid（中間transferコンポーネント）
       ├─ ModernHeader（ヘッダー）
       ├─ MaintenanceTableBody（グリッド本体）
       │    ├─ MaintenanceTableRow（機器ベース行）
       │    └─ TaskBasedRow（作業ベース行）
       └─ Dialogs（ダイアログ群）
```

### 標準hander実装パターン（App.tsx）

```typescript
const handleOperation = useCallback((data: T) => {
  // 1. Manager初期化チェック
  if (!managerRef.current || !isServicesInitialized) {
    showSnackbar('サービスが初期化されていません', 'error');
    return;
  }

  try {
    // 2. Manager操作実行
    const result = managerRef.current.operation(data);

    // 3. 成功フィードバック
    showSnackbar('更新しました', 'success');

    // 4. 必要に応じてデータ再読み込み
    loadDataFromViewModeManager();
  } catch (error) {
    // 5. エラーハンドリング
    console.error('[App] Operation Error:', error);
    if (errorHandlerRef.current) {
      handleGenericError(error, 'operationType', errorHandlerRef.current);
    }
    showSnackbar('操作に失敗しました', 'error');
  }
}, [isServicesInitialized]);
```

---

## 6. ダイアログ統合パターン

### ダイアログ一覧

| ダイアログ | ファイル | 用途 |
|---|---|---|
| TaskEditDialog | `src/components/TaskEditDialog/` | 作業の編集・スケジュール管理 |
| StatusSelectionDialog | `src/components/StatusSelectionDialog/` | ステータス変更 |
| CostInputDialog | `src/components/CostInputDialog/` | コスト入力 |
| HierarchyEditDialog | `src/components/HierarchyEditDialog/` | 階層構造の編集 |
| AssetReassignDialog | `src/components/AssetReassignDialog/` | 機器の階層移動 |
| SpecificationEditDialog | `src/components/SpecificationEditDialog/` | 機器仕様の編集 |
| DataMigrationDialog | `src/components/DataMigrationDialog/` | レガシーデータの移行 |

### 標準 Dialog Props パターン

```typescript
interface StandardDialogProps {
  open: boolean;                 // ダイアログ表示状態
  onClose: () => void;           // 閉じるコールバック
  onSave: (data: T) => void;    // 保存コールバック
}
```

### WorkOrderLineDialog（最重要ダイアログ）

```typescript
interface WorkOrderLineDialogProps {
  open: boolean;
  assetId: string;               // 対象機器ID
  dateKey: string;               // 対象日付キー
  workOrderLines: WorkOrderLine[];
  allTasks: Task[];
  allAssets: Asset[];
  allWorkOrders: WorkOrder[];
  onSave: (updates: WorkOrderLineUpdate[]) => void;
  onClose: () => void;
}
```

### ダイアログ統合フロー

**1. 状態管理（App.tsx）**

```typescript
const [taskEditDialogState, setTaskEditDialogState] = useState({
  open: false,
  assetId: '',
  dateKey: ''
});
```

**2. 開くハンドラ（App.tsx）**

```typescript
const handleOpenTaskEditDialog = useCallback((assetId: string, dateKey: string) => {
  setTaskEditDialogState({ open: true, assetId, dateKey });
}, []);
```

**3. propsをチェインで渡す（App.tsx → EnhancedMaintenanceGrid → Dialog）**

```typescript
<EnhancedMaintenanceGrid
  onCellClick={handleOpenTaskEditDialog}
  taskEditDialogState={taskEditDialogState}
  onTaskEditDialogSave={handleTaskEditDialogSave}
  onTaskEditDialogClose={() => setTaskEditDialogState(prev => ({ ...prev, open: false }))}
/>
```

**4. 保存ハンドラ（App.tsx）**

```typescript
const handleWorkOrderLineDialogSave = useCallback((updates: WorkOrderLineUpdate[]) => {
  if (!workOrderLineManagerRef.current || !isServicesInitialized) return;

  try {
    for (const update of updates) {
      switch (update.action) {
        case 'create':
          workOrderLineManagerRef.current.createLine(update.data as any);
          break;
        case 'update':
          workOrderLineManagerRef.current.updateLine(update.lineId, update.data as any);
          break;
        case 'delete':
          workOrderLineManagerRef.current.deleteLine(update.lineId);
          break;
      }
    }
    loadDataFromViewModeManager();
    showSnackbar('保存しました', 'success');
  } catch (error) {
    console.error('[App] WorkOrderLine save error:', error);
    showSnackbar('保存に失敗しました', 'error');
  }
}, [isServicesInitialized]);
```

---

## 7. パフォーマンス最適化

### データインデックス

```typescript
dataIndexManagerRef.current.buildAll({
  assets: existingAssets,
  tasks: existingTasks,
  workOrders: existingWorkOrders,
  workOrderLines: existingWorkOrderLines
});
```

### メモ化

```typescript
// ViewModeManagerは内部でメモ化を使用
const memoizedAggregateSchedule = memoizeDeep(
  (schedule: WorkOrderSchedule, timeScale: TimeScale) =>
    this.aggregateScheduleByTimeScaleInternal(schedule, timeScale),
  100
);
```

### ダイアログの遅延読み込み

```typescript
const LazyTaskEditDialog = React.lazy(
  () => import('./components/TaskEditDialog/TaskEditDialog')
);
```

---

## 8. よくある統合ミス

### ❌ ミス1: Props渡し漏れ

```diff
// EnhancedMaintenanceGrid で新しいpropsを受けているが渡し忘れ
- <MaintenanceTableBody />
+ <MaintenanceTableBody onSpecEdit={onSpecEdit} />
```

### ❌ ミス2: Manager初期化チェック漏れ

```diff
const handleSave = (data) => {
-  managerRef.current.save(data);  // nullチェックなし
+  if (!managerRef.current || !isServicesInitialized) return;
+  managerRef.current.save(data);
};
```

### ❌ ミス3: ViewModeManager更新忘れ

```diff
// Manager操作後にViewModeManagerを更新しないとUI同期が崩れる
  associationManagerRef.current.updateAssociation(id, data);
+ loadDataFromViewModeManager();
```

### ❌ ミス4: EditHandlersをバイパスした直接操作

```diff
// 編集操作は必ずEditHandlersを経由する
- associationManagerRef.current.updateSchedule(id, dateKey, entry);
+ editHandlersRef.current.handleScheduleEdit(request);
```

---

## 9. デバッグ

### Manager状態の確認

```typescript
console.log('[Debug] Manager状態:', {
  isServicesInitialized,
  hasTaskManager: !!taskManagerRef.current,
  hasAssetManager: !!assetManagerRef.current,
  hasViewModeManager: !!viewModeManagerRef.current,
  tasksCount: taskManagerRef.current?.getAllTasks()?.length,
  assetsCount: assetManagerRef.current?.getAllAssets()?.length
});
```

---

## 10. 統合チェックリスト

- [ ] 全Managerが正しい順序で初期化されている
- [ ] 新規propsがコンポーネントチェイン全体に渡されている
- [ ] エラーハンドリングが各操作に実装されている
- [ ] UndoRedoManagerが各操作で使用されている
- [ ] EditHandlersを経由して編集操作を実行している
- [ ] 操作後に `loadDataFromViewModeManager()` で同期している
- [ ] TypeScriptコンパイルが通っている
- [ ] ダイアログの開閉状態がApp.tsxで管理されている
- [ ] データインデックスが構築されている
- [ ] パフォーマンス最適化（遅延読み込み・メモ化）が適用されている
