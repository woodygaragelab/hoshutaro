/**
 * Excel-Like Grid Types
 * Type definitions for the Excel-like grid component
 */

import { HierarchicalData } from '../../types';

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
  accessor?: string | ((row: any) => any);
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
  clipboardData?: any;
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
  value: any;
  previousValue: any;
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
  timeHeaders: any[];
  viewMode: 'status' | 'cost';
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
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
 * Grid Range
 */
export interface GridRange {
  start: GridSelection;
  end: GridSelection;
}
