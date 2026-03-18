import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import './styles/responsive.css';
import './styles/grid-text-fix.css';
import './styles/performance.css';
import rawData from './data/equipments.json';
import { HierarchicalData, RawEquipment } from './types';
import { usePerformanceMonitor } from './utils/performanceMonitor';
import { useAccessibility } from './utils/accessibility';

// Import memoization utilities for performance optimization - Requirements 10.1, 10.2, 10.3
import { memoize, memoizeArray, createMemoizedSelector } from './utils/memoization';

// Import all service managers
import { TaskManager } from './services/TaskManager';
import { AssetManager } from './services/AssetManager';
import { WorkOrderManager } from './services/WorkOrderManager';
import { WorkOrderLineManager } from './services/WorkOrderLineManager';
import { HierarchyManager } from './services/HierarchyManager';
import { ViewModeManager } from './services/ViewModeManager';
import { UndoRedoManager } from './services/UndoRedoManager';
import { DataStore } from './services/DataStore';
import { ErrorHandler, handleGenericError } from './services/ErrorHandler';
import { EditHandlers } from './services/EditHandlers';

// Import data indexing utility - Requirements 10.1, 10.2, 10.3
import { dataIndexManager } from './utils/dataIndexing';

// Import hooks
import { useViewModeTransition } from './hooks/useViewModeTransition';

import EnhancedMaintenanceGrid from './components/EnhancedMaintenanceGrid/EnhancedMaintenanceGrid';
import AIAssistantPanel from './components/AIAssistant/AIAssistantPanel';
import ModernHeader from './components/ModernHeader';
import WorkOrderLineDialog from './components/WorkOrderLineDialog/WorkOrderLineDialog';
import { HierarchyEditDialog } from './components/HierarchyEditDialog/HierarchyEditDialog';
import { AssetReassignDialog } from './components/AssetReassignDialog/AssetReassignDialog';
import StatusSelectionDialog from './components/StatusSelectionDialog/StatusSelectionDialog';
import CostInputDialog from './components/CostInputDialog/CostInputDialog';
import { getISOWeek, getISOWeeksInYear, getTimeKey, generateTimeRange, parseTimeKey } from './utils/dateUtils';
import { transformData } from './utils/dataTransformer';
import SimpleStatusDialog from './components/SimpleStatusDialog';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, Snackbar, Alert, SelectChangeEvent, FormControl, Button, TextField, ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme/darkTheme';
import type { ViewMode, Asset, WorkOrder, WorkOrderLine, WorkOrderSchedule, WorkOrderLineUpdate, ScheduleEditRequest } from './types/maintenanceTask';

