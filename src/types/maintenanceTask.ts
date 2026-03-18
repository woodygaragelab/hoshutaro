/**
 * Maintenance Management Type Definitions — Data Model v3.0.0
 *
 * WorkOrder + COM integrated model.
 * Single Source of Truth: docs/DATABASE_STRUCTURE.md
 *
 * Entity overview:
 *   TaskClassification  — 20-item flat master (maintenance type)
 *   AssetClassification — hierarchical equipment classification
 *   Task               — concrete work item (part + activity)
 *   Asset              — maintainable equipment
 *   WorkOrder          — ordering / grouping unit (N tasks × N assets)
 *   WorkOrderLine      — star-chart cell (1 task × 1 asset × schedule)
 */

// ============================================================================
// Master Data Types
// ============================================================================

/**
 * TaskClassification — flat master for maintenance work categories (20 types max)
 */
export interface TaskClassification {
  id: string;      // "01"–"20"
  name: string;    // e.g. "年次点検", "オーバーホール", "SDM"
  order: number;   // display order
}

/**
 * AssetClassificationLevel — one level in the equipment classification hierarchy
 */
export interface AssetClassificationLevel {
  key: string;       // e.g. "機器大分類", "機器種別", "機器型式"
  order: number;
  values: string[];
}

/**
 * AssetClassificationDefinition — complete equipment classification hierarchy (1‑10 levels)
 */
export interface AssetClassificationDefinition {
  levels: AssetClassificationLevel[];
}

/**
 * AssetClassificationPath — an asset's position within the classification tree
 */
export interface AssetClassificationPath {
  [levelKey: string]: string;
}

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * Task — a concrete maintenance work item (part + activity name)
 * e.g. "ボイラードラム分解清掃", "電動機ベアリング交換"
 */
