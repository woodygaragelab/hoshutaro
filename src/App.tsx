import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// HMR Cache Invalidation Touch: Vite requires this to clear the module graph after deep component changes - 20260407
import './App.css';
import './styles/responsive.css';
import './styles/grid-text-fix.css';
import './styles/performance.css';
import { HierarchicalData, RawEquipment } from './types';
import { usePerformanceMonitor } from './utils/performanceMonitor';
import { useAccessibility } from './utils/accessibility';


// Import memoization utilities for performance optimization - Requirements 10.1, 10.2, 10.3
import { memoize, memoizeArray, createMemoizedSelector } from './utils/memoization';

// Import all service managers
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
import { AgentBar } from './components/AgentBar/AgentBar';
import { EmptyState } from './components/EmptyState';
import { CostTrendGraph } from './components/CostTrendGraph';
import { AnimatePresence } from 'framer-motion';
import WorkOrderLineDialog from './components/WorkOrderLineDialog/WorkOrderLineDialog';
import { TreeClassificationEditDialog } from './components/TreeClassificationEditDialog';
import { WorkOrderClassificationEditDialog } from './components/WorkOrderClassificationEditDialog';
import { AssetReassignDialog } from './components/AssetReassignDialog/AssetReassignDialog';
import { getISOWeek, getISOWeeksInYear, getTimeKey, generateTimeRange, parseTimeKey, shiftDateByTimeScale } from './utils/dateUtils';
import { transformData } from './utils/dataTransformer';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select, Snackbar, Alert, SelectChangeEvent, FormControl, Button, TextField, ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme/darkTheme';
import type { ViewMode, Asset, WorkOrder, WorkOrderLine, WorkOrderLineUpdate } from './types/maintenanceTask';

const rawData = {
  version: '3.0.0',
  assets: {},
  workOrders: {},
  workOrderLines: {},
  hierarchy: { levels: [{ key: 'level1', order: 1, values: [] }] },
  metadata: {}
};

