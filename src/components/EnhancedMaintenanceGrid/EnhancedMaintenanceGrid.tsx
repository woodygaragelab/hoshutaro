import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
// HMR Cache Invalidation Touch: Vite requires this to clear the module graph after deep component deletion
import { Box, Paper, Snackbar, Alert } from '@mui/material';
import { EnhancedMaintenanceGridProps, DisplayAreaConfig, GridColumn } from '../ExcelLikeGrid/types';
import MaintenanceGridLayout from './MaintenanceGridLayout';
import { useMaintenanceGridState } from './hooks/useMaintenanceGridState';
import { GridFilterBar } from './GridFilterBar';
import { WorkOrderLineDialog } from '../WorkOrderLineDialog/WorkOrderLineDialog';
import { ViewModeManager } from '../../services/ViewModeManager';
import {
  WorkOrder,
  Asset,
  WorkOrderLine,
  HierarchyDefinition,
  WorkOrderLineUpdate,
  AssetBasedRow,
  WorkOrderBasedRow,
  TimeScale,
} from '../../types/maintenanceTask';
import './EnhancedMaintenanceGrid.css';

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
  onAssetEdit?: (assetId: string, updates: any) => void;

  // Undo/Redo props - Requirements 8.1, 8.2, 8.3
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  // Additional props from usage
  displayMode?: 'both' | 'specifications' | 'maintenance';
  showBomCode?: boolean;
  onSpecificationEdit?: (rowId: string, specIndex: number, field: string, value: any) => void;
  onSpecificationColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  className?: string;
  groupedData?: { [key: string]: any[] };
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
  onLevel1FilterChange?: (event: any) => void;
  onLevel2FilterChange?: (event: any) => void;
  onLevel3FilterChange?: (event: any) => void;
  hierarchyFilterTree?: any;
  level2Options?: string[];
  level3Options?: string[];
  onAddYear?: () => void;
  onDeleteYear?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
  onResetData?: () => void;
  onAIAssistantToggle?: () => void;
  isAIAssistantOpen?: boolean;
  onShowBomCodeChange?: (checked: boolean) => void;
  onDisplayModeChange?: (mode: 'both' | 'specifications' | 'maintenance') => void;
  onViewModeChange?: (mode: 'status' | 'cost') => void;
  timeScale?: TimeScale;
  onTimeScaleChange?: (scale: TimeScale) => void;
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
  onCellCopy?: (rowId: string, columnId: string, viewMode: 'status' | 'cost') => void;
  onCellPaste?: (rowId: string, columnId: string, viewMode: 'status' | 'cost') => void;
}

