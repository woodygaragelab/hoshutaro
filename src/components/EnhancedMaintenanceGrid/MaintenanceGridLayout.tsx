import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState, DisplayAreaConfig } from './types';
import Resizer from './Resizer';
// CommonEditLogic removed - not used as JSX component
import TagNoEditDialog from '../TagNoEditDialog/TagNoEditDialog';
import SpecificationEditDialog from '../SpecificationEditDialog/SpecificationEditDialog';
import { StatusValue, CostValue } from '../CommonEdit/types';
import { useKeyboardNavigation } from './keyboardNavigation';
import './MaintenanceGridLayout.css';
// import { useScrollManager } from './scrollManager';

interface MaintenanceGridLayoutProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  displayAreaConfig: DisplayAreaConfig;
  gridState: GridState;
  viewMode: 'status' | 'cost';
  groupedData?: { [key: string]: HierarchicalData[] };
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event?: React.MouseEvent<HTMLElement>) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onRowResize: (rowId: string, height: number) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange: (range: any) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onSpecificationEdit?: (rowId: string, index: number, field: 'key' | 'value', value: string) => void;
  onSpecificationColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onAssetEdit?: (assetId: string, updates: any) => void;
  hierarchy?: any;
  virtualScrolling: boolean;
  readOnly: boolean;
  onCopy?: () => Promise<void>;
  isEquipmentBasedMode?: boolean;
  isTaskBasedMode?: boolean;
  expandedWorkOrders?: Set<string>;
  onToggleWorkOrderExpanded?: (workOrderId: string) => void;
  selectedAssets?: string[];
  onPaste?: () => void;
  enableHorizontalVirtualScrolling?: boolean;
  onAssetSelectionToggle?: (assetId: string, event: React.MouseEvent<any>) => void;
  // Filter props
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
  uniqueTasks?: string[];
  selectedTasks?: string[];
  onSelectedTasksChange?: (tasks: string[]) => void;
  uniqueBomCodes?: string[];
  selectedBomCodes?: string[];
  onSelectedBomCodesChange?: (bomCodes: string[]) => void;
}
import MaintenanceTableHeader from './MaintenanceTableHeader';
import MaintenanceTableBody from './MaintenanceTableBody';

