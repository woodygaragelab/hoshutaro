import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState, DisplayAreaConfig } from '../ExcelLikeGrid/types';
import Resizer from './Resizer';
import { CommonEditLogic } from '../CommonEdit/CommonEditLogic';
import StatusSelectionDialog from '../StatusSelectionDialog/StatusSelectionDialog';
import CostInputDialog from '../CostInputDialog/CostInputDialog';
import SpecificationEditDialog from '../SpecificationEditDialog/SpecificationEditDialog';
import { StatusValue, CostValue, SpecificationValue } from '../CommonEdit/types';
import { useKeyboardNavigation } from './keyboardNavigation';
import { useCopyPaste } from './copyPasteManager';
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
  onSpecificationEdit: (rowId: string, index: number, field: 'key' | 'value', value: string) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
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
  virtualScrolling,
  readOnly
}) => {
  // Scroll synchronization state
  const [syncScrollTop, setSyncScrollTop] = useState(0);
  const fixedAreaRef = useRef<HTMLDivElement>(null);
  const specAreaRef = useRef<HTMLDivElement>(null);
  const maintenanceAreaRef = useRef<HTMLDivElement>(null);
  const specHeaderRef = useRef<HTMLDivElement>(null);
  const maintenanceHeaderRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Enhanced editing state
  const [editDialogState, setEditDialogState] = useState<{
    type: 'status' | 'cost' | 'specification' | null;
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

  // Device detection for responsive dialogs
  const [deviceType, setDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Detect device type on mount and resize
  useEffect(() => {
    const detectDeviceType = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    detectDeviceType();
    window.addEventListener('resize', detectDeviceType);
    return () => window.removeEventListener('resize', detectDeviceType);
  }, []);

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation(data, columns, {
    skipNonEditable: true,
    wrapAround: false,
    allowEditOnEnter: true,
  });

  // Copy & Paste functionality
  const { 
    copySingleCell, 
    pasteSingleCell
  } = useCopyPaste(data, columns);

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

    // Debug logging to check column organization
    console.log('Column organization:', {
      allColumns: columns.map(c => c.id),
      fixedColumns: displayAreaConfig.fixedColumns,
      fixed: fixed.map(c => c.id),
      specifications: specifications.map(c => c.id),
      maintenance: maintenance.map(c => c.id),
      mode: displayAreaConfig.mode
    });

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

  // Handle scroll synchronization between areas - Updated
  const handleScrollSync = useCallback((scrollTop: number, sourceArea: 'fixed' | 'spec' | 'maintenance') => {
    if (isScrollingSyncRef.current) return;
    

    isScrollingSyncRef.current = true;
    
    setSyncScrollTop(scrollTop);
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
    console.log('Cell double-click detected:', { rowId, columnId });
    
    // Check if any dropdown/menu is open - if so, don't handle the double click
    const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
    if (hasOpenMenu) {
      console.log('Menu is open, skipping double-click handling');
      return; // Don't handle double click when menus are open
    }

    if (readOnly) {
      console.log('Grid is read-only, skipping double-click handling');
      return;
    }

    const column = columns.find(col => col.id === columnId);
    if (!column?.editable) {
      console.log('Column is not editable, skipping double-click handling');
      return;
    }

    const item = data.find(d => d.id === rowId);
    if (!item) {
      console.log('Item not found, skipping double-click handling');
      return;
    }

    let editType: 'status' | 'cost' | 'specification' | null = null;
    let currentValue: any = null;

    // Determine edit type and current value based on column
    if (columnId.startsWith('time_')) {
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
      console.log('Opening edit dialog:', { editType, rowId, columnId, deviceType });
      
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
      console.log('No edit type determined for double-click');
    }
  }, [readOnly, columns, data, viewMode, deviceType, onEditingCellChange]);

  // Handle dialog save
  const handleDialogSave = useCallback((value: any) => {
    if (!editDialogState.rowId || !editDialogState.columnId) return;

    const { rowId, columnId, type } = editDialogState;

    if (type === 'status') {
      const statusValue = value as StatusValue;
      onCellEdit(rowId, columnId, {
        planned: statusValue.planned,
        actual: statusValue.actual,
      });
    } else if (type === 'cost') {
      const costValue = value as CostValue;
      onCellEdit(rowId, columnId, costValue);
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

  // Copy & Paste handlers
  const handleCopy = useCallback(async () => {
    const currentRowId = gridState.selectedCell?.rowId;
    const currentColumnId = gridState.selectedCell?.columnId;

    if (currentRowId && currentColumnId) {
      const success = await copySingleCell(currentRowId, currentColumnId, viewMode);
      if (success) {
        console.log('Cell copied successfully');
        // TODO: Show user feedback
      }
    }
  }, [gridState.selectedCell, copySingleCell, viewMode]);

  const handlePaste = useCallback(async () => {
    const currentRowId = gridState.selectedCell?.rowId;
    const currentColumnId = gridState.selectedCell?.columnId;

    if (currentRowId && currentColumnId && !readOnly) {
      const result = await pasteSingleCell(currentRowId, currentColumnId, viewMode);
      if (result.success && result.value !== undefined) {
        onCellEdit(currentRowId, currentColumnId, result.value);
        console.log('Cell pasted successfully');
        // TODO: Show user feedback
      } else if (result.error) {
        console.error('Paste failed:', result.error);
        // TODO: Show error message to user
      }
    }
  }, [gridState.selectedCell, pasteSingleCell, viewMode, readOnly, onCellEdit]);

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
    console.log('renderSingleArea called for mode:', displayAreaConfig.mode);
    console.log('columnsByArea:', {
      fixed: columnsByArea.fixed.map(c => c.id),
      specifications: columnsByArea.specifications.map(c => c.id),
      maintenance: columnsByArea.maintenance.map(c => c.id)
    });
    
    // Get scrollable columns (non-fixed columns)
    const scrollableColumns = [
      ...(displayAreaConfig.mode === 'specifications' || displayAreaConfig.mode === 'both' ? columnsByArea.specifications : []),
      ...(displayAreaConfig.mode === 'maintenance' || displayAreaConfig.mode === 'both' ? columnsByArea.maintenance : [])
    ];
    
    console.log('renderSingleArea fixed columns:', columnsByArea.fixed.map(c => c.id));
    console.log('renderSingleArea scrollable columns:', scrollableColumns.map(c => c.id));

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
            />
          </Box>
          <Box 
            ref={fixedAreaRef}
            sx={{ 
              overflowY: 'auto',
              overflowX: 'hidden', 
              flex: 1,
              willChange: 'scroll-position',
              transform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
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
                pointerEvents: 'none'
              }}
            >
              <MaintenanceTableHeader
                columns={scrollableColumns}
                gridState={gridState}
                onColumnResize={handleEnhancedColumnResize}
              />
            </Box>
            <Box 
              ref={maintenanceAreaRef}
              sx={{ 
                overflow: 'auto', 
                flex: 1,
                willChange: 'scroll-position',
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
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
              />
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderSplitAreas = () => {
    console.log('renderSplitAreas called for mode:', displayAreaConfig.mode);
    console.log('renderSplitAreas columnsByArea:', {
      fixed: columnsByArea.fixed.map(c => c.id),
      specifications: columnsByArea.specifications.map(c => c.id),
      maintenance: columnsByArea.maintenance.map(c => c.id)
    });
    
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
              willChange: 'scroll-position',
              transform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
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
                  pointerEvents: 'none' // Prevent user interaction with header scroll
                }}
              >
                <MaintenanceTableHeader
                  columns={columnsByArea.specifications}
                  gridState={gridState}
                  onColumnResize={handleEnhancedColumnResize}
                />
              </Box>
              <Box 
                ref={specAreaRef}
                sx={{ 
                  overflow: 'auto', 
                  flex: 1,
                  willChange: 'scroll-position',
                  transform: 'translate3d(0, 0, 0)',
                  backfaceVisibility: 'hidden',
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
                  pointerEvents: 'none' // Prevent user interaction with header scroll
                }}
              >
                <MaintenanceTableHeader
                  columns={columnsByArea.maintenance}
                  gridState={gridState}
                  onColumnResize={handleEnhancedColumnResize}
                />
              </Box>
              <Box 
                ref={maintenanceAreaRef}
                sx={{ 
                  overflow: 'auto', 
                  flex: 1,
                  willChange: 'scroll-position',
                  transform: 'translate3d(0, 0, 0)',
                  backfaceVisibility: 'hidden',
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
      ref={gridContainerRef}
      sx={{ 
        flex: 1, 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none', // Remove focus outline
        '&:focus': {
          outline: 'none',
        }
      }}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKeyboardNavigation}
    >
      {(() => {
        console.log('MaintenanceGridLayout rendering mode:', displayAreaConfig.mode);
        return displayAreaConfig.mode === 'both' ? renderSplitAreas() : renderSingleArea();
      })()}
      
      {/* Status Selection Dialog */}
      {editDialogState.type === 'status' && (
        <StatusSelectionDialog
          open={editDialogState.open}
          currentStatus={editDialogState.currentValue}
          onSelect={handleDialogSave}
          onClose={handleDialogClose}
          deviceType={deviceType}
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
          deviceType={deviceType}
        />
      )}
      
      {/* Specification Edit Dialog */}
      {editDialogState.type === 'specification' && (
        <SpecificationEditDialog
          open={editDialogState.open}
          specifications={editDialogState.currentValue}
          onSave={handleDialogSave}
          onClose={handleDialogClose}
          deviceType={deviceType}
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
    if (key === 'key') {
      props.onSpecificationEdit(rowId, specIndex, 'key', value);
    } else {
      props.onSpecificationEdit(rowId, specIndex, 'value', value);
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