export const EnhancedMaintenanceGrid: React.FC<ExtendedMaintenanceGridProps> = ({
  data,
  timeHeaders,
  viewMode,
  displayMode,
  showBomCode,
  onCellEdit,
  onSpecificationEdit,
  onSpecificationColumnReorder,
  onColumnResize,
  onRowResize,
  onUpdateItem,
  virtualScrolling = false,
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
  onDataViewModeChange,
  // Edit scope props - Requirements 4.8, 5.7
  editScope = 'single-asset',
  onEditScopeChange,
  // Hierarchy management props - Requirements 3.1, 3.2
  selectedAssets = [],
  onAssetSelectionChange,
  onHierarchyEdit,
  onOpenAssetReassignDialog,
  onOpenTaskEditDialog,
  onAssetEdit,
  // Undo/Redo props - Requirements 8.1, 8.2, 8.3
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
  onViewModeChange,
  timeScale = 'year',
  onTimeScaleChange,
  onShowBomCodeChange,
  onDisplayModeChange,
  onAddYear,
  onDeleteYear,
  onExportData,
  onImportData,
  onResetData,
  onAIAssistantToggle,
  isAIAssistantOpen = false,
  currentYear,
  onJumpToDate,
  onCellCopy,
  onCellPaste,
  uniqueTasks,
  selectedTasks,
  onSelectedTasksChange,
  uniqueBomCodes,
  selectedBomCodes,
  onSelectedBomCodesChange
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
  const [currentDisplayAreaConfig, setCurrentDisplayAreaConfig] = useState<DisplayAreaConfig | null>(null);

  // Task edit dialog state
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');

  // WorkOrder Expand State for Tree Grid
  const [expandedWorkOrders, setExpandedWorkOrders] = useState<Set<string>>(new Set());

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

  // Get equipment-based data if in equipment-based mode - simplified without useMemo
  const equipmentBasedData = (() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
            return [];
    }

    if (!isEquipmentBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getAssetBasedData();
  })();

  // Get task-based data if in task-based mode - simplified without useMemo
  const taskBasedData = (() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
            return [];
    }

    if (!isTaskBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getWorkOrderBasedData();
  })();

  // Convert equipment-based or task-based data to grid format
  // Use immediate function to avoid memoization issues
  const convertedData = (() => {
    // If we have data from parent, use it directly (it's already transformed)
    if (data && data.length > 0) {
                        return data;
    }

    // Task-based mode conversion (only if no data from parent)
    if (isTaskBasedMode && taskBasedData.length > 0) {
      return taskBasedData.map((row: any) => {
        if (row.type === 'hierarchy') {
          // Hierarchy header row (帯部分)
          return {
            id: `hierarchy_${row.hierarchyKey}_${row.hierarchyValue}`,
            task: row.hierarchyValue!,
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: true,
            level: row.level,
            // Add type information for WorkOrderBasedRow
            type: 'hierarchy',
            rowType: 'hierarchy'
          };
        } else if (row.type === 'asset') {
          // Asset row (機器)
          return {
            id: `asset_${row.assetId}`,
            task: row.assetName!,
            bomCode: row.assetId!,
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: false,
            level: row.level,
            assetId: row.assetId,
            hierarchyPath: row.hierarchyPath,
            // Add type information for WorkOrderBasedRow
            type: 'asset',
            rowType: 'asset'
          };
        } else {
          // Task row under asset with schedule information (作業)
          let results: any = {};
          let rolledUpResults: any = {};

          if (row.aggregatedSchedule) {
            results = { ...row.aggregatedSchedule };
            rolledUpResults = { ...row.aggregatedSchedule };
          }

          return {
            id: `task_${row.workOrderId}_asset_${row.assetId}`,
            task: row.workOrderName || '',
            bomCode: row.assetId!,
            specifications: [],
            results,
            rolledUpResults,
            hierarchyPath: row.hierarchyPath,
            level: row.level,
            assetId: row.assetId,
            taskId: row.workOrderId,
            schedule: row.aggregatedSchedule,
            type: 'workOrderLine',
            rowType: 'workOrderLine'
          };
        }
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
          return {
            id: row.assetId!,
            task: row.assetName!,
            bomCode: row.assetId!,
            specifications: row.specifications || [],
            results: {},
            rolledUpResults: {},
            hierarchyPath: row.hierarchyPath,
            tasks: [],

            // Add type information
            type: 'asset' as 'asset',
            rowType: 'asset' as const
          } as any;
        }
      });
    }

    // Default: use original data
        return data;
  })();

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
    timeScale, 
    displayMode, 
    showBomCode, 
    memoizedTimeHeaders, 
    viewMode, 
    data, 
    isTaskBasedMode, 
    isEquipmentBasedMode
  ]);

  // Generate display area configuration
  // Use immediate function to avoid memoization issues
  const displayAreaConfig = ((): DisplayAreaConfig => {
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
  })();

  const {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell
  } = useMaintenanceGridState(columns, data);

  // Auto-enable virtual scrolling for large column counts (week/day views)
  // DISABLED: User explicitly requested to review/disable the caching & rendering optimization design
  // as it was causing severe rendering glitches (blank screens) upon time scale changes.
  const autoVirtualScrolling = useMemo(() => {
    return false; // Force disable virtual scrolling to guarantee rendering stability
  }, [columns, virtualScrolling]);

  // Performance optimization hooks - use appropriate data based on mode
  // Use immediate function to avoid memoization issues
  const dataForProcessing = (() => {
    // Use convertedData (which now includes data from parent)
    return convertedData as any;
  })();

  const processedData = dataForProcessing;
  const processedColumns = columns;
  const debouncedUpdate = useCallback((fn: () => void) => fn(), []);
  const startRenderMeasurement = useCallback(() => {}, []);
  const endRenderMeasurement = useCallback(() => {}, []);
  const getPerformanceMetrics = useCallback(() => ({ renderTime: 0, fps: 60, droppedFrames: 0 }), []);
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
      }, [isEquipmentBasedMode, isTaskBasedMode, dataViewMode, onOpenTaskEditDialog]);

  // Handle task association updates from dialog
  const handleTaskAssociationUpdate = useCallback((updates: WorkOrderLineUpdate[]) => {
    if (onTaskAssociationUpdate) {
      onTaskAssociationUpdate(updates);
    }

    // Close dialog with minimal state change to prevent layout issues
    setTaskEditDialogOpen(false);

    // Show success message after a brief delay to ensure smooth transition
    setTimeout(() => {
      setClipboardMessage({
        message: '作業の関連付けを更新しました',
        severity: 'success'
      });
    }, 100);
  }, [onTaskAssociationUpdate]);

  // Handle cell editing with support for both regular cells and specifications
  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
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
                value: value
              };
            } else {
              // Add new specification
              newSpecs.push({
                key: specKey,
                value: value,
                order: newSpecs.length + 1
              });
            }

            // Call the specification edit handler with the spec index
            const specIndex = existingSpecIndex >= 0 ? existingSpecIndex : newSpecs.length - 1;
            onSpecificationEdit(rowId, specIndex, 'value', value);

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
              let statusValue = value;
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
  }, [readOnly, onCellEdit, onSpecificationEdit, debouncedUpdate, processedData, onUpdateItem, isEquipmentBasedMode, isTaskBasedMode]);



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

  // Determine current display area based on selected cell
  const getCurrentDisplayArea = useCallback((): 'specifications' | 'maintenance' => {
    if (!gridState.selectedCell) return 'maintenance';

    const column = processedColumns.find(col => col.id === gridState.selectedCell?.columnId);
    if (!column) return 'maintenance';

    // Check if column is in specifications area
    const specColumns = displayAreaConfig.scrollableAreas.specifications?.columns || [];
    if (specColumns.includes(column.id)) {
      return 'specifications';
    }

    return 'maintenance';
  }, [gridState.selectedCell, processedColumns, displayAreaConfig]);

  // Handle copy operation with cross-area support
  const handleCopy = useCallback(async () => {
    if (!gridState.selectedCell) return;

    if (onCellCopy) {
      onCellCopy(gridState.selectedCell.rowId, gridState.selectedCell.columnId, viewMode as any);
      setClipboardMessage({ message: `コピーしました`, severity: 'success' });
    }
  }, [gridState.selectedCell, onCellCopy, viewMode]);

  // Handle paste operation with cross-area support
  const handlePaste = useCallback(async () => {
    if (!gridState.selectedCell || readOnly) return;

    if (onCellPaste) {
      onCellPaste(gridState.selectedCell.rowId, gridState.selectedCell.columnId, viewMode as any);
      // Optional: notification will be triggered internally by App.tsx if successful
    }
  }, [gridState.selectedCell, readOnly, onCellPaste, viewMode]);

  // Handle delete operation
  const handleDelete = useCallback(() => {
    if (!gridState.selectedCell || readOnly) return;

    const { rowId, columnId } = gridState.selectedCell;
    const currentColumn = processedColumns.find(col => col.id === columnId);

    // Only delete if the cell is editable
    if (!currentColumn?.editable) return;


    // Check if this is a specification column
    if (columnId.startsWith('spec_')) {
      const specKey = columnId.replace('spec_', '');
      const updatedItem = processedData.find(item => item.id === rowId);

      if (updatedItem && onSpecificationEdit) {
        const newSpecs = [...(updatedItem.specifications || [])];
        const existingSpecIndex = newSpecs.findIndex(s => s.key === specKey);

        if (existingSpecIndex >= 0) {
          // Clear the specification value
          onSpecificationEdit(rowId, existingSpecIndex, 'value', '');

          if (onUpdateItem) {
            newSpecs[existingSpecIndex] = {
              ...newSpecs[existingSpecIndex],
              value: ''
            };
            onUpdateItem({
              ...updatedItem,
              specifications: newSpecs
            });
          }

          setClipboardMessage({ message: '機器仕様を削除しました', severity: 'success' });
        }
      }
    } else if (columnId.startsWith('time_')) {
      // Delete maintenance status (星取)
      const timeHeader = columnId.replace('time_', '');
      const updatedItem = processedData.find(item => item.id === rowId);

      if (updatedItem && onUpdateItem) {
        const emptyStatus = { planned: false, actual: false, planCost: 0, actualCost: 0 };
        const updatedResults = {
          ...updatedItem.results,
          [timeHeader]: emptyStatus
        };

        onUpdateItem({
          ...updatedItem,
          results: updatedResults,
          rolledUpResults: updatedResults
        });

        if (onCellEdit) {
          onCellEdit(rowId, columnId, emptyStatus);
        }

        setClipboardMessage({ message: '星取を削除しました', severity: 'success' });
      }
    } else {
      // Delete other editable fields
      handleCellEdit(rowId, columnId, '');
      setClipboardMessage({ message: 'セルを削除しました', severity: 'success' });
    }
  }, [
    gridState.selectedCell,
    readOnly,
    processedColumns,
    processedData,
    onSpecificationEdit,
    onUpdateItem,
    onCellEdit,
    handleCellEdit,
    isTaskBasedMode,
    convertedData,
    associations,
    onTaskAssociationUpdate
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
          handleCopy();
          return;
        case 'v':
          e.preventDefault();
          handlePaste();
          return;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            // Toggle performance monitor via Ctrl+Shift+P
            setShowPerformanceMonitor(prev => !prev);
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
        handleDelete();
        break;
      case 'Tab':
        e.preventDefault();
        navigateToCell('tab');
        break;
      case 'Enter':
        e.preventDefault();
        // If the current cell is editable and not readonly, start editing
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
    handleCopy,
    handlePaste,
    handleDelete
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

  // Performance measurement
  useEffect(() => {
    startRenderMeasurement();
    return () => {
      endRenderMeasurement();
    };
  }, []); // 空の依存配列を追加

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
      const assetIds = convertedData
        .filter((row: any) => !row.isGroupHeader)
        .map((row: any) => row.id);

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
  }, [selectedAssets, onAssetSelectionChange, processedData]);



  // Stable callback handlers to prevent infinite re-renders
  const handleLevel1FilterChange = useCallback((e: any) => {
    onLevel1FilterChange?.(e.target.value);
  }, [onLevel1FilterChange]);

  const handleLevel2FilterChange = useCallback((e: any) => {
    onLevel2FilterChange?.(e.target.value);
  }, [onLevel2FilterChange]);

  const handleLevel3FilterChange = useCallback((e: any) => {
    onLevel3FilterChange?.(e.target.value);
  }, [onLevel3FilterChange]);

  const handleViewModeChange = useCallback((e: any) => {
    onViewModeChange?.(e.target.checked ? 'cost' : 'status');
  }, [onViewModeChange]);

  const handleTimeScaleChange = useCallback((e: any) => {
    onTimeScaleChange?.(e.target.value as TimeScale);
  }, [onTimeScaleChange]);

  // Stable empty function references with useMemo to prevent re-creation
  const stableOnSearchChange = useMemo(() => onSearchChange || (() => { }), [onSearchChange]);
  const stableOnShowBomCodeChange = useMemo(() => onShowBomCodeChange || (() => { }), [onShowBomCodeChange]);
  const stableOnDisplayModeChange = useMemo(() => onDisplayModeChange || (() => { }), [onDisplayModeChange]);
  const stableOnAddYear = useMemo(() => onAddYear || (() => { }), [onAddYear]);
  const stableOnDeleteYear = useMemo(() => onDeleteYear || (() => { }), [onDeleteYear]);
  const stableOnExportData = useMemo(() => onExportData || (() => { }), [onExportData]);
  const stableOnImportData = useMemo(() => onImportData || (() => { }), [onImportData]);
  const stableOnResetData = useMemo(() => onResetData || (() => { }), [onResetData]);
  const stableOnAIAssistantToggle = useMemo(() => onAIAssistantToggle || (() => { }), [onAIAssistantToggle]);

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
        readOnly={readOnly}
        onCopy={handleCopy}
        isEquipmentBasedMode={isEquipmentBasedMode}
        isTaskBasedMode={isTaskBasedMode}
        // Asset selection props
        selectedAssets={selectedAssets}
        onAssetSelectionToggle={handleAssetSelectionToggle}
        // WorkOrder expansion props
        expandedWorkOrders={expandedWorkOrders}
        onToggleWorkOrderExpanded={toggleWorkOrderExpanded}
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
      />
    );
  }, [
    processedData, processedColumns, currentDisplayAreaConfig, displayAreaConfig,
    gridState, viewMode, groupedData, handleCellEdit, handleCellDoubleClick, isEquipmentBasedMode, isTaskBasedMode,
    onSpecificationEdit, handleColumnResize, handleRowResize, setSelectedCell, setEditingCell,
    handleCopy, selectedAssets, handleAssetSelectionToggle, hierarchy, onAssetEdit,
    expandedWorkOrders, toggleWorkOrderExpanded,
    searchTerm, stableOnSearchChange, level1Filter, level2Filter, level3Filter,
    handleLevel1FilterChange, handleLevel2FilterChange, handleLevel3FilterChange,
    hierarchyFilterTree, level2Options, level3Options, uniqueTasks, selectedTasks,
    onSelectedTasksChange, uniqueBomCodes, selectedBomCodes, onSelectedBomCodesChange
  ]);



  // Desktop-only className
  const paperClassName = useMemo(() => {
    return `enhanced-maintenance-grid ${className} desktop-view`;
  }, [className]);

  return (
    <>
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

      {/* Clipboard feedback */}
      {clipboardMessage && (
        <Snackbar
          open={true}
          autoHideDuration={3000}
          onClose={() => setClipboardMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setClipboardMessage(null)}
            severity={clipboardMessage.severity}
            variant="filled"
          >
            {clipboardMessage.message}
          </Alert>
        </Snackbar>
      )}

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
    </>
  );
};

export default EnhancedMaintenanceGrid;