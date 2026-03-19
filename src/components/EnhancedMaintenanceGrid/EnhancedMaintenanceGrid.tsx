import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Box, Paper, Snackbar, Alert } from '@mui/material';
import { EnhancedMaintenanceGridProps, DisplayAreaConfig, GridColumn } from '../ExcelLikeGrid/types';
import MaintenanceGridLayout from './MaintenanceGridLayout';
import { useMaintenanceGridState } from './hooks/useMaintenanceGridState';
import { useClipboard } from '../ExcelLikeGrid/hooks/useClipboard';
import { usePerformanceOptimization } from '../ExcelLikeGrid/hooks/usePerformanceOptimization';
import PerformanceMonitor from '../PerformanceMonitor';
import { IntegratedToolbar } from '../ModernHeader/ModernHeader';
import { WorkOrderLineDialog } from '../WorkOrderLineDialog/WorkOrderLineDialog';
import { ViewModeManager } from '../../services/ViewModeManager';
import {
  Task,
  Asset,
  WorkOrderLine,
  HierarchyDefinition,
  WorkOrderLineUpdate,
  EquipmentBasedRow,
  TaskBasedRow,
  TimeScale,
  WorkOrderSchedule
} from '../../types/maintenanceTask';
import { aggregateScheduleByTimeScale } from '../../utils/dataAggregation';
import './EnhancedMaintenanceGrid.css';

// Edit context for tracking edit scope
export interface EditContext {
  viewMode: 'equipment-based' | 'task-based';
  editScope: 'single-asset' | 'all-assets';  // 編集範囲
}

// Extended props to support equipment-based mode
export interface ExtendedMaintenanceGridProps extends Omit<EnhancedMaintenanceGridProps, 'columns'> {
  // Make columns optional since it's generated internally
  columns?: GridColumn[];

  // Equipment-based mode props
  tasks?: Task[];
  assets?: Asset[];
  associations?: WorkOrderLine[];
  hierarchy?: HierarchyDefinition;
  viewModeManager?: ViewModeManager;
  onTaskAssociationUpdate?: (updates: WorkOrderLineUpdate[]) => void;

  // Data view mode props - Requirements 6.1, 6.2, 6.5
  dataViewMode?: 'equipment-based' | 'task-based';
  onDataViewModeChange?: (mode: 'equipment-based' | 'task-based') => void;

  // Edit scope props - Requirements 4.8, 5.7
  editScope?: 'single-asset' | 'all-assets';
  onEditScopeChange?: (scope: 'single-asset' | 'all-assets') => void;

  // Hierarchy management props - Requirements 3.1, 3.2
  selectedAssets?: string[]; // Asset IDs
  onAssetSelectionChange?: (assetIds: string[]) => void;
  onHierarchyEdit?: (hierarchy: HierarchyDefinition) => void;
  onOpenAssetReassignDialog?: () => void;
  onOpenTaskEditDialog?: (assetId: string, dateKey: string) => void;
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
  tasks = [],
  assets = [],
  associations = [],
  hierarchy,
  viewModeManager,
  onTaskAssociationUpdate,
  // Data view mode props - Requirements 6.1, 6.2, 6.5
  dataViewMode = 'equipment-based',
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
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [currentDisplayAreaConfig, setCurrentDisplayAreaConfig] = useState<DisplayAreaConfig | null>(null);

  // Task edit dialog state
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');

  // Check current view mode - use dataViewMode prop if provided, otherwise get from viewModeManager
  const currentViewMode = (() => {
    if (dataViewMode) {
      return dataViewMode;
    }
    const mode = viewModeManager ? viewModeManager.getCurrentMode() : null;
    return mode;
  })();

  const isEquipmentBasedMode = currentViewMode === 'equipment-based';
  const isTaskBasedMode = currentViewMode === 'task-based';

  // Use timeHeaders directly to avoid memoization issues
  const memoizedTimeHeaders = timeHeaders;

  // Get equipment-based data if in equipment-based mode - simplified without useMemo
  const equipmentBasedData = (() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
      console.log('[EnhancedMaintenanceGrid] Using data from parent, skipping ViewModeManager fetch');
      return [];
    }