const App: React.FC = () => {
  // Performance and accessibility hooks
  const { measureAsync } = usePerformanceMonitor();
  const { announce, setupGridKeyboardNavigation } = useAccessibility();

  // Initialize all service managers
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
  const [activeTimeHeaders, setActiveTimeHeaders] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentVisibleDate, setCurrentVisibleDate] = useState<string | undefined>();
  const [focusDateKey, setFocusDateKey] = useState<string | null>(null);
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
  const [showGraph, setShowGraph] = useState(false);

  // Spreadsheet-style checkbox filters
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedBomCodes, setSelectedBomCodes] = useState<string[]>([]);


  // Data view mode state - Requirements 6.1, 6.2, 6.5
  const [dataViewMode, setDataViewMode] = useState<'asset-based' | 'workorder-based'>('asset-based');

  // Edit scope state - Requirements 4.8, 5.7: User-controllable edit scope
  // In equipment-based mode: user can choose to edit single asset or all assets with same task
  // In task-based mode: always edits all assets (editScope is forced to 'all-assets')
  const [editScope, setEditScope] = useState<'single-asset' | 'all-assets'>('single-asset');
  const [projectName, setProjectName] = useState<string>('無題のプロジェクト');

  // Handle project name change
  const handleProjectNameChange = useCallback((newName: string) => {
    setProjectName(newName);
  }, []);

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
    // Don't call setDataViewMode here to prevent infinite loops
    // The mode change will be handled by the handleDataViewModeChange function
  };
  const hookApplyFilters = (filters: any) => {
  };
  const hookUpdateData = (tasks: any, assets: any, associations: any, hierarchy: any) => {
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
            setDataViewMode(mode);
    },
    onTransitionStart: () => {
          },
    onTransitionComplete: (duration) => {
            // Requirements 6.3: Verify transition completes within 1000ms for 50,000 assets
      if (duration > 1000) {
              }
    },
  });
  */

  // Filter states
  const [level1Filter, setLevel1Filter] = useState<string>('all');
  const [level2Filter, setLevel2Filter] = useState<string>('all');
  const [level3Filter, setLevel3Filter] = useState<string>('all');
  // Classification filter states
  const [classificationFilter, setClassificationFilter] = useState<{[key: string]: string}>({});
  const [woClassificationFilter, setWoClassificationFilter] = useState<string>('all');

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
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isHierarchyManagerOpen, setIsHierarchyManagerOpen] = useState(false);
  const [isAssetClassificationEditOpen, setIsAssetClassificationEditOpen] = useState(false);
  const [isWorkOrderClassificationEditOpen, setIsWorkOrderClassificationEditOpen] = useState(false);

  // Display toggles
  const [showBomCode, setShowBomCode] = useState(true);

  // Display area mode for EnhancedMaintenanceGrid
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('maintenance');

  // Handle cell double click - proper dialog routing based on view mode
  const handleCellDoubleClick = (item: any, header: string, event: React.MouseEvent<HTMLElement>) => {

    // Route to appropriate dialog based on view mode
    // Both modes use TaskEditDialog, but with different context
    if (dataViewMode === 'asset-based') {
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
  const [taskEditTaskId, setTaskEditTaskId] = useState<string | undefined>(undefined);

  // AssetReassignDialog states - Requirements 3.2, 3.6
  const [assetReassignDialogOpen, setAssetReassignDialogOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  // HierarchyEditDialog state
  const [hierarchyEditDialogOpen, setHierarchyEditDialogOpen] = useState(false);


  // Initialize all services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize UndoRedoManager first
        undoRedoManagerRef.current = new UndoRedoManager();
        undoRedoManagerRef.current.subscribe(() => {
          setCanUndo(undoRedoManagerRef.current?.canUndo() || false);
          setCanRedo(undoRedoManagerRef.current?.canRedo() || false);
        });
        errorHandlerRef.current = new ErrorHandler();
        dataStoreRef.current = new DataStore();

        // Initialize managers with UndoRedoManager (order matters!)
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
          (window as any).__assetManager = assetManagerRef.current;
          (window as any).__woManager = workOrderManagerRef.current;
        }

        // Initialize ViewModeManager with empty data (will be populated after loading)
        viewModeManagerRef.current = new ViewModeManager(
          [],
          [],
          { levels: [] }
        );

        // Load data from DataStore with version checking
        // Requirements 9.1: Check version and handle legacy data
        try {
          // Step 1: Check data version before attempting to load
          const dataVersion = (rawData as any).version;


          if (dataVersion === '3.0.0') {
            // New data model (v3.0.0) - use DataStore
            console.log("Raw Data Hierarchy:", JSON.parse(JSON.stringify(rawData.hierarchy)));
            const loadedData = dataStoreRef.current.loadData(rawData);

            // Initialize project name from metadata if available
            if (loadedData.metadata?.projectName) {
              setProjectName(loadedData.metadata.projectName);
            }


            // Populate managers with loaded data
            if (loadedData) {
              undoRedoManagerRef.current?.mute();
              
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
              const postCreationLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
              (window as any).__debug_wol = { existingWorkOrderLines, postCreationLines, wolSuccessCount, wolErrorCount };

              // Reinitialize EditHandlers with the new WorkOrderLineManager
              editHandlersRef.current = new EditHandlers(workOrderLineManagerRef.current);

              // Reinitialize ViewModeManager with loaded data
              viewModeManagerRef.current = new ViewModeManager(
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
                    values: level.values.map((v: any) => typeof v === 'string' ? { value: v } : v) // 互換性: string[] -> TreeLevelValue[] に変換
                  }))
                };

                hierarchyManagerRef.current?.setHierarchyDefinition(hierarchyDefinition);

                // アセットの階層パスはそのまま使用（変換不要）

                // ViewModeManagerを階層定義で初期化
                viewModeManagerRef.current = new ViewModeManager(
                  existingAssets,
                  existingWorkOrderLines,
                  hierarchyDefinition
                );
              }

              // Build data indexes for O(1) lookups - Requirements 10.1, 10.2, 10.3
              dataIndexManagerRef.current.buildAll({
                assets: existingAssets,
                workOrders: existingWorkOrders,
                associations: existingWorkOrderLines
              });

              const indexStats = dataIndexManagerRef.current.getStats();

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
              setTimeHeaders(headerStrings);

              setTimeout(() => {
                undoRedoManagerRef.current?.unmute();
                undoRedoManagerRef.current?.clear();
              }, 100);

              announce('データモデル (v3.0.0) が読み込まれました');
            }
          } else {
            // Legacy data (no version or different version) - use legacy transformation
            // Requirements 9.1: Detect and handle legacy data

            const [flatData, headers, filterTree] = transformData(rawData as unknown as { [id: string]: RawEquipment }, timeScale);
            setMaintenanceData(flatData);
            setTimeHeaders(headers);
            setHierarchyFilterTree(filterTree);

            const versionInfo = dataVersion ? `バージョン ${dataVersion}` : 'バージョン情報なし';
            announce(`レガシーデータが読み込まれました (${versionInfo})。${flatData.length}件の設備データが表示されています。`);

            // setLegacyDataDetected(true);
            // setMigrationDialogOpen(true);
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
          console.log("NOT calling fallback data transformation to prevent infinite loop");
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

  // Listen for date jumps to update the dynamic time window
  useEffect(() => {
    const handleJump = (event: Event) => {
      const customEvent = event as CustomEvent;
      const header = customEvent.detail?.header;
      if (header) {
        setFocusDateKey(header);
      }
    };
    window.addEventListener('jumpToColumn', handleJump);
    return () => window.removeEventListener('jumpToColumn', handleJump);
  }, []);

  // Update data when time scale changes, focus date changes, or services are initialized
  useEffect(() => {
    if (!isServicesInitialized) return;

    const loadData = async () => {
      // Delegate completely to the unified loader which respects dataViewMode state.
      loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
    };
    measureAsync('data-transformation', 'render', loadData);
  }, [timeScale, focusDateKey, isServicesInitialized]); // Remove measureAsync and announce from dependencies

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

  useEffect(() => {
    if (isServicesInitialized && assetManagerRef.current &&
      workOrderLineManagerRef.current && hierarchyManagerRef.current) {
      hookUpdateData(
        [], // taskManager removed
        assetManagerRef.current.getAllAssets(),
        workOrderLineManagerRef.current.getAllWorkOrderLines(),
        hierarchyManagerRef.current.getHierarchyDefinition()
      );
    }
  }, [isServicesInitialized]); // Remove hookUpdateData to prevent infinite loops

  // Memoized data transformation functions - Requirements 10.1, 10.2, 10.3
  const transformEquipmentData = useMemo(() => {
    return createMemoizedSelector((equipmentData: any[]) => {

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
          if (row.workOrderLines) {
            const aggregated = viewModeManagerRef.current!.aggregateEventsByTimeScaleInternal(
              row.workOrderLines,
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

  // Helper function to load data from ViewModeManager
  // Updated to use useViewModeTransition hook data when available
  // Helper function to load data from ViewModeManager
  // Updated to use useViewModeTransition hook data when available
  // Helper function to load data from ViewModeManager with explicit mode parameter
  // This avoids state synchronization issues when switching modes
  const loadDataFromViewModeManagerWithMode = useCallback((mode: 'asset-based' | 'workorder-based', timeScaleOverride?: 'year' | 'month' | 'week' | 'day') => {

    if (!isServicesInitialized || !viewModeManagerRef.current || !assetManagerRef.current) {
      return;
    }

    try {
      // Rebuild data indexes for O(1) lookups - Requirements 10.1, 10.2, 10.3
      if (workOrderManagerRef.current && workOrderLineManagerRef.current) {
        const workOrders = workOrderManagerRef.current.getAllWorkOrders();
        const assets = assetManagerRef.current.getAllAssets();
        const workOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();


        dataIndexManagerRef.current.buildAll({
          assets,
          workOrders,
          associations: workOrderLines
        });
      }

      const assets = assetManagerRef.current.getAllAssets();

      if (assets.length > 0) {
        // Use the explicit mode parameter instead of state
        if (mode === 'asset-based') {
          // Update ViewModeManager with latest data before fetching
          // This ensures we have the latest edits from EditHandlers
          if (workOrderLineManagerRef.current && hierarchyManagerRef.current) {
            viewModeManagerRef.current.updateData(
              assetManagerRef.current.getAllAssets(),
              workOrderLineManagerRef.current.getAllWorkOrderLines(),
              hierarchyManagerRef.current.getHierarchyDefinition(),
              workOrderManagerRef.current?.getAllWorkOrders() || []
            );
          }

          // Use hook's equipment data if available, otherwise fall back to ViewModeManager
          const equipmentData = hookEquipmentData.length > 0
            ? hookEquipmentData
            : viewModeManagerRef.current.getAssetBasedData();


          // Transform to legacy format for grid compatibility using memoized function
          // Requirements 10.1, 10.2, 10.3: Memoized transformation for performance
          const transformedData = transformEquipmentData(equipmentData);

          // DEBUG: Expose data to window for headless inspection
          (window as any).__DEBUG_EQUIPMENT = equipmentData;
          (window as any).__DEBUG_TRANS = transformedData;

          const newActiveHeaders = new Set<string>();
          transformedData.forEach(item => {
            if (item.results) {
              Object.keys(item.results).forEach(k => {
                if (item.results![k].planned || item.results![k].actual) {
                  newActiveHeaders.add(k);
                }
              });
            }
          });
          setActiveTimeHeaders(Array.from(newActiveHeaders));

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
          if (viewModeManagerRef.current && assetManagerRef.current && workOrderLineManagerRef.current) {
            const currentAssets = assetManagerRef.current.getAllAssets();
            const currentWorkOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
            const currentHierarchy = hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] };
            const currentWorkOrders = workOrderManagerRef.current?.getAllWorkOrders() || [];

            // Reinitialize ViewModeManager with current data
            // Fix: Use updateData instead of re-instantiation to preserve view mode state
            viewModeManagerRef.current.updateData(
              currentAssets,
              currentWorkOrderLines,
              currentHierarchy,
              currentWorkOrders
            );
          }

          const effectiveTimeScale = timeScaleOverride || timeScale;
          const taskBasedData = viewModeManagerRef.current.getWorkOrderBasedData(effectiveTimeScale);


          // Transform task-based data to legacy format for grid compatibility
          const transformedData = taskBasedData.map(row => {
            if (row.type === 'workOrder') {
              return {
                ...row,
                type: row.type,
                id: row.id,
                task: row.workOrderName || '',
                bomCode: '',
                specifications: [],
                results: {},
                rolledUpResults: {},
                isGroupHeader: false, // In task mode, work order acts as parent but it has its own schedule
                level: row.level,
                children: []
              };
            } else if (row.type === 'assetChild') {
              const results: any = row.aggregatedSchedule || {};
              const rolledUpResults: any = row.aggregatedSchedule || {};
              return {
                ...row,
                type: row.type,
                id: row.id,
                task: row.assetName || '',
                bomCode: row.assetId || '',
                specifications: [],
                results,
                rolledUpResults,
                isGroupHeader: false,
                hierarchyPath: row.hierarchyPath ? Object.values(row.hierarchyPath).join(' > ') : '',
                level: row.level,
                assetId: row.assetId,
                taskId: row.workOrderId,
                ClassificationId: row.ClassificationId,
                children: []
              };
            } else {
              return row as any;
            }
          });

          const newActiveHeaders = new Set<string>();
          transformedData.forEach(item => {
            if (item.results) {
              Object.keys(item.results).forEach(k => {
                if (item.results![k].planned || item.results![k].actual) {
                  newActiveHeaders.add(k);
                }
              });
            }
          });
          setActiveTimeHeaders(Array.from(newActiveHeaders));

          setMaintenanceData(transformedData);

          // Generate time headers dynamically based on the transformed data
          const generatedHeaders = generateTimeHeadersFromData(transformedData);


          // Use standard unique filtering before pushing to state
          const uniqueHeaders = Array.from(new Set(generatedHeaders)).sort();

          if (uniqueHeaders.length > 0) {
            setTimeHeaders(generateFullTimeRange(uniqueHeaders[0], uniqueHeaders[uniqueHeaders.length - 1], effectiveTimeScale));
          } else {
            setTimeHeaders([]);
          }

          // Build hierarchy filter tree using memoized function
          const filterTree = buildHierarchyFilterTree(transformedData);
          setHierarchyFilterTree(filterTree);
        }
      }
    } catch (error) {
      console.error('Failed to load data from ViewModeManager with mode:', error);

      // Use ErrorHandler with proper error type detection
      if (errorHandlerRef.current) {
        handleGenericError(error, 'dataLoadTimeScale', errorHandlerRef.current);
      }

      // Deliberately NOT falling back to legacy flatData here.
      // Doing so would wipe out the task hierarchies (causing the ghost UI bug).
      // We rely strictly on ViewModeManager, and if it fails, we show the ErrorHandler UI.
    }
  }, [isServicesInitialized, timeScale, focusDateKey]);

  const loadDataFromViewModeManager = useCallback((timeScaleOverride?: 'year' | 'month' | 'week' | 'day') => {
    // Delegate to loadDataFromViewModeManagerWithMode to ensure consistent behavior
    // This fixes the layout breakage issue on save by using the same proven logic as mode switching
    loadDataFromViewModeManagerWithMode(dataViewMode, timeScaleOverride);
  }, [dataViewMode, loadDataFromViewModeManagerWithMode]);


  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    // 画面の表示を更新
    setMaintenanceData(prevData =>
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );

    // AssetManager(マスターデータ)に変更を保存する（タブ切り替えなどで失われないようにするため）
    if (assetManagerRef.current && updatedItem.specifications) {
      // idが 'asset_123' のような書式の場合はプレフィックスを外す
      const cleanAssetId = updatedItem.id.startsWith('asset_')
        ? updatedItem.id.substring(6)
        : updatedItem.id;

      if (assetManagerRef.current.hasAsset(cleanAssetId)) {
        try {
          assetManagerRef.current.updateSpecifications(cleanAssetId, updatedItem.specifications);
        } catch (e) {
          console.error('[App] Failed to persist specifications on update:', cleanAssetId, e);
        }
      }
    }
  };

  // --- Filtering Logic ---
  const level2Options = level1Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children || {}) : [];
  const level3Options = level1Filter !== 'all' && level2Filter !== 'all' && hierarchyFilterTree ? Object.keys(hierarchyFilterTree.children[level1Filter]?.children[level2Filter]?.children || {}) : [];

  const handleLevel1FilterChange = (value: string | SelectChangeEvent) => {
    const val = typeof value === 'string' ? value : value.target.value;
    setLevel1Filter(val);
    setLevel2Filter('all');
    setLevel3Filter('all');
  };
  const handleLevel2FilterChange = (value: string | SelectChangeEvent) => {
    const val = typeof value === 'string' ? value : value.target.value;
    setLevel2Filter(val);
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

  // Extract unique values for spreadsheet-style checkbox filtering
  const { uniqueTasks, uniqueBomCodes } = useMemo(() => {
    const tasks = new Set<string>();
    const bomCodes = new Set<string>();
    maintenanceData.forEach(item => {
      if (item.isGroupHeader) return; // Do not include hierarchy strings in the checkbox filter

      // Avoid inserting blank strings as checkbox options if they logically don't have this property in UI
      if (item.task) tasks.add(item.task);
      if (item.bomCode) bomCodes.add(item.bomCode);
    });
    return {
      uniqueTasks: Array.from(tasks).sort(),
      uniqueBomCodes: Array.from(bomCodes).sort()
    };
  }, [maintenanceData]);

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

        // Also check workOrder names using workOrder index
        if (workOrderManagerRef.current) {
          const allWorkOrders = workOrderManagerRef.current.getAllWorkOrders();
          const matchingWoIds = new Set<string>();

          allWorkOrders.forEach(wo => {
            if (wo.name.toLowerCase().includes(searchLower)) {
              matchingWoIds.add(wo.id);
            }
          });

          // If we found matching workOrders, get all assets associated with those workOrders
          if (matchingWoIds.size > 0 && workOrderLineManagerRef.current) {
            matchingWoIds.forEach(woId => {
              const associations = dataIndexManagerRef.current.associations.getByWorkOrder(woId);
              associations.forEach(assoc => {
                matchingAssetIds.add(assoc.AssetId);
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
          // Check if item matches by workOrder name (for task-based view)
          if (item.taskId && workOrderManagerRef.current) {
            const wo = dataIndexManagerRef.current.workOrders.get(item.taskId);
            if (wo && wo.name.toLowerCase().includes(searchLower)) {
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

    // Apply asset classification filter (equipment-based mode)
    if (dataViewMode === 'asset-based' && Object.keys(classificationFilter).length > 0 && isServicesInitialized && assetManagerRef.current) {
      const allAssets = assetManagerRef.current.getAllAssets();
      const matchingAssetIds = new Set<string>();
      allAssets.forEach(asset => {
        if (!asset.classificationPath) return;
        const matches = Object.entries(classificationFilter).every(([key, value]) =>
          asset.classificationPath && asset.classificationPath[key] === value
        );
        if (matches) matchingAssetIds.add(asset.id);
      });
      filteredData = filteredData.filter(item => {
        if (item.isGroupHeader) return true;
        if (item.assetId) return matchingAssetIds.has(item.assetId);
        if (item.bomCode) return matchingAssetIds.has(item.bomCode);
        return false;
      });
    }

    // Apply work order classification filter (workorder-based mode)
    if (dataViewMode === 'workorder-based' && woClassificationFilter !== 'all' && isServicesInitialized && workOrderManagerRef.current) {
      const allWorkOrders = workOrderManagerRef.current.getAllWorkOrders();
      const matchingWoIds = new Set<string>();
      allWorkOrders.forEach(wo => {
        if (wo.ClassificationId === woClassificationFilter) matchingWoIds.add(wo.id);
      });
      filteredData = filteredData.filter(item => {
        if (item.isGroupHeader) {
          // Group header in workorder mode: workOrderId is stored in the item
          if (item.workOrderId) return matchingWoIds.has(item.workOrderId);
          return true;
        }
        // Child rows: check parent workOrderId
        if (item.workOrderId) return matchingWoIds.has(item.workOrderId);
        return true;
      });
    }

    // Apply spreadsheet-style checkbox filtering
    if (selectedTasks.length > 0) {
      const taskSet = new Set(selectedTasks);
      filteredData = filteredData.filter(item => taskSet.has(item.task) || item.isGroupHeader);
    }

    if (selectedBomCodes.length > 0) {
      const bomCodeSet = new Set(selectedBomCodes);
      filteredData = filteredData.filter(item => (item.bomCode && bomCodeSet.has(item.bomCode)) || item.isGroupHeader);
    }

    // Cleanup: Remove any empty group headers (headers that have no corresponding child data rows left)
    const survivingHierarchyPaths = new Set<string>();
    filteredData.forEach(item => {
      if (!item.isGroupHeader && item.hierarchyPath) {
        // Splitting into partial paths so parent hierarchy bands survive
        const parts = item.hierarchyPath.split(' > ');
        let currentPath = '';
        parts.forEach(part => {
          if (currentPath) currentPath += ' > ';
          currentPath += part;
          survivingHierarchyPaths.add(currentPath);
        });
      }
    });

    filteredData = filteredData.filter(item => {
      if (item.isGroupHeader) {
        // A group header row stores its exact path natively in 'task'
        return survivingHierarchyPaths.has(item.task);
      }
      return true;
    });

    return filteredData;
  }, [maintenanceData, searchTerm, level1Filter, level2Filter, level3Filter, isServicesInitialized, selectedTasks, selectedBomCodes, classificationFilter, woClassificationFilter, dataViewMode]);

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
  const handleDataViewModeChange = (mode: 'asset-based' | 'workorder-based') => {
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
        if (mode === 'workorder-based' && displayMode !== 'maintenance') {
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
        announce(`表示モードを${mode === 'asset-based' ? '機器ベース' : '作業ベース'}に切り替えました。フィルターは保持されています。`);
        showSnackbar(`表示モードを${mode === 'asset-based' ? '機器ベース' : '作業ベース'}に切り替えました`, 'success');
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

    // 仕様を現在の順序（orderプロパティ）に基づいて収集
    const specKeysMap = new Map<string, number>();
    maintenanceData.forEach(item => {
      if (item.specifications) {
        item.specifications.forEach(spec => {
          if (spec.key && spec.key.trim()) {
            const currentOrder = specKeysMap.get(spec.key);
            if (currentOrder === undefined || spec.order < currentOrder) {
              specKeysMap.set(spec.key, spec.order);
            }
          }
        });
      }
    });

    const sortedKeys = Array.from(specKeysMap.entries())
      .sort((a, b) => {
        const orderDiff = a[1] - b[1];
        if (orderDiff !== 0) return orderDiff;
        return a[0].localeCompare(b[0]);
      })
      .map(entry => entry[0]);


    if (fromIndex < 0 || fromIndex >= sortedKeys.length || toIndex < 0 || toIndex >= sortedKeys.length) {
      return;
    }

    // 並び替え
    const reorderedKeys = [...sortedKeys];
    const [movedKey] = reorderedKeys.splice(fromIndex, 1);
    reorderedKeys.splice(toIndex, 0, movedKey);


    // 全機器の仕様を新しい順序で並び替え
    // 1. Local state (maintenanceData)
    setMaintenanceData(prevData =>
      prevData.map(item => {
        if (!item.specifications || item.specifications.length === 0) {
          return item;
        }

        const specMap = new Map<string, { key: string; value: string; order: number }>();
        item.specifications.forEach(spec => {
          if (spec.key) specMap.set(spec.key, spec);
        });

        const reorderedSpecs = reorderedKeys
          .map((key, index) => {
            const spec = specMap.get(key);
            if (spec) {
              return { ...spec, order: index + 1 };
            }
            return null;
          })
          .filter(spec => spec !== null) as { key: string; value: string; order: number }[];

        // Add back any specifications that weren't in reorderedKeys
        item.specifications.forEach(spec => {
          if (!reorderedKeys.includes(spec.key)) {
            reorderedSpecs.push({ ...spec, order: reorderedSpecs.length + 1 });
          }
        });

        return { ...item, specifications: reorderedSpecs };
      })
    );

    // 2. Global state (AssetManager) - To persist across tab/mode switches
    if (assetManagerRef.current) {
      const allAssets = assetManagerRef.current.getAllAssets();
      allAssets.forEach(asset => {
        if (!asset.specifications || asset.specifications.length === 0) return;

        const specMap = new Map<string, { key: string; value: string; order: number }>();
        asset.specifications.forEach(spec => {
          if (spec.key) specMap.set(spec.key, spec);
        });

        const reorderedSpecs = reorderedKeys
          .map((key, index) => {
            const spec = specMap.get(key);
            if (spec) {
              return { ...spec, order: index + 1 };
            }
            return null;
          })
          .filter(spec => spec !== null) as { key: string; value: string; order: number }[];

        asset.specifications.forEach(spec => {
          if (!reorderedKeys.includes(spec.key)) {
            reorderedSpecs.push({ ...spec, order: reorderedSpecs.length + 1 });
          }
        });

        try {
          assetManagerRef.current?.updateSpecifications(asset.id, reorderedSpecs);
        } catch (e) {
        }
      });
    }

    showSnackbar('機器仕様の列順序を変更しました', 'success');
  };

  // Deep Copy Handlers relocated to the bottom of the component to fix initialization hoisting

  // Handle cell editing for EnhancedMaintenanceGrid
  // Requirements 4.2, 4.8, 5.7: Use EditHandlers for schedule editing with view mode awareness
  const handleCellEdit = (rowId: string, columnId: string, value: any) => {

    // If services are initialized, use EditHandlers
    if (isServicesInitialized && editHandlersRef.current && workOrderLineManagerRef.current && undoRedoManagerRef.current) {
      try {
        // Save current state for undo
        const currentState = {
          maintenanceData: [...maintenanceData]
        };

        // Parse rowId to get the actual Asset ID
        let actualAssetId = rowId;
        let associatedTaskId: string | null = null;
        let associatedWolId: string | null = null;

        if (rowId.startsWith('asset_')) {
          actualAssetId = rowId.replace('asset_', '');
        } else if (rowId.startsWith('task_')) {
          // Format: task_{taskId}_asset_{assetId}_wol_{wolId} OR task_{taskId}_asset_{assetId}
          const parts = rowId.split('_asset_');
          if (parts.length === 2) {
            associatedTaskId = parts[0].replace('task_', '');

            // Check if there's a wol suffix
            const assetParts = parts[1].split('_wol_');
            actualAssetId = assetParts[0];

            if (assetParts.length === 2) {
              associatedWolId = assetParts[1];
            }
          }
        }

        // Deal with specification editing which was missing completely
        if (columnId.startsWith('spec_')) {
          const specKey = columnId.replace('spec_', '');
          const asset = assetManagerRef.current?.getAsset(actualAssetId);
          if (asset && assetManagerRef.current) {
            const specIndex = asset.specifications.findIndex(s => s.key === specKey);
            if (specIndex >= 0) {
              const newSpecs = [...asset.specifications];
              newSpecs[specIndex] = { ...newSpecs[specIndex], value: String(value) };
              assetManagerRef.current.updateAsset(actualAssetId, { specifications: newSpecs });
              showSnackbar('機器仕様を更新しました', 'success');
              loadDataFromViewModeManager();
            }
          }
          return;
        }

        // Handle Task Name editing
        if (columnId === 'task' && associatedTaskId && workOrderManagerRef.current) {
          try {
            workOrderManagerRef.current.updateWorkOrder(associatedTaskId, { name: String(value).trim() });
            showSnackbar('作業名を更新しました', 'success');
            loadDataFromViewModeManager();
          } catch (error) {
            console.error('Failed to update task name:', error);
            showSnackbar('作業名の更新に失敗しました', 'error');
          }
          return;
        }

        if (columnId.startsWith('time_')) {
          showSnackbar('スケジュールの編集はセルをダブルクリックしてダイアログから行ってください。', 'info');
          return;
        }
      } catch (error) {
        console.error('Failed to update through EditHandlers:', error);

        // Use ErrorHandler with proper error type detection
        if (errorHandlerRef.current) {
          handleGenericError(error, 'cellEdit', errorHandlerRef.current);
        }
        showSnackbar('セルの更新に失敗しました', 'error');
      }
    } else {
      showSnackbar('サービスが初期化されていません', 'error');
    }
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
      try {
        let startBoundStr = sortedHeaders[0];
        let endBoundStr = sortedHeaders[sortedHeaders.length - 1];

        // We no longer truncate the time window here. The grid uses virtual scrolling, 
        // so generating 5000+ columns (e.g., 10 years of days) is cheap in React.
        // Truncating this array was breaking the DateJumpDialog min/max limits.
        return generateFullTimeRange(startBoundStr, endBoundStr, timeScale);
      } catch (error) {
        return sortedHeaders;
      }
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
      const assets = assetManagerRef.current?.getAllAssets() || [];
      const workOrders = workOrderManagerRef.current?.getAllWorkOrders() || [];
      const workOrderLines = workOrderLineManagerRef.current?.getAllWorkOrderLines() || [];
      const hierarchy = hierarchyManagerRef.current?.getHierarchyDefinition();

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

      await dataStoreRef.current.saveData({
        version: '3.0.0',
        assets: assetsObj,
        workOrders: workOrdersObj,
        workOrderLines: workOrderLinesObj,
        hierarchy: hierarchy || { levels: [] },
        workOrderClassifications: dataStoreRef.current.getWorkOrderClassifications(),
        assetClassification: dataStoreRef.current.getAssetClassification(),
        metadata: {
          lastModified: new Date(),
          projectName: projectName
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
    if (!isServicesInitialized || !dataStoreRef.current) {
      // Fallback to legacy export
      const dataToExport = { timeHeaders, maintenanceData, timeScale };
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize project name for filesystem
      const sanitizedProjectName = projectName.replace(/[/\\?%*:|"<>]/g, '-');
      a.download = `${sanitizedProjectName}_legacy.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSnackbar('レガシーデータをエクスポートしました。', 'success');
      return;
    }

    try {
      // Export new data model (v3.0.0)
      const assets = assetManagerRef.current?.getAllAssets() || [];
      const workOrders = workOrderManagerRef.current?.getAllWorkOrders() || [];
      const workOrderLines = workOrderLineManagerRef.current?.getAllWorkOrderLines() || [];
      const hierarchy = hierarchyManagerRef.current?.getHierarchyDefinition();

      const assetsObj = assets.reduce((acc, asset) => {
        acc[asset.id] = asset;
        return acc;
      }, {} as any);

      const workOrdersObj = workOrders.reduce((acc, wo) => {
        acc[wo.id] = wo;
        return acc;
      }, {} as any);

      const workOrderLinesObj = workOrderLines.reduce((acc, wol) => {
        const cleanWol = { ...wol };
        // Strip V3 nested properties to strictly adhere to flat equipments.json format
        delete cleanWol.schedule;
        delete (cleanWol as any).__workOrderDraft;
        acc[wol.id] = cleanWol;
        return acc;
      }, {} as any);

      // Include workOrderClassifications and assetClassification from DataStore
      const sourceWorkOrderClassifications = dataStoreRef.current?.getWorkOrderClassifications() || [];
      const sourceAssetClassification = dataStoreRef.current?.getAssetClassification() || { levels: [] };

      const dataToExport = {
        version: '3.0.0',
        workOrderClassifications: sourceWorkOrderClassifications,
        assetClassification: sourceAssetClassification,
        assets: assetsObj,
        workOrders: workOrdersObj,
        workOrderLines: workOrderLinesObj,
        hierarchy: hierarchy || { levels: [] },
        metadata: {
          lastModified: new Date(),
          projectName: projectName
        }
      };


      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Sanitize project name for filesystem
      const sanitizedProjectName = projectName.replace(/[/\\?%*:|"<>]/g, '-');
      a.download = `${sanitizedProjectName}.json`;
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
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        const imported = JSON.parse(e.target?.result as string);

        // Detect v3.0.0 format
        if (imported.version === '3.0.0' && imported.assets) {

          // Validate with DataStore
          if (dataStoreRef.current) {
            try {
              dataStoreRef.current.loadData(imported);
            } catch (validationError: any) {
              throw new Error(`v3.0.0バリデーションエラー: ${validationError.message}`);
            }
          }

          setImportedFileData({ ...imported, _format: 'v3', _fileName: fileName });
          setImportConfirmDialogOpen(true);
        } else if (imported.timeHeaders && Array.isArray(imported.timeHeaders) && imported.maintenanceData && Array.isArray(imported.maintenanceData)) {
          // Legacy format
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
      undoRedoManagerRef.current?.mute();
      
      if (importedFileData._format === 'v3') {
        // v3.0.0 import: reload all managers with imported data

        const importData = { ...importedFileData };
        delete importData._format;

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

        // Update project name from imported metadata or filename
        if (importData.metadata?.projectName) {
          setProjectName(importData.metadata.projectName);
        } else if ((importedFileData as any)._fileName) {
          setProjectName((importedFileData as any)._fileName);
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

        // Reload classification data into DataStore
        if (dataStoreRef.current) {
          const fullData = {
            ...importData,
            _fileName: undefined,
          };
          delete fullData._fileName;
          try {
            dataStoreRef.current.loadData(fullData);
          } catch (e) {
            console.warn('[App] DataStore reload after import had validation issue:', e);
          }
        }

        // Reinitialize ViewModeManager
        viewModeManagerRef.current = new ViewModeManager(
          existingAssets,
          existingWorkOrderLines,
          hierarchyDef,
          existingWorkOrders
        );

        // Rebuild data indexes
        dataIndexManagerRef.current.buildAll({
          assets: existingAssets,
          workOrders: existingWorkOrders,
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
        // Update the GUI
        loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);

        showSnackbar(`v3.0.0データをインポートしました（機器:${existingAssets.length}件, 作業指示:${existingWorkOrders.length}件）`, 'success');
      } else {
        // Legacy import
        setTimeHeaders(importedFileData.timeHeaders);
        setMaintenanceData(importedFileData.maintenanceData);
        setTimeScale(importedFileData.timeScale || 'year');
        if (importedFileData._fileName) {
          setProjectName(importedFileData._fileName);
        }
        showSnackbar('レガシーデータをインポートしました。', 'success');
      }
    } catch (error: any) {
      console.error('[App] Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      showSnackbar(`インポートエラー: ${errorMessage}`, 'error');
    } finally {
      undoRedoManagerRef.current?.unmute();
      undoRedoManagerRef.current?.clear();
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
  const handleOpenTaskEditDialog = (assetId: string, dateKey: string, taskId?: string) => {
    if (!isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }


    setTaskEditAssetId(assetId);
    setTaskEditDateKey(dateKey);
    setTaskEditTaskId(taskId);
    setTaskEditDialogOpen(true);
  };

  const handleCloseTaskEditDialog = () => {
    setTaskEditDialogOpen(false);
    setTaskEditAssetId('');
    setTaskEditDateKey('');
    setTaskEditTaskId(undefined);
  };

  const handleSaveTaskEdits = (updates: WorkOrderLineUpdate[]) => {

    if (!workOrderLineManagerRef.current || !undoRedoManagerRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Save current state for undo
      const currentState = {
        workOrderLines: workOrderLineManagerRef.current.getAllWorkOrderLines(),
        workOrders: workOrderManagerRef.current!.getAllWorkOrders()
      };

      undoRedoManagerRef.current.mute();

      let totalUpdated = 0;

      const newWoIdMap = new Map<string, string>(); // Maps NEW_xx draft IDs to actual created WO IDs

      // Process each update
      updates.forEach(update => {

        if (update.action === 'create' && update.data) {
          const draft = (update.data as any).__workOrderDraft;
          let workOrderId = update.data.WorkOrderId;

          if (draft && draft.isNew) {
            if (newWoIdMap.has(draft.id)) {
              workOrderId = newWoIdMap.get(draft.id)!;
            } else {
              const newWo = workOrderManagerRef.current!.createWorkOrder({
                name: draft.name || '新規作業',
                ClassificationId: draft.classificationId || '01'
              });
              workOrderId = newWo.id;
              newWoIdMap.set(draft.id, workOrderId);
            }
          } else if (draft && !draft.isNew) {
            const existingWo = workOrderManagerRef.current!.getWorkOrder(workOrderId!);
            if (existingWo && (existingWo.name !== draft.name || existingWo.ClassificationId !== draft.classificationId)) {
              workOrderManagerRef.current!.updateWorkOrder(workOrderId!, {
                name: draft.name,
                ClassificationId: draft.classificationId
              });
            }
          }

          update.data.WorkOrderId = workOrderId;
          delete (update.data as any).__workOrderDraft;
          workOrderLineManagerRef.current!.createWorkOrderLine(update.data as any);
          totalUpdated++;
        } else if (update.action === 'update' && update.data) {
          const draft = (update.data as any).__workOrderDraft;
          const workOrderId = update.data.WorkOrderId;
          if (draft && !draft.isNew && workOrderId) {
            const existingWo = workOrderManagerRef.current!.getWorkOrder(workOrderId);
            if (existingWo && (existingWo.name !== draft.name || existingWo.ClassificationId !== draft.classificationId)) {
              workOrderManagerRef.current!.updateWorkOrder(workOrderId, {
                name: draft.name,
                ClassificationId: draft.classificationId
              });
            }
          }
          delete (update.data as any).__workOrderDraft;

          // Direct update for the flat WorkOrderLine record
          workOrderLineManagerRef.current!.updateWorkOrderLine(update.lineId, update.data);
          totalUpdated++;
        } else if (update.action === 'delete') {
          workOrderLineManagerRef.current!.deleteWorkOrderLine(update.lineId);
          totalUpdated++;
        }
      });

      const updatedState = {
        workOrderLines: workOrderLineManagerRef.current.getAllWorkOrderLines(),
        workOrders: workOrderManagerRef.current!.getAllWorkOrders()
      };

      undoRedoManagerRef.current.unmute();
      undoRedoManagerRef.current.pushState('UPDATE_WORK_ORDER_LINE', {
        previousState: currentState,
        updatedState: updatedState
      });

      // Update ViewModeManager with new data (avoid re-initialization to prevent layout breakage)
      if (viewModeManagerRef.current && assetManagerRef.current && workOrderManagerRef.current) {
        const assets = assetManagerRef.current.getAllAssets();
        const workOrders = workOrderManagerRef.current.getAllWorkOrders();
        const workOrderLines = workOrderLineManagerRef.current.getAllWorkOrderLines();
        const hierarchyDefinition = hierarchyManagerRef.current?.getHierarchyDefinition() || { levels: [] };

        // Update existing ViewModeManager instead of creating new instance
        // This preserves memoization cache and prevents layout breakage
        viewModeManagerRef.current.updateData(assets, workOrderLines, hierarchyDefinition, workOrders);


        // Update hook data as well
        if (hookUpdateData) {
          hookUpdateData([], assets, workOrderLines, hierarchyDefinition);
        }
      }

      // Reload data to reflect changes
      loadDataFromViewModeManager();

      // Show feedback with edit scope information
      const scopeDescription = editScope === 'all-assets' ? '全機器' : '単一機器';
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

  const handleUpdateWorkOrder = (workOrderId: string, updates: Partial<any>) => {
    if (!workOrderManagerRef.current || !undoRedoManagerRef.current || !isServicesInitialized) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      // Save current state for undo
      const currentWo = workOrderManagerRef.current.getWorkOrder(workOrderId);
      if (currentWo) {
        undoRedoManagerRef.current.pushState('UPDATE_WORK_ORDER', {
          workOrderId,
          previousWo: currentWo
        });
      }

      // Update or Create workOrder
      if (workOrderManagerRef.current.getWorkOrder(workOrderId)) {
        workOrderManagerRef.current.updateWorkOrder(workOrderId, updates);
      } else {
        const taskName = updates.name;
        if (taskName) {
          workOrderManagerRef.current.createWorkOrder({
            id: workOrderId,
            name: taskName,
            ClassificationId: '01'
          });
        } else {
          console.error('[App] Cannot create workOrder, missing name:', updates);
          throw new Error('新しい作業を作成するには作業名が必要です');
        }
      }

      // Reload data to reflect changes
      loadDataFromViewModeManager();
      showSnackbar('作業定義を更新しました', 'success');
    } catch (error) {
      console.error('[App] Error updating workOrder:', error);
      if (errorHandlerRef.current) {
        handleGenericError(error, 'workOrderUpdate', errorHandlerRef.current);
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

  // Handle full asset edits from AssetDetailsDialog
  const handleAssetEdit = useCallback((assetId: string, updates: any) => {

    if (!isServicesInitialized || !assetManagerRef.current) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    try {
      const asset = assetManagerRef.current.getAsset(assetId);
      if (!asset) {
        showSnackbar(`機器 ${assetId} が見つかりません`, 'error');
        return;
      }

      // Prepare updates
      const assetUpdates: Partial<typeof asset> = {};
      if (updates.assetName !== undefined) assetUpdates.name = updates.assetName;
      if (updates.hierarchyPath !== undefined) assetUpdates.hierarchyPath = updates.hierarchyPath;
      if (updates.specifications !== undefined) assetUpdates.specifications = updates.specifications;

      if (updates.bomCode !== undefined && updates.bomCode !== assetId) {
      }

      // Update asset via manager
      assetManagerRef.current.updateAsset(assetId, assetUpdates);

      // Reload data to reflect changes
      loadDataFromViewModeManagerWithMode(dataViewMode);
      showSnackbar('機器情報を更新しました', 'success');

    } catch (error) {
      console.error('Failed to update asset:', error);
      if (errorHandlerRef.current) {
        handleGenericError(error, 'assetEdit', errorHandlerRef.current);
      }
      showSnackbar(`機器情報の更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [isServicesInitialized, dataViewMode]);

  // --- Deep Copy & Paste Handlers ---
  const [internalClipboard, setInternalClipboard] = useState<{
    rowId: string;
    columnId: string;
    viewMode: 'status' | 'cost';
  } | null>(null);

  const handleCellCopy = useCallback((rowId: string, columnId: string, viewMode: 'status' | 'cost') => {
    setInternalClipboard({ rowId, columnId, viewMode });
  }, []);

  const handleCellPaste = useCallback((rowId: string, columnId: string, viewMode: 'status' | 'cost') => {
    if (!internalClipboard) {
      showSnackbar('クリップボードにデータがありません', 'warning');
      return;
    }

    if (!isServicesInitialized || !workOrderLineManagerRef.current || !workOrderManagerRef.current) {
      showSnackbar('サービスが初期化されていません', 'error');
      return;
    }

    if (!columnId.startsWith('time_') || !internalClipboard.columnId.startsWith('time_')) {
      showSnackbar('計画・実績（タイムライン）のセルに対してのみペースト可能です', 'warning');
      return;
    }

    try {
      const sourceTimeKey = internalClipboard.columnId.replace('time_', '');
      const targetTimeKey = columnId.replace('time_', '');

      // Parse IDs from raw grid tags
      const extractIds = (rawId: string) => {
        let assetId = rawId;
        let taskId: string | null = null;
        if (rawId.startsWith('asset_')) {
          assetId = rawId.replace('asset_', '');
        } else if (rawId.startsWith('workOrder_')) {
          const parts = rawId.split('_asset_');
          if (parts.length === 2) {
            taskId = parts[0].replace('workOrder_', '');
            assetId = parts[1];
          }
        } else if (rawId.startsWith('task_')) {
          const parts = rawId.split('_asset_');
          if (parts.length === 2) {
            taskId = parts[0].replace('task_', '');
            assetId = parts[1].split('_wol_')[0];
          }
        }
        return { assetId, taskId };
      };

      const source = extractIds(internalClipboard.rowId);
      const target = extractIds(rowId);

      // Extract raw event pool
      const allLines = workOrderLineManagerRef.current.getAllWorkOrderLines();

      const sourceLines = allLines.filter(line => {
        if (line.AssetId !== source.assetId) return false;
        const date = typeof line.PlanScheduleStart === 'string'
          ? new Date(line.PlanScheduleStart)
          : line.PlanScheduleStart;
        if (isNaN(date.getTime())) return false;

        return getTimeKey(date, timeScale) === sourceTimeKey;
      });

      // Filter by specific task if copied from WorkOrder-based mode
      const linesToCopy = source.taskId
        ? sourceLines.filter(l => l.WorkOrderId === source.taskId)
        : sourceLines;

      if (linesToCopy.length === 0) {
        showSnackbar('コピー元期間（' + sourceTimeKey + '）に複製可能な作業明細が存在しません', 'warning');
        return;
      }

      // Deep Clone and Date Shift
      let successCount = 0;
      linesToCopy.forEach(line => {
        const originalDate = new Date(line.PlanScheduleStart);
        const shiftedStart = shiftDateByTimeScale(originalDate, sourceTimeKey, targetTimeKey, timeScale);

        const shiftedEnd = line.PlanScheduleEnd
          ? shiftDateByTimeScale(new Date(line.PlanScheduleEnd), sourceTimeKey, targetTimeKey, timeScale)
          : undefined;

        let shiftedActualStart: Date | undefined;
        let shiftedActualEnd: Date | undefined;

        if (line.ActualScheduleStart) {
          shiftedActualStart = shiftDateByTimeScale(new Date(line.ActualScheduleStart), sourceTimeKey, targetTimeKey, timeScale);
        }
        if (line.ActualScheduleEnd) {
          shiftedActualEnd = shiftDateByTimeScale(new Date(line.ActualScheduleEnd), sourceTimeKey, targetTimeKey, timeScale);
        }

        const newLine = {
          ...line,
          id: undefined, // Manager will assign fresh UUID
          AssetId: target.assetId,
          WorkOrderId: target.taskId || line.WorkOrderId,
          PlanScheduleStart: shiftedStart.toISOString(),
          PlanScheduleEnd: shiftedEnd ? shiftedEnd.toISOString() : undefined,
          ActualScheduleStart: shiftedActualStart ? shiftedActualStart.toISOString() : undefined,
          ActualScheduleEnd: shiftedActualEnd ? shiftedActualEnd.toISOString() : undefined
        };

        workOrderLineManagerRef.current?.createWorkOrderLine(newLine as any);
        successCount++;
      });

      if (successCount > 0) {
        handleSaveData().then(() => {
          loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
        });
        showSnackbar(`スケジュールを${successCount}件複製しました`, 'success');
      }

    } catch (error) {
      console.error('Deep copy paste failed:', error);
      showSnackbar('ペースト処理中にエラーが発生しました', 'error');
    }
  }, [internalClipboard, isServicesInitialized, timeScale, dataViewMode, loadDataFromViewModeManagerWithMode, handleSaveData]);

  // Asset selection handlers
  const handleAssetSelectionChange = (assetIds: string[]) => {
    setSelectedAssets(assetIds);
  };


  // Desktop-only layout calculations
  const containerPadding = 12;
  const mainContentWidth = '100%';

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
          loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
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
          loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
          showSnackbar('操作をやり直しました', 'info');
          announce('操作をやり直しました');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServicesInitialized, timeScale, dataViewMode, loadDataFromViewModeManagerWithMode]);

  // History state applier
  const applyHistoryState = useCallback((state: any, isUndo: boolean) => {
    if (!assetManagerRef.current || !workOrderManagerRef.current || !workOrderLineManagerRef.current || !hierarchyManagerRef.current || !undoRedoManagerRef.current) return;

    undoRedoManagerRef.current.mute();
    try {
      const { action, data } = state;
      switch (action) {
        case 'CREATE_WORK_ORDER_LINE':
          if (isUndo) workOrderLineManagerRef.current.deleteLine(data.line.id);
          else workOrderLineManagerRef.current.createLine(data.line);
          break;
        case 'DELETE_WORK_ORDER_LINE':
          if (isUndo) workOrderLineManagerRef.current.createLine(data.line);
          else workOrderLineManagerRef.current.deleteLine(data.line.id);
          break;
        case 'UPDATE_WORK_ORDER_LINE':
          if (data.previousLine && data.updatedLine) {
            workOrderLineManagerRef.current.updateLine(
               isUndo ? data.previousLine.id : data.updatedLine.id, 
               isUndo ? data.previousLine : data.updatedLine
            );
          } else if (data.previousState) {
            // Bulk update
            const targetState = isUndo ? data.previousState : data.updatedState;
            if (targetState) {
              if (targetState.workOrderLines) workOrderLineManagerRef.current.loadLines(targetState.workOrderLines);
              // Simple loadWorkOrders isn't available, but we can do it manually
              if (targetState.workOrders) {
                // Clear and recreate since WorkOrderManager doesn't have loadWorkOrders
                targetState.workOrders.forEach((wo: any) => {
                   try {
                     if (workOrderManagerRef.current!.getWorkOrder(wo.id)) {
                        workOrderManagerRef.current!.updateWorkOrder(wo.id, wo);
                     } else {
                        workOrderManagerRef.current!.createWorkOrder(wo);
                     }
                   } catch (e) {
                      // fallback
                   }
                });
              }
            }
          }
          break;
        case 'UPDATE_WORK_ORDER':
          if (data.previousWo && data.updatedWo) {
             workOrderManagerRef.current.updateWorkOrder(
               isUndo ? data.previousWo.id : data.updatedWo.id,
               isUndo ? data.previousWo : data.updatedWo
             );
          }
          break;
        case 'CREATE_WORK_ORDER':
          if (isUndo) workOrderManagerRef.current.deleteWorkOrder(data.wo.id);
          else workOrderManagerRef.current.createWorkOrder(data.wo);
          break;
        case 'DELETE_WORK_ORDER':
          if (isUndo) workOrderManagerRef.current.createWorkOrder(data.wo);
          else workOrderManagerRef.current.deleteWorkOrder(data.wo.id);
          break;
        case 'UPDATE_ASSET':
          if (data.isCreate) {
             if (isUndo) assetManagerRef.current.deleteAsset(data.asset.id);
             else assetManagerRef.current.createAsset(data.asset);
          } else if (data.previousAsset && data.updatedAsset) {
             assetManagerRef.current.updateAsset(
               isUndo ? data.previousAsset.id : data.updatedAsset.id,
               isUndo ? data.previousAsset : data.updatedAsset
             );
          }
          break;
        case 'UPDATE_HIERARCHY':
          hierarchyManagerRef.current.setHierarchyDefinition(isUndo ? data.previousHierarchy : data.updatedHierarchy);
          break;
      }

      viewModeManagerRef.current?.updateData(
        assetManagerRef.current.getAllAssets(),
        workOrderLineManagerRef.current.getAllWorkOrderLines(),
        hierarchyManagerRef.current.getHierarchyDefinition(),
        workOrderManagerRef.current.getAllWorkOrders()
      );
    } catch (err) {
      console.error("Undo/Redo apply error:", err);
    } finally {
      undoRedoManagerRef.current.unmute();
    }
  }, []);

  // Handle explicit Undo from UI
  const handleUndo = useCallback(() => {
    if (undoRedoManagerRef.current?.canUndo()) {
      const state = undoRedoManagerRef.current.undo();
      if (state) {
         applyHistoryState(state, true);
         loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
         showSnackbar('操作を元に戻しました', 'info');
         announce('操作を元に戻しました');
      }
    }
  }, [dataViewMode, timeScale, loadDataFromViewModeManagerWithMode, applyHistoryState]);

  // Handle explicit Redo from UI
  const handleRedo = useCallback(() => {
    if (undoRedoManagerRef.current?.canRedo()) {
      const state = undoRedoManagerRef.current.redo();
      if (state) {
         applyHistoryState(state, false);
         loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
         showSnackbar('操作をやり直しました', 'info');
         announce('操作をやり直しました');
      }
    }
  }, [dataViewMode, timeScale, loadDataFromViewModeManagerWithMode, applyHistoryState]);

  // Handle grid scroll state sync
  const handleGridScroll = useCallback((dateKey: string) => {
    if (currentVisibleDate !== dateKey) {
      setCurrentVisibleDate(dateKey);
    }
  }, [currentVisibleDate]);

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
          {displayedMaintenanceData.length === 0 ? (
            <EmptyState onImportClick={handleImportDataClick} />
          ) : (
            <div
              ref={gridRef}
              className="grid-container-responsive grid-performance"
              style={{
                paddingLeft: `${containerPadding}px`,
                paddingRight: `${containerPadding}px`,
                paddingTop: '54px',
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

              <AnimatePresence>
                {showGraph && (
                  <div style={{ flex: 1, paddingBottom: '16px', overflow: 'hidden' }}>
                    <CostTrendGraph data={displayedMaintenanceData} timeHeaders={timeHeaders} />
                  </div>
                )}
              </AnimatePresence>

              <div style={{ flex: showGraph ? 1 : 'unset', minHeight: 0, height: showGraph ? 'unset' : '100%', overflow: 'hidden' }}>
                {/* Enhanced Maintenance Grid - Production Version */}
                <EnhancedMaintenanceGrid
                data={displayedMaintenanceData}
                timeHeaders={timeHeaders}
                onCellEdit={handleCellEdit}
                onSpecificationEdit={handleSpecificationEdit}
                onSpecificationColumnReorder={handleSpecificationColumnReorder}
                onUpdateItem={handleUpdateItem}
                onJumpToDate={handleJumpToDate}
                onScroll={handleGridScroll}
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
                workOrders={workOrderManagerRef.current?.getAllWorkOrders() || []}
                assets={assetManagerRef.current?.getAllAssets() || []}
                associations={workOrderLineManagerRef.current?.getAllWorkOrderLines() || []}
                hierarchy={hierarchyManagerRef.current?.getHierarchyDefinition()}
                onHierarchyEdit={handleHierarchyEdit}
                selectedAssets={selectedAssets}
                onAssetEdit={handleAssetEdit}
                onCellCopy={handleCellCopy}
                onCellPaste={handleCellPaste}
                // Header props - restored to original structure
                onSearchChange={setSearchTerm}
                uniqueTasks={uniqueTasks}
                selectedTasks={selectedTasks}
                onSelectedTasksChange={setSelectedTasks}
                uniqueBomCodes={uniqueBomCodes}
                selectedBomCodes={selectedBomCodes}
                onSelectedBomCodesChange={setSelectedBomCodes}
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
                onLevel3FilterChange={(value) => {
                  const val = typeof value === 'string' ? value : (value as any).target?.value;
                  setLevel3Filter(val);
                }}
                hierarchyFilterTree={hierarchyFilterTree}
                level2Options={level2Options}
                level3Options={level3Options}
                assetClassification={dataStoreRef.current?.getAssetClassification()}
                workOrderClassifications={dataStoreRef.current?.getWorkOrderClassifications() || []}
                classificationFilter={classificationFilter}
                onClassificationFilterChange={setClassificationFilter}
                woClassificationFilter={woClassificationFilter}
                onWoClassificationFilterChange={setWoClassificationFilter}
                onAddYear={handleAddYearClick}
                onDeleteYear={handleDeleteYearClick}
                onExportData={handleExportData}
                onImportData={handleImportDataClick}
                onResetData={handleResetDataClick}
                onShowBomCodeChange={setShowBomCode}
                onDisplayModeChange={setDisplayMode}
                projectName={projectName}
                onProjectNameChange={handleProjectNameChange}
              />
              </div>
            </div>
          )}
        </div>

        {/* Global Floating Agent Bar */}
        <AgentBar
          timeHeaders={timeHeaders}
          activeTimeHeaders={activeTimeHeaders}
          currentVisibleDate={currentVisibleDate}
          showGraph={showGraph}
          onToggleGraph={() => setShowGraph(!showGraph)}
          onTimeScaleChange={(scale) => {
            setTimeScale(scale);
            loadDataFromViewModeManager(scale);
          }}
          timeScale={timeScale}
          onDisplayModeChange={setDisplayMode}
          displayMode={displayMode}
          onDataViewModeChange={handleDataViewModeChange}
          dataViewMode={dataViewMode}
          onImportData={handleImportDataClick}
          onExportData={handleExportData}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onHierarchyEdit={() => setIsHierarchyManagerOpen(true)}
          onAssetClassificationEdit={() => setIsAssetClassificationEditOpen(true)}
          onWorkOrderClassificationEdit={() => setIsWorkOrderClassificationEditOpen(true)}
          onSuggestionApply={(suggestion) => {
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
            showSnackbar(`Excelファイル "${file.name}" の解析を開始します`, 'info');
          }}
          onImportComplete={(dataModel) => {
            try {
              const loadedData = dataStoreRef.current?.loadData(dataModel);
              if (loadedData && assetManagerRef.current && workOrderManagerRef.current && workOrderLineManagerRef.current && undoRedoManagerRef.current) {
                undoRedoManagerRef.current.mute();
                
                assetManagerRef.current = new AssetManager(undoRedoManagerRef.current);
                Object.values(loadedData.assets).forEach(a => assetManagerRef.current!.createAsset(a));
                workOrderManagerRef.current = new WorkOrderManager(undoRedoManagerRef.current);
                Object.values(loadedData.workOrders || {}).forEach(w => workOrderManagerRef.current!.createWorkOrder(w as any));
                workOrderLineManagerRef.current = new WorkOrderLineManager(undoRedoManagerRef.current);
                Object.values(loadedData.workOrderLines || {}).forEach(l => {
                  try { workOrderLineManagerRef.current!.createWorkOrderLine(l as any); } catch (e) { console.error('Import Line Error:', e); }
                });
                hierarchyManagerRef.current?.setHierarchyDefinition(loadedData.hierarchy || { levels: [] });
                viewModeManagerRef.current?.updateData(
                  assetManagerRef.current.getAllAssets(),
                  workOrderLineManagerRef.current.getAllWorkOrderLines(),
                  loadedData.hierarchy || { levels: [] },
                  workOrderManagerRef.current.getAllWorkOrders()
                );
                
                undoRedoManagerRef.current.unmute();
                undoRedoManagerRef.current.clear();
                
                loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
                showSnackbar('データの取り込みが完了し、画面を更新しました', 'success');
              }
            } catch (err: any) {
              showSnackbar(`インポートしたデータの反映に失敗しました: ${err.message}`, 'error');
            }
          }}
          dataContext={{
            assets: assetManagerRef.current?.getAllAssets() || [],
            workOrders: workOrderManagerRef.current?.getAllWorkOrders() || [],
            workOrderLines: workOrderLineManagerRef.current?.getAllWorkOrderLines() || [],
          }}
        />

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
            workOrderId={taskEditTaskId}
            associations={(taskEditAssetId
              ? workOrderLineManagerRef.current?.getWorkOrderLinesByAsset(taskEditAssetId)
              : taskEditTaskId
                ? workOrderLineManagerRef.current?.getAllWorkOrderLines().filter(l => l.WorkOrderId === taskEditTaskId)
                : []) || []}
            allWorkOrders={workOrderManagerRef.current?.getAllWorkOrders() || []}
            allAssets={assetManagerRef.current?.getAllAssets() || []}
            allWorkOrderLines={workOrderLineManagerRef.current?.getAllWorkOrderLines() || []}
            onSave={handleSaveTaskEdits}
            onUpdateWorkOrder={handleUpdateWorkOrder}
            onClose={handleCloseTaskEditDialog}
            readOnly={false}
            editScope={dataViewMode === 'workorder-based' ? 'single-asset' : 'single-asset'}
            dataViewMode={dataViewMode}
          />
        )}

        {/* Hierarchy Edit Dialog */}
        {hierarchyManagerRef.current && (
          <TreeClassificationEditDialog
            open={isHierarchyManagerOpen}
            title="機器階層の編集"
            definition={hierarchyManagerRef.current.getHierarchyDefinition()}
            assetCount={assetManagerRef.current?.getAllAssets().length || 0}
            assets={assetManagerRef.current?.getAllAssets() || []}
            pathKey="hierarchyPath"
            onClose={() => setIsHierarchyManagerOpen(false)}
            onSave={(newHierarchy) => {
              if (hierarchyManagerRef.current) {
                hierarchyManagerRef.current.setHierarchyDefinition({ levels: newHierarchy.levels });
                loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
                showSnackbar('階層構造情報を更新しました', 'success');
              }
            }}
            onSaveLinkedAssets={(updatedAssets) => {
              if (assetManagerRef.current) {
                undoRedoManagerRef.current?.mute();
                updatedAssets.forEach(update => {
                  assetManagerRef.current!.updateAsset(update.id, {
                    hierarchyPath: update.path
                  });
                });
                undoRedoManagerRef.current?.unmute();
                loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
                showSnackbar(`${updatedAssets.length}件の機器の階層紐づけを更新しました`, 'success');
              }
            }}
          />
        )}

        {/* Asset Classification Edit Dialog */}
        {dataStoreRef.current && (
          <TreeClassificationEditDialog
            open={isAssetClassificationEditOpen}
            title="機器分類の編集"
            definition={dataStoreRef.current.getAssetClassification()}
            assetCount={assetManagerRef.current?.getAllAssets().length || 0}
            assets={assetManagerRef.current?.getAllAssets() || []}
            pathKey="classificationPath"
            onClose={() => setIsAssetClassificationEditOpen(false)}
            onSave={(newClassification) => {
              if (dataStoreRef.current) {
                const currentData = dataStoreRef.current.exportData();
                currentData.assetClassification = newClassification;
                dataStoreRef.current.loadData(currentData);
                showSnackbar('機器分類マスタを更新しました', 'success');
              }
            }}
            onSaveLinkedAssets={(updatedAssets) => {
              if (assetManagerRef.current) {
                undoRedoManagerRef.current?.mute();
                updatedAssets.forEach(update => {
                  assetManagerRef.current!.updateAsset(update.id, {
                    classificationPath: update.path
                  });
                });
                undoRedoManagerRef.current?.unmute();
                loadDataFromViewModeManagerWithMode(dataViewMode, timeScale);
                showSnackbar(`${updatedAssets.length}件の機器の分類紐づけを更新しました`, 'success');
              }
            }}
          />
        )}

        {/* Work Order Classification Edit Dialog */}
        {dataStoreRef.current && (
          <WorkOrderClassificationEditDialog
            open={isWorkOrderClassificationEditOpen}
            onClose={() => setIsWorkOrderClassificationEditOpen(false)}
            classifications={dataStoreRef.current.getWorkOrderClassifications()}
            workOrders={workOrderManagerRef.current?.getAllWorkOrders() || []}
            onSave={(newClassifications) => {
              if (dataStoreRef.current) {
                // Update datastore
                const currentData = dataStoreRef.current.exportData();
                currentData.workOrderClassifications = newClassifications;
                dataStoreRef.current.loadData(currentData);
                showSnackbar('作業分類マスタを更新しました', 'success');
              }
            }}
          />
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => handleSnackbarClose()}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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
