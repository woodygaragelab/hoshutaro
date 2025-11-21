import { HierarchicalData } from '../../types';

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
  accessor?: string; // Path to the data property
}

export interface ExcelLikeGridProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  displayAreaConfig?: DisplayAreaConfig;
  onCellEdit?: (rowId: string, columnId: string, value: any) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  onDisplayAreaChange?: (config: DisplayAreaConfig) => void;
  onCopy?: (data: ClipboardData) => void;
  onPaste?: (data: ClipboardData, targetCell: { rowId: string; columnId: string }) => Promise<boolean>;
  virtualScrolling?: boolean;
  readOnly?: boolean;
  className?: string;
}

export interface CellEditContext {
  rowId: string;
  columnId: string;
  value: any;
  previousValue: any;
  isValid: boolean;
  errorMessage?: string;
}

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

export interface GridState {
  selectedCell: { rowId: string; columnId: string } | null;
  editingCell: { rowId: string; columnId: string } | null;
  selectedRange: {
    startRow: string;
    startColumn: string;
    endRow: string;
    endColumn: string;
  } | null;
  columnWidths: { [columnId: string]: number };
  rowHeights: { [rowId: string]: number };
  clipboardData: ClipboardData | null;
}

export interface ClipboardData {
  cells: ClipboardCell[][];
  sourceArea: 'specifications' | 'maintenance';
  timestamp: number;
}

export interface ClipboardCell {
  rowId: string;
  columnId: string;
  value: any;
  type: 'text' | 'number' | 'date' | 'status' | 'cost';
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

export interface SpecificationManagementProps {
  onSpecificationAdd: (rowId: string, afterIndex?: number) => void;
  onSpecificationDelete: (rowId: string, specIndex: number) => void;
  onSpecificationReorder: (rowId: string, fromIndex: number, toIndex: number) => void;
}

export interface ResponsiveLayout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isTouch: boolean;
  getVisibleColumns: (allColumns: string[]) => string[];
  getColumnWidth: (columnId: string, baseWidth: number) => number;
  getCellHeight: () => number;
  getSpacing: (size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => number;
  shouldStackElements: () => boolean;
  shouldHideSecondaryActions: () => boolean;
  shouldUseCompactSpacing: () => boolean;
}

export interface EnhancedMaintenanceGridProps {
  data: HierarchicalData[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  displayMode: 'specifications' | 'maintenance' | 'both';
  showBomCode: boolean;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  onSpecificationColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  virtualScrolling?: boolean;
  readOnly?: boolean;
  className?: string;
  groupedData?: { [key: string]: HierarchicalData[] };
  
  // Integrated toolbar props
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  level1Filter?: string;
  level2Filter?: string;
  level3Filter?: string;
  onLevel1FilterChange?: (event: any) => void;
  onLevel2FilterChange?: (event: any) => void;
  onLevel3FilterChange?: (event: any) => void;
  hierarchyFilterTree?: any;
  level2Options?: string[];
  level3Options?: string[];
  onViewModeChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  timeScale?: 'year' | 'month' | 'week' | 'day';
  onTimeScaleChange?: (event: any) => void;
  onShowBomCodeChange?: (checked: boolean) => void;
  onDisplayModeChange?: (mode: 'specifications' | 'maintenance' | 'both') => void;
  onAddYear?: () => void;
  onDeleteYear?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
  onResetData?: () => void;
  onAIAssistantToggle?: () => void;
  isAIAssistantOpen?: boolean;
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
}