    if (!isEquipmentBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getEquipmentBasedData();
  })();

  // Get task-based data if in task-based mode - simplified without useMemo
  const taskBasedData = (() => {
    // If we have data from parent (App.tsx), don't fetch again to avoid inconsistency
    if (data && data.length > 0) {
      console.log('[EnhancedMaintenanceGrid] Using data from parent, skipping ViewModeManager fetch');
      return [];
    }

    if (!isTaskBasedMode || !viewModeManager) {
      return [];
    }
    return viewModeManager.getTaskBasedData();
  })();

  // Convert equipment-based or task-based data to grid format
  // Use immediate function to avoid memoization issues
  const convertedData = (() => {
    // If we have data from parent, use it directly (it's already transformed)
    if (data && data.length > 0) {
      console.log('[EnhancedMaintenanceGrid] Using data from parent, length:', data.length);
      console.log('[EnhancedMaintenanceGrid] Sample parent data:', data.slice(0, 3));
      console.log('[EnhancedMaintenanceGrid] Data structure check:', {
        hasId: data[0]?.id !== undefined,
        hasTask: data[0]?.task !== undefined,
        hasBomCode: data[0]?.bomCode !== undefined,
        hasResults: data[0]?.results !== undefined,
        hasLevel: data[0]?.level !== undefined,
        isGroupHeader: data[0]?.isGroupHeader !== undefined
      });
      return data;
    }

    // Task-based mode conversion (only if no data from parent)
    if (isTaskBasedMode && taskBasedData.length > 0) {
      return taskBasedData.map((row) => {
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
            // Add type information for TaskBasedRow
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
            // Add type information for TaskBasedRow
            type: 'asset',
            rowType: 'asset'
          };
        } else {
          // Task row under asset with schedule information (作業)
          let results: any = {};
          let rolledUpResults: any = {};

          // Aggregate schedule by time period ONCE, then extract values for each time header
          if (row.schedule) {
            // Week aggregation is now supported
            const aggregated = aggregateScheduleByTimeScale(
              row.schedule as WorkOrderSchedule,
              timeScale as 'day' | 'week' | 'month' | 'year'
            );

            // Create stable objects to prevent infinite re-renders
            results = { ...aggregated };
            rolledUpResults = { ...aggregated };
          }

          return {
            id: `task_${row.taskId}_asset_${row.assetId}`,
            task: row.taskName || '',
            bomCode: row.assetId!,
            specifications: [],
            results,
            rolledUpResults,
            hierarchyPath: row.hierarchyPath,
            level: row.level,
            assetId: row.assetId,
            taskId: row.taskId,
            schedule: row.schedule,
            // Add type information for TaskBasedRow
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
          // Asset row with aggregated task information
          let results: any = {};
          let rolledUpResults: any = {};

          // Aggregate tasks by time period
          if (row.tasks && row.tasks.length > 0) {
            // First, aggregate each task's schedule ONCE
            const aggregatedTasks = row.tasks.map(task => {
              return aggregateScheduleByTimeScale(
                task.schedule,
                timeScale as 'day' | 'week' | 'month' | 'year'
              );
            });

            // Create a stable results object
            const combinedResults: any = {};

            // Then, for each time header, combine the aggregated results
            memoizedTimeHeaders.forEach(timeHeader => {
              const aggregatedStatus = {
                planned: false,
                actual: false,
                totalPlanCost: 0,
                totalActualCost: 0,
                count: 0,
              };

              // Combine all tasks for this time period
              aggregatedTasks.forEach(aggregated => {
                const periodStatus = aggregated[timeHeader];
                if (periodStatus) {
                  aggregatedStatus.planned = aggregatedStatus.planned || periodStatus.planned;
                  aggregatedStatus.actual = aggregatedStatus.actual || periodStatus.actual;
                  aggregatedStatus.totalPlanCost += periodStatus.totalPlanCost;
                  aggregatedStatus.totalActualCost += periodStatus.totalActualCost;
                  aggregatedStatus.count += periodStatus.count;
                }
              });

              // Store aggregated status
              combinedResults[timeHeader] = aggregatedStatus;
            });

            results = combinedResults;
            rolledUpResults = combinedResults;
          }

          return {
            id: row.assetId!,
            task: row.assetName!,
            bomCode: row.assetId!,
            specifications: row.specifications || [],
            results,
            rolledUpResults,
            hierarchyPath: row.hierarchyPath,
            tasks: row.tasks, // Store tasks for dialog
            // Add type information
            type: 'asset',
            rowType: 'asset'
          };
        }
      });
    }

    // Default: use original data
    console.log('[EnhancedMaintenanceGrid] Using original data as fallback, length:', data.length);
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

  const {
    processedData,
    processedColumns,
    debouncedUpdate,
    startRenderMeasurement,
    endRenderMeasurement,
    getPerformanceMetrics,
    shouldUseVirtualScrolling
  } = usePerformanceOptimization(
    dataForProcessing,
    columns,
    gridState,
    {
      // DISABLED Performance optimizations based on user feedback regarding caching bugs
      // causing display breaks when changing parameters like time scales.
      enableMemoization: false,
      enableDebouncing: false,
      debounceDelay: 0,
      enableBatching: false,
      batchSize: 50
    }
  );

  // Handle cell double click - opens TaskEditDialog for both modes
  const handleCellDoubleClick = useCallback((rowId: string, columnId: string, event?: React.MouseEvent<HTMLElement>) => {
    console.log('[EnhancedMaintenanceGrid] handleCellDoubleClick called:', {
      rowId,
      columnId,
      isEquipmentBasedMode,
      isTaskBasedMode,
      dataViewMode,
      hasOnOpenTaskEditDialog: !!onOpenTaskEditDialog
    });

    // Only handle time columns for TaskEditDialog
    if (columnId.startsWith('time_')) {
      const timeHeader = columnId.replace('time_', '');

      // Extract assetId from rowId
      let assetId: string | undefined;

      if (rowId.startsWith('asset_')) {
        // Asset row: asset_P-101
        assetId = rowId.replace('asset_', '');
      } else if (rowId.startsWith('task_') && rowId.includes('_asset_')) {
        // Task row: task_task-001_asset_P-101
        const parts = rowId.split('_asset_');
        assetId = parts[1];
      } else {
        // Fallback: raw asset ID (equipment-based mode uses plain IDs like 'P-101')
        assetId = rowId;
      }

      if (assetId) {
        console.log('[EnhancedMaintenanceGrid] Opening TaskEditDialog for:', { assetId, timeHeader });

        // CRITICAL: Prevent MaintenanceGridLayout from opening StatusSelectionDialog/CostInputDialog
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Open TaskEditDialog through App.tsx integration
        if (onOpenTaskEditDialog) {
          onOpenTaskEditDialog(assetId, timeHeader);
        } else {
          // Fallback for standalone usage
          setSelectedAssetId(assetId);
          setSelectedDateKey(timeHeader);
          setTaskEditDialogOpen(true);
        }
        return;
      }
    }

    // For non-time columns, let MaintenanceGridLayout handle (specifications, etc.)
    console.log('[EnhancedMaintenanceGrid] Non-time column, delegating to MaintenanceGridLayout');
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

    // In task-based mode, handle linked schedule updates
    if (isTaskBasedMode && columnId.startsWith('time_')) {
      const row = processedData.find(r => r.id === rowId) as any;
      if (row && row.assetId && row.taskId) {
        // This is a task row under an asset - perform linked update
        const timeHeader = columnId.replace('time_', '');

        // Convert various value formats to status object
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
        } else if (value && typeof value === 'object') {
          // Handle status/cost objects from dialogs
          if ('planned' in value && 'actual' in value) {
            statusValue = {
              planned: value.planned || false,
              actual: value.actual || false,
              planCost: value.planCost || 0,
              actualCost: value.actualCost || 0
            };
          }
        }

        // Find all associations with the same task and update them
        const taskId = row.taskId;
        const relatedAssociations = associations.filter(a => a.taskId === taskId);



        if (onTaskAssociationUpdate && relatedAssociations.length > 0) {
          const updates: WorkOrderLineUpdate[] = relatedAssociations.map(assoc => ({
            lineId: assoc.id,
            action: 'update',
            data: {
              schedule: {
                ...assoc.schedule,
                [timeHeader]: statusValue
              }
            }
          }));

          onTaskAssociationUpdate(updates);
          setClipboardMessage({
            message: `作業ベースモード: ${relatedAssociations.length}件の機器のスケジュールを連動更新しました`,
            severity: 'success'
          });
        }

        return;
      }
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

  // Initialize clipboard hook with handleCellEdit
  const {
    copyToClipboard,
    pasteFromClipboard
  } = useClipboard({
    data: processedData,
    columns: processedColumns,
    onCellEdit: handleCellEdit,
    readOnly
  });

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
    if (!gridState.selectedCell && !gridState.selectedRange) return;

    const sourceArea = getCurrentDisplayArea();
    try {
      copyToClipboard(gridState.selectedRange || gridState.selectedCell);
      setClipboardMessage({ message: `${sourceArea === 'specifications' ? '機器仕様' : '計画実績'}エリアからコピーしました`, severity: 'success' });
    } catch (error) {
      setClipboardMessage({ message: 'コピーに失敗しました', severity: 'error' });
    }
  }, [gridState.selectedCell, gridState.selectedRange, getCurrentDisplayArea, copyToClipboard]);

  // Handle paste operation with cross-area support
  const handlePaste = useCallback(async () => {
    if (!gridState.selectedCell || readOnly) return;

    // In task-based mode, handle linked paste
    if (isTaskBasedMode && gridState.selectedCell.columnId.startsWith('time_')) {
      const selectedRowId = gridState.selectedCell!.rowId;
      const row = processedData.find(r => r.id === selectedRowId) as any;
      if (row && row.assetId && row.taskId) {
        try {
          // Get clipboard data
          const clipboardText = await navigator.clipboard.readText();

          // Parse clipboard data (simple implementation - assumes single cell)
          const value = clipboardText.trim();

          // Apply the paste to all assets with the same task
          const timeHeader = gridState.selectedCell.columnId.replace('time_', '');
          const taskId = row.taskId;
          const relatedAssociations = associations.filter(a => a.taskId === taskId);

          // Convert value to status object
          let statusValue: any;
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



          if (onTaskAssociationUpdate && relatedAssociations.length > 0) {
            const updates: WorkOrderLineUpdate[] = relatedAssociations.map(assoc => ({
              lineId: assoc.id,
              action: 'update',
              data: {
                schedule: {
                  ...assoc.schedule,
                  [timeHeader]: statusValue
                }
              }
            }));

            onTaskAssociationUpdate(updates);
            setClipboardMessage({
              message: `作業ベースモード: ${relatedAssociations.length}件の機器にペーストしました（連動更新）`,
              severity: 'success'
            });
          }
        } catch (error) {
          console.error('[EnhancedMaintenanceGrid] Paste error in task-based mode:', error);
          setClipboardMessage({
            message: 'ペーストに失敗しました',
            severity: 'error'
          });
        }

        return;
      }
    }

    const targetArea = getCurrentDisplayArea();
    try {
      pasteFromClipboard(gridState.selectedCell);
      setClipboardMessage({
        message: `${targetArea === 'specifications' ? '機器仕様' : '計画実績'}エリアにペーストしました`,
        severity: 'success'
      });
    } catch (error) {
      setClipboardMessage({
        message: `ペーストに失敗しました`,
        severity: 'error'
      });
    }
  }, [gridState.selectedCell, readOnly, getCurrentDisplayArea, pasteFromClipboard, isTaskBasedMode, processedData, associations, onTaskAssociationUpdate]);

  // Handle delete operation
  const handleDelete = useCallback(() => {
    if (!gridState.selectedCell || readOnly) return;

    const { rowId, columnId } = gridState.selectedCell;
    const currentColumn = processedColumns.find(col => col.id === columnId);

    // Only delete if the cell is editable
    if (!currentColumn?.editable) return;

    // In task-based mode, handle linked delete
    if (isTaskBasedMode && columnId.startsWith('time_')) {
      const row = processedData.find(r => r.id === rowId) as any;
      if (row && row.assetId && row.taskId) {
        // This is an asset row under a task - perform linked delete
        const timeHeader = columnId.replace('time_', '');
        const taskId = row.taskId;
        const relatedAssociations = associations.filter(a => a.taskId === taskId);

        const emptyStatus = { planned: false, actual: false, planCost: 0, actualCost: 0 };

        if (onTaskAssociationUpdate && relatedAssociations.length > 0) {
          const updates: WorkOrderLineUpdate[] = relatedAssociations.map(assoc => ({
            lineId: assoc.id,
            action: 'update',
            data: {
              schedule: {
                ...assoc.schedule,
                [timeHeader]: emptyStatus
              }
            }
          }));

          onTaskAssociationUpdate(updates);
          setClipboardMessage({
            message: `作業ベースモード: ${relatedAssociations.length}件の機器の星取を削除しました（連動削除）`,
            severity: 'success'
          });
        }

        return;
      }
    }

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
    handleDelete,
    showPerformanceMonitor
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



  // Desktop-only view
  const renderGridView = useMemo(() => {
    console.log('[EnhancedMaintenanceGrid] Rendering grid with processedData:', {
      length: processedData.length,
      sample: processedData.slice(0, 3),
      isTaskBasedMode,
      dataViewMode
    });

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
        onPaste={handlePaste}
        enableHorizontalVirtualScrolling={autoVirtualScrolling}
        isEquipmentBasedMode={isEquipmentBasedMode}
        isTaskBasedMode={isTaskBasedMode}
        // Asset selection props - Requirements 3.2, 3.6
        selectedAssets={selectedAssets}
        onAssetSelectionToggle={handleAssetSelectionToggle}
      />
    );
  }, [
    processedData, processedColumns, currentDisplayAreaConfig, displayAreaConfig,
    gridState, viewMode, groupedData, handleCellEdit, handleCellDoubleClick, isEquipmentBasedMode, isTaskBasedMode,
    onSpecificationEdit, handleColumnResize, handleRowResize, setSelectedCell, setEditingCell,
    setSelectedRange, onUpdateItem, virtualScrolling, shouldUseVirtualScrolling, readOnly,
    handleCopy, handlePaste, selectedAssets, handleAssetSelectionToggle, hierarchy, onAssetEdit
  ]);

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
          {/* Integrated Toolbar - Re-enabled with stable props */}
          <Box
            key="integrated-toolbar"
            sx={{
              flexShrink: 0,
              zIndex: 10,
              position: 'relative'
            }}
          >
            <IntegratedToolbar
              searchTerm={searchTerm}
              onSearchChange={stableOnSearchChange}
              level1Filter={level1Filter}
              level2Filter={level2Filter}
              level3Filter={level3Filter}
              onLevel1FilterChange={handleLevel1FilterChange}
              onLevel2FilterChange={handleLevel2FilterChange}
              onLevel3FilterChange={handleLevel3FilterChange}
              hierarchyFilterTree={hierarchyFilterTree}
              level2Options={level2Options || []}
              level3Options={level3Options || []}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              timeScale={timeScale}
              onTimeScaleChange={handleTimeScaleChange}
              dataViewMode={dataViewMode}
              onDataViewModeChange={onDataViewModeChange}
              editScope={editScope}
              onEditScopeChange={onEditScopeChange}
              showBomCode={showBomCode}
              onShowBomCodeChange={stableOnShowBomCodeChange}
              displayMode={displayMode}
              onDisplayModeChange={stableOnDisplayModeChange}
              onAddYear={stableOnAddYear}
              onDeleteYear={stableOnDeleteYear}
              onExportData={stableOnExportData}
              onImportData={stableOnImportData}
              onResetData={stableOnResetData}
              onAIAssistantToggle={stableOnAIAssistantToggle}
              isAIAssistantOpen={isAIAssistantOpen}
              currentYear={currentYear}
              onJumpToDate={onJumpToDate}
              hierarchy={hierarchy}
              assets={assets || []}
              selectedAssets={selectedAssets || []}
              onAssetSelectionChange={onAssetSelectionChange}
              onHierarchyEdit={onHierarchyEdit}
              onOpenAssetReassignDialog={onOpenAssetReassignDialog}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo}
              onRedo={onRedo}
            />
          </Box>

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

      {/* Performance Monitor - Desktop only */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          metrics={getPerformanceMetrics()}
          dataSize={processedData.length}
          columnCount={processedColumns.length}
          virtualScrollingEnabled={virtualScrolling || shouldUseVirtualScrolling}
          visible={true}
        />
      )}

      {/* WorkOrderLineDialog - Equipment-based mode */}
      {isEquipmentBasedMode && taskEditDialogOpen && (
        <WorkOrderLineDialog
          open={taskEditDialogOpen}
          assetId={selectedAssetId}
          dateKey={selectedDateKey}
          associations={associations.filter(a => a.assetId === selectedAssetId)}
          allTasks={tasks}
          allAssets={assets}
          onSave={handleTaskAssociationUpdate}
          onClose={() => setTaskEditDialogOpen(false)}
          readOnly={readOnly}
        />
      )}
    </>
  );
};

export default EnhancedMaintenanceGrid;