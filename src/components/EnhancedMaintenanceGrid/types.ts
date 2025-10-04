import { HierarchicalData } from '../../types';
import { GridColumn, GridState, DisplayAreaConfig } from '../ExcelLikeGrid/types';

export interface MaintenanceGridLayoutProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  displayAreaConfig: DisplayAreaConfig;
  gridState: GridState;
  viewMode: 'status' | 'cost';
  groupedData?: { [key: string]: HierarchicalData[] };
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onRowResize: (rowId: string, height: number) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange: (range: any) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
}

export interface MaintenanceTableRowProps {
  item: HierarchicalData;
  columns: GridColumn[];
  viewMode: 'status' | 'cost';
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  readOnly: boolean;
}

export interface SpecificationEditContext {
  rowId: string;
  specIndex: number;
  field: 'key' | 'value' | 'order';
  value: string | number;
  previousValue: string | number;
  isValid: boolean;
  errorMessage?: string;
}

export interface DisplayAreaControlProps {
  config: DisplayAreaConfig;
  onChange: (config: DisplayAreaConfig) => void;
}

// Re-export commonly used types from ExcelLikeGrid
export type { GridColumn, GridState, ClipboardData } from '../ExcelLikeGrid/types';