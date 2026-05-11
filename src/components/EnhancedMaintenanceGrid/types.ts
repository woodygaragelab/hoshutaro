/**
 * Excel-Like Grid Types
 * Type definitions for the Excel-like grid component
 */

import { HierarchicalData } from '../../types';
import type { WorkOrderBasedRow, AggregatedStatus, HierarchyPath } from '../../types/maintenanceTask';

/**
 * Grid Column Definition
 */
export interface GridColumn {
  id: string;
  header: string;
  width: number;
  minWidth: number;
  maxWidth?: number;
  resizable: boolean;
  sortable: boolean;
  type: 'text' | 'number' | 'date' | 'status' | 'cost';
  editable: boolean;
  fixed?: boolean;
  accessor?: string | ((row: HierarchicalData) => unknown);
}

/**
 * Grid State
 */
export interface GridState {
  selectedCell: { rowId: string; columnId: string } | null;
  editingCell: { rowId: string; columnId: string } | null;
  selectedRange: {
    start: { rowId: string; columnId: string };
    end: { rowId: string; columnId: string };
  } | null;
  columnWidths: { [columnId: string]: number };
  rowHeights: { [rowId: string]: number };
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  scrollPosition: { x: number; y: number };
  clipboardData?: ClipboardData;
}

/**
 * Display Area Configuration
 */
export interface DisplayAreaConfig {
  mode: 'specifications' | 'maintenance' | 'both';
  fixedColumns: string[]; // 機器リスト等の固定列
  scrollableAreas: {
    specifications?: {
      visible: boolean;
      width: number;
      columns: string[];
    };
    maintenance?: {
      visible: boolean;
      width: number;
      columns: string[];
    };
  };
}

/**
 * Cell Edit Context
 */
export interface CellEditContext {
  rowId: string;
  columnId: string;
  value: unknown;
  previousValue: unknown;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Clipboard Data
 */
export interface ClipboardData {
  rows: string[][];
  source: 'copy' | 'cut';
  timestamp: number;
}

/**
 * Enhanced Maintenance Grid Props
 */
export interface EnhancedMaintenanceGridProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  onCellEdit: (rowId: string, columnId: string, value: unknown) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onTimeCellsDelete?: (cells: {rowId: string, columnId: string}[]) => void;
  virtualScrolling?: boolean;
  readOnly?: boolean;
  displayAreaConfig?: DisplayAreaConfig;
  onDisplayAreaConfigChange?: (config: DisplayAreaConfig) => void;
  onScroll?: (dateKey: string) => void;
}

/**
 * Grid Selection
 */
export interface GridSelection {
  rowId: string;
  columnId: string;
}

/**
 * Grid 内部で扱う派生行型。
 *
 * `WorkOrderBasedRow.type` は ViewModeManager が出力する canonical な
 * `'workOrder' | 'assetChild'` 2 値のみだが、Grid のレンダリング層では
 * `'hierarchy'` (グループヘッダ) / `'asset'` / `'workOrderLine'` (タスク行)
 * といった派生行も同じ row として扱う。
 *
 * これらの派生型を canonical 型 (`maintenanceTask.ts`) に混ぜると
 * ViewModeManager 側の type narrow が壊れるため、Grid ローカルに分離する。
 */
export type GridRowType = 'workOrder' | 'assetChild' | 'hierarchy' | 'asset' | 'workOrderLine';

export interface GridDerivedRow extends Omit<WorkOrderBasedRow, 'type'> {
  type: GridRowType;
  isGroupHeader?: boolean;
  taskId?: string;
  schedule?: { [timeKey: string]: AggregatedStatus };
  hierarchyKey?: string;
  hierarchyValue?: string;
  hierarchyPath?: HierarchyPath;
}

/**
 * Grid Range
 */
export interface GridRange {
  start: GridSelection;
  end: GridSelection;
}
