import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
// HMR Cache Invalidation Touch: Vite requires this to clear the module graph after deep component deletion
import { Box, Paper, TextField, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { EnhancedMaintenanceGridProps, DisplayAreaConfig, GridColumn } from './types';
import MaintenanceGridLayout from './MaintenanceGridLayout';
import { useMaintenanceGridState } from './hooks/useMaintenanceGridState';
import { WorkOrderLineDialog } from '../WorkOrderLineDialog/WorkOrderLineDialog';
import { ViewModeManager } from '../../services/ViewModeManager';
import {
  WorkOrder,
  Asset,
  WorkOrderLine,
  HierarchyDefinition,
  AssetClassificationDefinition,
  WorkOrderClassification,
  WorkOrderLineUpdate,
  TimeScale,
  SpecificationChange,
  WorkOrderBasedRow,
  AggregatedStatus,
} from '../../types/maintenanceTask';
import { HierarchicalData } from '../../types';
import type { FilterTreeNode } from '../../utils/dataTransformer';
import type { SelectChangeEvent } from '@mui/material/Select';
import './EnhancedMaintenanceGrid.css';
import { writeToClipboard, readFromClipboard, generateTSV, parseTSV } from './utils/clipboardUtils';
import { extractIdsFromRowId } from './utils/gridIdUtils';

// Edit context for tracking edit scope
export interface EditContext {
  viewMode: 'asset-based' | 'workorder-based';
  editScope: 'single-asset' | 'all-assets';  // 編集範囲
}

// Extended props to support equipment-based mode
export interface ExtendedMaintenanceGridProps extends Omit<EnhancedMaintenanceGridProps, 'columns'> {
  // Make columns optional since it's generated internally
  columns?: GridColumn[];

  // Equipment-based mode props
  workOrders?: WorkOrder[];
  assets?: Asset[];
  associations?: WorkOrderLine[];
  hierarchy?: HierarchyDefinition;
  viewModeManager?: ViewModeManager;
  onTaskAssociationUpdate?: (updates: WorkOrderLineUpdate[]) => void;

  // Data view mode props - Requirements 6.1, 6.2, 6.5
  dataViewMode?: 'asset-based' | 'workorder-based';
  onDataViewModeChange?: (mode: 'asset-based' | 'workorder-based') => void;

  // Edit scope props - Requirements 4.8, 5.7
  editScope?: 'single-asset' | 'all-assets';
  onEditScopeChange?: (scope: 'single-asset' | 'all-assets') => void;

  // Hierarchy management props - Requirements 3.1, 3.2
  selectedAssets?: string[]; // Asset IDs
  onAssetSelectionChange?: (assetIds: string[]) => void;
  onHierarchyEdit?: (hierarchy: HierarchyDefinition) => void;
  onOpenAssetReassignDialog?: () => void;
  onOpenTaskEditDialog?: (assetId: string, dateKey: string, taskId?: string) => void;
  // App.tsx 側 handleAssetEdit と shape を揃える (UI 寄り field 名 assetName / bomCode を含む)
  onAssetEdit?: (assetId: string, updates: {
    assetName?: string;
    bomCode?: string;
    hierarchyPath?: Asset['hierarchyPath'];
    specifications?: Asset['specifications'];
  }) => void;

  // Undo/Redo props - Requirements 8.1, 8.2, 8.3
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  // Additional props from usage
  displayMode?: 'both' | 'specifications' | 'maintenance';
  showBomCode?: boolean;
  // value は spec field によって string / number 等に変わるため unknown を使用
  onSpecificationEdit?: (rowId: string, specIndex: number, field: string, value: unknown) => void;
  onSpecificationBatchUpdate?: (changes: SpecificationChange[]) => void;
  onSpecificationColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  className?: string;
  groupedData?: { [key: string]: HierarchicalData[] };
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  uniqueTasks?: string[];
  selectedTasks?: string[];
  onSelectedTasksChange?: (tasks: string[]) => void;
  uniqueBomCodes?: string[];
  selectedBomCodes?: string[];
  onSelectedBomCodesChange?: (bomCodes: string[]) => void;
  level1Filter?: string;
  level2Filter?: string;
  level3Filter?: string;
  // EMG 内で SelectChangeEvent を unpack してから string で呼び出す
  onLevel1FilterChange?: (value: string) => void;
  onLevel2FilterChange?: (value: string) => void;
  onLevel3FilterChange?: (value: string) => void;
  hierarchyFilterTree?: FilterTreeNode | null;
  level2Options?: string[];
  level3Options?: string[];
  onShowBomCodeChange?: (checked: boolean) => void;
  onDisplayModeChange?: (mode: 'both' | 'specifications' | 'maintenance') => void;
  onViewModeChange?: (mode: 'status' | 'cost') => void;
  timeScale?: TimeScale;
  onTimeScaleChange?: (scale: TimeScale) => void;
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
  onCellCopy?: (rowId: string, columnId: string, viewMode: 'status' | 'cost') => void;
  onCellPaste?: (rowId: string, columnId: string, viewMode: 'status' | 'cost') => void;
  onTimeCellsDelete?: (cells: {rowId: string, columnId: string}[]) => void;
  // Project Name Props
  projectName?: string;
  onProjectNameChange?: (newName: string) => void;
  onAddYear?: () => void;
  onDeleteYear?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
  onResetData?: () => void;

  // Classification Filter props
  assetClassification?: AssetClassificationDefinition;
  workOrderClassifications?: WorkOrderClassification[];
  classificationFilter?: { [levelKey: string]: string };
  onClassificationFilterChange?: (filter: { [levelKey: string]: string }) => void;
  woClassificationFilter?: string;
  onWoClassificationFilterChange?: (classificationId: string) => void;
}

export const EnhancedMaintenanceGrid: React.FC<ExtendedMaintenanceGridProps> = ({
  data,
  timeHeaders,
  viewMode,
  displayMode,
  showBomCode,
  onCellEdit,
  onSpecificationEdit,
  onSpecificationBatchUpdate,
  onSpecificationColumnReorder,
  onColumnResize,
  onRowResize,
  onUpdateItem,
  virtualScrolling: _virtualScrolling = false,
  readOnly = false,
  className = '',
  groupedData,
  // Equipment-based mode props
  workOrders = [],
  assets = [],
  associations = [],
  hierarchy,
  viewModeManager,
  onTaskAssociationUpdate,
  // Data view mode props - Requirements 6.1, 6.2, 6.5
  dataViewMode = 'asset-based',
  onDataViewModeChange: _onDataViewModeChange,
  // Edit scope props - Requirements 4.8, 5.7
  editScope: _editScope = 'single-asset',
  onEditScopeChange: _onEditScopeChange,
  // Hierarchy management props - Requirements 3.1, 3.2
  selectedAssets = [],
  onAssetSelectionChange,
  onHierarchyEdit: _onHierarchyEdit,
  onOpenAssetReassignDialog: _onOpenAssetReassignDialog,
  onOpenTaskEditDialog,
  onAssetEdit,
  // Undo/Redo props - Requirements 8.1, 8.2, 8.3
  canUndo: _canUndo,
  canRedo: _canRedo,
  onUndo: _onUndo,
  onRedo: _onRedo,
  // Integrated toolbar props
  searchTerm = '',
  onSearchChange,
  level1Filter = 'all',
  level2Filter = 'all',
  level3Filter = 'all',
  onLevel1FilterChange,
  onLevel2FilterChange,
  onLevel3FilterChange,
  hierarchyFilterTree,
  level2Options = [],
  level3Options = [],
  // onViewModeChange / onTimeScaleChange は EMG 内で binding 先 UI 要素が無く
  // 親から渡されても呼ばれない。dead prop だが API surface のため受理だけする。
  onViewModeChange: _onViewModeChange,
  timeScale: _timeScale = 'year',
  onTimeScaleChange: _onTimeScaleChange,
  onShowBomCodeChange: _onShowBomCodeChange,
  onDisplayModeChange: _onDisplayModeChange,
  currentYear: _currentYear,
  onJumpToDate: _onJumpToDate,
  onCellCopy,
  onCellPaste,
  onTimeCellsDelete,
  uniqueTasks,
  selectedTasks,
  onSelectedTasksChange,
  uniqueBomCodes,
  selectedBomCodes,
  onSelectedBomCodesChange,
  onScroll,
  // Project Name Props
  projectName = '無題のプロジェクト',
  onProjectNameChange,
  
  // Classification filters
  assetClassification,
  workOrderClassifications,
  classificationFilter,
  onClassificationFilterChange,
  woClassificationFilter,
  onWoClassificationFilterChange,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentDisplayAreaConfig, setCurrentDisplayAreaConfig] = useState<DisplayAreaConfig | null>(null);

  // Internal Clipboard for Specifications
  const [specClipboard, setSpecClipboard] = useState<{
    sourceRows: {
      relativeRowIdx: number;
      specs: { relativeColIdx: number; specKey: string; specName: string; value: string }[];
    }[];
  } | null>(null);

  // Task edit dialog state
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');

  // WorkOrder Expand State for Tree Grid
  const [expandedWorkOrders, setExpandedWorkOrders] = useState<Set<string>>(new Set());

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [timeCellsToDelete, setTimeCellsToDelete] = useState<{rowId: string, columnId: string}[]>([]);

  // Project Name Edit State
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState(projectName);

  // Sync temp name when prop changes
  useEffect(() => {
    setTempProjectName(projectName);
  }, [projectName]);

  const handleProjectNameBlur = () => {
    setIsEditingProjectName(false);
    if (tempProjectName.trim() && tempProjectName !== projectName) {
      onProjectNameChange?.(tempProjectName.trim());
    } else {
      setTempProjectName(projectName);
    }
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProjectNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingProjectName(false);
      setTempProjectName(projectName);
    }
  };

  const toggleWorkOrderExpanded = useCallback((workOrderId: string) => {
    setExpandedWorkOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workOrderId)) {
        newSet.delete(workOrderId);
      } else {
        newSet.add(workOrderId);
      }
      return newSet;
    });
  }, []);

  // Check current view mode - use dataViewMode prop if provided, otherwise get from viewModeManager
  const currentViewMode = (() => {
    if (dataViewMode) {
      return dataViewMode;
    }
    const mode = viewModeManager ? viewModeManager.getCurrentMode() : null;
    return mode;
  })();

  const isEquipmentBasedMode = currentViewMode === 'asset-based';
  const isTaskBasedMode = currentViewMode === 'workorder-based';

  // Use timeHeaders directly to avoid memoization issues
  const memoizedTimeHeaders = timeHeaders;

  // Get equipment-based data if in equipment-based mode
  const equipmentBasedData = useMemo(() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
            return [];
    }

    if (!isEquipmentBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getAssetBasedData();
  }, [data, isEquipmentBasedMode, viewModeManager]);

  // Get task-based data if in task-based mode
  const taskBasedData = useMemo(() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
            return [];
    }

    if (!isTaskBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getWorkOrderBasedData();
  }, [data, isTaskBasedMode, viewModeManager]);

  // Convert equipment-based or task-based data to grid format
  const convertedData = useMemo(() => {
    // If we have data from parent, use it directly (it's already transformed)
    if (data && data.length > 0) {
                        return data;
    }

    // Task-based mode conversion (only if no data from parent)
    if (isTaskBasedMode && taskBasedData.length > 0) {
      // WorkOrderBasedRow.type は canonical な 'workOrder' | 'assetChild' のみ。
      // PR #18 で type union がスリム化された結果、旧 'hierarchy' / 'asset' 分岐は
      // dead code となり any によって隠蔽されていた → 削除し canonical 2 値で処理する。
      return taskBasedData.map((row: WorkOrderBasedRow) => {
        const scheduleSnapshot: { [timeKey: string]: AggregatedStatus } = row.aggregatedSchedule
          ? { ...row.aggregatedSchedule }
          : {};
        // HierarchyPath は { [levelKey: string]: string } のオブジェクト。
        // HierarchicalData.hierarchyPath は breadcrumb 表示用 string なので join する。
        const hierarchyPathStr = row.hierarchyPath
          ? Object.values(row.hierarchyPath).join(' > ')
          : undefined;

        return {
          id: `task_${row.workOrderId}_asset_${row.assetId}`,
          task: row.workOrderName || '',
          bomCode: row.assetId!,
          specifications: [],
          results: scheduleSnapshot,
          rolledUpResults: scheduleSnapshot,
          hierarchyPath: hierarchyPathStr,
          level: row.level,
          assetId: row.assetId,
          taskId: row.workOrderId,
          schedule: row.aggregatedSchedule,
          type: 'workOrderLine',
          rowType: 'workOrderLine'
        };
      });
    }

    // Equipment-based mode conversion
    if (isEquipmentBasedMode && equipmentBasedData.length > 0) {
      return equipmentBasedData.map((row) => {
        if (row.type === 'hierarchy') {
          // Hierarchy header row
          return {
            id: `hierarchy_${row.level}_${row.hierarchyValue}`,
            task: `${'  '.repeat(row.level || 0)}${row.hierarchyValue}`,
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: true,
            level: row.level,
            // Add type information
            type: 'hierarchy',
            rowType: 'hierarchy'
          };
        } else {
          // Asset row (帯) - No aggregated schedule natively
          // HierarchyPath (object) を HierarchicalData.hierarchyPath (string) 形式に変換。
          const hierarchyPathStr = row.hierarchyPath
            ? Object.values(row.hierarchyPath).join(' > ')
            : undefined;
          return {
            id: row.assetId!,
            task: row.assetName!,
            bomCode: row.assetId!,
            specifications: row.specifications || [],
            results: {},
            rolledUpResults: {},
            hierarchyPath: hierarchyPathStr,
            level: row.level ?? 0,
            // Add type information
            type: 'asset' as const,
            rowType: 'asset' as const,
          };
        }
      });
    }

    // Default: use original data
        return data;
  }, [data, isTaskBasedMode, taskBasedData, isEquipmentBasedMode, equipmentBasedData]);

  // Generate columns based on current configuration
  // Memoized to prevent heavy array reconstruction on every render
  const columns = useMemo((): GridColumn[] => {
    const cols: GridColumn[] = [];
    // Use data directly instead of convertedData to avoid circular dependency
    const effectiveData = data;

    // Task name column (always visible)
    // In task-based mode, this shows the hierarchy: classification → task → asset
    cols.push({
      id: 'task',
      header: isTaskBasedMode ? '作業階層' : '機器台帳',
      width: 250,
      minWidth: 150,
      maxWidth: 400,
      resizable: true,
      sortable: false,
      type: 'text',
      editable: !(isEquipmentBasedMode || isTaskBasedMode), // Read-only in special modes
      accessor: 'task'
    });

    // TAG No. column (conditional)
    // In task-based mode, TAG No. column is not shown
    if (showBomCode && !isTaskBasedMode) {
      cols.push({
        id: 'bomCode',
        header: 'TAG No.',
        width: 150,
        minWidth: 100,
        maxWidth: 200,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: !(isEquipmentBasedMode || isTaskBasedMode),
        accessor: 'bomCode'
      });
    }

    // Specification columns (when in specifications or both mode)
    // Note: In task-based mode, specifications are not shown because tasks don't have specifications
    if ((displayMode === 'specifications' || displayMode === 'both') && !isTaskBasedMode) {
      // Collect all unique specification keys with their order from data
      const specKeysMap = new Map<string, number>();
      effectiveData.forEach(item => {
        if (item.specifications) {
          item.specifications.forEach(spec => {
            if (spec.key && spec.key.trim()) {
              // Use the minimum order value for each key
              const currentOrder = specKeysMap.get(spec.key);
              if (currentOrder === undefined || spec.order < currentOrder) {
                specKeysMap.set(spec.key, spec.order);
              }
            }
          });
        }
      });

      // Sort by order field, then alphabetically as fallback
      const sortedSpecKeys = Array.from(specKeysMap.entries())
        .sort((a, b) => {
          const orderDiff = a[1] - b[1];
          if (orderDiff !== 0) return orderDiff;
          return a[0].localeCompare(b[0]);
        })
        .map(entry => entry[0]);

      // Limit the number of specification columns to prevent performance issues
      const maxSpecColumns = 20;
      const limitedSpecKeys = sortedSpecKeys.slice(0, maxSpecColumns);

      // Create columns for each specification key
      limitedSpecKeys.forEach(specKey => {
        cols.push({
          id: `spec_${specKey}`,
          header: specKey,
          width: 150,
          minWidth: 100,
          maxWidth: 250,
          resizable: true,
          sortable: false,
          type: 'text',
          editable: true,
          accessor: `specifications.${specKey}`
        });
      });
    }

    // Time header columns (when in maintenance or both mode)
    if (displayMode === 'maintenance' || displayMode === 'both') {
      memoizedTimeHeaders.forEach(timeHeader => {
        cols.push({
          id: `time_${timeHeader}`,
          header: timeHeader,
          width: viewMode === 'cost' ? 120 : 80,
          minWidth: 60,
          maxWidth: 200,
          resizable: true,
          sortable: false,
          type: viewMode === 'cost' ? 'cost' : 'status',
          // In equipment-based mode, cells open dialogs
          // In task-based mode, cells are editable with linked updates
          editable: !isEquipmentBasedMode,
          accessor: `results.${timeHeader}`
        });
      });
    }

    return cols;
  }, [
    displayMode,
    showBomCode,
    memoizedTimeHeaders,
    viewMode,
    data,
    isTaskBasedMode,
    isEquipmentBasedMode
  ]);

  // Generate display area configuration
  const displayAreaConfig = useMemo((): DisplayAreaConfig => {
    const fixedColumns = ['task'];
    if (showBomCode) fixedColumns.push('bomCode');

    const specColumns = columns.filter(col => col.id.startsWith('spec_')).map(col => col.id);
    const maintenanceColumns = columns.filter(col => col.id.startsWith('time_')).map(col => col.id);

    return {
      mode: displayMode,
      fixedColumns,
      scrollableAreas: {
        specifications: {
          visible: displayMode === 'specifications' || displayMode === 'both',
          width: specColumns.length * 135,
          columns: specColumns
        },
        maintenance: {
          visible: displayMode === 'maintenance' || displayMode === 'both',
          width: maintenanceColumns.length * (viewMode === 'cost' ? 120 : 80),
          columns: maintenanceColumns
        }
      }
    };
  }, [showBomCode, columns, displayMode, viewMode]);

  // Calculate visible row IDs in the exact order they appear in the UI for range selection
  const visibleRowIds = useMemo(() => {
    const ids: string[] = [];
    if (isTaskBasedMode && taskBasedData.length > 0) {
      // taskBasedData は ViewModeManager.getWorkOrderBasedData() の出力で type は
      // canonical な 'workOrder' | 'assetChild' のみ。
      const visibleRows = taskBasedData.filter(row => {
        if (row.type === 'workOrder') return true;
        if (row.type === 'assetChild' && row.workOrderId) {
          return expandedWorkOrders?.has(row.workOrderId);
        }
        return true;
      });
      visibleRows.forEach(row => ids.push(row.id));
    } else {
      const renderData: [string, HierarchicalData[]][] = groupedData
        ? Object.entries(groupedData)
        : [['', data]];
      renderData.forEach(([hierarchyPath, items]) => {
        if (hierarchyPath) {
          // Add group header if visual match
          // IDs of group headers aren't selectable via specifications usually, but necessary for accurate distance
          ids.push(`hierarchy_${hierarchyPath}`);
        }
        items.forEach(item => {
          ids.push(item.id);
        });
      });
    }
    return ids;
  }, [data, groupedData, isTaskBasedMode, taskBasedData, expandedWorkOrders]);

  const {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell,
    isDragging,
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    isCellInSelectedRange
  } = useMaintenanceGridState(columns, visibleRowIds);

  // 仮想スクロールは常に有効（パフォーマンス安定性のため定数）。
  const autoVirtualScrolling = useMemo(() => true, []);

  // Performance optimization hooks - use appropriate data based on mode
  // convertedData は taskBased / equipmentBased / parent data から派生する派生行配列。
  // 内部表現としては HierarchicalData[] のスーパーセット相当のフィールドを持つため
  // 下流の処理 (clipboard / find / spec edit) では HierarchicalData[] として扱う。
  const dataForProcessing = useMemo<HierarchicalData[]>(() => {
    return convertedData as HierarchicalData[];
  }, [convertedData]);

  const processedData = dataForProcessing;
  const processedColumns = columns;
  const debouncedUpdate = useCallback((fn: () => void) => fn(), []);
  const shouldUseVirtualScrolling = columns.length > 20;

  // Handle cell double click - opens TaskEditDialog for both modes
  const handleCellDoubleClick = useCallback((rowId: string, columnId: string, event?: React.MouseEvent<HTMLElement>) => {
    
    // Only handle time columns for TaskEditDialog
    if (columnId.startsWith('time_')) {
      const timeHeader = columnId.replace('time_', '');

      // Extract assetId and taskId from rowId
      let assetId: string | undefined;
      let taskId: string | undefined;

      // Check for ViewModeManager's task row format: asset_P-101_wo_wo-001
      if (rowId.startsWith('asset_') && rowId.includes('_wo_')) {
        const parts = rowId.replace('asset_', '').split('_wo_');
        assetId = parts[0];
        taskId = parts[1];
      }
      // Check for WorkOrder tree child row format: workOrder_wo-001_asset_P-101
      else if (rowId.startsWith('workOrder_') && rowId.includes('_asset_')) {
        const parts = rowId.split('_asset_');
        taskId = parts[0].replace('workOrder_', '');
        // Strip out any trailing suffixes just in case
        assetId = parts[1].split('_')[0] === parts[1] ? parts[1] : parts[1].split('_')[0]; 
        // Wait, asset id might have hyphens but usually no underscores. If `_wol_` was attached, split by it.
        if (parts[1].includes('_wol_')) {
            assetId = parts[1].split('_wol_')[0];
        } else {
            assetId = parts[1];
        }
      }
      // Check for WorkOrder tree parent row format: workOrder_wo-001
      else if (rowId.startsWith('workOrder_') && !rowId.includes('_asset_')) {
        taskId = rowId.replace('workOrder_', '');
        assetId = ''; // Blank asset means we are focusing on the whole work order
      }
      // Check for alternative legacy task row format: task_wo-001_asset_P-101
      else if (rowId.startsWith('task_') && rowId.includes('_asset_')) {
        const parts = rowId.split('_asset_');
        taskId = parts[0].replace('task_', '');
        const assetParts = parts[1].split('_wol_');
        assetId = assetParts[0];
      } 
      // Finally, check for pure asset row format: asset_P-101
      else if (rowId.startsWith('asset_')) {
        assetId = rowId.replace('asset_', '');
      } 
      else {
        // Fallback: raw asset ID
        assetId = rowId;
      }

      if (assetId || taskId) {
        
        // CRITICAL: Prevent MaintenanceGridLayout from opening StatusSelectionDialog/CostInputDialog
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Open TaskEditDialog through App.tsx integration
        if (onOpenTaskEditDialog) {
          onOpenTaskEditDialog(assetId || '', timeHeader, taskId);
        } else {
          // Fallback for standalone usage
          setSelectedAssetId(assetId || '');
          setSelectedDateKey(timeHeader);
          setTaskEditDialogOpen(true);
        }
        return;
      }
    }

    // For non-time columns, let MaintenanceGridLayout handle (specifications, etc.)
  }, [onOpenTaskEditDialog]);

  // Handle task association updates from dialog
  const handleTaskAssociationUpdate = useCallback((updates: WorkOrderLineUpdate[]) => {
    if (onTaskAssociationUpdate) {
      onTaskAssociationUpdate(updates);
    }

    // Close dialog with minimal state change to prevent layout issues
    setTaskEditDialogOpen(false);

    // (元コードは存在しない setClipboardMessage を呼んでおり死コードだったため削除)
  }, [onTaskAssociationUpdate]);

  // Handle cell editing with support for both regular cells and specifications
  // value は呼び出し元 (MaintenanceGridLayout) から spec 編集の string / time セル編集の
  // string シンボル ('◎' 等) / 数値などが混在して流れてくるため unknown を起点に narrow する。
  const handleCellEdit = useCallback((rowId: string, columnId: string, value: unknown) => {
    if (readOnly) return;

    // In equipment-based mode, time cells editing is handled by double-click dialog
    // Don't process edit values directly for time cells
    if (isEquipmentBasedMode && columnId.startsWith('time_')) {
      // Time cell editing is handled by TaskEditDialog via double-click
      return;
    }

    // Check if this is a specification edit
    if (columnId.startsWith('spec_')) {
      const specKey = columnId.replace('spec_', '');
      // spec.value の正規型は string なので、unknown を防御的に string 化する
      const specValue: string = typeof value === 'string' ? value : String(value ?? '');

      if (onSpecificationEdit) {
        debouncedUpdate(() => {
          // Find the specification index for this key
          const updatedItem = processedData.find(item => item.id === rowId);
          if (updatedItem) {
            const newSpecs = [...(updatedItem.specifications || [])];
            const existingSpecIndex = newSpecs.findIndex(s => s.key === specKey);

            if (existingSpecIndex >= 0) {
              // Update existing specification
              newSpecs[existingSpecIndex] = {
                ...newSpecs[existingSpecIndex],
                value: specValue
              };
            } else {
              // Add new specification
              newSpecs.push({
                key: specKey,
                value: specValue,
                order: newSpecs.length + 1
              });
            }

            // Call the specification edit handler with the spec index
            const specIndex = existingSpecIndex >= 0 ? existingSpecIndex : newSpecs.length - 1;
            onSpecificationEdit(rowId, specIndex, 'value', specValue);

            // Update the item
            if (onUpdateItem) {
              onUpdateItem({
                ...updatedItem,
                specifications: newSpecs
              });
            }
          }
        });
      }
    } else {
      // Regular cell edit (maintenance area)
      if (onCellEdit) {
        debouncedUpdate(() => {
          onCellEdit(rowId, columnId, value);

          // Trigger cross-area synchronization
          // When maintenance data is edited, ensure the item is updated
          const updatedItem = processedData.find(item => item.id === rowId);
          if (updatedItem && onUpdateItem) {
            // Handle time column edits
            if (columnId.startsWith('time_')) {
              const timeHeader = columnId.replace('time_', '');

              // Convert string status symbols to status object if needed
              type StatusEntry = { planned: boolean; actual: boolean; planCost: number; actualCost: number };
              let statusValue: StatusEntry;
              if (typeof value === 'string') {
                switch (value) {
                  case '◎':
                    statusValue = { planned: true, actual: true, planCost: 0, actualCost: 0 };
                    break;
                  case '〇':
                  case '○':
                    statusValue = { planned: true, actual: false, planCost: 0, actualCost: 0 };
                    break;
                  case '●':
                    statusValue = { planned: false, actual: true, planCost: 0, actualCost: 0 };
                    break;
                  default:
                    statusValue = { planned: false, actual: false, planCost: 0, actualCost: 0 };
                }
              } else {
                // 非 string 値はクリップボード由来等で既に status オブジェクト形状を仮定
                statusValue = value as StatusEntry;
              }

              const updatedResults = {
                ...updatedItem.results,
                [timeHeader]: statusValue
              };

              onUpdateItem({
                ...updatedItem,
                results: updatedResults,
                rolledUpResults: updatedResults
              });
            } else {
              // Handle other field edits
              onUpdateItem({
                ...updatedItem,
                [columnId]: value
              });
            }
          }
        });
      }
    }
  }, [readOnly, onCellEdit, onSpecificationEdit, debouncedUpdate, processedData, onUpdateItem, isEquipmentBasedMode]);



  const handleColumnResize = useCallback((columnId: string, width: number) => {
    updateColumnWidth(columnId, width);
    onColumnResize?.(columnId, width);
  }, [updateColumnWidth, onColumnResize]);

  const handleRowResize = useCallback((rowId: string, height: number) => {
    updateRowHeight(rowId, height);
    onRowResize?.(rowId, height);
  }, [updateRowHeight, onRowResize]);



  // Update current display area config when displayMode changes
  useEffect(() => {
    setCurrentDisplayAreaConfig(null); // Reset to use the computed displayAreaConfig
  }, [displayMode]);

  const handleSystemCopy = useCallback(async () => {
    if (!gridState.selectedCell) return;
    const { columnId } = gridState.selectedCell;

    // Is it a specification string?
    if (columnId.startsWith('spec_')) {
      // TSV logic for selectedRange
      const startCell = gridState.selectedRange?.start || gridState.selectedCell;
      const endCell = gridState.selectedRange?.end || gridState.selectedCell;
      
      // Get exact coordinates using visibleRowIds to match what user sees
      const startRowIdx = visibleRowIds.indexOf(startCell.rowId);
      const endRowIdx = visibleRowIds.indexOf(endCell.rowId);
      const minRow = Math.min(startRowIdx, endRowIdx);
      const maxRow = Math.max(startRowIdx, endRowIdx);
      
      const startColIdx = processedColumns.findIndex(c => c.id === startCell.columnId);
      const endColIdx = processedColumns.findIndex(c => c.id === endCell.columnId);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      
      if (minRow >= 0 && minCol >= 0) {
        const rowsToCopy: string[][] = [];
        const internalClipboardRows: {
          relativeRowIdx: number;
          specs: { relativeColIdx: number; specKey: string; specName: string; value: string }[];
        }[] = [];

        for (let r = minRow; r <= maxRow; r++) {
          const targetRowId = visibleRowIds[r];
          const rowData = processedData.find(d => d.id === targetRowId);
          if (!rowData) continue; // Skip group header rows that don't have specifications

          const rowValues: string[] = [];
          const currentInternalRow: { relativeColIdx: number; specKey: string; specName: string; value: string }[] = [];

          for (let c = minCol; c <= maxCol; c++) {
            const colDef = processedColumns[c];
            if (colDef.id.startsWith('spec_')) {
              const specKey = colDef.id.replace('spec_', '');
              const spec = rowData.specifications?.find(s => s.key === specKey);
              const val = spec?.value || '';
              rowValues.push(val);
              currentInternalRow.push({
                relativeColIdx: c - minCol,
                specKey,
                specName: colDef.header,
                value: val
              });
            } else {
              rowValues.push('');
            }
          }
          rowsToCopy.push(rowValues);
          if (currentInternalRow.length > 0) {
            internalClipboardRows.push({
              relativeRowIdx: r - minRow,
              specs: currentInternalRow
            });
          }
        }
        
        try {
          const tsv = generateTSV(rowsToCopy);
          await writeToClipboard(tsv);
          // Set internal specification clipboard state
          setSpecClipboard({ sourceRows: internalClipboardRows });
        } catch (e) {
          console.error('Failed to copy', e);
        }
      }
      return;
    }

    if (onCellCopy) {
      onCellCopy(gridState.selectedCell.rowId, gridState.selectedCell.columnId, viewMode);
    }
  }, [gridState.selectedCell, gridState.selectedRange, onCellCopy, viewMode, processedData, processedColumns, visibleRowIds]);

  // Handle paste operation with cross-area support
  const handleSystemPaste = useCallback(async () => {
    if (!gridState.selectedCell || readOnly) return;
    const { rowId, columnId } = gridState.selectedCell;

    if (columnId.startsWith('spec_')) {
      try {
        const startRowIdx = visibleRowIds.indexOf(rowId);
        const startColIdx = processedColumns.findIndex(c => c.id === columnId);
        
        if (startRowIdx >= 0 && startColIdx >= 0) {
          const batchChanges: SpecificationChange[] = [];
          
          if (specClipboard && specClipboard.sourceRows.length > 0) {
            // Priority: Use internal clipboard with metadata
            specClipboard.sourceRows.forEach((srcRow) => {
              const targetRowIdx = startRowIdx + srcRow.relativeRowIdx;
              if (targetRowIdx >= visibleRowIds.length) return;
              
              const targetRowId = visibleRowIds[targetRowIdx];
              const targetRow = processedData.find(d => d.id === targetRowId);
              if (!targetRow) return;

              // Parse asset ID robustly using common utility
              const { assetId: actualAssetId } = extractIdsFromRowId(targetRow.id, targetRow.assetId);

              let rowModified = false;
              const newSpecs = [...(targetRow.specifications || [])];

              srcRow.specs.forEach((srcSpec) => {
                const targetColIdx = startColIdx + srcSpec.relativeColIdx;
                if (targetColIdx >= processedColumns.length) return;
                
                const targetCol = processedColumns[targetColIdx];
                if (targetCol.id.startsWith('spec_') && targetCol.editable) {
                  const specKey = targetCol.id.replace('spec_', '');
                  const existingIndex = newSpecs.findIndex(s => s.key === specKey);
                  
                  if (existingIndex >= 0) {
                    newSpecs[existingIndex] = { ...newSpecs[existingIndex], value: srcSpec.value };
                  } else {
                    // canonical Specification 型は { key, value, order } のみ。
                    // `name` は any によって紛れ込んでいた死フィールドで read 元なし。
                    newSpecs.push({ key: specKey, value: srcSpec.value, order: newSpecs.length + 1 });
                  }
                  rowModified = true;
                }
              });

              if (rowModified) {
                batchChanges.push({
                  assetId: actualAssetId,
                  specifications: newSpecs
                });
              }
            });

          } else {
            // Fallback: Read raw TSV from clipboard (e.g. from Excel)
            const tsvText = await readFromClipboard();
            if (!tsvText) return;
            
            const clipRows = parseTSV(tsvText);
            if (clipRows.length === 0) return;
            
            clipRows.forEach((rowVals, rOffset) => {
              const targetRowIdx = startRowIdx + rOffset;
              if (targetRowIdx >= visibleRowIds.length) return;
              const targetRowId = visibleRowIds[targetRowIdx];
              const targetRow = processedData.find(d => d.id === targetRowId);
              if (!targetRow) return;

              // Parse asset ID robustly using common utility
              const { assetId: actualAssetId } = extractIdsFromRowId(targetRow.id, targetRow.assetId);

              let rowModified = false;
              const newSpecs = [...(targetRow.specifications || [])];

              rowVals.forEach((val, cOffset) => {
                const targetColIdx = startColIdx + cOffset;
                if (targetColIdx >= processedColumns.length) return;
                const targetCol = processedColumns[targetColIdx];
                
                if (targetCol.id.startsWith('spec_') && targetCol.editable) {
                  const specKey = targetCol.id.replace('spec_', '');
                  const existingIndex = newSpecs.findIndex(s => s.key === specKey);
                  
                  if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                    // Empty value: remove the specification if it exists
                    if (existingIndex >= 0) {
                      newSpecs.splice(existingIndex, 1);
                      rowModified = true;
                    }
                  } else {
                    if (existingIndex >= 0) {
                      newSpecs[existingIndex] = { ...newSpecs[existingIndex], value: val };
                    } else {
                      newSpecs.push({ key: specKey, value: val, order: newSpecs.length + 1 });
                    }
                    rowModified = true;
                  }
                }
              });

              if (rowModified) {
                batchChanges.push({
                  assetId: actualAssetId,
                  specifications: newSpecs
                });
              }
            });
          }

          // Trigger batch update once with all changes
          if (batchChanges.length > 0 && onSpecificationBatchUpdate) {
            onSpecificationBatchUpdate(batchChanges);
          } else if (batchChanges.length > 0 && onUpdateItem) {
            // Legacy fallback if App didn't pass the new prop
            console.warn('onSpecificationBatchUpdate is missing, falling back to sequential UI updates (Undo/Redo disabled)');
            batchChanges.forEach(change => {
              const legacyRow = processedData.find(d => d.assetId === change.assetId); // approximate
              if (legacyRow) onUpdateItem({ ...legacyRow, specifications: change.specifications });
            });
          }
        }
      } catch (e) {
        console.error('Failed to paste', e);
      }
      return;
    }

    if (onCellPaste) {
      onCellPaste(rowId, columnId, viewMode);
      // Optional: notification will be triggered internally by App.tsx if successful
    }
  }, [gridState.selectedCell, readOnly, onCellPaste, viewMode, processedData, processedColumns, specClipboard, onSpecificationBatchUpdate, onUpdateItem, visibleRowIds]);

  // Handle delete operation
  const handleSystemDelete = useCallback(() => {
    if (!gridState.selectedCell || readOnly) return;

    const { rowId, columnId } = gridState.selectedCell;
    
    // Check if this is a specification column
    if (columnId.startsWith('spec_')) {
      // Determine range to delete
      const startCell = gridState.selectedRange?.start || gridState.selectedCell;
      const endCell = gridState.selectedRange?.end || gridState.selectedCell;

      const startRowIdx = visibleRowIds.indexOf(startCell.rowId);
      const endRowIdx = visibleRowIds.indexOf(endCell.rowId);
      const minRow = Math.min(startRowIdx, endRowIdx);
      const maxRow = Math.max(startRowIdx, endRowIdx);
      
      const startColIdx = processedColumns.findIndex(c => c.id === startCell.columnId);
      const endColIdx = processedColumns.findIndex(c => c.id === endCell.columnId);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      
      if (minRow >= 0 && minCol >= 0) {
        const batchChanges: SpecificationChange[] = [];

        for (let r = minRow; r <= maxRow; r++) {
          const targetRowId = visibleRowIds[r];
          const targetRow = processedData.find(d => d.id === targetRowId);
          if (!targetRow) continue; // Skip group headers
          
          // Parse asset ID robustly
          const { assetId: actualAssetId } = extractIdsFromRowId(targetRow.id, targetRow.assetId);

          let rowModified = false;
          const newSpecs = [...(targetRow.specifications || [])];
          
          for (let c = minCol; c <= maxCol; c++) {
            const colDef = processedColumns[c];
            if (colDef.id.startsWith('spec_') && colDef.editable) {
              const specKey = colDef.id.replace('spec_', '');
              const existingIndex = newSpecs.findIndex(s => s.key === specKey);
              if (existingIndex >= 0) {
                // Delete: remove from newSpecs instead of just setting value: '' to prevent AssetManager validation errors
                newSpecs.splice(existingIndex, 1);
                rowModified = true;
              }
            }
          }
          
          if (rowModified) {
            batchChanges.push({
              assetId: actualAssetId,
              specifications: newSpecs
            });
          }
        }

        if (batchChanges.length > 0 && onSpecificationBatchUpdate) {
          onSpecificationBatchUpdate(batchChanges);
        } else if (batchChanges.length > 0 && onUpdateItem) {
          batchChanges.forEach(change => {
            const legacyRow = processedData.find(d => d.id === rowId || d.assetId === change.assetId);
            if (legacyRow) onUpdateItem({ ...legacyRow, specifications: change.specifications });
          });
        }
      }
    } else if (columnId.startsWith('time_')) {
      const startCell = gridState.selectedRange?.start || gridState.selectedCell;
      const endCell = gridState.selectedRange?.end || gridState.selectedCell;

      const startRowIdx = visibleRowIds.indexOf(startCell.rowId);
      const endRowIdx = visibleRowIds.indexOf(endCell.rowId);
      const minRow = Math.min(startRowIdx, endRowIdx);
      const maxRow = Math.max(startRowIdx, endRowIdx);
      
      const startColIdx = processedColumns.findIndex(c => c.id === startCell.columnId);
      const endColIdx = processedColumns.findIndex(c => c.id === endCell.columnId);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);
      
      if (minRow >= 0 && minCol >= 0) {
        const cells: {rowId: string, columnId: string}[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const tRowId = visibleRowIds[r];
          // Skip hierarchy header rows
          if (tRowId.startsWith('hierarchy_')) continue;
          for (let c = minCol; c <= maxCol; c++) {
            const colId = processedColumns[c].id;
            if (colId.startsWith('time_')) {
              cells.push({ rowId: tRowId, columnId: colId });
            }
          }
        }
        if (cells.length > 0) {
          setTimeCellsToDelete(cells);
          setDeleteConfirmOpen(true);
        }
      }
      return;
    } else {
      // Delete other editable fields
      handleCellEdit(rowId, columnId, '');
    }
  }, [
    gridState.selectedCell,
    readOnly,
    processedColumns,
    processedData,
    onUpdateItem,
    handleCellEdit,
    gridState.selectedRange?.end,
    gridState.selectedRange?.start,
    onSpecificationBatchUpdate,
    visibleRowIds,
  ]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't handle keyboard events if they come from input elements or if a menu is open
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // Check if any dropdown/menu is open by looking for MUI menu elements
    const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
    if (hasOpenMenu) {
      return; // Don't handle keyboard events when menus are open
    }

    // Handle copy/paste shortcuts and performance monitor toggle
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          handleSystemCopy();
          return;
        case 'x':
          e.preventDefault();
          if (gridState.selectedCell?.columnId.startsWith('time_')) {
            // Do not allow cut operation on time scale (schedule) cells via keyboard shortcuts
            return;
          }
          // Fix for ghost lines issue: make sure copy fully resolves and states are stable before deleting
          handleSystemCopy().then(() => {
            setTimeout(() => {
              handleSystemDelete();
            }, 0);
          });
          return;
        case 'v':
          e.preventDefault();
          handleSystemPaste();
          return;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            // Toggle performance monitor via Ctrl+Shift+P (Not implemented)
            console.log("Performance monitor toggle requested");
            return;
          }
          break;
      }
    }

    // Only handle navigation if we're not in editing mode
    if (gridState.editingCell) return;

    // Only handle navigation if a cell is selected
    if (!gridState.selectedCell) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        handleSystemDelete();
        break;
      case 'Tab':
        e.preventDefault();
        navigateToCell('tab');
        break;
      case 'Enter':
        e.preventDefault();
        // If the current cell is editable and not readonly, start editing
        // eslint-disable-next-line no-case-declarations
        const currentColumn = processedColumns.find(col => col.id === gridState.selectedCell?.columnId);
        if (currentColumn?.editable && !readOnly) {
          setEditingCell(gridState.selectedCell.rowId, gridState.selectedCell.columnId);
        } else {
          navigateToCell('enter');
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateToCell('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateToCell('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateToCell('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateToCell('right');
        break;
      case 'Escape':
        // Clear selection or cancel editing
        if (gridState.editingCell) {
          setEditingCell(null, null);
        } else {
          setSelectedCell(null, null);
        }
        break;
    }
  }, [
    gridState.editingCell,
    gridState.selectedCell,
    navigateToCell,
    processedColumns,
    readOnly,
    setEditingCell,
    setSelectedCell,
    handleSystemCopy,
    handleSystemPaste,
    handleSystemDelete
  ]);

  // Focus the grid when a cell is selected, but not if menus are open
  useEffect(() => {
    if (gridState.selectedCell && gridRef.current) {
      // Check if any dropdown/menu is open
      const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
      if (!hasOpenMenu) {
        gridRef.current.focus();
      }
    }
  }, [gridState.selectedCell]);

  // Asset selection handlers - Requirements 3.2, 3.6
  const handleAssetSelectionToggle = useCallback((assetId: string, event: React.MouseEvent) => {
    if (!onAssetSelectionChange) return;

    const currentSelected = selectedAssets || [];

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle individual selection
      if (currentSelected.includes(assetId)) {
        onAssetSelectionChange(currentSelected.filter(id => id !== assetId));
      } else {
        onAssetSelectionChange([...currentSelected, assetId]);
      }
    } else if (event.shiftKey && currentSelected.length > 0) {
      // Shift+Click: Range selection
      const lastSelected = currentSelected[currentSelected.length - 1];
      const assetIds = (convertedData as HierarchicalData[])
        .filter(row => !row.isGroupHeader)
        .map(row => row.id);

      const lastIndex = assetIds.indexOf(lastSelected);
      const currentIndex = assetIds.indexOf(assetId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = assetIds.slice(start, end + 1);

        // Merge with existing selection
        const newSelection = Array.from(new Set([...currentSelected, ...rangeIds]));
        onAssetSelectionChange(newSelection);
      }
    } else {
      // Regular click: Single selection
      onAssetSelectionChange([assetId]);
    }
  }, [selectedAssets, onAssetSelectionChange, convertedData]);



  // Stable callback handlers to prevent infinite re-renders
  const handleLevel1FilterChange = useCallback((e: SelectChangeEvent<string>) => {
    onLevel1FilterChange?.(e.target.value);
  }, [onLevel1FilterChange]);

  const handleLevel2FilterChange = useCallback((e: SelectChangeEvent<string>) => {
    onLevel2FilterChange?.(e.target.value);
  }, [onLevel2FilterChange]);

  const handleLevel3FilterChange = useCallback((e: SelectChangeEvent<string>) => {
    onLevel3FilterChange?.(e.target.value);
  }, [onLevel3FilterChange]);

  // handleViewModeChange / handleTimeScaleChange は本コンポーネント内で binding 先が無く
  // 死コードだったため削除。viewMode / timeScale の切替 UI は親側 (App.tsx) に存在する。

  // Stable empty function references with useMemo to prevent re-creation
  const stableOnSearchChange = useMemo(() => onSearchChange || (() => { }), [onSearchChange]);

  // Desktop-only view
  const renderGridView = useMemo(() => {
    return (
      <MaintenanceGridLayout
        data={processedData}
        columns={processedColumns}
        displayAreaConfig={currentDisplayAreaConfig || displayAreaConfig}
        gridState={gridState}
        viewMode={viewMode}
        groupedData={groupedData}
        onCellEdit={handleCellEdit}
        onCellDoubleClick={handleCellDoubleClick}
        onSpecificationEdit={onSpecificationEdit}
        onSpecificationColumnReorder={onSpecificationColumnReorder}
        onAssetEdit={onAssetEdit}
        hierarchy={hierarchy}
        onColumnResize={handleColumnResize}
        onRowResize={handleRowResize}
        onSelectedCellChange={setSelectedCell}
        onEditingCellChange={setEditingCell}
        onSelectedRangeChange={setSelectedRange}
        onUpdateItem={onUpdateItem}
        virtualScrolling={autoVirtualScrolling || shouldUseVirtualScrolling}
        enableHorizontalVirtualScrolling={autoVirtualScrolling || shouldUseVirtualScrolling}
        readOnly={readOnly}
        onCopy={handleSystemCopy}
        onPaste={handleSystemPaste}
        isEquipmentBasedMode={isEquipmentBasedMode}
        isTaskBasedMode={isTaskBasedMode}
        // Asset selection props
        selectedAssets={selectedAssets}
        onAssetSelectionToggle={handleAssetSelectionToggle}
        onScroll={onScroll}
        // WorkOrder expansion props
        expandedWorkOrders={expandedWorkOrders}
        onToggleWorkOrderExpanded={toggleWorkOrderExpanded}
        // Drag selection props
        isDragging={isDragging}
        startDragSelection={startDragSelection}
        updateDragSelection={updateDragSelection}
        endDragSelection={endDragSelection}
        isCellInSelectedRange={isCellInSelectedRange}
        // Filter props for MaintenanceTableHeader
        searchTerm={searchTerm}
        onSearchChange={stableOnSearchChange}
        level1Filter={level1Filter}
        level2Filter={level2Filter}
        level3Filter={level3Filter}
        onLevel1FilterChange={handleLevel1FilterChange}
        onLevel2FilterChange={handleLevel2FilterChange}
        onLevel3FilterChange={handleLevel3FilterChange}
        hierarchyFilterTree={hierarchyFilterTree}
        level2Options={level2Options}
        level3Options={level3Options}
        uniqueTasks={uniqueTasks}
        selectedTasks={selectedTasks}
        onSelectedTasksChange={onSelectedTasksChange}
        uniqueBomCodes={uniqueBomCodes}
        selectedBomCodes={selectedBomCodes}
        onSelectedBomCodesChange={onSelectedBomCodesChange}
        assetClassification={assetClassification}
        workOrderClassifications={workOrderClassifications}
        classificationFilter={classificationFilter}
        onClassificationFilterChange={onClassificationFilterChange}
        woClassificationFilter={woClassificationFilter}
        onWoClassificationFilterChange={onWoClassificationFilterChange}
        assets={assets}
      />
    );
  }, [
    processedData, processedColumns, currentDisplayAreaConfig, displayAreaConfig,
    gridState, viewMode, groupedData, handleCellEdit, handleCellDoubleClick, isEquipmentBasedMode, isTaskBasedMode,
    onSpecificationEdit, onSpecificationColumnReorder, handleColumnResize, handleRowResize, setSelectedCell, setEditingCell,
    setSelectedRange, onUpdateItem,
    autoVirtualScrolling, shouldUseVirtualScrolling, readOnly,
    handleSystemCopy, handleSystemPaste, selectedAssets, handleAssetSelectionToggle, hierarchy, onAssetEdit,
    expandedWorkOrders, toggleWorkOrderExpanded,
    isDragging, startDragSelection, updateDragSelection, endDragSelection, isCellInSelectedRange,
    searchTerm, stableOnSearchChange, level1Filter, level2Filter, level3Filter,
    handleLevel1FilterChange, handleLevel2FilterChange, handleLevel3FilterChange,
    hierarchyFilterTree, level2Options, level3Options, uniqueTasks, selectedTasks,
    onSelectedTasksChange, uniqueBomCodes, selectedBomCodes, onSelectedBomCodesChange,
    assetClassification, workOrderClassifications, classificationFilter, onClassificationFilterChange,
    woClassificationFilter, onWoClassificationFilterChange, assets, onScroll,
  ]);



  // Desktop-only className
  const paperClassName = useMemo(() => {
    return `enhanced-maintenance-grid ${className} desktop-view`;
  }, [className]);

  return (
    <>
      {/* Project Title Container - Floating above the grid */}
      <Box className="project-title-container">
        {isEditingProjectName ? (
          <TextField
            autoFocus
            variant="standard"
            value={tempProjectName}
            onChange={(e) => setTempProjectName(e.target.value)}
            onBlur={handleProjectNameBlur}
            onKeyDown={handleProjectNameKeyDown}
            className="project-title-input"
            inputProps={{
              style: {
                textAlign: 'center',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                padding: '0'
              }
            }}
          />
        ) : (
          <Box
            className="project-title-text"
            onClick={() => setIsEditingProjectName(true)}
          >
            {projectName || '無題のプロジェクト'}
          </Box>
        )}
      </Box>

      <Paper
        ref={gridRef}
        className={paperClassName}
        elevation={1}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          '&:focus': {
            outline: 'none'
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Desktop Grid Layout */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {renderGridView}
          </Box>
        </Box>
      </Paper>


      {/* WorkOrderLineDialog - Equipment-based mode */}
      {isEquipmentBasedMode && taskEditDialogOpen && (
        <WorkOrderLineDialog
          open={taskEditDialogOpen}
          assetId={selectedAssetId}
          dateKey={selectedDateKey}
          associations={associations.filter(a => a.AssetId === selectedAssetId)}
          allWorkOrders={workOrders}
          allAssets={assets}
          onSave={handleTaskAssociationUpdate}
          onClose={() => setTaskEditDialogOpen(false)}
          readOnly={readOnly}
          allWorkOrderLines={associations}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>計画・実績データの削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            選択したタイムスケールセルから作業データを削除してもよろしいですか？（{timeCellsToDelete.length}セル）<br/>
            この操作は元に戻せる場合がありますが、完全にデータが消去されます。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</Button>
          <Button 
            onClick={() => {
              if (timeCellsToDelete.length > 0 && onTimeCellsDelete) {
                onTimeCellsDelete(timeCellsToDelete);
              }
              setDeleteConfirmOpen(false);
              setTimeCellsToDelete([]);
            }} 
            variant="contained" 
            color="error"
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EnhancedMaintenanceGrid;
