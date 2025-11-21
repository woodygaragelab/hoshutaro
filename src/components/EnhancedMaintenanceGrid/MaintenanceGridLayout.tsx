import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState, DisplayAreaConfig } from '../ExcelLikeGrid/types';
import Resizer from './Resizer';
import { CommonEditLogic } from '../CommonEdit/CommonEditLogic';
import StatusSelectionDialog from '../StatusSelectionDialog/StatusSelectionDialog';
import CostInputDialog from '../CostInputDialog/CostInputDialog';
import SpecificationEditDialog from '../SpecificationEditDialog/SpecificationEditDialog';
import TagNoEditDialog from '../TagNoEditDialog/TagNoEditDialog';
import { StatusValue, CostValue, SpecificationValue } from '../CommonEdit/types';
import { useKeyboardNavigation } from './keyboardNavigation';
// import { useScrollManager } from './scrollManager';

interface MaintenanceGridLayoutProps {
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
  onSpecificationEdit?: (rowId: string, index: number, field: 'key' | 'value', value: string) => void;
  onSpecificationColumnReorder?: (fromIndex: number, toIndex: number) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
  onCopy?: () => Promise<void>;
  onPaste?: () => Promise<void>;
  enableHorizontalVirtualScrolling?: boolean;
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
  onColumnResize,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onSpecificationEdit,
  onSpecificationColumnReorder,
  virtualScrolling,
  readOnly,
  onCopy,
  onPaste,
  enableHorizontalVirtualScrolling = false
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