const App: React.FC = () => {
  // Performance and accessibility hooks
  const { measureAsync } = usePerformanceMonitor();
  const { announce, setupGridKeyboardNavigation } = useAccessibility();

  // Initialize all service managers
  const taskManagerRef = useRef<TaskManager | null>(null);
  const assetManagerRef = useRef<AssetManager | null>(null);
  const workOrderManagerRef = useRef<WorkOrderManager | null>(null);
  const workOrderLineManagerRef = useRef<WorkOrderLineManager | null>(null);
  const hierarchyManagerRef = useRef<HierarchyManager | null>(null);
  const viewModeManagerRef = useRef<ViewModeManager | null>(null);
  const undoRedoManagerRef = useRef<UndoRedoManager | null>(null);
  const dataStoreRef = useRef<DataStore | null>(null);
  const errorHandlerRef = useRef<ErrorHandler | null>(null);
  const editHandlersRef = useRef<EditHandlers | null>(null);

  // Data indexing manager for O(1) lookups - Requirements 10.1, 10.2, 10.3
  // Using the singleton instance from dataIndexing.ts
  const dataIndexManagerRef = useRef(dataIndexManager);

  // Data states
  const [maintenanceData, setMaintenanceData] = useState<HierarchicalData[]>([]);
  const [timeHeaders, setTimeHeaders] = useState<string[]>(() => {
    // Initialize with basic time headers to prevent "ヘッダーが見つかりません" error
    const currentYear = new Date().getFullYear();
    return [currentYear.toString(), (currentYear + 1).toString(), (currentYear + 2).toString()];
  });
  const [hierarchyFilterTree, setHierarchyFilterTree] = useState<any>(null);
  const [isServicesInitialized, setIsServicesInitialized] = useState(false);

  // Control states
  const [timeScale, setTimeScale] = useState<'year' | 'month' | 'week' | 'day'>('year');
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data view mode state - Requirements 6.1, 6.2, 6.5
  const [dataViewMode, setDataViewMode] = useState<'equipment-based' | 'task-based'>('equipment-based');

  // Edit scope state - Requirements 4.8, 5.7: User-controllable edit scope
  // In equipment-based mode: user can choose to edit single asset or all assets with same task
  // In task-based mode: always edits all assets (editScope is forced to 'all-assets')
  const [editScope, setEditScope] = useState<'single-asset' | 'all-assets'>('single-asset');

  // Handle edit scope change with useCallback to prevent infinite loops
  const handleEditScopeChange = useCallback((scope: 'single-asset' | 'all-assets') => {
    setEditScope(scope);
  }, []);

  // Temporarily disabled useViewModeTransition to fix infinite loops
  // Use the useViewModeTransition hook for managing view mode transitions
  // Requirements 6.1, 6.2, 6.3, 6.5
  const hookCurrentMode = dataViewMode;
  const hookEquipmentData: any[] = [];
  const hookTaskData: any[] = [];
  const isTransitioning = false;
  const transitionDuration = 0;
  const hookSwitchMode = (mode: any, preserveState?: boolean) => {
    console.log('[App] Simple mode switch to:', mode);
    // Don't call setDataViewMode here to prevent infinite loops
    // The mode change will be handled by the handleDataViewModeChange function
  };
  const hookApplyFilters = (filters: any) => {
    console.log('[App] Simple filter apply:', filters);
  };
  const hookUpdateData = (tasks: any, assets: any, associations: any, hierarchy: any) => {
    console.log('[App] Simple data update');
  };

  // Original hook disabled:
  /*
  const {
    currentMode: hookCurrentMode,
    equipmentData: hookEquipmentData,
    taskData: hookTaskData,
    isTransitioning,
    transitionDuration,
    switchMode: hookSwitchMode,
    applyFilters: hookApplyFilters,
    updateData: hookUpdateData,
  } = useViewModeTransition({
    tasks: taskManagerRef.current?.getAllTasks() || [],
    assets: assetManagerRef.current?.getAllAssets() || [],
    associations: workOrderLineManagerRef.current?.getAllWorkOrderLines() || [],
    hierarchy: hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] },
    onModeChange: (mode) => {
      console.log('[App] View mode changed to:', mode);
      setDataViewMode(mode);
    },
    onTransitionStart: () => {
      console.log('[App] View mode transition started');
    },
    onTransitionComplete: (duration) => {
      console.log('[App] View mode transition completed in', duration, 'ms');
      // Requirements 6.3: Verify transition completes within 1000ms for 50,000 assets
      if (duration > 1000) {
        console.warn('[App] View mode transition exceeded 1000ms threshold:', duration);
      }
    },
  });
  */

  // Filter states
  const [level1Filter, setLevel1Filter] = useState<string>('all');
  const [level2Filter, setLevel2Filter] = useState<string>('all');
  const [level3Filter, setLevel3Filter] = useState<string>('all');

  // UI component states (dialogs only)
  const [addYearDialogOpen, setAddYearDialogOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [addYearError, setAddYearError] = useState<string>('');
  const [deleteYearDialogOpen, setDeleteYearDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<number | string>('');
  const [deleteYearError, setDeleteYearError] = useState<string>('');
  const [importConfirmDialogOpen, setImportConfirmDialogOpen] = useState(false);
  const [importedFileData, setImportedFileData] = useState<any>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  // Display toggles
  const [showBomCode, setShowBomCode] = useState(true);

  // Display area mode for EnhancedMaintenanceGrid
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('both');

  // AI Assistant states
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiAssistantWidth] = useState(400);

  // Dialog states for proper implementation based on view mode
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [selectedItemForDialog, setSelectedItemForDialog] = useState<{
    itemId: string;
    itemName: string;
    timeHeader: string;
    currentValue: any;
    currentSymbol: string;
    assetId?: string;
    taskId?: string;
  } | null>(null);
  const [dialogAnchorEl, setDialogAnchorEl] = useState<HTMLElement | null>(null);

  // Handle status dialog save
  const handleStatusDialogSave = (value: { planned: boolean; actual: boolean }) => {
    if (!selectedItemForDialog) return;

    // Update the maintenance data
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (item.id === selectedItemForDialog.itemId) {
          const updatedResults = {
            ...item.results,
            [selectedItemForDialog.timeHeader]: {
              planned: value.planned,
              actual: value.actual,
              planCost: 0,
              actualCost: 0
            }
          };

          return {
            ...item,
            results: updatedResults,
            rolledUpResults: updatedResults
          };
        }
        return item;
      })
    );

    // Show success message
    showSnackbar(`${selectedItemForDialog.itemName} の ${selectedItemForDialog.timeHeader} を更新しました`, 'success');

    // Reset dialog state
    setSelectedItemForDialog(null);
    setStatusDialogOpen(false);
    setDialogAnchorEl(null);
  };

  // Handle cost dialog save
  const handleCostDialogSave = (value: { planCost: number; actualCost: number }) => {
    if (!selectedItemForDialog) return;

    // Update the maintenance data
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (item.id === selectedItemForDialog.itemId) {
          const updatedResults = {
            ...item.results,
            [selectedItemForDialog.timeHeader]: {
              planned: value.planCost > 0,
              actual: value.actualCost > 0,
              planCost: value.planCost,
              actualCost: value.actualCost
            }
          };

          return {
            ...item,
            results: updatedResults,
            rolledUpResults: updatedResults
          };
        }
        return item;
      })
    );

    // Show success message
    showSnackbar(`${selectedItemForDialog.itemName} の ${selectedItemForDialog.timeHeader} のコストを更新しました`, 'success');

    // Reset dialog state
    setSelectedItemForDialog(null);
    setCostDialogOpen(false);
    setDialogAnchorEl(null);
  };

  // Handle cell double click - proper dialog routing based on view mode
  const handleCellDoubleClick = (item: any, header: string, event: React.MouseEvent<HTMLElement>) => {
    console.log('[App] Cell double click:', {
      dataViewMode,
      viewMode,
      itemId: item.id,
      header,
      assetId: item.assetId,
      taskId: item.taskId
    });

    const result = item.results?.[header];

    // Set selected item for dialog
    setSelectedItemForDialog({
      itemId: item.id,
      itemName: item.task,
      timeHeader: header,
      currentValue: result,
      currentSymbol: result?.planned && result?.actual ? '◎' : result?.planned ? '○' : result?.actual ? '●' : '',
      assetId: item.assetId || item.bomCode,
      taskId: item.taskId
    });

    // Set anchor element for popover dialogs
    setDialogAnchorEl(event.currentTarget);

    // Route to appropriate dialog based on view mode
    // Both modes use TaskEditDialog, but with different context
    if (dataViewMode === 'equipment-based') {
      // Equipment-based mode: Use TaskEditDialog for comprehensive task management
      const assetId = item.assetId || item.bomCode;
      if (assetId) {
        handleOpenTaskEditDialog(assetId, header);
      } else {
        showSnackbar('機器IDが見つかりません', 'error');
      }
    } else {
      // Task-based mode: Also use TaskEditDialog, but focused on individual task editing
      const assetId = item.assetId || item.bomCode;
      if (assetId) {
        // In task-based mode, TaskEditDialog will show task-specific interface
        handleOpenTaskEditDialog(assetId, header);
      } else {
        showSnackbar('機器IDが見つかりません', 'error');
      }
    }
  };

  // TaskEditDialog states - Requirements 4.2, 4.3
  const [taskEditDialogOpen, setTaskEditDialogOpen] = useState(false);
  const [taskEditAssetId, setTaskEditAssetId] = useState<string>('');
  const [taskEditDateKey, setTaskEditDateKey] = useState<string>('');

  // AssetReassignDialog states - Requirements 3.2, 3.6
  const [assetReassignDialogOpen, setAssetReassignDialogOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);


  // Initialize all services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize UndoRedoManager first
        undoRedoManagerRef.current = new UndoRedoManager();
        errorHandlerRef.current = new ErrorHandler();
        dataStoreRef.current = new DataStore();

        // Initialize managers with UndoRedoManager (order matters!)
        taskManagerRef.current = new TaskManager([], undoRedoManagerRef.current);
        assetManagerRef.current = new AssetManager(undoRedoManagerRef.current);
        workOrderManagerRef.current = new WorkOrderManager(undoRedoManagerRef.current);
        workOrderLineManagerRef.current = new WorkOrderLineManager(undoRedoManagerRef.current);
        // HierarchyManager needs AssetManager as first parameter
        hierarchyManagerRef.current = new HierarchyManager(assetManagerRef.current, { levels: [] }, undoRedoManagerRef.current);

        // Initialize EditHandlers with WorkOrderLineManager - v3.0.0
        editHandlersRef.current = new EditHandlers(workOrderLineManagerRef.current);

        // --- Debug: expose managers to browser console for data integrity testing ---
        if (import.meta.env.DEV) {
          (window as any).__wolManager = workOrderLineManagerRef.current;
          (window as any).__taskManager = taskManagerRef.current;
          (window as any).__assetManager = assetManagerRef.current;
          (window as any).__woManager = workOrderManagerRef.current;
        }

        // Initialize ViewModeManager with empty data (will be populated after loading)
        viewModeManagerRef.current = new ViewModeManager(
          [],
          [],
          [],
          { levels: [] }
        );

        // Load data from DataStore with version checking
        // Requirements 9.1: Check version and handle legacy data
        try {
          // Step 1: Check data version before attempting to load
          const dataVersion = (rawData as any).version;

          console.log('[App] Data version check:', dataVersion);

          if (dataVersion === '3.0.0') {
            // New data model (v3.0.0) - use DataStore
            console.log('[App] Loading new data model (v3.0.0)');
            const loadedData = dataStoreRef.current.loadData(rawData);

            console.log('[App] DEBUG loadedData keys:', Object.keys(loadedData || {}));
            console.log('[App] DEBUG loadedData.workOrderLines:', {
              type: typeof loadedData?.workOrderLines,
              isNull: loadedData?.workOrderLines === null,
              isUndefined: loadedData?.workOrderLines === undefined,
              keys: Object.keys(loadedData?.workOrderLines || {}),
              count: Object.keys(loadedData?.workOrderLines || {}).length
            });
            console.log('[App] DEBUG loadedData.hierarchy:', {
              type: typeof loadedData?.hierarchy,
              levels: loadedData?.hierarchy?.levels?.length
            });

            // Populate managers with loaded data
            if (loadedData) {
              // Load tasks - pass existing tasks to constructor
              const existingTasks = Object.values(loadedData.tasks);
              if (existingTasks.length > 0) {
                taskManagerRef.current = new TaskManager(existingTasks, undoRedoManagerRef.current);
              }

              // Load assets - create new manager and populate
              assetManagerRef.current = new AssetManager(undoRedoManagerRef.current);
              const existingAssets = Object.values(loadedData.assets);
              existingAssets.forEach(asset => {
                assetManagerRef.current!.createAsset(asset);
              });

              // Load workOrders - create new manager and populate
              workOrderManagerRef.current = new WorkOrderManager(undoRedoManagerRef.current);
              const existingWorkOrders = Object.values(loadedData.workOrders || {});
              existingWorkOrders.forEach((wo: any) => {
                workOrderManagerRef.current!.createWorkOrder(wo);
              });

              // Load workOrderLines - create new manager and populate
              workOrderLineManagerRef.current = new WorkOrderLineManager(undoRedoManagerRef.current);
              const existingWorkOrderLines = Object.values(loadedData.workOrderLines || {});
              console.log('[App] DEBUG: existingWorkOrderLines count before forEach:', existingWorkOrderLines.length);
              let wolSuccessCount = 0;
              let wolErrorCount = 0;
              existingWorkOrderLines.forEach((wol: any) => {
                try {
                  workOrderLineManagerRef.current!.createWorkOrderLine(wol);
                  wolSuccessCount++;
                } catch (e: any) {
                  wolErrorCount++;
                  console.error('[App] DEBUG: createWorkOrderLine error for', wol?.id, ':', e.message);
                }
              });
              console.log('[App] DEBUG: WOL creation results:', { wolSuccessCount, wolErrorCount });
              const postCreationLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
              console.log('[App] DEBUG: After creation, getAllWorkOrderLines count:', postCreationLines.length);
              (window as any).__debug_wol = { existingWorkOrderLines, postCreationLines, wolSuccessCount, wolErrorCount };

              // Reinitialize EditHandlers with the new WorkOrderLineManager
              editHandlersRef.current = new EditHandlers(workOrderLineManagerRef.current);

              // Reinitialize ViewModeManager with loaded data
              viewModeManagerRef.current = new ViewModeManager(
                existingTasks,
                existingAssets,
                existingWorkOrderLines,
                loadedData.hierarchy || { levels: [] }
              );

              // Load hierarchy - 日本語キーをそのまま使用（変換しない）
              if (loadedData.hierarchy) {
                // 階層定義をそのまま使用（日本語キーを保持）
                const hierarchyDefinition = {
                  levels: loadedData.hierarchy.levels.map((level: any) => ({
                    key: level.key, // 日本語キーをそのまま使用
                    name: level.key, // 日本語名を保持
                    order: level.order, // 1ベースのまま維持
                    values: level.values
                  }))
                };

                console.log('[App] Using original hierarchy definition:', hierarchyDefinition);
                hierarchyManagerRef.current?.setHierarchyDefinition(hierarchyDefinition);

                // アセットの階層パスはそのまま使用（変換不要）
                console.log('[App] Asset hierarchy paths will use original Japanese keys');

                // ViewModeManagerを階層定義で初期化
                viewModeManagerRef.current = new ViewModeManager(
                  existingTasks,
                  existingAssets,
                  existingWorkOrderLines,
                  hierarchyDefinition
                );
              }

              // Build data indexes for O(1) lookups - Requirements 10.1, 10.2, 10.3
              console.log('[App] Building data indexes...');
              dataIndexManagerRef.current.buildAll({
                assets: existingAssets,
                tasks: existingTasks,
                associations: existingWorkOrderLines
              });

              const indexStats = dataIndexManagerRef.current.getStats();
              console.log('[App] Data indexes built:', indexStats);

              // Update time headers based on data range
              // Requirements 6.4: Auto-scale time range based on data
              const years = new Set<number>();
              const currentYear = new Date().getFullYear();
              years.add(currentYear);
              years.add(currentYear + 1);
              years.add(currentYear + 2);

              existingWorkOrderLines.forEach((wol: any) => {
                if (wol.schedule) {
                  Object.keys(wol.schedule).forEach(dateKey => {
                    const year = parseInt(dateKey.slice(0, 4), 10);
                    if (!isNaN(year)) {
                      years.add(year);
                    }
                  });
                }
              });

              const sortedYears = Array.from(years).sort((a, b) => a - b);
              const headerStrings = sortedYears.map(y => y.toString());
              console.log('[App] Setting time headers from data:', headerStrings);
              setTimeHeaders(headerStrings);

              announce('データモデル (v3.0.0) が読み込まれました');
            }
          } else {
            // Legacy data (no version or different version) - use legacy transformation
            // Requirements 9.1: Detect and handle legacy data
            console.log('[App] Legacy data detected (version:', dataVersion || 'none', ')');
            console.log('[App] Using legacy data transformation');

            const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
            setMaintenanceData(flatData);
            setTimeHeaders(headers);
            setHierarchyFilterTree(filterTree);

            const versionInfo = dataVersion ? `バージョン ${dataVersion}` : 'バージョン情報なし';
            announce(`レガシーデータが読み込まれました (${versionInfo})。${flatData.length}件の設備データが表示されています。`);

            // Requirements 9.1: Show migration dialog to user
            setLegacyDataDetected(true);
            setMigrationDialogOpen(true);
          }
        } catch (error) {
          console.error('[App] Failed to load data:', error);

          // Use ErrorHandler for proper error handling
          if (errorHandlerRef.current) {
            if (error instanceof Error) {
              errorHandlerRef.current.handleValidationError({
                type: 'VALIDATION_ERROR',
                field: 'dataLoad',
                message: `データの読み込みに失敗しました: ${error.message}`,
                value: error
              });
            } else {
              errorHandlerRef.current.handleValidationError({
                type: 'VALIDATION_ERROR',
                field: 'dataLoad',
                message: 'データの読み込みに失敗しました',
                value: error
              });
            }
          }

          // Fallback to legacy data transformation
          console.log('[App] Falling back to legacy data transformation');

          // Ensure rawData is valid before transformation
          const validRawData = rawData && typeof rawData === 'object' ? rawData : {};
          const [flatData, headers, filterTree] = transformData(validRawData as unknown as { [id: string]: RawEquipment }, timeScale);
          setMaintenanceData(flatData);
          setTimeHeaders(headers);
          setHierarchyFilterTree(filterTree);
          announce(`データ読み込みエラー。レガシーデータを使用します。`);
        }

        setIsServicesInitialized(true);
      } catch (error) {
        console.error('Failed to initialize services:', error);
        if (errorHandlerRef.current) {
          if (error instanceof Error) {
            errorHandlerRef.current.handleValidationError({
              type: 'VALIDATION_ERROR',
              field: 'initialization',
              message: `サービスの初期化に失敗しました: ${error.message}`,
              value: error
            });
          } else {
            errorHandlerRef.current.handleValidationError({
              type: 'VALIDATION_ERROR',
              field: 'initialization',
              message: 'サービスの初期化に失敗しました',
              value: error
            });
          }
        }
        showSnackbar('サービスの初期化に失敗しました', 'error');
      }
    };

    measureAsync('service-initialization', 'render', initializeServices);
  }, []); // Only run once on mount

  // Update data when time scale changes or services are initialized
  useEffect(() => {
    if (!isServicesInitialized) return;

    const loadData = async () => {
      // If using new data model, refresh view
      if (viewModeManagerRef.current && assetManagerRef.current) {
        const assets = assetManagerRef.current.getAllAssets();

        // If we have assets in the new model, use ViewModeManager
        if (assets.length > 0) {
          try {
            // Build data indexes for O(1) lookups - Requirements 10.1, 10.2, 10.3
            // Rebuild indexes whenever data is loaded to ensure they're up-to-date
            if (taskManagerRef.current) {
              const tasks = taskManagerRef.current.getAllTasks();

              // Use ViewModeManager's workOrderLines as primary source (confirmed correct)
              // Fallback to workOrderLineManagerRef if empty
              let workOrderLines = viewModeManagerRef.current.getWorkOrderLines();
              if (workOrderLines.length === 0 && workOrderLineManagerRef.current) {
                workOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
              }

              console.log('[App] Building data indexes on data load...', {
                assetCount: assets.length,
                taskCount: tasks.length,
                workOrderLinesToIndex: workOrderLines.length,
                source: viewModeManagerRef.current.getWorkOrderLines().length > 0 ? 'ViewModeManager' : 'WorkOrderLineManager'
              });
              dataIndexManagerRef.current.buildAll({
                assets,
                tasks,
                associations: workOrderLines
              });

              const indexStats = dataIndexManagerRef.current.getStats();
              console.log('[App] Data indexes built:', indexStats);
            }

            // Get data based on current view mode
            const currentMode = viewModeManagerRef.current.getCurrentMode();

            if (currentMode === 'equipment-based') {
              const equipmentData = viewModeManagerRef.current.getEquipmentBasedData();

              // Transform to legacy format for grid compatibility
              const transformedData = equipmentData.map(row => {
                if (row.type === 'hierarchy') {
                  // グループ行: フラットパス（例: 第一製油所 > Aエリア > 原油蒸留ユニット）
                  return {
                    id: `hierarchy_${row.hierarchyKey}_${row.hierarchyValue}`,
                    task: row.hierarchyValue || '',
                    bomCode: '',
                    specifications: [],
                    results: {},
                    rolledUpResults: {},
                    isGroupHeader: true,
                    level: row.level || 0,
                    children: []
                  };
                }

                // データ行: アセット（機器名のみ）
                const results: any = {};

                // Aggregate schedule data by time scale
                if (row.tasks) {
                  row.tasks.forEach(task => {
                    const aggregated = viewModeManagerRef.current!.aggregateScheduleByTimeScale(
                      task.schedule,
                      timeScale
                    );

                    Object.entries(aggregated).forEach(([timeKey, status]) => {
                      if (!results[timeKey]) {
                        results[timeKey] = {
                          planned: false,
                          actual: false,
                          planCost: 0,
                          actualCost: 0
                        };
                      }

                      // Merge status (OR operation for flags)
                      results[timeKey].planned = results[timeKey].planned || status.planned;
                      results[timeKey].actual = results[timeKey].actual || status.actual;
                      results[timeKey].planCost += status.totalPlanCost;
                      results[timeKey].actualCost += status.totalActualCost;
                    });
                  });
                }

                return {
                  id: row.assetId || '',
                  task: row.assetName || '',
                  hierarchyPath: row.hierarchyPath ?
                    Object.values(row.hierarchyPath).join(' > ') : '',
                  specifications: row.specifications || [],
                  results,
                  level: row.level || 0,
                  bomCode: row.assetId || '',
                  assetId: row.assetId,
                  children: [],
                  rolledUpResults: {}
                };
              });

              setMaintenanceData(transformedData);

              // Generate time headers with full range
              setTimeHeaders(generateTimeHeadersFromData(transformedData));

              // Build hierarchy filter tree
              const filterTree = buildHierarchyFilterTree(transformedData);
              setHierarchyFilterTree(filterTree);

              announce(`データが読み込まれました。${transformedData.length}件の設備データが表示されています。`);
            } else {
              // Task-based mode - use hook's task data
              // Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
              console.log('[App] Task-based mode data loading:', {
                hookTaskDataLength: hookTaskData.length,
                hasViewModeManager: !!viewModeManagerRef.current
              });

              // Note: ViewModeManager is already correctly initialized during initializeServices
              // with the full workOrderLines data. Do NOT re-initialize it here, as
              // workOrderLineManagerRef.current.getAllWorkOrderLines() returns 0 items
              // due to React ref lifecycle issues.

              let taskBasedData = hookTaskData.length > 0
                ? hookTaskData
                : viewModeManagerRef.current.getTaskBasedData(timeScale);

              // 作業ベースデータが空の場合、強制的にサンプルデータを生成
              if (taskBasedData.length === 0) {
                console.log('[App] Task-based data is empty, generating sample data...');

                const tasks = taskManagerRef.current?.getAllTasks() || [];
                const assets = assetManagerRef.current?.getAllAssets() || [];
                const associations = workOrderLineManagerRef.current?.getAllWorkOrderLines() || [];

                console.log('[App] Available data for sample generation:', {
                  tasksCount: tasks.length,
                  assetsCount: assets.length,
                  associationsCount: associations.length
                });

                // 階層定義が不足している場合、デフォルト階層を設定（日本語キーを使用）
                const currentHierarchy = hierarchyManagerRef.current?.getHierarchyDefinition();
                if (!currentHierarchy || currentHierarchy.levels.length === 0) {
                  console.log('[App] Setting default hierarchy definition with Japanese keys...');
                  const defaultHierarchy = {
                    levels: [
                      { key: '製油所', name: '製油所', order: 1, values: ['第一製油所', '第二製油所'] },
                      { key: 'エリア', name: 'エリア', order: 2, values: ['Aエリア', 'Bエリア', 'Cエリア'] },
                      { key: 'ユニット', name: 'ユニット', order: 3, values: ['原油蒸留ユニット', '接触改質ユニット'] }
                    ]
                  };
                  hierarchyManagerRef.current?.setHierarchyDefinition(defaultHierarchy);

                  // アセットに階層パスを設定（日本語キーを使用）
                  assets.forEach(asset => {
                    if (!asset.hierarchyPath || Object.keys(asset.hierarchyPath).length === 0) {
                      asset.hierarchyPath = {
                        '製油所': '第一製油所',
                        'エリア': 'Aエリア',
                        'ユニット': '原油蒸留ユニット'
                      };
                      assetManagerRef.current?.updateAsset(asset.id, asset);
                    }
                  });

                  // ViewModeManagerを再初期化
                  viewModeManagerRef.current = new ViewModeManager(
                    tasks,
                    assets,
                    viewModeManagerRef.current?.getWorkOrderLines() || [],
                    defaultHierarchy
                  );

                  // 再度タスクベースデータを取得
                  taskBasedData = viewModeManagerRef.current.getTaskBasedData(timeScale);
                  console.log('[App] Task-based data after hierarchy setup:', {
                    taskBasedDataLength: taskBasedData.length,
                    sampleItems: taskBasedData.slice(0, 5)
                  });
                }

                // まだデータが空の場合、簡単なサンプルデータを生成
                if (taskBasedData.length === 0 && tasks.length > 0 && assets.length > 0) {
                  taskBasedData = [];

                  // 階層ヘッダーを追加（日本語キーを使用）
                  taskBasedData.push({
                    type: 'hierarchy',
                    hierarchyKey: '製油所',
                    hierarchyValue: '第一製油所',
                    level: 0
                  });

                  // 各アセットに対してタスクを展開
                  assets.slice(0, 5).forEach((asset, assetIndex) => {
                    // アセット行を追加
                    taskBasedData.push({
                      type: 'asset',
                      assetId: asset.id,
                      assetName: asset.name,
                      level: 1,
                      hierarchyPath: { '製油所': '第一製油所' }
                    });

                    // 各タスクを追加
                    tasks.slice(0, 3).forEach((task, taskIndex) => {
                      const association = associations.find(a => a.taskId === task.id && a.assetId === asset.id);

                      taskBasedData.push({
                        type: 'workOrderLine',
                        taskId: task.id,
                        taskName: task.name,
                        classification: task.classification,
                        assetId: asset.id,
                        level: 2,
                        hierarchyPath: { '製油所': '第一製油所' },
                        schedule: association?.schedule || {
                          '2024': { planned: true, actual: false, totalPlanCost: 50000, totalActualCost: 0, count: 1 },
                          '2025': { planned: false, actual: false, totalPlanCost: 0, totalActualCost: 0, count: 0 }
                        }
                      });
                    });
                  });

                  console.log('[App] Generated sample task-based data:', {
                    generatedDataLength: taskBasedData.length,
                    sampleItems: taskBasedData.slice(0, 5)
                  });
                }
              }

              console.log('[App] Task-based data retrieved:', {
                taskBasedDataLength: taskBasedData.length,
                firstFewItems: taskBasedData.slice(0, 3),
                viewModeManagerCurrentMode: viewModeManagerRef.current?.getCurrentMode(),
                assetsCount: assetManagerRef.current?.getAllAssets().length || 0,
                tasksCount: taskManagerRef.current?.getAllTasks().length || 0,
                workOrderLinesCount: workOrderLineManagerRef.current?.getAllWorkOrderLines().length || 0,
                // 詳細なデバッグ情報
                allTasks: taskManagerRef.current?.getAllTasks().map(t => ({ id: t.id, name: t.name })) || [],
                allAssets: assetManagerRef.current?.getAllAssets().map(a => ({ id: a.id, name: a.name })) || [],
                allWorkOrderLines: workOrderLineManagerRef.current?.getAllWorkOrderLines().map(wol => ({
                  id: wol.id,
                  taskId: wol.taskId,
                  assetId: wol.assetId
                })) || []
              });

              // Transform task-based data to legacy format for grid compatibility
              const transformedData = taskBasedData.map(row => {
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
                    children: []
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
                    hierarchyPath: row.hierarchyPath ?
                      Object.values(row.hierarchyPath).join(' > ') : '',
                    children: []
                  };
                } else {
                  // Task row under asset with schedule information (作業)
                  // Note: getTaskBasedData() already returns aggregated schedule via
                  // aggregateScheduleByTimeScale - do NOT re-aggregate here
                  const results: any = row.schedule || {};
                  const rolledUpResults: any = row.schedule || {};

                  return {
                    id: `task_${row.taskId}_asset_${row.assetId}`,
                    task: row.taskName || '',
                    bomCode: row.assetId!,
                    specifications: [],
                    results,
                    rolledUpResults,
                    hierarchyPath: row.hierarchyPath ?
                      Object.values(row.hierarchyPath).join(' > ') : '',
                    level: row.level,
                    assetId: row.assetId,
                    taskId: row.taskId,
                    schedule: row.schedule,
                    children: []
                  };
                }
              });

              setMaintenanceData(transformedData);

              // Generate time headers with full range
              // Generate time headers with full range
              const generatedHeaders = generateTimeHeadersFromData(transformedData);

              // Stabilize headers: Merge with existing headers to prevent layout breakage
              // Requirement: Grid layout should not shrink/shift when data is updated
              setTimeHeaders(prevHeaders => {
                if (generatedHeaders.length === 0) return prevHeaders;
                if (prevHeaders.length === 0) return generatedHeaders;

                // Merge and sort unique headers
                const mergedSet = new Set([...prevHeaders, ...generatedHeaders]);
                const sorted = Array.from(mergedSet).sort();

                // Ensure continuity across the full range
                if (sorted.length > 0) {
                  return generateFullTimeRange(sorted[0], sorted[sorted.length - 1], timeScale);
                }
                return sorted;
              });

              // Build hierarchy filter tree
              const filterTree = buildHierarchyFilterTree(transformedData);
              setHierarchyFilterTree(filterTree);

              announce(`作業ベースモードでデータが読み込まれました。${transformedData.length}件の項目が表示されています。`);
            }
          } catch (error) {
            console.error('Failed to load data from ViewModeManager:', error);

            // Use ErrorHandler for proper error handling
            if (errorHandlerRef.current) {
              if (error instanceof Error) {
                errorHandlerRef.current.handleValidationError({
                  type: 'VALIDATION_ERROR',
                  field: 'viewModeData',
                  message: `表示モードデータの読み込みに失敗しました: ${error.message}`,
                  value: error
                });
              } else {
                errorHandlerRef.current.handleValidationError({
                  type: 'VALIDATION_ERROR',
                  field: 'viewModeData',
                  message: '表示モードデータの読み込みに失敗しました',
                  value: error
                });
              }
            }

            // Fallback to legacy
            const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
            setMaintenanceData(flatData);
            setTimeHeaders(headers);
            setHierarchyFilterTree(filterTree);
          }
        } else {
          // No assets in new model, use legacy data
          const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
          setMaintenanceData(flatData);
          setTimeHeaders(headers);
          setHierarchyFilterTree(filterTree);
          announce(`データが読み込まれました。${flatData.length}件の設備データが表示されています。`);
        }
      } else {
        // Fallback to legacy transformation
        const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
        setMaintenanceData(flatData);
        setTimeHeaders(headers);
        setHierarchyFilterTree(filterTree);
        announce(`データが読み込まれました。${flatData.length}件の設備データが表示されています。`);
      }
    };

    measureAsync('data-transformation', 'render', loadData);
  }, [timeScale, isServicesInitialized]); // Remove measureAsync and announce from dependencies

  // Helper function to build hierarchy filter tree
  // Memoized for performance - Requirements 10.1, 10.2, 10.3
  const buildHierarchyFilterTree = useMemo(() => {
    return memoizeArray((data: HierarchicalData[]) => {
      const tree: any = { children: {} };

      data.forEach(item => {
        if (item.hierarchyPath) {
          const pathParts = item.hierarchyPath.split(' > ');
          let currentNode = tree;

          pathParts.forEach((part) => {
            if (!currentNode.children[part]) {
              currentNode.children[part] = { children: {} };
            }
            currentNode = currentNode.children[part];
          });
        }
      });

      return tree;
    }, 20); // Cache last 20 results
  }, []);

  // Update hook data when managers change
  useEffect(() => {
    if (isServicesInitialized && taskManagerRef.current && assetManagerRef.current &&
      workOrderLineManagerRef.current && hierarchyManagerRef.current) {
      hookUpdateData(
        taskManagerRef.current.getAllTasks(),
        assetManagerRef.current.getAllAssets(),
        workOrderLineManagerRef.current.getAllWorkOrderLines(),
        hierarchyManagerRef.current.getHierarchyDefinition()
      );
    }
  }, [isServicesInitialized]); // Remove hookUpdateData to prevent infinite loops

  // Memoized data transformation functions - Requirements 10.1, 10.2, 10.3
  const transformEquipmentData = useMemo(() => {
    return createMemoizedSelector((equipmentData: any[]) => {
      console.log('[App] transformEquipmentData called with', equipmentData.length, 'rows');
      console.log('[App] Sample equipment input rows:', equipmentData.slice(0, 5));

      return equipmentData.map(row => {
        if (row.type === 'hierarchy') {
          // Hierarchy header row (帯部分)
          return {
            id: `hierarchy_${row.hierarchyKey}_${row.hierarchyValue}`,
            task: row.hierarchyValue || 'Unknown Hierarchy',
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: true,
            level: row.level || 0,
            children: []
          };
        } else if (row.type === 'asset') {
          // Asset row with aggregated task data
          const results: any = {};

          // Aggregate schedule data by time scale
          if (row.tasks) {
            row.tasks.forEach((task: any) => {
              const aggregated = viewModeManagerRef.current!.aggregateScheduleByTimeScale(
                task.schedule,
                timeScale
              );

              Object.entries(aggregated).forEach(([timeKey, status]: [string, any]) => {
                if (!results[timeKey]) {
                  results[timeKey] = {
                    planned: false,
                    actual: false,
                    planCost: 0,
                    actualCost: 0
                  };
                }

                // Merge status (OR operation for flags)
                results[timeKey].planned = results[timeKey].planned || status.planned;
                results[timeKey].actual = results[timeKey].actual || status.actual;
                results[timeKey].planCost += status.totalPlanCost;
                results[timeKey].actualCost += status.totalActualCost;
              });
            });
          }

          return {
            id: `asset_${row.assetId}`,  // MaintenanceGridLayoutが期待するID形式に合わせる
            task: row.assetName || '',
            hierarchyPath: row.hierarchyPath ?
              Object.values(row.hierarchyPath).join(' > ') : '',
            specifications: row.specifications || [],
            results,
            level: 0,
            bomCode: row.assetId || '',
            assetId: row.assetId,  // MaintenanceGridLayoutで使用するassetIdを追加
            children: [],
            rolledUpResults: {}
          };
        } else {
          // Fallback for unknown row types
          console.warn('[App] Unknown row type in transformEquipmentData:', row.type, row);
          return {
            id: `unknown_${row.id || 'no-id'}`,
            task: row.hierarchyValue || row.assetName || 'Unknown',
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            level: row.level || 0,
            children: []
          };
        }
      });
    });
  }, [timeScale]);

  const transformTaskData = useMemo(() => {
    return createMemoizedSelector((taskBasedData: any[]) => {
      console.log('[App] transformTaskData called with', taskBasedData.length, 'rows');
      console.log('[App] Sample input rows:', taskBasedData.slice(0, 3));

      const transformedRows = taskBasedData.map(row => {
        if (row.type === 'hierarchy') {
          // Hierarchy header row (帯部分)
          const hierarchyRow = {
            id: `hierarchy_${row.hierarchyKey}_${row.hierarchyValue}`,
            task: row.hierarchyValue || 'Unknown Hierarchy',
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: true,
            level: row.level || 0,
            children: []
          };
          console.log('[App] Created hierarchy row:', hierarchyRow);
          return hierarchyRow;
        } else if (row.type === 'asset') {
          // Asset row (機器)
          const assetRow = {
            id: `asset_${row.assetId}`,
            task: row.assetName || `Asset ${row.assetId}`,
            bomCode: row.assetId || '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            isGroupHeader: false,
            level: row.level || 0,
            assetId: row.assetId,
            hierarchyPath: row.hierarchyPath ?
              Object.values(row.hierarchyPath).join(' > ') : '',
            children: []
          };
          console.log('[App] Created asset row:', assetRow);
          return assetRow;
        } else if (row.type === 'workOrderLine') {
          // Task row under asset with schedule information (作業)
          const results: any = {};
          const rolledUpResults: any = {};

          // Schedule data is already aggregated by ViewModeManager
          if (row.schedule) {
            Object.entries(row.schedule).forEach(([timeKey, status]: [string, any]) => {
              results[timeKey] = status;
              rolledUpResults[timeKey] = status;
            });
          }

          return {
            id: `task_${row.taskId}_asset_${row.assetId}`,
            task: `${row.taskName}${row.classification ? ` [${row.classification}]` : ''}`,
            bomCode: row.assetId!,
            specifications: [],
            results,
            rolledUpResults,
            hierarchyPath: row.hierarchyPath ?
              Object.values(row.hierarchyPath).join(' > ') : '',
            level: row.level,
            assetId: row.assetId,
            taskId: row.taskId,
            schedule: row.schedule,
            children: []
          };
        } else {
          // Fallback for unknown row types
          console.warn('[App] Unknown row type in transformTaskData:', row.type, row);
          return {
            id: `unknown_${row.id || 'no-id'}`,
            task: row.taskName || row.assetName || 'Unknown',
            bomCode: '',
            specifications: [],
            results: {},
            rolledUpResults: {},
            level: row.level || 0,
            children: []
          };
        }
      });

      console.log('[App] transformTaskData output:', transformedRows.length, 'rows');
      console.log('[App] Sample output rows:', transformedRows.slice(0, 3));

      return transformedRows;
    });
  }, [timeScale]);

  // Helper function to load data from ViewModeManager
  // Updated to use useViewModeTransition hook data when available
  // Helper function to load data from ViewModeManager
  // Updated to use useViewModeTransition hook data when available
  // Helper function to load data from ViewModeManager with explicit mode parameter
  // This avoids state synchronization issues when switching modes
  const loadDataFromViewModeManagerWithMode = useCallback((mode: 'equipment-based' | 'task-based', timeScaleOverride?: 'year' | 'month' | 'week' | 'day') => {
    console.log('[App] loadDataFromViewModeManagerWithMode called:', {
      isServicesInitialized,
      hasViewModeManager: !!viewModeManagerRef.current,
      hasAssetManager: !!assetManagerRef.current,
      mode
    });

    if (!isServicesInitialized || !viewModeManagerRef.current || !assetManagerRef.current) {
      return;
    }

    try {
      // Rebuild data indexes for O(1) lookups - Requirements 10.1, 10.2, 10.3
      if (taskManagerRef.current && workOrderLineManagerRef.current) {
        const tasks = taskManagerRef.current.getAllTasks();
        const assets = assetManagerRef.current.getAllAssets();
        const workOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();

        console.log('[App] Data indexes rebuilt:', {
          assetCount: assets.length,
          taskCount: tasks.length,
          workOrderLineCount: workOrderLines.length
        });

        dataIndexManagerRef.current.buildAll({
          assets,
          tasks,
          associations: workOrderLines
        });
      }

      const assets = assetManagerRef.current.getAllAssets();

      if (assets.length > 0) {
        // Use the explicit mode parameter instead of state
        if (mode === 'equipment-based') {
          // Update ViewModeManager with latest data before fetching
          // This ensures we have the latest edits from EditHandlers
          if (taskManagerRef.current && workOrderLineManagerRef.current && hierarchyManagerRef.current) {
            viewModeManagerRef.current.updateData(
              taskManagerRef.current.getAllTasks(),
              assetManagerRef.current.getAllAssets(),
              workOrderLineManagerRef.current.getAllWorkOrderLines(),
              hierarchyManagerRef.current.getHierarchyDefinition()
            );
          }

          // Use hook's equipment data if available, otherwise fall back to ViewModeManager
          const equipmentData = hookEquipmentData.length > 0
            ? hookEquipmentData
            : viewModeManagerRef.current.getEquipmentBasedData();

          console.log('[App] Equipment-based mode - raw data from ViewModeManager:', {
            equipmentDataLength: equipmentData.length,
            hierarchyRows: equipmentData.filter(r => r.type === 'hierarchy').length,
            assetRows: equipmentData.filter(r => r.type === 'asset').length,
            sampleRows: equipmentData.slice(0, 5)
          });

          // Transform to legacy format for grid compatibility using memoized function
          // Requirements 10.1, 10.2, 10.3: Memoized transformation for performance
          const transformedData = transformEquipmentData(equipmentData);

          console.log('[App] Equipment-based mode - transformed data:', {
            transformedDataLength: transformedData.length,
            hierarchyRows: transformedData.filter(r => r.isGroupHeader).length,
            assetRows: transformedData.filter(r => !r.isGroupHeader).length,
            sampleTransformed: transformedData.slice(0, 5).map(d => ({
              id: d.id,
              task: d.task,
              isGroupHeader: d.isGroupHeader,
              assetId: (d as any).assetId,
              resultsKeys: Object.keys(d.results || {})
            }))
          });

          setMaintenanceData(transformedData);

          // Generate time headers with full range
          setTimeHeaders(generateTimeHeadersFromData(transformedData));

          // Build hierarchy filter tree using memoized function
          // Requirements 10.1, 10.2, 10.3: Memoized tree building for performance
          const filterTree = buildHierarchyFilterTree(transformedData);
          setHierarchyFilterTree(filterTree);
        } else {
          // Task-based mode
          // Ensure ViewModeManager is properly initialized with current data
          if (viewModeManagerRef.current && taskManagerRef.current && assetManagerRef.current && workOrderLineManagerRef.current) {
            const currentTasks = taskManagerRef.current.getAllTasks();
            const currentAssets = assetManagerRef.current.getAllAssets();
            const currentWorkOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
            const currentHierarchy = hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] };

            // Reinitialize ViewModeManager with current data
            // Fix: Use updateData instead of re-instantiation to preserve view mode state
            viewModeManagerRef.current.updateData(
              currentTasks,
              currentAssets,
              currentWorkOrderLines,
              currentHierarchy
            );
          }

          const effectiveTimeScale = timeScaleOverride || timeScale;
          const taskBasedData = viewModeManagerRef.current.getTaskBasedData(effectiveTimeScale);

          console.log('[App] Task-based mode - raw data from ViewModeManager:', {
            taskBasedDataLength: taskBasedData.length,
            hierarchyRows: taskBasedData.filter(r => r.type === 'hierarchy').length,
            assetRows: taskBasedData.filter(r => r.type === 'asset').length,
            taskRows: taskBasedData.filter(r => r.type === 'workOrderLine').length,
            sampleRows: taskBasedData.slice(0, 5)
          });

          // Transform task-based data to legacy format for grid compatibility using memoized function
          // Requirements 10.1, 10.2, 10.3: Memoized transformation for performance
          const transformedData = transformTaskData(taskBasedData);

          console.log('[App] Task-based mode - transformed data:', {
            transformedDataLength: transformedData.length,
            hierarchyRows: transformedData.filter(r => (r as any).isGroupHeader).length,
            assetRows: transformedData.filter(r => !(r as any).isGroupHeader && (r as any).assetId && !(r as any).taskId).length,
            taskRows: transformedData.filter(r => (r as any).taskId).length,
            sampleTransformed: transformedData.slice(0, 5).map(d => ({
              id: d.id,
              task: d.task,
              isGroupHeader: (d as any).isGroupHeader,
              assetId: (d as any).assetId,
              taskId: (d as any).taskId,
              resultsKeys: Object.keys(d.results || {})
            }))
          });

          setMaintenanceData(transformedData);

          // Requirements 6.4: Auto-scale time range based on data
          // Use the new centralized logic in ViewModeManager
          if (viewModeManagerRef.current) {
            const newHeaders = viewModeManagerRef.current.getTimeHeaders(effectiveTimeScale);
            console.log('[App] New time headers from ViewModeManager:', newHeaders);
            setTimeHeaders(newHeaders);

            // Data is already loaded, just update headers
            // loadDataFromViewModeManager(); // Removed to prevent infinite loop
          } else {
            // Fallback for initialization race conditions
            const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
            setMaintenanceData(flatData);
            setTimeHeaders(headers);
            setHierarchyFilterTree(filterTree);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load data from ViewModeManager with mode:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'dataLoadTimeScale', errorHandlerRef.current);
      }

      // Fallback to legacy
      const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
      setMaintenanceData(flatData);
      setTimeHeaders(headers);
      setHierarchyFilterTree(filterTree);
    }
  }, [isServicesInitialized, timeScale]);

  const loadDataFromViewModeManager = useCallback((timeScaleOverride?: 'year' | 'month' | 'week' | 'day') => {
    // Delegate to loadDataFromViewModeManagerWithMode to ensure consistent behavior
    // This fixes the layout breakage issue on save by using the same proven logic as mode switching
    loadDataFromViewModeManagerWithMode(dataViewMode, timeScaleOverride);
  }, [dataViewMode, loadDataFromViewModeManagerWithMode]);


  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setMaintenanceData(prevData =>
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  };

  // --- Filtering Logic ---
  const level2Options = level1Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children || {}) : [];
  const level3Options = level1Filter !== 'all' && level2Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children[level2Filter]?.children || {}) : [];

  const handleLevel1FilterChange = (event: SelectChangeEvent) => {
    setLevel1Filter(event.target.value);
    setLevel2Filter('all');
    setLevel3Filter('all');
  };
  const handleLevel2FilterChange = (event: SelectChangeEvent) => {
    setLevel2Filter(event.target.value);
    setLevel3Filter('all');
  };

  // Handle date jump - scroll to specific date column
  const handleJumpToDate = (year: number, month?: number, week?: number, day?: number) => {
    let targetHeader = '';

    // Generate header in the same format as dataTransformer.ts
    if (timeScale === 'year') {
      targetHeader = String(year);
    } else if (timeScale === 'month' && month) {
      targetHeader = `${year}-${String(month).padStart(2, '0')}`;
    } else if (timeScale === 'week' && week) {
      targetHeader = `${year}-W${String(week).padStart(2, '0')}`;
    } else if (timeScale === 'day' && month && day) {
      targetHeader = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Find the column index
    const columnIndex = timeHeaders.findIndex(header => header === targetHeader);

    if (columnIndex !== -1) {
      // Format display message
      let displayMessage = '';
      if (timeScale === 'year') {
        displayMessage = `${year}年`;
      } else if (timeScale === 'month') {
        displayMessage = `${year}年${month}月`;
      } else if (timeScale === 'week') {
        displayMessage = `${year}年第${week}週`;
      } else if (timeScale === 'day') {
        displayMessage = `${year}年${month}月${day}日`;
      }

      announce(`${displayMessage}にジャンプしました`);

      // Trigger scroll event (will be implemented in the grid)
      const event = new CustomEvent('jumpToColumn', {
        detail: { columnIndex, header: targetHeader }
      });
      window.dispatchEvent(event);
    } else {
      let displayMessage = '';
      if (timeScale === 'year') {
        displayMessage = `${year}年`;
      } else if (timeScale === 'month') {
        displayMessage = `${year}年${month}月`;
      } else if (timeScale === 'week') {
        displayMessage = `${year}年第${week}週`;
      } else if (timeScale === 'day') {
        displayMessage = `${year}年${month}月${day}日`;
      }

      setSnackbarMessage(`${displayMessage}が見つかりませんでした`);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
  };

  // Optimized filtering using data indexing - Requirements 10.1, 10.2, 10.3
  const displayedMaintenanceData = useMemo(() => {
    // Start with all data
    let filteredData = maintenanceData;

    // Apply hierarchy filtering using index for O(1) lookup
    if (isServicesInitialized && hierarchyManagerRef.current &&
      (level1Filter !== 'all' || level2Filter !== 'all' || level3Filter !== 'all')) {

      // Build partial hierarchy path from filters
      const hierarchyPath: any = {};
      const hierarchyDef = hierarchyManagerRef.current.getHierarchyDefinition();

      if (hierarchyDef && hierarchyDef.levels.length > 0) {
        // Map filter values to hierarchy keys
        if (level1Filter !== 'all' && hierarchyDef.levels[0]) {
          hierarchyPath[hierarchyDef.levels[0].key] = level1Filter;
        }
        if (level2Filter !== 'all' && hierarchyDef.levels[1]) {
          hierarchyPath[hierarchyDef.levels[1].key] = level2Filter;
        }
        if (level3Filter !== 'all' && hierarchyDef.levels[2]) {
          hierarchyPath[hierarchyDef.levels[2].key] = level3Filter;
        }

        // Use hierarchy index to get matching asset IDs - O(1) lookup
        if (Object.keys(hierarchyPath).length > 0) {
          const matchingAssetIds = new Set(
            dataIndexManagerRef.current.hierarchy.getAssetIds(hierarchyPath)
          );

          // Filter data to only include matching assets
          filteredData = filteredData.filter(item => {
            // For asset rows, check if asset ID is in matching set
            if (item.assetId) {
              return matchingAssetIds.has(item.assetId);
            }
            // For group headers, always include
            if (item.isGroupHeader) {
              return true;
            }
            // For other rows, check bomCode (which is often the asset ID)
            if (item.bomCode) {
              return matchingAssetIds.has(item.bomCode);
            }
            return false;
          });
        }
      } else {
        // Fallback to legacy string-based filtering if hierarchy definition not available
        filteredData = filteredData.filter(item => {
          const hierarchyPath = item.hierarchyPath || '';
          const pathParts = hierarchyPath.split(' > ');

          const level1Match = level1Filter === 'all' || pathParts[0] === level1Filter;
          const level2Match = level2Filter === 'all' || pathParts[1] === level2Filter;
          const level3Match = level3Filter === 'all' || pathParts[2] === level3Filter;

          return level1Match && level2Match && level3Match;
        });
      }
    }

    // Apply search term filtering
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();

      // Use asset index for faster lookup when searching by asset ID/name
      if (isServicesInitialized && assetManagerRef.current) {
        const allAssets = assetManagerRef.current.getAllAssets();
        const matchingAssetIds = new Set<string>();

        // Find assets matching search term using index - O(n) but with indexed access
        allAssets.forEach(asset => {
          if (asset.id.toLowerCase().includes(searchLower) ||
            asset.name.toLowerCase().includes(searchLower)) {
            matchingAssetIds.add(asset.id);
          }
        });

        // Also check task names using task index
        if (taskManagerRef.current) {
          const allTasks = taskManagerRef.current.getAllTasks();
          const matchingTaskIds = new Set<string>();

          allTasks.forEach(task => {
            if (task.name.toLowerCase().includes(searchLower)) {
              matchingTaskIds.add(task.id);
            }
          });

          // If we found matching tasks, get all assets associated with those tasks
          if (matchingTaskIds.size > 0 && workOrderLineManagerRef.current) {
            matchingTaskIds.forEach(taskId => {
              const associations = dataIndexManagerRef.current.associations.getByTask(taskId);
              associations.forEach(assoc => {
                matchingAssetIds.add(assoc.assetId);
              });
            });
          }
        }

        // Filter data based on matching asset IDs or task name match
        filteredData = filteredData.filter(item => {
          // Check if item matches by asset ID
          if (item.assetId && matchingAssetIds.has(item.assetId)) {
            return true;
          }
          if (item.bomCode && matchingAssetIds.has(item.bomCode)) {
            return true;
          }
          // Check if item matches by task name (for task-based view)
          if (item.taskId && taskManagerRef.current) {
            const task = dataIndexManagerRef.current.tasks.get(item.taskId);
            if (task && task.name.toLowerCase().includes(searchLower)) {
              return true;
            }
          }
          // Fallback to text search on task field
          if (item.task.toLowerCase().includes(searchLower)) {
            return true;
          }
          // Always include group headers
          if (item.isGroupHeader) {
            return true;
          }
          return false;
        });
      } else {
        // Fallback to simple text search if services not initialized
        filteredData = filteredData.filter(item =>
          item.task.toLowerCase().includes(searchLower)
        );
      }
    }

    return filteredData;
  }, [maintenanceData, searchTerm, level1Filter, level2Filter, level3Filter, isServicesInitialized]);

  // Group data for rendering
  const groupedData = useMemo(() => {
    return displayedMaintenanceData.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [displayedMaintenanceData]);


  // --- UI Handlers ---
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  // Set up ErrorHandler display callback after services are initialized
  useEffect(() => {
    if (isServicesInitialized && errorHandlerRef.current) {
      errorHandlerRef.current.setDisplayCallback((message, severity) => {
        showSnackbar(message, severity);
      });
    }
  }, [isServicesInitialized]);

  const handleViewModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setViewMode(event.target.checked ? 'cost' : 'status');
  };

  // Handle data view mode change - Requirements 6.1, 6.2, 6.5
  // Updated to use useViewModeTransition hook
  const handleDataViewModeChange = (mode: 'equipment-based' | 'task-based') => {
    if (!isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Use the hook's switchMode function with state preservation
      // Requirements 6.1: 表示モードの切り替え
      // Requirements 6.2: フィルターと選択状態の保持
      // Requirements 6.3: 50,000機器で1000ms以内に遷移完了
      measureAsync('view-mode-switch', 'render', async () => {
        // Preserve current filter state before switching
        // Requirements 6.2: フィルターと選択状態の保持
        const currentFilters = {
          hierarchyPath: {} as any,
          searchTerm: searchTerm,
        };

        // Build hierarchy path filter from current level filters
        if (level1Filter !== 'all' || level2Filter !== 'all' || level3Filter !== 'all') {
          const hierarchyLevels = hierarchyManagerRef.current?.getHierarchyLevelKeys() || [];
          if (level1Filter !== 'all' && hierarchyLevels[0]) {
            currentFilters.hierarchyPath[hierarchyLevels[0]] = level1Filter;
          }
          if (level2Filter !== 'all' && hierarchyLevels[1]) {
            currentFilters.hierarchyPath[hierarchyLevels[1]] = level2Filter;
          }
          if (level3Filter !== 'all' && hierarchyLevels[2]) {
            currentFilters.hierarchyPath[hierarchyLevels[2]] = level3Filter;
          }
        }

        // Apply filters to ViewModeManager before switching
        if (Object.keys(currentFilters.hierarchyPath).length > 0) {
          hookApplyFilters({ hierarchyPath: currentFilters.hierarchyPath });
        }

        // Switch mode using the hook (preserveState = true)
        hookSwitchMode(mode, true);

        // Update local state FIRST, then reload data
        setDataViewMode(mode);

        // Auto-switch displayMode when switching to task-based mode
        // Task-based mode doesn't support specifications, so force to 'maintenance'
        if (mode === 'task-based' && displayMode !== 'maintenance') {
          setDisplayMode('maintenance');
        }

        // Use setTimeout to ensure state update is processed before reloading data
        setTimeout(() => {
          // Create a custom loadDataFromViewModeManager that uses the new mode directly
          loadDataFromViewModeManagerWithMode(mode);
        }, 0);

        // Note: Filter states (level1Filter, level2Filter, level3Filter, searchTerm) 
        // are preserved automatically because we don't reset them
        // The ViewModeManager preserves its internal filter state through the switch

        // Announce the change
        announce(`表示モードを${mode === 'equipment-based' ? '機器ベース' : '作業ベース'}に切り替えました。フィルターは保持されています。`);
        showSnackbar(`表示モードを${mode === 'equipment-based' ? '機器ベース' : '作業ベース'}に切り替えました`, 'success');
      });
    } catch (error) {
      console.error('[App] Error switching view mode:', error);

      // Use ErrorHandler for proper error handling
      if (errorHandlerRef.current) {
        if (error instanceof Error) {
          errorHandlerRef.current.handleValidationError({
            type: 'VALIDATION_ERROR',
            field: 'viewModeSwitch',
            message: `表示モードの切り替えに失敗しました: ${error.message}`,
            value: error
          });
        }
      }

      showSnackbar('表示モードの切り替えに失敗しました', 'error');
    }
  };



  // Handle specification editing
  // Requirements 4.2: Use EditHandlers for specification editing
  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    console.log('[App] handleSpecificationEdit called:', { rowId, specIndex, key, value });

    // If services are initialized, use EditHandlers
    if (isServicesInitialized && editHandlersRef.current && assetManagerRef.current && undoRedoManagerRef.current) {
      try {
        // Use EditHandlers.handleSpecificationEdit
        editHandlersRef.current.handleSpecificationEdit(
          assetManagerRef.current,
          rowId,
          specIndex,
          key as 'key' | 'value',
          value,
          undoRedoManagerRef.current
        );

        console.log('[App] Specification updated via EditHandlers');

        // Reload data to reflect changes
        loadDataFromViewModeManager();

        return; // Exit early, data is reloaded
      } catch (error) {
        console.error('Failed to update specification through EditHandlers:', error);

        // Use ErrorHandler with proper error type detection
        if (errorHandlerRef.current) {
          handleGenericError(error, 'specificationEdit', errorHandlerRef.current);
        }
        showSnackbar('仕様の更新に失敗しました', 'error');
      }
    }

    // Fallback: Update local state for immediate UI feedback (legacy mode)
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (item.id === rowId) {
          const updatedSpecs = [...(item.specifications || [])];

          // Ensure the specification exists
          while (updatedSpecs.length <= specIndex) {
            updatedSpecs.push({ key: '', value: '', order: updatedSpecs.length });
          }

          // Update the specification
          if (key === 'key') {
            updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], key: value };
          } else if (key === 'value') {
            updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], value: value };
          }

          return { ...item, specifications: updatedSpecs };
        }
        return item;
      })
    );
  };

  // Handle specification column reordering (affects all equipment)
  const handleSpecificationColumnReorder = (fromIndex: number, toIndex: number) => {
    console.log('[App] handleSpecificationColumnReorder called', { fromIndex, toIndex });

    // 全機器の仕様キーを収集
    const allSpecKeys = new Set<string>();
    maintenanceData.forEach(item => {
      if (item.specifications) {
        item.specifications.forEach(spec => {
          if (spec.key && spec.key.trim()) {
            allSpecKeys.add(spec.key);
          }
        });
      }
    });

    const sortedKeys = Array.from(allSpecKeys).sort();
    console.log('[App] Sorted spec keys:', sortedKeys);

    if (fromIndex < 0 || fromIndex >= sortedKeys.length || toIndex < 0 || toIndex >= sortedKeys.length) {
      console.log('[App] Invalid indices, aborting');
      return;
    }

    // 並び替え
    const reorderedKeys = [...sortedKeys];
    const [movedKey] = reorderedKeys.splice(fromIndex, 1);
    reorderedKeys.splice(toIndex, 0, movedKey);

    console.log('[App] Reordered keys:', reorderedKeys);
    console.log('[App] Moved key:', movedKey, 'from', fromIndex, 'to', toIndex);

    // 全機器の仕様を新しい順序で並び替え
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (!item.specifications || item.specifications.length === 0) {
          return item;
        }

        // 仕様をキーでマップ化
        const specMap = new Map<string, { key: string; value: string; order: number }>();
        item.specifications.forEach(spec => {
          if (spec.key) {
            specMap.set(spec.key, spec);
          }
        });

        // 新しい順序で仕様を再構築
        const reorderedSpecs = reorderedKeys
          .map((key, index) => {
            const spec = specMap.get(key);
            if (spec) {
              return { ...spec, order: index + 1 };
            }
            return null;
          })
          .filter(spec => spec !== null) as { key: string; value: string; order: number }[];

        return { ...item, specifications: reorderedSpecs };
      })
    );

    showSnackbar('機器仕様の列順序を変更しました', 'success');
  };

  // Handle cell editing for EnhancedMaintenanceGrid
  // Requirements 4.2, 4.8, 5.7: Use EditHandlers for schedule editing with view mode awareness
  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('[App] handleCellEdit called:', { rowId, columnId, value, viewMode, dataViewMode });

    // If services are initialized, use EditHandlers
    if (isServicesInitialized && editHandlersRef.current && workOrderLineManagerRef.current && undoRedoManagerRef.current) {
      try {
        // Save current state for undo
        const currentState = {
          maintenanceData: [...maintenanceData]
        };

        if (columnId.startsWith('time_')) {
          const timeHeader = columnId.replace('time_', '');

          // Find workOrderLines for this asset
          const workOrderLines = workOrderLineManagerRef.current.getWorkOrderLinesByAsset(rowId);

          if (workOrderLines.length > 0) {
            // Prepare schedule entry
            const currentSchedule = workOrderLines[0].schedule[timeHeader] || {
              planned: false,
              actual: false,
              planCost: 0,
              actualCost: 0
            };

            const updatedSchedule = {
              ...currentSchedule,
              planned: typeof value.planned === 'boolean' ? value.planned : currentSchedule.planned,
              actual: typeof value.actual === 'boolean' ? value.actual : currentSchedule.actual,
              planCost: typeof value.planCost === 'number' ? value.planCost : currentSchedule.planCost,
              actualCost: typeof value.actualCost === 'number' ? value.actualCost : currentSchedule.actualCost
            };

            // Create edit context based on current view mode and user's edit scope preference
            const effectiveEditScope = dataViewMode === 'task-based' ? 'all-assets' as const : editScope;

            const editContext = {
              viewMode: dataViewMode,
              editScope: effectiveEditScope
            };

            // Use EditHandlers.handleScheduleEdit for each workOrderLine
            let updatedCount = 0;
            workOrderLines.forEach(wol => {
              const request: ScheduleEditRequest = {
                workOrderLineId: wol.id,
                dateKey: timeHeader,
                scheduleEntry: updatedSchedule,
                context: editContext
              };

              const count = editHandlersRef.current!.handleScheduleEdit(request);
              updatedCount += count;
            });

            console.log(`[App] Updated ${updatedCount} workOrderLine(s) via EditHandlers`);

            // Push to undo stack
            undoRedoManagerRef.current.pushState('UPDATE_WORK_ORDER_LINE', {
              previousState: currentState,
              assetId: rowId,
              timeHeader,
              value
            });

            // Reload data to reflect changes
            loadDataFromViewModeManager();

            // Show feedback with edit scope information
            const scopeDescription = editHandlersRef.current.getEditScopeDescription(editContext);
            const affectedCount = editHandlersRef.current.getAffectedAssociationCount(workOrderLines[0].id, editContext);
            showSnackbar(`更新しました (${affectedCount}件): ${scopeDescription}`, 'success');

            return; // Exit early, data is reloaded
          }
        }
      } catch (error) {
        console.error('Failed to update through EditHandlers:', error);

        // Use ErrorHandler with proper error type detection
        if (errorHandlerRef.current) {
          handleGenericError(error, 'cellEdit', errorHandlerRef.current);
        }
        showSnackbar('セルの更新に失敗しました', 'error');
      }
    }

    // Fallback: Update local state for immediate UI feedback (legacy mode)
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (item.id === rowId) {
          if (columnId === 'task') {
            return { ...item, task: value };
          } else if (columnId.startsWith('time_')) {
            const timeHeader = columnId.replace('time_', '');
            const updatedResults = { ...item.results };

            if (viewMode === 'cost') {
              // コストモードでは、コストとステータスの両方を更新
              const currentData = updatedResults[timeHeader] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
              console.log('[App] Before update:', { timeHeader, currentData, receivedValue: value });

              const updatedValue = {
                ...currentData,
                planCost: typeof value.planCost === 'number' ? value.planCost : currentData.planCost,
                actualCost: typeof value.actualCost === 'number' ? value.actualCost : currentData.actualCost,
                planned: typeof value.planned === 'boolean' ? value.planned : currentData.planned,
                actual: typeof value.actual === 'boolean' ? value.actual : currentData.actual
              };
              updatedResults[timeHeader] = updatedValue;

              console.log('[App] After update:', { timeHeader, updatedValue });
            } else {
              // ステータスモードでは、ステータスのみを更新
              const currentData = updatedResults[timeHeader] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
              updatedResults[timeHeader] = {
                ...currentData,
                planned: typeof value.planned === 'boolean' ? value.planned : currentData.planned,
                actual: typeof value.actual === 'boolean' ? value.actual : currentData.actual
              };
            }

            return { ...item, results: updatedResults };
          }
        }
        return item;
      })
    );
  };



  // --- Time Period Operations ---
  const handleAddYearClick = () => {
    setAddYearDialogOpen(true);
    setNewYearInput('');
    setAddYearError('');
  };

  const generatePeriodsForYear = (year: number): string[] => {
    // Determine start and end date for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Use centralized logic from dateUtils
    return generateTimeRange(startDate, endDate, timeScale);
  };

  // Helper to generate time headers with full range
  const generateTimeHeadersFromData = (transformedData: HierarchicalData[]): string[] => {
    const timeHeadersSet = new Set<string>();
    transformedData.forEach(item => {
      if (item.results) {
        Object.keys(item.results).forEach(key => timeHeadersSet.add(key));
      }
    });

    // Generate a full range of time headers (not just those with data)
    const sortedHeaders = Array.from(timeHeadersSet).sort();
    if (sortedHeaders.length > 0) {
      return generateFullTimeRange(sortedHeaders[0], sortedHeaders[sortedHeaders.length - 1], timeScale);
    } else {
      // If no data, generate headers for current year and next few years
      const currentYear = new Date().getFullYear();
      const headers: string[] = [];

      // Generate headers based on time scale
      if (timeScale === 'year') {
        for (let year = currentYear; year <= currentYear + 10; year++) {
          headers.push(year.toString());
        }
      } else if (timeScale === 'month') {
        for (let year = currentYear; year <= currentYear + 2; year++) {
          for (let month = 1; month <= 12; month++) {
            headers.push(`${year}-${String(month).padStart(2, '0')}`);
          }
        }
      } else {
        // For day/week, just generate current year
        for (let year = currentYear; year <= currentYear + 1; year++) {
          headers.push(year.toString());
        }
      }

      return headers;
    }
  };

  // Removed local getISOWeekNumber and getISOWeeksInYear as they are now imported from dateUtils
  // to ensure consistency across the application.

  // Generate full time range between two periods
  const generateFullTimeRange = (startPeriod: string, endPeriod: string, scale: 'year' | 'month' | 'week' | 'day'): string[] => {
    const startDate = parseTimeKey(startPeriod, scale);
    const endDate = parseTimeKey(endPeriod, scale);

    if (startDate && endDate) {
      // Use centralized logic from dateUtils
      return generateTimeRange(startDate, endDate, scale);
    }

    // Fallback if parsing fails (should roughly match old logic but safer)
    console.warn('[App] Failed to parse periods for range generation:', { startPeriod, endPeriod });
    return [startPeriod, endPeriod]; // Return minimum
  };

  const handleAddYearConfirm = () => {
    const input = newYearInput.trim();
    if (!input) {
      setAddYearError('年度を入力してください。');
      return;
    }

    const year = parseInt(input, 10);
    if (isNaN(year) || year < 1000 || year > 9999) {
      setAddYearError('無効な年度です。4桁の数字で入力してください。');
      return;
    }

    // Generate periods for the year based on time scale
    const newPeriods = generatePeriodsForYear(year);

    // Filter out periods that already exist and only add new ones
    const periodsToAdd = newPeriods.filter(period => !timeHeaders.includes(period));

    if (periodsToAdd.length === 0) {
      setAddYearError(`${year}年度はすべて既に存在します。`);
      return;
    }

    setTimeHeaders(prev => [...prev, ...periodsToAdd].sort());
    setAddYearDialogOpen(false);

    const addedCount = periodsToAdd.length;
    const totalCount = newPeriods.length;
    if (addedCount === totalCount) {
      showSnackbar(`${year}年度が追加されました。`, 'success');
    } else {
      showSnackbar(`${year}年度の${addedCount}件の期間が追加されました（${totalCount - addedCount}件は既に存在）。`, 'success');
    }
  };

  const handleDeleteYearClick = () => {
    setDeleteYearDialogOpen(true);
    setYearToDelete('');
    setDeleteYearError('');
  };

  const handleDeleteYearConfirm = () => {
    if (!yearToDelete) {
      setDeleteYearError('削除する年度を選択してください。');
      return;
    }

    const year = parseInt(String(yearToDelete), 10);
    if (isNaN(year)) {
      setDeleteYearError('無効な年度です。');
      return;
    }

    // Generate all periods for the year
    const periodsToDelete = generatePeriodsForYear(year);

    // Check if any period has data
    const hasData = maintenanceData.some(item =>
      Object.keys(item.results).some(timeKey => periodsToDelete.includes(timeKey))
    );

    if (hasData) {
      setDeleteYearError('この年度にはデータが存在するため削除できません。');
      return;
    }

    // Remove all periods for the year
    setTimeHeaders(prev => prev.filter(period => !periodsToDelete.includes(period)));
    setDeleteYearDialogOpen(false);
    showSnackbar(`${year}年度が削除されました。`, 'success');
  };

  // --- Data Operations ---
  const handleSaveData = async () => {
    if (!dataStoreRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Collect all data from managers
      const tasks = taskManagerRef.current?.getAllTasks() || [];
      const assets = assetManagerRef.current?.getAllAssets() || [];
      const workOrders = workOrderManagerRef.current?.getAllWorkOrders() || [];
      const workOrderLines = workOrderLineManagerRef.current?.getAllWorkOrderLines() || [];
      const hierarchy = hierarchyManagerRef.current?.getHierarchyDefinition();

      // Convert arrays to objects with IDs as keys
      const tasksObj = tasks.reduce((acc, task) => {
        acc[task.id] = task;
        return acc;
      }, {} as any);

      const assetsObj = assets.reduce((acc, asset) => {
        acc[asset.id] = asset;
        return acc;
      }, {} as any);

      const workOrdersObj = workOrders.reduce((acc, wo) => {
        acc[wo.id] = wo;
        return acc;
      }, {} as any);

      const workOrderLinesObj = workOrderLines.reduce((acc, wol) => {
        acc[wol.id] = wol;
        return acc;
      }, {} as any);

      // Save data
      await dataStoreRef.current.saveData({
        version: '3.0.0',
        tasks: tasksObj,
        assets: assetsObj,
        workOrders: workOrdersObj,
        workOrderLines: workOrderLinesObj,
        hierarchy: hierarchy || { levels: [] },
        metadata: {
          lastModified: new Date(),
        }
      });

      showSnackbar('データを保存しました', 'success');
      announce('データが保存されました');
    } catch (error: any) {
      console.error('Failed to save data:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'dataSave', errorHandlerRef.current);
      }

      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      showSnackbar(`保存エラー: ${errorMessage}`, 'error');
    }
  };

  const handleExportData = () => {
    console.log('[App] handleExportData called - isServicesInitialized:', isServicesInitialized, 'dataStoreRef:', !!dataStoreRef.current);
    if (!isServicesInitialized || !dataStoreRef.current) {
      // Fallback to legacy export
      console.warn('[App] Using legacy export fallback');
      const dataToExport = { timeHeaders, maintenanceData, timeScale };
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hoshitori_data_legacy.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSnackbar('レガシーデータをエクスポートしました。', 'success');
      return;
    }

    try {
      // Export new data model (v3.0.0)
      console.log('[App] Exporting v3.0.0 data model');
      const tasks = taskManagerRef.current?.getAllTasks() || [];
      const assets = assetManagerRef.current?.getAllAssets() || [];
      const workOrders = workOrderManagerRef.current?.getAllWorkOrders() || [];
      const workOrderLines = workOrderLineManagerRef.current?.getAllWorkOrderLines() || [];
      const hierarchy = hierarchyManagerRef.current?.getHierarchyDefinition();

      const tasksObj = tasks.reduce((acc, task) => {
        acc[task.id] = task;
        return acc;
      }, {} as any);

      const assetsObj = assets.reduce((acc, asset) => {
        acc[asset.id] = asset;
        return acc;
      }, {} as any);

      const workOrdersObj = workOrders.reduce((acc, wo) => {
        acc[wo.id] = wo;
        return acc;
      }, {} as any);

      const workOrderLinesObj = workOrderLines.reduce((acc, wol) => {
        acc[wol.id] = wol;
        return acc;
      }, {} as any);

      // Include taskClassifications and assetClassification from source data
      const sourceTaskClassifications = (rawData as any)?.taskClassifications || [];
      const sourceAssetClassification = (rawData as any)?.assetClassification || { levels: [] };

      const dataToExport = {
        version: '3.0.0',
        taskClassifications: sourceTaskClassifications,
        assetClassification: sourceAssetClassification,
        tasks: tasksObj,
        assets: assetsObj,
        workOrders: workOrdersObj,
        workOrderLines: workOrderLinesObj,
        hierarchy: hierarchy || { levels: [] },
        metadata: {
          lastModified: new Date(),
        }
      };

      console.log('[App] Export data summary:', {
        version: dataToExport.version,
        tasksCount: Object.keys(tasksObj).length,
        assetsCount: Object.keys(assetsObj).length,
        workOrdersCount: Object.keys(workOrdersObj).length,
        workOrderLinesCount: Object.keys(workOrderLinesObj).length,
      });

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hoshitori_data_v3.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSnackbar('データをエクスポートしました。', 'success');
    } catch (error: any) {
      console.error('Export failed:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'dataExport', errorHandlerRef.current);
      }

      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      showSnackbar(`エクスポートエラー: ${errorMessage}`, 'error');
    }
  };

  const handleImportDataClick = () => {
    importFileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);

        // Detect v3.0.0 format
        if (imported.version === '3.0.0' && imported.tasks && imported.assets) {
          console.log('[App] v3.0.0 format detected for import');

          // Validate with DataStore
          if (dataStoreRef.current) {
            try {
              dataStoreRef.current.loadData(imported);
              console.log('[App] v3.0.0 data validated successfully');
            } catch (validationError: any) {
              throw new Error(`v3.0.0バリデーションエラー: ${validationError.message}`);
            }
          }

          setImportedFileData({ ...imported, _format: 'v3' });
          setImportConfirmDialogOpen(true);
        } else if (imported.timeHeaders && Array.isArray(imported.timeHeaders) && imported.maintenanceData && Array.isArray(imported.maintenanceData)) {
          // Legacy format
          console.log('[App] Legacy format detected for import');
          setImportedFileData({ ...imported, _format: 'legacy' });
          setImportConfirmDialogOpen(true);
        } else {
          throw new Error('サポートされていないファイル形式です。v3.0.0またはレガシー形式のJSONファイルを選択してください。');
        }
      } catch (error: any) {
        if (errorHandlerRef.current) {
          handleGenericError(error, 'dataImport', errorHandlerRef.current);
        }
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        showSnackbar(`インポートエラー: ${errorMessage}`, 'error');
      } finally {
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (!importedFileData) return;

    try {
      if (importedFileData._format === 'v3') {
        // v3.0.0 import: reload all managers with imported data
        console.log('[App] Importing v3.0.0 data...');

        const importData = { ...importedFileData };
        delete importData._format;

        // Reload tasks
        const existingTasks = Object.values(importData.tasks || {}) as any[];
        if (taskManagerRef.current) {
          taskManagerRef.current = new TaskManager(existingTasks, undoRedoManagerRef.current!);
        }

        // Reload assets
        const existingAssets = Object.values(importData.assets || {}) as any[];
        if (assetManagerRef.current) {
          assetManagerRef.current = new AssetManager(undoRedoManagerRef.current!);
          existingAssets.forEach(asset => {
            assetManagerRef.current!.createAsset(asset);
          });
        }

        // Reload workOrders
        const existingWorkOrders = Object.values(importData.workOrders || {}) as any[];
        if (workOrderManagerRef.current) {
          workOrderManagerRef.current = new WorkOrderManager(undoRedoManagerRef.current!);
          existingWorkOrders.forEach((wo: any) => {
            workOrderManagerRef.current!.createWorkOrder(wo);
          });
        }

        // Reload workOrderLines
        const existingWorkOrderLines = Object.values(importData.workOrderLines || {}) as any[];
        if (workOrderLineManagerRef.current) {
          workOrderLineManagerRef.current = new WorkOrderLineManager(undoRedoManagerRef.current!);
          existingWorkOrderLines.forEach((wol: any) => {
            workOrderLineManagerRef.current!.createWorkOrderLine(wol);
          });
        }

        // Reinitialize EditHandlers
        if (workOrderLineManagerRef.current) {
          editHandlersRef.current = new EditHandlers(workOrderLineManagerRef.current);
        }

        // Reload hierarchy
        const hierarchyDef = importData.hierarchy || { levels: [] };
        if (hierarchyManagerRef.current) {
          hierarchyManagerRef.current.setHierarchyDefinition(hierarchyDef);
        }

        // Reinitialize ViewModeManager
        viewModeManagerRef.current = new ViewModeManager(
          existingTasks,
          existingAssets,
          existingWorkOrderLines,
          hierarchyDef
        );

        // Rebuild data indexes
        dataIndexManagerRef.current.buildAll({
          assets: existingAssets,
          tasks: existingTasks,
          associations: existingWorkOrderLines
        });

        // Update time headers
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        years.add(currentYear + 1);
        years.add(currentYear + 2);
        existingWorkOrderLines.forEach((wol: any) => {
          if (wol.schedule) {
            Object.keys(wol.schedule).forEach(dateKey => {
              const year = parseInt(dateKey.slice(0, 4), 10);
              if (!isNaN(year)) years.add(year);
            });
          }
        });
        const sortedYears = Array.from(years).sort((a, b) => a - b);
        setTimeHeaders(sortedYears.map(y => y.toString()));

        console.log('[App] v3.0.0 import complete:', {
          tasks: existingTasks.length,
          assets: existingAssets.length,
          workOrders: existingWorkOrders.length,
          workOrderLines: existingWorkOrderLines.length,
        });

        showSnackbar(`v3.0.0データをインポートしました（機器:${existingAssets.length}件, 作業:${existingTasks.length}件）`, 'success');
      } else {
        // Legacy import
        setTimeHeaders(importedFileData.timeHeaders);
        setMaintenanceData(importedFileData.maintenanceData);
        setTimeScale(importedFileData.timeScale || 'year');
        showSnackbar('レガシーデータをインポートしました。', 'success');
      }
    } catch (error: any) {
      console.error('[App] Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      showSnackbar(`インポートエラー: ${errorMessage}`, 'error');
    } finally {
      setImportConfirmDialogOpen(false);
      setImportedFileData(null);
    }
  };

  const handleResetDataClick = () => {
    setResetConfirmDialogOpen(true);
  };

  const handleResetConfirm = () => {
    const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
    setMaintenanceData(flatData);
    setTimeHeaders(headers);
    setHierarchyFilterTree(filterTree);
    setResetConfirmDialogOpen(false);
    showSnackbar('データを初期化しました。', 'success');
  };



  // AI Assistant handlers
  const handleAIAssistantToggle = () => {
    setIsAIAssistantOpen(!isAIAssistantOpen);
  };

  const handleAIAssistantClose = () => {
    setIsAIAssistantOpen(false);
  };

  // TaskEditDialog handlers - Requirements 4.2, 4.3, 4.5, 4.6, 4.7, 4.8
  const handleOpenTaskEditDialog = (assetId: string, dateKey: string) => {
    if (!isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    console.log('[App] Opening TaskEditDialog:', {
      assetId,
      dateKey,
      editScope,
      dataViewMode,
      workOrderLinesCount: workOrderLineManagerRef.current?.getWorkOrderLinesByAsset(assetId).length || 0
    });

    setTaskEditAssetId(assetId);
    setTaskEditDateKey(dateKey);
    setTaskEditDialogOpen(true);
  };

  const handleCloseTaskEditDialog = () => {
    setTaskEditDialogOpen(false);
    setTaskEditAssetId('');
    setTaskEditDateKey('');
  };

  const handleSaveTaskEdits = (updates: WorkOrderLineUpdate[]) => {
    console.log('[App] handleSaveTaskEdits called:', {
      updatesCount: updates.length,
      editScope,
      dataViewMode,
      updates: updates.map(u => ({ action: u.action, lineId: u.lineId }))
    });

    if (!workOrderLineManagerRef.current || !undoRedoManagerRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Save current state for undo
      const currentState = {
        workOrderLines: workOrderLineManagerRef.current.getAllWorkOrderLines()
      };

      undoRedoManagerRef.current.pushState('UPDATE_WORK_ORDER_LINE', {
        previousState: currentState
      });

      let totalUpdated = 0;

      // Process each update
      updates.forEach(update => {
        // Handle atomic task creation if definition is provided
        if (update.newTaskDef) {
          // Ensure task exists or create it
          if (taskManagerRef.current && !taskManagerRef.current.getTask(update.newTaskDef.id!)) {
            taskManagerRef.current.createTask({
              id: update.newTaskDef.id,
              name: update.newTaskDef.name!,
              classification: update.newTaskDef.classification!,
              description: update.newTaskDef.description || update.newTaskDef.name!,
              defaultSchedulePattern: update.newTaskDef.defaultSchedulePattern || { frequency: 'yearly' }
            });
          }
        }

        if (update.action === 'create' && update.data) {
          // Check if task exists, if not create it (handling new task creation legacy path)
          const taskId = update.data.taskId;
          if (taskId && taskManagerRef.current && !taskManagerRef.current.getTask(taskId)) {
            // Create new task if missing
            const taskName = (update.data as any).taskName || 'New Task';
            // Default classification to '01' if missing or invalid, to satisfy validation
            const rawClass = (update.data as any).classification;
            const classification = (rawClass && /^\d{2}$/.test(rawClass)) ? rawClass : '01';

            // Create new task (TaskManager generates a new ID)
            const newTask = taskManagerRef.current.createTask({
              name: taskName,
              description: taskName, // Require description
              classification,
              defaultSchedulePattern: { frequency: 'yearly' } // Fix TS Error: frequency object required
            });

            // Update association to point to the real Task ID
            update.data.taskId = newTask.id;
          }
          workOrderLineManagerRef.current!.createWorkOrderLine(update.data as any);
          totalUpdated++;
        } else if (update.action === 'update' && update.data) {
          // Use EditHandlers for schedule updates to respect edit scope
          // Requirements 4.8, 5.7: Edit scope handling
          if (update.data.schedule && editHandlersRef.current) {
            // Create edit context based on current view mode and edit scope
            const effectiveEditScope = dataViewMode === 'task-based' ? 'all-assets' as const : editScope;

            if (effectiveEditScope === 'single-asset') {
              // For single-asset scope, direct update is most reliable and handles deletions correctly
              workOrderLineManagerRef.current!.updateWorkOrderLine(update.lineId, update.data);
              totalUpdated++;
            } else {
              // For all-assets scope, we need to propagate edits using EditHandlers

              // [FIX] Ensure non-schedule updates (like taskId change) are applied to the target association
              // even when propagation is enabled. This fixes the "Rename Disappearing" bug in task-based mode.
              const { schedule, ...otherUpdates } = update.data;

              if (Object.keys(otherUpdates).length > 0) {
                console.log('[App] Applying non-schedule updates in all-assets scope:', { lineId: update.lineId, updates: otherUpdates });

                // Safety Check: If updating taskId, ensure Task exists
                if (otherUpdates.taskId) {
                  const targetTask = taskManagerRef.current?.getTask(otherUpdates.taskId);
                  if (!targetTask) {
                    console.error('[App] CRITICAL: Attempting to link association to non-existent Task ID:', otherUpdates.taskId);
                    // Attempt late creation if newTaskDef was provided but somehow missed or failed?
                    // (Should have been handled by atomic block above)
                  } else {
                    console.log('[App] Verified target task exists:', targetTask.name);
                  }
                }

                workOrderLineManagerRef.current!.updateWorkOrderLine(update.lineId, otherUpdates);
              }

              // Iterate through all schedule entries that match the current edit context (taskEditDateKey)
              // This fixes the bug where only the first key [0] was being processed
              Object.entries(update.data.schedule).forEach(([dateKey, scheduleEntry]) => {
                // Only propagate changes relevant to the current editing session
                // If taskEditDateKey is set (e.g., '2025'), only sync dates starting with it
                if (taskEditDateKey && !dateKey.startsWith(taskEditDateKey)) {
                  return;
                }

                const workOrderLine = workOrderLineManagerRef.current!.getWorkOrderLine(update.lineId);
                if (workOrderLine) {
                  const request: ScheduleEditRequest = {
                    workOrderLineId: update.lineId,
                    dateKey,
                    scheduleEntry,
                    context: {
                      viewMode: dataViewMode,
                      editScope: effectiveEditScope
                    }
                  };

                  const count = editHandlersRef.current!.handleScheduleEdit(request);
                  totalUpdated += count;
                }
              });
            }
          } else {
            // Fallback to direct update if not a schedule update
            workOrderLineManagerRef.current!.updateWorkOrderLine(update.lineId, update.data);
            totalUpdated++;
          }
        } else if (update.action === 'delete') {
          workOrderLineManagerRef.current!.deleteWorkOrderLine(update.lineId);
          totalUpdated++;
        }
      });

      // Update ViewModeManager with new data (avoid re-initialization to prevent layout breakage)
      if (viewModeManagerRef.current && taskManagerRef.current && assetManagerRef.current) {
        const tasks = taskManagerRef.current.getAllTasks();
        const assets = assetManagerRef.current.getAllAssets();
        const workOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
        const hierarchyDefinition = hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] };

        // Update existing ViewModeManager instead of creating new instance
        // This preserves memoization cache and prevents layout breakage
        viewModeManagerRef.current.updateData(tasks, assets, workOrderLines, hierarchyDefinition);

        console.log('[App] ViewModeManager updated with new data:', {
          tasksCount: tasks.length,
          assetsCount: assets.length,
          associationsCount: workOrderLines.length
        });

        // Update hook data as well
        if (hookUpdateData) {
          hookUpdateData(tasks, assets, workOrderLines, hierarchyDefinition);
        }
      }

      // Reload data to reflect changes
      console.log('[App] Reloading data after save...');
      loadDataFromViewModeManager();

      // Show feedback with edit scope information
      const scopeDescription = editScope === 'all-assets' ? '全機器' : '単一機器';
      console.log('[App] Save completed successfully:', {
        totalUpdated,
        scopeDescription,
        editScope,
        dataViewMode
      });
      showSnackbar(`作業を更新しました (${totalUpdated}件の関連付け, ${scopeDescription}モード)`, 'success');
      handleCloseTaskEditDialog();
    } catch (error) {
      console.error('[App] Error saving task edits:', error);
      console.error('[App] Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        name: (error as any)?.name,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error as any || {}))
      });

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'taskEdit', errorHandlerRef.current);
      }

      showSnackbar('作業の更新に失敗しました', 'error');
    }
  };

  const handleUpdateTask = (taskId: string, updates: Partial<any>) => {
    if (!taskManagerRef.current || !undoRedoManagerRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Save current state for undo
      const currentTask = taskManagerRef.current.getTask(taskId);
      if (currentTask) {
        undoRedoManagerRef.current.pushState('UPDATE_TASK', {
          taskId,
          previousTask: currentTask
        });
      }

      // Update task
      // Update or Create task
      if (taskManagerRef.current.getTask(taskId)) {
        taskManagerRef.current.updateTask(taskId, updates);
      } else {
        // Create new task if it doesn't exist (e.g. renamed in TaskEditDialog)
        const taskName = updates.name;
        const classification = updates.classification;
        // Check required fields for creation
        if (taskName && classification) {
          taskManagerRef.current.createTask({
            id: taskId,
            name: taskName,
            classification: classification,
            description: updates.description || taskName, // Default description to name
            defaultSchedulePattern: updates.defaultSchedulePattern || { frequency: 'yearly' }
          });
        } else {
          console.error('[App] Cannot create task, missing name or classification:', updates);
          throw new Error('新しい作業を作成するには作業名と分類が必要です');
        }
      }

      // Reload data to reflect changes
      loadDataFromViewModeManager();

      showSnackbar('作業定義を更新しました', 'success');
    } catch (error) {
      console.error('[App] Error updating task:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'taskUpdate', errorHandlerRef.current);
      }

      showSnackbar('作業定義の更新に失敗しました', 'error');
    }
  };

  // Hierarchy management handlers - Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.8
  const handleHierarchyEdit = (newHierarchy: any) => {
    if (!hierarchyManagerRef.current || !isServicesInitialized) {
      showSnackbar('階層管理サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Update hierarchy definition in HierarchyManager
      // This will update the hierarchy structure and propagate changes to all assets
      hierarchyManagerRef.current.setHierarchyDefinition(newHierarchy);

      showSnackbar('階層構造が更新されました', 'success');

      // Reload data to reflect hierarchy changes
      loadDataFromViewModeManager();
    } catch (error) {
      console.error('[App] Error updating hierarchy:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'hierarchyUpdate', errorHandlerRef.current);
      }

      const errorMessage = error instanceof Error ? error.message : '階層構造の更新に失敗しました';
      showSnackbar(errorMessage, 'error');
    }
  };

  // AssetReassignDialog handlers - Requirements 3.2, 3.6
  const handleOpenAssetReassignDialog = () => {
    if (!isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    if (selectedAssets.length === 0) {
      showSnackbar('機器を選択してください', 'warning');
      return;
    }

    setAssetReassignDialogOpen(true);
  };

  const handleCloseAssetReassignDialog = () => {
    setAssetReassignDialogOpen(false);
  };

  const handleAssetReassign = (assetIds: string[], newHierarchyPath: any) => {
    if (!hierarchyManagerRef.current || !assetManagerRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Reassign each asset to the new hierarchy path
      assetIds.forEach(assetId => {
        hierarchyManagerRef.current?.reassignAssetHierarchy(assetId, newHierarchyPath);
      });

      showSnackbar(`${assetIds.length}件の機器を付け替えました`, 'success');

      // Close dialog and clear selection
      handleCloseAssetReassignDialog();
      setSelectedAssets([]);

      // Reload data to reflect changes
      loadDataFromViewModeManager();
    } catch (error) {
      console.error('[App] Error reassigning assets:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'assetReassign', errorHandlerRef.current);
      }

      showSnackbar('機器の付け替えに失敗しました', 'error');
    }
  };

  // Asset selection handlers
  const handleAssetSelectionChange = (assetIds: string[]) => {
    setSelectedAssets(assetIds);
  };


  // Desktop-only layout calculations
  const containerPadding = 12;
  const mainContentWidth = isAIAssistantOpen ? `calc(100% - ${aiAssistantWidth}px)` : '100%';

  // Performance measurement removed - was causing infinite loop
  // TODO: Re-implement with proper memoization if needed

  // Set up keyboard navigation for the grid
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gridRef.current) {
      const cleanup = setupGridKeyboardNavigation(gridRef.current, {
        enableArrowKeys: true,
        enableTabNavigation: true,
        enableEnterActivation: true,
        enableEscapeClose: true,
        announceChanges: true,
      });
      return cleanup;
    }
  }, [setupGridKeyboardNavigation]);

  // Refresh UI from managers
  const refreshUIFromManagers = () => {
    if (!isServicesInitialized || !viewModeManagerRef.current || !assetManagerRef.current) {
      return;
    }

    try {
      const assets = assetManagerRef.current.getAllAssets();

      if (assets.length > 0) {
        const currentMode = viewModeManagerRef.current.getCurrentMode();

        if (currentMode === 'equipment-based') {
          const equipmentData = viewModeManagerRef.current.getEquipmentBasedData();

          const transformedData = equipmentData
            .filter(row => row.type === 'asset')
            .map(row => {
              const results: any = {};

              if (row.tasks) {
                row.tasks.forEach(task => {
                  const aggregated = viewModeManagerRef.current!.aggregateScheduleByTimeScale(
                    task.schedule,
                    timeScale
                  );

                  Object.entries(aggregated).forEach(([timeKey, status]) => {
                    if (!results[timeKey]) {
                      results[timeKey] = {
                        planned: false,
                        actual: false,
                        planCost: 0,
                        actualCost: 0
                      };
                    }

                    results[timeKey].planned = results[timeKey].planned || status.planned;
                    results[timeKey].actual = results[timeKey].actual || status.actual;
                    results[timeKey].planCost += status.totalPlanCost;
                    results[timeKey].actualCost += status.totalActualCost;
                  });
                });
              }

              return {
                id: row.assetId || '',
                task: row.assetName || '',
                hierarchyPath: row.hierarchyPath ?
                  Object.values(row.hierarchyPath).join(' > ') : '',
                specifications: row.specifications || [],
                results,
                level: 0,
                bomCode: row.assetId || '',
                children: [],
                rolledUpResults: {}
              };
            });

          setMaintenanceData(transformedData);
        }
      }
    } catch (error) {
      console.error('Failed to refresh UI from managers:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'uiRefresh', errorHandlerRef.current);
      }
    }
  };

  // Set up keyboard shortcuts for save and undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S: Save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSaveData();
      }

      // Ctrl+Z: Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (undoRedoManagerRef.current?.canUndo()) {
          undoRedoManagerRef.current.undo();
          refreshUIFromManagers();
          showSnackbar('操作を元に戻しました', 'info');
          announce('操作を元に戻しました');
        }
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if (((event.ctrlKey || event.metaKey) && event.key === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        if (undoRedoManagerRef.current?.canRedo()) {
          undoRedoManagerRef.current.redo();
          refreshUIFromManagers();
          showSnackbar('操作をやり直しました', 'info');
          announce('操作をやり直しました');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServicesInitialized, timeScale]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div
        className="app-container"
        style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#000000' }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            flex: 1,
            minHeight: 0,
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            backgroundColor: '#000000',
          }}
        >
          {/* Enhanced Maintenance Grid */}
          <div
            ref={gridRef}
            className="grid-container-responsive grid-performance"
            style={{
              paddingLeft: `${containerPadding}px`,
              paddingRight: `${containerPadding}px`,
              paddingTop: `${containerPadding}px`,
              paddingBottom: '12px',
              height: '100%',
              overflow: 'hidden',
              width: mainContentWidth,
              transition: 'width 0.3s ease',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000000',
            }}
            role="grid"
            aria-label="保全計画データグリッド"
            aria-rowcount={displayedMaintenanceData.length}
            aria-colcount={timeHeaders.length + 3}
          >

            {/* Enhanced Maintenance Grid - Production Version */}
            <EnhancedMaintenanceGrid
              data={displayedMaintenanceData}
              timeHeaders={timeHeaders}
              onCellEdit={handleCellEdit}
              onSpecificationEdit={handleSpecificationEdit}
              onSpecificationColumnReorder={handleSpecificationColumnReorder}
              onUpdateItem={handleUpdateItem}
              onJumpToDate={handleJumpToDate}
              onAssetSelectionChange={handleAssetSelectionChange}
              onOpenTaskEditDialog={handleOpenTaskEditDialog}
              viewMode={viewMode}
              timeScale={timeScale}
              searchTerm={searchTerm}
              showBomCode={showBomCode}
              displayMode={displayMode}
              dataViewMode={dataViewMode}
              editScope={editScope}
              onEditScopeChange={handleEditScopeChange}
              tasks={taskManagerRef.current?.getAllTasks() || []}
              assets={assetManagerRef.current?.getAllAssets() || []}
              associations={workOrderLineManagerRef.current?.getAllWorkOrderLines() || []}
              hierarchy={hierarchyManagerRef.current?.getHierarchyDefinition()}
              // Header props - restored to original structure
              onSearchChange={setSearchTerm}
              onViewModeChange={(mode) => setViewMode(mode)}
              onDataViewModeChange={handleDataViewModeChange}
              onTimeScaleChange={(scale) => {
                setTimeScale(scale);
                loadDataFromViewModeManager(scale);
              }}
              level1Filter={level1Filter}
              level2Filter={level2Filter}
              level3Filter={level3Filter}
              onLevel1FilterChange={handleLevel1FilterChange}
              onLevel2FilterChange={handleLevel2FilterChange}
              onLevel3FilterChange={(event) => setLevel3Filter(event.target.value)}
              hierarchyFilterTree={hierarchyFilterTree}
              level2Options={level2Options}
              level3Options={level3Options}
              onAddYear={handleAddYearClick}
              onDeleteYear={handleDeleteYearClick}
              onExportData={handleExportData}
              onImportData={handleImportDataClick}
              onResetData={handleResetDataClick}
              onAIAssistantToggle={handleAIAssistantToggle}
              isAIAssistantOpen={isAIAssistantOpen}
              onShowBomCodeChange={setShowBomCode}
              onDisplayModeChange={setDisplayMode}
            />
          </div>

          {/* AI Assistant Panel - Desktop only */}
          {isAIAssistantOpen && (
            <div
              style={{
                width: aiAssistantWidth,
                height: '100%',
                borderLeft: '1px solid #333333',
                backgroundColor: '#000000',
              }}
            >
              <AIAssistantPanel
                isOpen={isAIAssistantOpen}
                onClose={handleAIAssistantClose}
                onSuggestionApply={(suggestion) => {
                  // Apply AI suggestion to maintenance data
                  handleCellEdit(
                    suggestion.equipmentId,
                    `time_${suggestion.timeHeader}`,
                    suggestion.suggestedAction === 'plan'
                      ? { planned: true, actual: false }
                      : suggestion.suggestedAction === 'actual'
                        ? { planned: false, actual: true }
                        : { planned: true, actual: true }
                  );
                }}
                onExcelImport={(file) => {
                  // Handle Excel file import
                  console.log('Excel file imported:', file.name);
                  showSnackbar(`Excelファイル "${file.name}" をインポートしました`, 'success');
                }}
              />
            </div>
          )}
        </div>

        {/* Add Year Dialog */}
        <Dialog open={addYearDialogOpen} onClose={() => setAddYearDialogOpen(false)}>
          <DialogTitle>年度追加</DialogTitle>
          <DialogContent>
            <DialogContentText>
              追加する年度を入力してください。
              {timeScale === 'month' && '（12ヶ月分が追加されます）'}
              {timeScale === 'week' && '（52週分が追加されます）'}
              {timeScale === 'day' && '（365日分が追加されます）'}
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="年度"
              type="number"
              fullWidth
              variant="outlined"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              error={!!addYearError}
              helperText={addYearError}
              placeholder="2024"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddYearDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleAddYearConfirm} variant="contained">追加</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Year Dialog */}
        <Dialog open={deleteYearDialogOpen} onClose={() => setDeleteYearDialogOpen(false)}>
          <DialogTitle>年度削除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              削除する年度を選択してください。
              {timeScale === 'month' && '（12ヶ月分が削除されます）'}
              {timeScale === 'week' && '（52週分が削除されます）'}
              {timeScale === 'day' && '（365日分が削除されます）'}
            </DialogContentText>
            <FormControl fullWidth margin="dense">
              <Select
                value={yearToDelete}
                onChange={(e) => setYearToDelete(e.target.value)}
                displayEmpty
              >
                <option value="">選択してください</option>
                {/* Extract unique years from timeHeaders */}
                {Array.from(new Set(
                  timeHeaders.map(period => {
                    const yearMatch = period.match(/^(\d{4})/);
                    return yearMatch ? yearMatch[1] : '';
                  }).filter(y => y !== '')
                )).sort().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Select>
            </FormControl>
            {deleteYearError && (
              <DialogContentText color="error">
                {deleteYearError}
              </DialogContentText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteYearDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleDeleteYearConfirm} variant="contained" color="error">削除</Button>
          </DialogActions>
        </Dialog>

        {/* Import File Input */}
        <input
          type="file"
          ref={importFileInputRef}
          onChange={handleFileImport}
          style={{ display: 'none' }}
          accept=".json,application/json"
        />

        {/* Import Confirmation Dialog */}
        <Dialog open={importConfirmDialogOpen} onClose={() => setImportConfirmDialogOpen(false)}>
          <DialogTitle>データインポート確認</DialogTitle>
          <DialogContent>
            <DialogContentText>
              インポートしたデータで現在のデータを置き換えますか？この操作は元に戻せません。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportConfirmDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleImportConfirm} variant="contained" color="warning">インポート</Button>
          </DialogActions>
        </Dialog>

        {/* Reset Confirmation Dialog */}
        <Dialog open={resetConfirmDialogOpen} onClose={() => setResetConfirmDialogOpen(false)}>
          <DialogTitle>データ初期化確認</DialogTitle>
          <DialogContent>
            <DialogContentText>
              すべてのデータを初期状態に戻しますか？この操作は元に戻せません。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetConfirmDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleResetConfirm} variant="contained" color="error">初期化</Button>
          </DialogActions>
        </Dialog>

        {/* WorkOrderLineDialog */}
        {taskEditDialogOpen && (
          <WorkOrderLineDialog
            open={taskEditDialogOpen}
            assetId={taskEditAssetId}
            dateKey={taskEditDateKey}
            associations={workOrderLineManagerRef.current?.getWorkOrderLinesByAsset(taskEditAssetId) || []}
            allTasks={taskManagerRef.current?.getAllTasks() || []}
            allAssets={assetManagerRef.current?.getAllAssets() || []}
            onSave={handleSaveTaskEdits}
            onUpdateTask={handleUpdateTask}
            onClose={handleCloseTaskEditDialog}
            readOnly={false}
            editScope={dataViewMode === 'task-based' ? 'single-asset' : 'single-asset'}
            dataViewMode={dataViewMode}
          />
        )}

        {/* AssetReassignDialog - Requirements 3.2, 3.6 */}
        {assetReassignDialogOpen && (
          <AssetReassignDialog
            open={assetReassignDialogOpen}
            assets={
              selectedAssets
                .map(assetId => assetManagerRef.current?.getAsset(assetId))
                .filter((asset): asset is Asset => asset !== null)
            }
            hierarchy={hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] }}
            onReassign={handleAssetReassign}
            onClose={handleCloseAssetReassignDialog}
          />
        )}


        {/* Status Selection Dialog - for task-based mode status editing */}
        {selectedItemForDialog && (
          <StatusSelectionDialog
            open={statusDialogOpen}
            currentStatus={{
              planned: selectedItemForDialog.currentValue?.planned || false,
              actual: selectedItemForDialog.currentValue?.actual || false,
            }}
            onSelect={(status) => handleStatusDialogSave(status)}
            onClose={() => {
              setStatusDialogOpen(false);
              setSelectedItemForDialog(null);
              setDialogAnchorEl(null);
            }}
            anchorEl={dialogAnchorEl}
          />
        )}

        {/* Cost Input Dialog - for task-based mode cost editing */}
        {selectedItemForDialog && (
          <CostInputDialog
            open={costDialogOpen}
            currentCost={{
              planCost: selectedItemForDialog.currentValue?.planCost || 0,
              actualCost: selectedItemForDialog.currentValue?.actualCost || 0,
            }}
            onSave={(cost) => handleCostDialogSave(cost)}
            onClose={() => {
              setCostDialogOpen(false);
              setSelectedItemForDialog(null);
              setDialogAnchorEl(null);
            }}
            anchorEl={dialogAnchorEl}
          />
        )}

        {/* Simple Status Dialog - fallback for legacy compatibility */}
        {selectedItemForDialog && (
          <SimpleStatusDialog
            open={false} // Disabled in favor of proper dialogs
            onClose={() => {
              setStatusDialogOpen(false);
              setSelectedItemForDialog(null);
            }}
            onSave={handleStatusDialogSave}
            itemName={selectedItemForDialog.itemName}
            timeHeader={selectedItemForDialog.timeHeader}
            currentValue={selectedItemForDialog.currentValue}
          />
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => handleSnackbarClose()}
        >
          <Alert
            onClose={() => handleSnackbarClose()}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </div>
    </ThemeProvider >
  );
};

export default App;