export interface Task {
  id: string;
  name: string;           // 機器部位＋作業名
  description: string;    // work description (required)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HierarchyPath — dynamic hierarchy for asset location
 */
export interface HierarchyPath {
  [levelKey: string]: string;  // e.g. { "製油所": "第一製油所", "エリア": "Aエリア" }
}

/**
 * Specification — equipment specification key-value pair
 */
export interface Specification {
  key: string;
  value: string;
  order: number;
}

/**
 * Asset — a physical equipment that requires maintenance
 */
export interface Asset {
  id: string;                                    // TAG No.
  name: string;                                  // equipment name
  hierarchyPath: HierarchyPath;                  // location hierarchy
  classificationPath: AssetClassificationPath;   // NEW: equipment classification
  specifications: Specification[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WorkOrder — ordering / management unit, groups multiple Task × Asset
 * Name represents the order name (e.g. "ボイラー設備年次点検整備")
 */
export interface WorkOrder {
  id: string;                    // WONUM
  name: string;                  // order / package name
  taskClassificationId: string;  // → TaskClassification.id
  defaultSchedulePattern?: {
    frequency: 'yearly' | 'monthly' | 'quarterly' | 'custom';
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WorkOrderSchedule — per-date planned/actual/cost data
 */
export interface WorkOrderSchedule {
  [dateKey: string]: {           // YYYY-MM-DD, YYYY-MM, or YYYY
    planned: boolean;
    actual: boolean;
    planCost: number;            // >= 0, default 0
    actualCost: number;          // >= 0, default 0
  };
}

/**
 * WorkOrderLine — star-chart cell: 1 Task × 1 Asset × Schedule
 */
export interface WorkOrderLine {
  id: string;
  workOrderId: string;           // → WorkOrder.id
  taskId: string;                // → Task.id
  assetId: string;               // → Asset.id
  schedule: WorkOrderSchedule;
  manhours?: number;             // hours (optional, >= 0)
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Hierarchy Management Types
// ============================================================================

/**
 * HierarchyLevel — one level in the location hierarchy
 */
export interface HierarchyLevel {
  key: string;       // e.g. "製油所", "エリア", "ユニット"
  order: number;
  values: string[];
}

/**
 * HierarchyDefinition — complete location hierarchy (dynamic 1‑10 levels)
 */
export interface HierarchyDefinition {
  levels: HierarchyLevel[];
}

// ============================================================================
// View Mode Types
// ============================================================================

/**
 * ViewMode — display mode for the maintenance grid
 */
export type ViewMode = 'equipment-based' | 'task-based';

/**
 * AggregatedStatus — rolled-up status over a time period
 */
export interface AggregatedStatus {
  planned: boolean;
  actual: boolean;
  totalPlanCost: number;
  totalActualCost: number;
  count: number;
}

/**
 * ViewModeState — current view mode state (filters, selection)
 */
export interface ViewModeState {
  mode: ViewMode;
  filters: {
    hierarchyPath?: Partial<HierarchyPath>;
    taskClassification?: string;
    dateRange?: { start: string; end: string };
  };
  selection?: {
    rowId: string;
    columnId: string;
  };
}

/**
 * EquipmentBasedRow — row data for equipment-based view
 */
export interface EquipmentBasedRow {
  type: 'hierarchy' | 'asset';
  level?: number;
  hierarchyKey?: string;
  hierarchyValue?: string;
  assetId?: string;
  assetName?: string;
  hierarchyPath?: HierarchyPath;
  classificationPath?: AssetClassificationPath;
  specifications?: Specification[];
  workOrderLines?: {
    workOrderLineId: string;
    workOrderId: string;
    workOrderName: string;
    taskId: string;
    taskName: string;
    taskClassificationId: string;
    schedule: WorkOrderSchedule;
    manhours?: number;
  }[];
}

/**
 * TaskBasedRow — row data for task-based view
 * Structure: Hierarchy → Asset → WorkOrderLine (3 layers)
 *
 * Note: specifications are not included because task-based mode focuses on tasks,
 * and specifications belong to assets. Specification editing is only
 * available in equipment-based mode.
 */
export interface TaskBasedRow {
  id: string;
  type: 'hierarchy' | 'asset' | 'workOrderLine';
  level: number;
  // Hierarchy fields
  hierarchyKey?: string;
  hierarchyValue?: string;
  // Asset fields
  assetId?: string;
  assetName?: string;
  hierarchyPath?: HierarchyPath;
  // WorkOrderLine fields
  workOrderLineId?: string;
  workOrderId?: string;
  workOrderName?: string;
  taskId?: string;
  taskName?: string;
  taskClassificationId?: string;
  schedule?: WorkOrderSchedule | { [timeKey: string]: AggregatedStatus };
  manhours?: number;
}

// ============================================================================
// Data Model — v3.0.0
// ============================================================================

/**
 * DataModel — complete data structure
 */
export interface DataModel {
  version: string;               // "3.0.0"
  tasks: { [id: string]: Task };
  assets: { [id: string]: Asset };
  workOrders: { [id: string]: WorkOrder };
  workOrderLines: { [id: string]: WorkOrderLine };
  hierarchy: HierarchyDefinition;
  taskClassifications: TaskClassification[];
  assetClassification: AssetClassificationDefinition;
  metadata: {
    lastModified: Date;
  };
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

export type HistoryAction =
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'CREATE_WORK_ORDER'
  | 'UPDATE_WORK_ORDER'
  | 'DELETE_WORK_ORDER'
  | 'CREATE_WORK_ORDER_LINE'
  | 'UPDATE_WORK_ORDER_LINE'
  | 'DELETE_WORK_ORDER_LINE'
  | 'UPDATE_HIERARCHY'
  | 'REASSIGN_HIERARCHY'
  | 'UPDATE_ASSET'
  | 'UPDATE_SPECIFICATION';

export interface HistoryState {
  timestamp: Date;
  action: HistoryAction;
  data: any;
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * WorkOrderLineUpdate — batch update operation for WorkOrderLineDialog
 */
export interface WorkOrderLineUpdate {
  lineId: string;
  action: 'update' | 'delete' | 'create';
  data?: Partial<WorkOrderLine>;
  newTaskDef?: Partial<Task>;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface ValidationError {
  type: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value: any;
}

export interface ReferenceError {
  type: 'REFERENCE_ERROR';
  entityType: 'task' | 'asset' | 'workOrder' | 'workOrderLine';
  entityId: string;
  referencedId: string;
  message: string;
}

export interface MigrationError {
  type: 'MIGRATION_ERROR';
  source: string;
  message: string;
  data: any;
}

export interface PerformanceError {
  type: 'PERFORMANCE_ERROR';
  operation: string;
  duration: number;
  threshold: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * TimeScale — aggregation granularity
 */
export type TimeScale = 'day' | 'week' | 'month' | 'year';

/**
 * EditContext — tracks current view mode and edit scope
 */
export interface EditContext {
  viewMode: ViewMode;
  editScope: 'single-asset' | 'all-assets';
}

/**
 * ScheduleEditRequest — request to edit schedule information
 */
export interface ScheduleEditRequest {
  workOrderLineId: string;
  dateKey: string;
  scheduleEntry: WorkOrderSchedule[string];
  context: EditContext;
}