// Enhanced MaintenanceGridLayout with integrated editing dialogs
const MaintenanceGridLayoutCore: React.FC<MaintenanceGridLayoutProps> = ({
  data,
  columns,
  displayAreaConfig,
  gridState,
  viewMode,
  groupedData,
  onCellEdit,
  onCellDoubleClick,
  onColumnResize,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onSpecificationEdit,
  onSpecificationColumnReorder,
  onAssetEdit,
  hierarchy,
  virtualScrolling,
  readOnly,
  onCopy,
  onPaste,
  enableHorizontalVirtualScrolling = false,
  isEquipmentBasedMode = false,
  isTaskBasedMode = false,
  expandedWorkOrders = new Set(),
  onToggleWorkOrderExpanded,
  // Filter props
  searchTerm,
  onSearchChange,
  level1Filter,
  level2Filter,
  level3Filter,
  onLevel1FilterChange,
  onLevel2FilterChange,
  onLevel3FilterChange,
  hierarchyFilterTree,
  level2Options,
  level3Options,
  uniqueTasks,
  selectedTasks,
  onSelectedTasksChange,
  uniqueBomCodes,
  selectedBomCodes,
  onSelectedBomCodesChange,
}) => {
    // Container width for horizontal virtual scrolling
  const [containerWidth, setContainerWidth] = useState(1920);
  const containerRef = useRef<HTMLDivElement>(null);

  // Horizontal scroll position for virtual scrolling
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0);

  // Track viewMode to preserve scroll position on mode change
  const prevViewModeRef = useRef<'status' | 'cost'>(viewMode);
  const scrollPositionBeforeModeChangeRef = useRef<number>(0);

  // Update container width on resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Scroll synchronization state
  const fixedAreaRef = useRef<HTMLDivElement>(null);
  const specAreaRef = useRef<HTMLDivElement>(null);
  const maintenanceAreaRef = useRef<HTMLDivElement>(null);
  const specHeaderRef = useRef<HTMLDivElement>(null);
  const maintenanceHeaderRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Reset horizontal scroll when columns change significantly (like changing time scale)
  useEffect(() => {
    // Reset scroll state
    setHorizontalScrollLeft(0);
    scrollPositionBeforeModeChangeRef.current = 0;
    
    // Reset actual DOM scroll position
    if (maintenanceAreaRef.current) {
      maintenanceAreaRef.current.scrollLeft = 0;
    }
    if (maintenanceHeaderRef.current) {
      maintenanceHeaderRef.current.scrollLeft = 0;
    }
  }, [columns.length, isTaskBasedMode]);

  // Enhanced editing state
  const [editDialogState, setEditDialogState] = useState<{
    type: 'status' | 'cost' | 'assetDetails' | 'tagNo' | null;
    open: boolean;
    rowId: string | null;
    columnId: string | null;
    currentValue: any;
    anchorEl: HTMLElement | null;
  }>({
    type: null,
    open: false,
    rowId: null,
    columnId: null,
    currentValue: null,
    anchorEl: null,
  });

  // Desktop-only mode
  const deviceType = 'desktop';

  // Column drag state
  const [columnDragState, setColumnDragState] = useState<{
    draggedColumnIndex: number | null;
    dragOverColumnIndex: number | null;
  }>({
    draggedColumnIndex: null,
    dragOverColumnIndex: null,
  });

  const handleColumnDragStateChange = useCallback((draggedIndex: number | null, dragOverIndex: number | null) => {
    setColumnDragState({
      draggedColumnIndex: draggedIndex,
      dragOverColumnIndex: dragOverIndex,
    });
  }, []);

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation(data, columns, {
    skipNonEditable: true,
    wrapAround: false,
    allowEditOnEnter: true,
  });

  // Basic scroll management (temporarily disabled)
  // const { resetForTimeScaleChange } = useScrollManager(`maintenance-grid-${data.length}`);

  // Grid container ref for keyboard event handling
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Organize columns by area - memoized to prevent infinite loops
  const columnsByArea = useMemo(() => {
    const fixed = columns.filter(col => displayAreaConfig.fixedColumns.includes(col.id));
    const specifications = columns.filter(col =>
      displayAreaConfig.scrollableAreas.specifications?.columns.includes(col.id) || false
    );
    const maintenance = columns.filter(col =>
      displayAreaConfig.scrollableAreas.maintenance?.columns.includes(col.id) || false
    );

    return { fixed, specifications, maintenance };
  }, [columns, displayAreaConfig]);

  // Resizable area widths state
  const [fixedAreaWidth, setFixedAreaWidth] = useState<number>(250);
  const [specAreaWidth, setSpecAreaWidth] = useState<number>(400);

  // Memoize fixed columns width calculation to prevent infinite loops
  const fixedColumnsWidth = useMemo(() => {
    return columnsByArea.fixed?.reduce((sum, col) => sum + col.width, 0) || 250;
  }, [columnsByArea.fixed]);

  // Memoize spec area width to prevent infinite loops
  const specAreaConfigWidth = useMemo(() => {
    return displayAreaConfig.scrollableAreas.specifications?.width || 400;
  }, [displayAreaConfig.scrollableAreas.specifications?.width]);

  // Initialize area widths based on columns and config, and view modes, to ensure alignment upon mode switch
  // Do NOT include fixedColumnsWidth to prevent resetting user-adjusted widths during regular renders
  useEffect(() => {
    setFixedAreaWidth(fixedColumnsWidth);
    setSpecAreaWidth(specAreaConfigWidth);
  }, [isEquipmentBasedMode, isTaskBasedMode, viewMode]);

  // Basic scroll synchronization state (currently unused)
  // const [scrollPosition, setScrollPosition] = useState({ top: 0, left: 0 });

  // Handle scroll synchronization between areas
  const handleScrollSync = useCallback((scrollTop: number, sourceArea: 'fixed' | 'spec' | 'maintenance') => {
    if (isScrollingSyncRef.current) return;

    isScrollingSyncRef.current = true;

    // Use requestAnimationFrame for smoother scroll synchronization
    requestAnimationFrame(() => {
      // Sync scroll positions
      if (sourceArea !== 'fixed' && fixedAreaRef.current) {
        fixedAreaRef.current.scrollTop = scrollTop;
      }
      if (sourceArea !== 'spec' && specAreaRef.current) {
        specAreaRef.current.scrollTop = scrollTop;
      }
      if (sourceArea !== 'maintenance' && maintenanceAreaRef.current) {
        maintenanceAreaRef.current.scrollTop = scrollTop;
      }

      // Reset sync flag after animation frame
      isScrollingSyncRef.current = false;
    });
  }, []);

  // Preserve scroll position when viewMode changes
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      // ViewMode changed - restore scroll position
      const maintenanceArea = maintenanceAreaRef.current;
      const maintenanceHeader = maintenanceHeaderRef.current;

      if (maintenanceArea && maintenanceHeader) {
        // Calculate which column index was visible before the change
        const oldColumnWidth = prevViewModeRef.current === 'cost' ? 120 : 80;
        const newColumnWidth = viewMode === 'cost' ? 120 : 80;

        // Calculate the column index that was at the left edge of the viewport
        const visibleColumnIndex = Math.floor(scrollPositionBeforeModeChangeRef.current / oldColumnWidth);

        // Calculate the new scroll position to show the same column
        const newScrollLeft = visibleColumnIndex * newColumnWidth;

        // Apply the new scroll position
        requestAnimationFrame(() => {
          if (maintenanceArea) {
            maintenanceArea.scrollLeft = newScrollLeft;
          }
          if (maintenanceHeader) {
            maintenanceHeader.scrollLeft = newScrollLeft;
          }
          setHorizontalScrollLeft(newScrollLeft);
        });
      }

      prevViewModeRef.current = viewMode;
    }
  }, [viewMode]);

  // Listen for jump to column events and handle delayed grid updates due to dynamic time windowing
  const pendingJumpRef = useRef<string | null>(null);

  const executeJump = useCallback((header: string) => {
    // Find the column by header
    const targetColumn = columns.find(col => col.id === `time_${header}`);
    if (!targetColumn) return false;

    // Determine which area the column belongs to
    const isInSpecArea = columnsByArea.specifications.some(col => col.id === targetColumn.id);
    const isInMaintenanceArea = columnsByArea.maintenance.some(col => col.id === targetColumn.id);

    if (!isInSpecArea && !isInMaintenanceArea) return false;

    // Calculate scroll position within the scrollable area (excluding fixed columns)
    let scrollLeft = 0;
    const targetArea = isInSpecArea ? columnsByArea.specifications : columnsByArea.maintenance;

    for (let i = 0; i < targetArea.length; i++) {
      const col = targetArea[i];
      if (col.id === targetColumn.id) break;
      scrollLeft += gridState.columnWidths[col.id] || col.width;
    }

    // Scroll to the column in the appropriate scrollable area
    if (isInMaintenanceArea && maintenanceAreaRef.current) {
      maintenanceAreaRef.current.scrollLeft = scrollLeft;
      if (maintenanceHeaderRef.current) maintenanceHeaderRef.current.scrollLeft = scrollLeft;
    }
    if (isInSpecArea && specAreaRef.current) {
      specAreaRef.current.scrollLeft = scrollLeft;
      if (specHeaderRef.current) specHeaderRef.current.scrollLeft = scrollLeft;
    }

    return true;
  }, [columns, gridState.columnWidths, columnsByArea]);

  useEffect(() => {
    const handleJumpToColumn = (event: CustomEvent) => {
      const { header } = event.detail;
      
      // Attempt jump immediately in case columns are already in view
      const success = executeJump(header);
      
      // If failed, column not rendered yet. Store pending jump to execute when columns update.
      if (!success) {
        pendingJumpRef.current = header;
      }
    };

    window.addEventListener('jumpToColumn', handleJumpToColumn as EventListener);
    return () => window.removeEventListener('jumpToColumn', handleJumpToColumn as EventListener);
  }, [executeJump]);

  // Execute pending jump once columns have updated
  useEffect(() => {
    if (pendingJumpRef.current) {
      const success = executeJump(pendingJumpRef.current);
      if (success) {
        pendingJumpRef.current = null;
      }
    }
  }, [columns, executeJump]);

  // Determine layout based on display mode
  const layoutStyle = useMemo(() => {
    const { mode } = displayAreaConfig;

    if (mode === 'both') {
      return {
        display: 'flex',
        flexDirection: 'row' as const,
        height: '100%',
        overflow: 'hidden'
      };
    }

    return {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      overflow: 'auto'
    };
  }, [displayAreaConfig.mode]);

  // Handle resizing of areas
  const handleFixedAreaResize = useCallback((delta: number) => {
    setFixedAreaWidth(prev => Math.max(150, Math.min(600, prev + delta)));
  }, []);

  const handleSpecAreaResize = useCallback((delta: number) => {
    setSpecAreaWidth(prev => Math.max(200, Math.min(800, prev + delta)));
  }, []);

  // Enhanced cell double-click handler for editing dialogs
  const handleCellDoubleClickInternal = useCallback((
    rowId: string,
    columnId: string,
    event: React.MouseEvent<HTMLElement>
  ) => {
    
    // Check if any dropdown/menu is open - if so, don't handle the double click
    const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
    if (hasOpenMenu) {
            return;
    }

    if (readOnly) {
            return;
    }

    const column = columns.find(col => col.id === columnId);

    // Remove editable check for dialog-based editing
    // Dialog-based editing should work regardless of the editable flag
    // The editable flag is for inline editing only

    // First try exact ID match
    let item = data.find(d => d.id === rowId);

    // If not found and in task-based mode, try alternative matching strategies
    if (!item && isTaskBasedMode) {
      // Strategy 1: Match by taskId and assetId components
      if (rowId.startsWith('task_') && rowId.includes('_asset_')) {
        const parts = rowId.split('_asset_');
        const taskPart = parts[0].replace('task_', '');
        const assetPart = parts[1];

        item = data.find(d => {
          const itemData = d as any;
          return itemData.taskId === taskPart && itemData.assetId === assetPart;
        });

        if (item) {
                  }
      }

      // Strategy 2: Match asset rows
      if (!item && rowId.startsWith('asset_')) {
        const assetId = rowId.replace('asset_', '');
        item = data.find(d => {
          const itemData = d as any;
          return itemData.assetId === assetId && !itemData.taskId;
        });

        if (item) {
                  }
      }
    }

    if (!item) {
            return;
    }

    
    let editType: 'assetDetails' | 'tagNo' | null = null;
    let currentValue: any = null;

    // Determine edit type and current value based on column
    if (isEquipmentBasedMode && (columnId === 'task' || columnId === 'bomCode' || columnId.startsWith('spec_'))) {
      editType = 'assetDetails';
      currentValue = item;
    } else if (columnId === 'bomCode') {
      editType = 'tagNo';
      currentValue = item.bomCode;
    } else if (columnId === 'task') {
      // In task-based mode, no edit for task currently (needs complex logic)
    }

    if (editType) {
      
      setEditDialogState({
        type: editType,
        open: true,
        rowId,
        columnId,
        currentValue,
        anchorEl: deviceType === 'desktop' ? event.currentTarget : null,
      });

      // Update editing cell state
      onEditingCellChange(rowId, columnId);
    } else {
          }
  }, [readOnly, columns, data, viewMode, deviceType, onEditingCellChange]);

  // Wrapper that calls both external and internal handlers
  const handleCellDoubleClick = useCallback((
    rowId: string,
    columnId: string,
    event: React.MouseEvent<HTMLElement>
  ) => {
    
    // First, call external handler if provided (for special mode handling)
    if (onCellDoubleClick) {
      onCellDoubleClick(rowId, columnId, event);
          }

    // For time columns, check if the external handler explicitly stopped propagation
    // External handler calls stopPropagation() on success, so we skip internal handler only then
    if (columnId.startsWith('time_')) {
      if (!event.isPropagationStopped()) {
        // External handler did not handle it (or no external handler), use internal handler as fallback
                handleCellDoubleClickInternal(rowId, columnId, event);
      } else {
        // External handler successfully processed the event
              }
    } else {
      // Non-time columns: only skip if propagation was stopped
      if (!event.isPropagationStopped()) {
                handleCellDoubleClickInternal(rowId, columnId, event);
      } else {
              }
    }
  }, [onCellDoubleClick, handleCellDoubleClickInternal]);

  // Handle dialog save with layout stability
  const handleDialogSave = useCallback((value: any) => {
    if (!editDialogState.rowId || !editDialogState.columnId) return;

    const { rowId, columnId, type } = editDialogState;

    
    // Prevent layout shifts by batching all updates
    const performUpdate = () => {
      if (type === 'tagNo') {
        const tagNo = value as string;
        const item = data.find(d => d.id === rowId);
        if (item) {
          onUpdateItem({
            ...item,
            bomCode: tagNo,
          });
        }
      } else if (type === 'status') {
        const statusValue = value as StatusValue;
        onCellEdit(rowId, columnId, {
          planned: statusValue.planned,
          actual: statusValue.actual,
        });
      } else if (type === 'cost') {
        const costValue = value as CostValue;
        // コスト入力時に星取表のステータスを自動更新
        const planned = (costValue.planCost || 0) > 0;
        const actual = (costValue.actualCost || 0) > 0;
        onCellEdit(rowId, columnId, {
          ...costValue,
          planned,
          actual
        });
      } else if (type === 'assetDetails') {
        if (onAssetEdit) {
          // assetId is usually the rowId for assets in equipment-based mode (stripped of "asset_" if present)
          const actualAssetId = rowId.startsWith('asset_') ? rowId.replace('asset_', '') : rowId;
          onAssetEdit(actualAssetId, value);
        }
      }
    };

    // Use React's unstable_batchedUpdates to prevent multiple re-renders
    // This is critical for preventing layout shifts
    if (typeof (React as any).unstable_batchedUpdates === 'function') {
      (React as any).unstable_batchedUpdates(() => {
        performUpdate();

        // Close dialog in the same batch
        setEditDialogState({
          type: null,
          open: false,
          rowId: null,
          columnId: null,
          currentValue: null,
          anchorEl: null,
        });

        // Clear editing state but keep selected cell
        onEditingCellChange(null, null);
      });
    } else {
      // Fallback for newer React versions
      performUpdate();

      // Close dialog
      setEditDialogState({
        type: null,
        open: false,
        rowId: null,
        columnId: null,
        currentValue: null,
        anchorEl: null,
      });

      // Clear editing state
      onEditingCellChange(null, null);
    }

      }, [editDialogState, onCellEdit, onUpdateItem, data, onEditingCellChange]);

  // Handle dialog close with minimal layout impact
  const handleDialogClose = useCallback(() => {
    
    // Use batched updates to prevent layout shifts
    if (typeof (React as any).unstable_batchedUpdates === 'function') {
      (React as any).unstable_batchedUpdates(() => {
        setEditDialogState({
          type: null,
          open: false,
          rowId: null,
          columnId: null,
          currentValue: null,
          anchorEl: null,
        });

        // Clear editing state
        onEditingCellChange(null, null);
      });
    } else {
      // Fallback for newer React versions
      setEditDialogState({
        type: null,
        open: false,
        rowId: null,
        columnId: null,
        currentValue: null,
        anchorEl: null,
      });

      onEditingCellChange(null, null);
    }

      }, [onEditingCellChange]);

  // Enhanced column resize with improved performance
  const handleEnhancedColumnResize = useCallback((columnId: string, width: number) => {
    // Debounce resize events for better performance
    const debouncedResize = setTimeout(() => {
      onColumnResize(columnId, width);
    }, 16); // ~60fps

    return () => clearTimeout(debouncedResize);
  }, [onColumnResize]);

  // Copy & Paste handlers (delegated to parent)
  const handleCopy = useCallback(async () => {
    if (onCopy) {
      await onCopy();
    }
  }, [onCopy]);

  const handlePaste = useCallback(async () => {
    if (onPaste) {
      await onPaste();
    }
  }, [onPaste]);

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentRowId = gridState.selectedCell?.rowId || null;
    const currentColumnId = gridState.selectedCell?.columnId || null;
    const isEditing = gridState.editingCell?.rowId !== null && gridState.editingCell?.columnId !== null;

    // Handle copy & paste shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        handleCopy();
        return;
      }
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        handlePaste();
        return;
      }
    }

    // Handle escape key to cancel editing
    if (event.key === 'Escape' && isEditing) {
      event.preventDefault();
      handleDialogClose();
      return;
    }

    // Skip navigation if currently editing (except for Escape and copy/paste)
    if (isEditing && event.key !== 'Escape') {
      return;
    }

    const navigationResult = handleKeyDown(
      event.nativeEvent,
      currentRowId,
      currentColumnId,
      isEditing
    );

    if (navigationResult && navigationResult.rowId && navigationResult.columnId) {
      // Update selected cell
      onSelectedCellChange(navigationResult.rowId, navigationResult.columnId);

      // If shouldEdit is true, start editing
      if (navigationResult.shouldEdit && gridContainerRef.current) {
        const mockEvent = {
          currentTarget: gridContainerRef.current,
          preventDefault: () => { },
          stopPropagation: () => { },
        } as unknown as React.MouseEvent<HTMLElement>;

        handleCellDoubleClick(navigationResult.rowId, navigationResult.columnId, mockEvent);
      }
    }
  }, [
    gridState.selectedCell,
    gridState.editingCell,
    handleKeyDown,
    handleCopy,
    handlePaste,
    onSelectedCellChange,
    handleCellDoubleClick,
    handleDialogClose
  ]);

  // Focus management for keyboard navigation
  useEffect(() => {
    const gridContainer = gridContainerRef.current;
    if (gridContainer && !readOnly) {
      // Check if any dropdown/menu is open before focusing
      const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
      if (!hasOpenMenu) {
        gridContainer.focus();
      }
    }
  }, [readOnly]);

  // Handle focus on cell selection change
  useEffect(() => {
    if (gridState.selectedCell && gridContainerRef.current) {
      // Check if any dropdown/menu is open before focusing
      const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
      if (!hasOpenMenu) {
        gridContainerRef.current.focus();
      }
    }
  }, [gridState.selectedCell]);

  // Calculate area widths for split layout
  const areaWidths = useMemo(() => {
    const fixedWidth = fixedAreaWidth;
    const specWidth = specAreaWidth;
    const maintenanceWidth = displayAreaConfig.scrollableAreas.maintenance?.width || 0;

    return { fixedWidth, specWidth, maintenanceWidth };
  }, [fixedAreaWidth, specAreaWidth, displayAreaConfig.scrollableAreas]);

  const renderSingleArea = () => {
    // Get scrollable columns (non-fixed columns)
    const scrollableColumns = [
      ...(displayAreaConfig.mode === 'specifications' || displayAreaConfig.mode === 'both' ? columnsByArea.specifications : []),
      ...(displayAreaConfig.mode === 'maintenance' || displayAreaConfig.mode === 'both' ? columnsByArea.maintenance : [])
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
        {/* Fixed columns area */}
        <Box
          sx={{
            width: areaWidths.fixedWidth,
            minWidth: areaWidths.fixedWidth,
            maxWidth: areaWidths.fixedWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '2px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            position: 'sticky',
            left: 0,
            zIndex: 2,
            boxShadow: '2px 0 4px rgba(0,0,0,0.08)'
          }}
        >
          {/* Resizer for fixed area */}
          <Resizer
            direction="horizontal"
            onResize={handleFixedAreaResize}
            className="fixed-area-resizer"
          />
          <Box
            sx={{
              width: '100%',
              overflow: 'hidden',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#2a2a2a'
            }}
          >
            <MaintenanceTableHeader
              columns={columnsByArea.fixed}
              gridState={gridState}
              onColumnResize={handleEnhancedColumnResize}
              onColumnReorder={onSpecificationColumnReorder}
              onDragStateChange={handleColumnDragStateChange}
              enableVirtualScrolling={false}
              containerWidth={containerWidth}
              // Filter props
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              level1Filter={level1Filter}
              level2Filter={level2Filter}
              level3Filter={level3Filter}
              onLevel1FilterChange={onLevel1FilterChange}
              onLevel2FilterChange={onLevel2FilterChange}
              onLevel3FilterChange={onLevel3FilterChange}
              hierarchyFilterTree={hierarchyFilterTree}
              level2Options={level2Options}
              level3Options={level3Options}
              uniqueTasks={uniqueTasks}
              selectedTasks={selectedTasks}
              onSelectedTasksChange={onSelectedTasksChange}
              uniqueBomCodes={uniqueBomCodes}
              selectedBomCodes={selectedBomCodes}
              onSelectedBomCodesChange={onSelectedBomCodesChange}
              isTaskBasedMode={isTaskBasedMode}
            />
          </Box>
          <Box
            ref={fixedAreaRef}
            sx={{
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0,0,0,0.1)'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '4px'
              }
            }}
            onScroll={(e) => {
              const scrollTop = e.currentTarget.scrollTop;
              handleScrollSync(scrollTop, 'fixed');
            }}
          >
            <MaintenanceTableBody
              data={data}
              columns={columnsByArea.fixed}
              gridState={gridState}
              viewMode={viewMode}
              groupedData={groupedData}
              onCellEdit={onCellEdit}

              onSelectedCellChange={onSelectedCellChange}
              onEditingCellChange={onEditingCellChange}
              onUpdateItem={onUpdateItem}
              onCellDoubleClick={handleCellDoubleClick}
              virtualScrolling={virtualScrolling}
              readOnly={readOnly}
              isFixedArea={true}
              draggedColumnIndex={columnDragState.draggedColumnIndex}
              dragOverColumnIndex={columnDragState.dragOverColumnIndex}
              isEquipmentBasedMode={isEquipmentBasedMode}
              isTaskBasedMode={isTaskBasedMode}
              expandedWorkOrders={expandedWorkOrders}
              onToggleWorkOrderExpanded={onToggleWorkOrderExpanded}
            />
          </Box>
        </Box>

        {/* Scrollable area */}
        {scrollableColumns.length > 0 && (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'background.paper'
            }}
          >
            <Box
              ref={maintenanceHeaderRef}
              sx={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: '#2a2a2a',
                '&::-webkit-scrollbar': {
                  display: 'none'
                },
                scrollbarWidth: 'none',
              }}
            >
              <MaintenanceTableHeader
                columns={scrollableColumns}
                gridState={gridState}
                onColumnResize={handleEnhancedColumnResize}
                onColumnReorder={onSpecificationColumnReorder}
                onDragStateChange={handleColumnDragStateChange}
                enableVirtualScrolling={enableHorizontalVirtualScrolling}
                containerWidth={containerWidth}
                scrollLeft={horizontalScrollLeft}
              />
            </Box>
            <Box
              ref={maintenanceAreaRef}
              sx={{
                overflow: 'auto',
                flex: 1,
                '&::-webkit-scrollbar': {
                  width: '8px',
                  height: '8px'
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'rgba(0,0,0,0.1)'
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: '4px'
                }
              }}
              onScroll={(e) => {
                const scrollTop = e.currentTarget.scrollTop;
                const scrollLeft = e.currentTarget.scrollLeft;
                handleScrollSync(scrollTop, 'maintenance');

                // Save scroll position before viewMode change
                scrollPositionBeforeModeChangeRef.current = scrollLeft;

                // Update horizontal scroll position for virtual scrolling
                setHorizontalScrollLeft(scrollLeft);

                // Sync header horizontal scroll
                if (maintenanceHeaderRef.current) {
                  maintenanceHeaderRef.current.scrollLeft = scrollLeft;
                }
              }}
            >
              <MaintenanceTableBody
                data={data}
                columns={scrollableColumns}
                gridState={gridState}
                viewMode={viewMode}
                groupedData={groupedData}
                onCellEdit={onCellEdit}

                onSelectedCellChange={onSelectedCellChange}
                onEditingCellChange={onEditingCellChange}
                onUpdateItem={onUpdateItem}
                onCellDoubleClick={handleCellDoubleClick}
                virtualScrolling={virtualScrolling}
                readOnly={readOnly}
                draggedColumnIndex={columnDragState.draggedColumnIndex}
                dragOverColumnIndex={columnDragState.dragOverColumnIndex}
                enableHorizontalVirtualScrolling={enableHorizontalVirtualScrolling}
                containerWidth={containerWidth}
                scrollLeft={horizontalScrollLeft}
                isEquipmentBasedMode={isEquipmentBasedMode}
                isTaskBasedMode={isTaskBasedMode}
                expandedWorkOrders={expandedWorkOrders}
                onToggleWorkOrderExpanded={onToggleWorkOrderExpanded}
              />
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderSplitAreas = () => {
    return (
      <Box sx={layoutStyle}>
        {/* Fixed columns area - Equipment list */}
        <Box
          sx={{
            width: areaWidths.fixedWidth,
            minWidth: areaWidths.fixedWidth,
            maxWidth: areaWidths.fixedWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '2px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            position: 'sticky',
            left: 0,
            zIndex: 2,
            boxShadow: '2px 0 4px rgba(0,0,0,0.08)'
          }}
        >
          {/* Resizer for fixed area */}
          <Resizer
            direction="horizontal"
            onResize={handleFixedAreaResize}
            className="fixed-area-resizer"
          />
          <Box
            sx={{
              width: '100%',
              overflow: 'hidden',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#2a2a2a'
            }}
          >
            <MaintenanceTableHeader
              columns={columnsByArea.fixed}
              gridState={gridState}
              onColumnResize={handleEnhancedColumnResize}
            />
          </Box>
          <Box
            ref={fixedAreaRef}
            sx={{
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              '&::-webkit-scrollbar': {
                width: '8px'
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0,0,0,0.1)'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '4px'
              }
            }}
            onScroll={(e) => {
              const scrollTop = e.currentTarget.scrollTop;
              handleScrollSync(scrollTop, 'fixed');
            }}
          >
            <MaintenanceTableBody
              data={data}
              columns={columnsByArea.fixed}
              gridState={gridState}
              viewMode={viewMode}
              groupedData={groupedData}
              onCellEdit={onCellEdit}

              onSelectedCellChange={onSelectedCellChange}
              onEditingCellChange={onEditingCellChange}
              onUpdateItem={onUpdateItem}
              onCellDoubleClick={handleCellDoubleClick}
              virtualScrolling={virtualScrolling}
              readOnly={readOnly}
              isFixedArea={true}
              draggedColumnIndex={columnDragState.draggedColumnIndex}
              dragOverColumnIndex={columnDragState.dragOverColumnIndex}
              isEquipmentBasedMode={isEquipmentBasedMode}
              isTaskBasedMode={isTaskBasedMode}
              expandedWorkOrders={expandedWorkOrders}
              onToggleWorkOrderExpanded={onToggleWorkOrderExpanded}
            />
          </Box>
        </Box>

        {/* Scrollable areas container */}
        <Box sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0, // Allow shrinking
          overflow: 'auto'
        }}>
          {/* Specifications area */}
          {displayAreaConfig.scrollableAreas.specifications?.visible && (
            <Box
              sx={{
                width: displayAreaConfig.scrollableAreas.maintenance?.visible ?
                  `${areaWidths.specWidth}px` : '100%',
                minWidth: displayAreaConfig.scrollableAreas.maintenance?.visible ?
                  `${areaWidths.specWidth}px` : 'auto',
                maxWidth: displayAreaConfig.scrollableAreas.maintenance?.visible ?
                  `${areaWidths.specWidth}px` : 'none',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: displayAreaConfig.scrollableAreas.maintenance?.visible ? '1px solid' : 'none',
                borderColor: 'divider',
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                position: 'relative',
                boxShadow: 'none'
              }}
            >
              {/* Resizer for specifications area (only show when maintenance area is also visible) */}
              {displayAreaConfig.scrollableAreas.maintenance?.visible && (
                <Resizer
                  direction="horizontal"
                  onResize={handleSpecAreaResize}
                  className="spec-area-resizer"
                />
              )}
              <Box
                ref={specHeaderRef}
                sx={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: '#2a2a2a',
                  '&::-webkit-scrollbar': {
                    display: 'none'
                  },
                  scrollbarWidth: 'none',
                }}
              >
                <MaintenanceTableHeader
                  columns={columnsByArea.specifications}
                  gridState={gridState}
                  onColumnResize={handleEnhancedColumnResize}
                  onColumnReorder={onSpecificationColumnReorder}
                  onDragStateChange={handleColumnDragStateChange}
                  enableVirtualScrolling={enableHorizontalVirtualScrolling}
                  containerWidth={containerWidth}
                  scrollLeft={horizontalScrollLeft}
                />
              </Box>
              <Box
                ref={specAreaRef}
                sx={{
                  overflow: 'auto',
                  flex: 1,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                    height: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.1)'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px'
                  }
                }}
                onScroll={(e) => {
                  const scrollTop = e.currentTarget.scrollTop;
                  const scrollLeft = e.currentTarget.scrollLeft;
                  handleScrollSync(scrollTop, 'spec');

                  // Update horizontal scroll position for virtual scrolling
                  setHorizontalScrollLeft(scrollLeft);

                  // Sync header horizontal scroll
                  if (specHeaderRef.current) {
                    specHeaderRef.current.scrollLeft = scrollLeft;
                  }
                }}
              >
                <MaintenanceTableBody
                  data={data}
                  columns={columnsByArea.specifications}
                  gridState={gridState}
                  viewMode={viewMode}
                  groupedData={groupedData}
                  onCellEdit={onCellEdit}

                  onSelectedCellChange={onSelectedCellChange}
                  onEditingCellChange={onEditingCellChange}
                  onUpdateItem={onUpdateItem}
                  onCellDoubleClick={handleCellDoubleClick}
                  virtualScrolling={virtualScrolling}
                  readOnly={readOnly}
                  draggedColumnIndex={columnDragState.draggedColumnIndex}
                  dragOverColumnIndex={columnDragState.dragOverColumnIndex}
                  enableHorizontalVirtualScrolling={enableHorizontalVirtualScrolling}
                  containerWidth={containerWidth}
                  scrollLeft={horizontalScrollLeft}
                  isEquipmentBasedMode={isEquipmentBasedMode}
                  isTaskBasedMode={isTaskBasedMode}
                  expandedWorkOrders={expandedWorkOrders}
                  onToggleWorkOrderExpanded={onToggleWorkOrderExpanded}
                />
              </Box>
            </Box>
          )}

          {/* Maintenance area */}
          {displayAreaConfig.scrollableAreas.maintenance?.visible && (
            <Box
              sx={{
                flex: 1,
                minWidth: `${Math.max(displayAreaConfig.scrollableAreas.maintenance?.width || 0, columnsByArea.maintenance.length * 80)}px`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'background.paper'
              }}
            >
              <Box
                ref={maintenanceHeaderRef}
                sx={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: '#2a2a2a',
                  '&::-webkit-scrollbar': {
                    display: 'none'
                  },
                  scrollbarWidth: 'none',
                }}
              >
                <MaintenanceTableHeader
                  columns={columnsByArea.maintenance}
                  gridState={gridState}
                  onColumnResize={handleEnhancedColumnResize}
                  onColumnReorder={onSpecificationColumnReorder}
                  onDragStateChange={handleColumnDragStateChange}
                  enableVirtualScrolling={enableHorizontalVirtualScrolling}
                  containerWidth={containerWidth}
                  scrollLeft={horizontalScrollLeft}
                />
              </Box>
              <Box
                ref={maintenanceAreaRef}
                sx={{
                  overflow: 'auto',
                  flex: 1,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                    height: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.1)'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px'
                  }
                }}
                onScroll={(e) => {
                  const scrollTop = e.currentTarget.scrollTop;
                  const scrollLeft = e.currentTarget.scrollLeft;
                  handleScrollSync(scrollTop, 'maintenance');

                  // Save scroll position before viewMode change
                  scrollPositionBeforeModeChangeRef.current = scrollLeft;

                  // Update horizontal scroll position for virtual scrolling
                  setHorizontalScrollLeft(scrollLeft);

                  // Sync header horizontal scroll
                  if (maintenanceHeaderRef.current) {
                    maintenanceHeaderRef.current.scrollLeft = scrollLeft;
                  }
                }}
              >
                <MaintenanceTableBody
                  data={data}
                  columns={columnsByArea.maintenance}
                  gridState={gridState}
                  viewMode={viewMode}
                  groupedData={groupedData}
                  onCellEdit={onCellEdit}

                  onSelectedCellChange={onSelectedCellChange}
                  onEditingCellChange={onEditingCellChange}
                  onUpdateItem={onUpdateItem}
                  onCellDoubleClick={handleCellDoubleClick}
                  virtualScrolling={virtualScrolling}
                  readOnly={readOnly}
                  draggedColumnIndex={columnDragState.draggedColumnIndex}
                  dragOverColumnIndex={columnDragState.dragOverColumnIndex}
                  enableHorizontalVirtualScrolling={enableHorizontalVirtualScrolling}
                  containerWidth={containerWidth}
                  scrollLeft={horizontalScrollLeft}
                  isEquipmentBasedMode={isEquipmentBasedMode}
                  isTaskBasedMode={isTaskBasedMode}
                  expandedWorkOrders={expandedWorkOrders}
                  onToggleWorkOrderExpanded={onToggleWorkOrderExpanded}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      ref={(el: HTMLDivElement | null) => {
        gridContainerRef.current = el;
        containerRef.current = el;
      }}
      className={`maintenance-grid-container ${editDialogState.open ? 'dialog-open' : ''}`}
      sx={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        margin: 0,
        padding: 0,
        contain: 'layout style',
        '&:focus': {
          outline: 'none',
        }
      }}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKeyboardNavigation}
    >
      {displayAreaConfig.mode === 'both' ? renderSplitAreas() : renderSingleArea()}

      {editDialogState.type === 'tagNo' && (
        <TagNoEditDialog
          open={editDialogState.open}
          tagNo={editDialogState.currentValue}
          onSave={handleDialogSave}
          onClose={handleDialogClose}
          readOnly={readOnly}
        />
      )}

      {editDialogState.type === 'assetDetails' && (
        <SpecificationEditDialog
          open={editDialogState.open}
          specifications={editDialogState.currentValue?.specifications || []}
          onSave={(specs) => handleDialogSave({ specifications: specs })}
          onClose={handleDialogClose}
          anchorEl={editDialogState.anchorEl}
          readOnly={readOnly}
        />
      )}
    </Box>
  );
};

