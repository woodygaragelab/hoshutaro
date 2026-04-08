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
 * WorkOrderClassification — flat master for maintenance work categories (20 types max)
 */
export interface WorkOrderClassification {
  id: string;      // "01"–"20"
  name: string;    // e.g. "年次点検", "オーバーホール", "SDM"
  order: number;   // display order
}

/**
 * TreeLevelValue — common interface for tree node value in hierarchy/classification
 */
export interface TreeLevelValue {
  value: string;         // e.g. "Aエリア", "第一製油所"
  parentValue?: string;  // Value of the parent node in the level above
}

/**
 * AssetClassificationLevel — one level in the equipment classification hierarchy
 */
export interface AssetClassificationLevel {
  key: string;       // e.g. "機器大分類", "機器種別", "機器型式"
  values: TreeLevelValue[];
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
 * WorkOrder — ordering / management unit, groups multiple Event × Asset
 * Name represents the order name (e.g. "ボイラー設備年次点検整備")
 */
export interface WorkOrder {
  id: string;                    // WONUM
  name: string;                  // order / package name
  ClassificationId: string;      // → WorkOrderClassification.id
  CreatedAt: Date;
  UpdatedAt: Date;
}

/**
 * WorkOrderLine — star-chart cell event: 1 Event × 1 Asset
 */
export interface WorkOrderLine {
  id: string;
  name: string;                  // e.g. "ボイラードラム分解清掃"
  WorkOrderId: string;           // → WorkOrder.id
  AssetId: string;               // → Asset.id
  PlanScheduleStart: Date;       // ISO 8601 Date
  PlanScheduleEnd: Date;         // ISO 8601 Date
  ActualScheduleStart: Date;     // ISO 8601 Date
  ActualScheduleEnd: Date;       // ISO 8601 Date
  Planned: boolean;
  Actual: boolean;
  PlanCost: number;              // >= 0, default 0
  ActualCost: number;            // >= 0, default 0
  PlannedManhours?: number;      // hours (optional, >= 0)
  ActualManhours?: number;       // hours (optional, >= 0)
  schedule?: {
    [dateKey: string]: {
      planned: boolean;
      actual: boolean;
      planCost: number;
      actualCost: number;
    }
  }; // Used in V3 data format for aggregated timelines
  CreatedAt: Date;
  UpdatedAt: Date;
}

// ============================================================================
// Hierarchy Management Types
// ============================================================================

/**
 * HierarchyLevel — one level in the location hierarchy
 */
export interface HierarchyLevel {
  key: string;       // e.g. "製油所", "エリア", "ユニット"
  values: TreeLevelValue[];
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
export type ViewMode = 'asset-based' | 'workorder-based';

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
 * AssetBasedRow — row data for asset-based view (formerly equipment-based)
 */
export interface AssetBasedRow {
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
    name: string;
    ClassificationId: string;
    PlanScheduleStart: Date;
    PlanScheduleEnd: Date;
    ActualScheduleStart: Date;
    ActualScheduleEnd: Date;
    Planned: boolean;
    Actual: boolean;
    PlanCost: number;
    ActualCost: number;
    manhours?: number;
  }[];
}

/**
 * WorkOrderBasedRow — row data for workorder-based view
 * Structure: WorkOrder (level 0) → AssetChild (level 1)
 */
export interface WorkOrderBasedRow {
  id: string;
  type: 'workOrder' | 'assetChild';
  level: number;
  isExpanded?: boolean;
  
  // Basic display fields used by the grid 
  task?: string; // e.g. rowName or workOrderName
  bomCode?: string; // used for rendering the id/tag
  
  // WorkOrder fields (for parent rows)
  workOrderId?: string;
  workOrderName?: string;
  ClassificationId?: string;
  
  // Asset fields (for child rows)
  assetId?: string;
  assetName?: string;
  hierarchyPath?: HierarchyPath;
  
  // Aggregated schedules for the row
  aggregatedSchedule?: { [timeKey: string]: AggregatedStatus };
  results?: { [timeKey: string]: AggregatedStatus };
  rolledUpResults?: { [timeKey: string]: AggregatedStatus };
}

// ============================================================================
// Data Model — v3.0.0
// ============================================================================

/**
 * DataModel — complete data structure
 */
export interface DataModel {
  version: string;               // "3.0.0"
  assets: { [id: string]: Asset };
  workOrders: { [id: string]: WorkOrder };
  workOrderLines: { [id: string]: WorkOrderLine };
  hierarchy: HierarchyDefinition;
  workOrderClassifications: WorkOrderClassification[];
  assetClassification: AssetClassificationDefinition;
  metadata: {
    lastModified: Date;
  };
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

export type HistoryAction =
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
  entityType: 'asset' | 'workOrder' | 'workOrderLine';
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
 * WorkOrderLineEditRequest — request to edit a target event cell
 */
export interface WorkOrderLineEditRequest {
  workOrderLineId: string;
  dateKey: string;  // The column representing the aggregated view (e.g., '2024-01')
  data: Partial<WorkOrderLine>;
  context: EditContext;
}