  // Enhanced editing state
  const [editDialogState, setEditDialogState] = useState<{
    type: 'status' | 'cost' | 'specification' | 'tagNo' | null;
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

  // Organize columns by area
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

  // Initialize area widths based on columns and config
  useEffect(() => {
    const initialFixedWidth = columnsByArea.fixed?.reduce((sum, col) => sum + col.width, 0) || 250;
    const initialSpecWidth = displayAreaConfig.scrollableAreas.specifications?.width || 400;
    
    setFixedAreaWidth(initialFixedWidth);
    setSpecAreaWidth(initialSpecWidth);
  }, [columnsByArea.fixed, displayAreaConfig.scrollableAreas.specifications?.width]);

  // Basic scroll synchronization state (currently unused)
  // const [scrollPosition, setScrollPosition] = useState({ top: 0, left: 0 });

  // Handle scroll synchronization between areas
  const handleScrollSync = useCallback((scrollTop: number, sourceArea: 'fixed' | 'spec' | 'maintenance') => {
    if (isScrollingSyncRef.current) return;

    isScrollingSyncRef.current = true;
    
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
    
    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 16);
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

  // Listen for jump to column events
  useEffect(() => {
    const handleJumpToColumn = (event: CustomEvent) => {
      const { header } = event.detail;
      
      // Find the column by header
      const targetColumn = columns.find(col => col.id === `time_${header}`);
      if (!targetColumn) return;
      
      // Determine which area the column belongs to
      const isInSpecArea = columnsByArea.specifications.some(col => col.id === targetColumn.id);
      const isInMaintenanceArea = columnsByArea.maintenance.some(col => col.id === targetColumn.id);
      
      if (!isInSpecArea && !isInMaintenanceArea) return;
      
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
        // Also sync the header
        if (maintenanceHeaderRef.current) {
          maintenanceHeaderRef.current.scrollLeft = scrollLeft;
        }
      }
      if (isInSpecArea && specAreaRef.current) {
        specAreaRef.current.scrollLeft = scrollLeft;
        // Also sync the header
        if (specHeaderRef.current) {
          specHeaderRef.current.scrollLeft = scrollLeft;
        }
      }
    };
    
    window.addEventListener('jumpToColumn', handleJumpToColumn as EventListener);
    
    return () => {
      window.removeEventListener('jumpToColumn', handleJumpToColumn as EventListener);
    };
  }, [columns, gridState.columnWidths, columnsByArea]);

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
  const handleCellDoubleClick = useCallback((
    rowId: string, 
    columnId: string, 
    event: React.MouseEvent<HTMLElement>
  ) => {
    // Check if any dropdown/menu is open - if so, don't handle the double click
    const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
    if (hasOpenMenu) return;

    if (readOnly) return;

    const column = columns.find(col => col.id === columnId);
    if (!column?.editable) return;

    const item = data.find(d => d.id === rowId);
    if (!item) return;

    let editType: 'status' | 'cost' | 'specification' | 'tagNo' | null = null;
    let currentValue: any = null;

    // Determine edit type and current value based on column
    if (columnId === 'bomCode') {
      editType = 'tagNo';
      currentValue = item.bomCode || '';
    } else if (columnId.startsWith('time_')) {
      const timeHeader = columnId.replace('time_', '');
      const result = item.results?.[timeHeader];
      
      if (viewMode === 'status') {
        editType = 'status';
        currentValue = {
          planned: result?.planned || false,
          actual: result?.actual || false,
          displaySymbol: result?.planned && result?.actual ? '◎' : 
                        result?.planned ? '○' : 
                        result?.actual ? '●' : '',
          label: result?.planned && result?.actual ? '両方' :
                 result?.planned ? '計画' :
                 result?.actual ? '実績' : '未計画'
        } as StatusValue;
      } else {
        editType = 'cost';
        currentValue = {
          planCost: result?.planCost || 0,
          actualCost: result?.actualCost || 0,
        } as CostValue;
      }
    } else if (columnId.startsWith('spec_')) {
      editType = 'specification';
      currentValue = item.specifications || [];
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
    }
  }, [readOnly, columns, data, viewMode, deviceType, onEditingCellChange]);

  // Handle dialog save
  const handleDialogSave = useCallback((value: any) => {
    if (!editDialogState.rowId || !editDialogState.columnId) return;

    const { rowId, columnId, type } = editDialogState;

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
    } else if (type === 'specification') {
      const specifications = value as SpecificationValue[];
      // Update the item's specifications
      const item = data.find(d => d.id === rowId);
      if (item) {
        onUpdateItem({
          ...item,
          specifications: specifications,
        });
      }
    }

    // Close dialog and clear editing state
    setEditDialogState({
      type: null,
      open: false,
      rowId: null,
      columnId: null,
      currentValue: null,
      anchorEl: null,
    });
    onEditingCellChange(null, null);
  }, [editDialogState, onCellEdit, onUpdateItem, data, onEditingCellChange]);

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    setEditDialogState({
      type: null,
      open: false,
      rowId: null,
      columnId: null,
      currentValue: null,
      anchorEl: null,
    });
    onEditingCellChange(null, null);
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
          preventDefault: () => {},
          stopPropagation: () => {},
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
                />
              </Box>
            </Box>
          )}

          {/* Maintenance area */}
          {displayAreaConfig.scrollableAreas.maintenance?.visible && (
            <Box
              sx={{
                flex: 1,
                minWidth: 0, // Allow shrinking
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
      sx={{ 
        flex: 1, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        margin: 0,
        padding: 0,
        '&:focus': {
          outline: 'none',
        }
      }}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKeyboardNavigation}
    >
      {displayAreaConfig.mode === 'both' ? renderSplitAreas() : renderSingleArea()}
      
      {/* Status Selection Dialog */}
      {editDialogState.type === 'status' && (
        <StatusSelectionDialog
          open={editDialogState.open}
          currentStatus={editDialogState.currentValue}
          onSelect={handleDialogSave}
          onClose={handleDialogClose}
          anchorEl={editDialogState.anchorEl}
        />
      )}
      
      {/* Cost Input Dialog */}
      {editDialogState.type === 'cost' && (
        <CostInputDialog
          open={editDialogState.open}
          currentCost={editDialogState.currentValue}
          onSave={handleDialogSave}
          onClose={handleDialogClose}
          anchorEl={editDialogState.anchorEl}
        />
      )}
      
      {/* TAG NO. Edit Dialog */}
      {editDialogState.type === 'tagNo' && (
        <TagNoEditDialog
          open={editDialogState.open}
          tagNo={editDialogState.currentValue}
          onSave={handleDialogSave}
          onClose={handleDialogClose}
          anchorEl={editDialogState.anchorEl}
          readOnly={readOnly}
        />
      )}

      {/* Specification Edit Dialog */}
      {editDialogState.type === 'specification' && (
        <SpecificationEditDialog
          open={editDialogState.open}
          specifications={editDialogState.currentValue}
          onSave={handleDialogSave}
          onClose={handleDialogClose}
          anchorEl={editDialogState.anchorEl}
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

  return (
    <CommonEditLogic
      data={props.data}
      viewMode={props.viewMode}
      deviceDetection={deviceDetection}
      onCellEdit={props.onCellEdit}
      onSpecificationEdit={handleSpecificationEdit}
      onValidationError={handleValidationError}
      readOnly={props.readOnly}
    >
      <MaintenanceGridLayoutCore {...props} />
    </CommonEditLogic>
  );
};

export default MaintenanceGridLayout;