// Wrapper component that provides CommonEditLogic context
export const MaintenanceGridLayout: React.FC<MaintenanceGridLayoutProps> = (props) => {
  const handleValidationError = useCallback((error: any) => {
    console.error('Validation error:', error);
    // TODO: Show user-friendly error message
  }, []);

  // Convert the onSpecificationEdit to match the expected interface
  const handleSpecificationEdit = useCallback((rowId: string, specIndex: number, key: string, value: string) => {
    // For now, we'll handle this differently since the original interface expects field/value
    // This is a temporary adapter until we can update the interface
    if (props.onSpecificationEdit) {
      if (key === 'key') {
        props.onSpecificationEdit(rowId, specIndex, 'key', value);
      } else {
        props.onSpecificationEdit(rowId, specIndex, 'value', value);
      }
    }
  }, [props]);

  // Create device detection
  const deviceDetection = useMemo(() => ({
    type: 'desktop' as const,
    screenSize: { width: window.innerWidth, height: window.innerHeight },
    orientation: window.innerWidth > window.innerHeight ? 'landscape' as const : 'portrait' as const,
    touchCapabilities: {
      hasTouch: 'ontouchstart' in window,
      hasHover: window.matchMedia('(hover: hover)').matches,
      hasPointerEvents: 'PointerEvent' in window,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    },
    userAgent: navigator.userAgent,
  }), []);

  return <MaintenanceGridLayoutCore {...props} />;
};

export default MaintenanceGridLayout;
// force HMR reload
