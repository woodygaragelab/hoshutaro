import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Box, Paper, Snackbar, Alert } from '@mui/material';
import { EnhancedMaintenanceGridProps, DisplayAreaConfig, GridColumn } from '../ExcelLikeGrid/types';
import MaintenanceGridLayout from './MaintenanceGridLayout';
import { useMaintenanceGridState } from './hooks/useMaintenanceGridState';
import { useClipboard } from '../ExcelLikeGrid/hooks/useClipboard';
import { usePerformanceOptimization } from '../ExcelLikeGrid/hooks/usePerformanceOptimization';
import { PerformanceMonitor } from '../ExcelLikeGrid/PerformanceMonitor';
import { IntegratedToolbar } from '../ModernHeader/ModernHeader';
import './EnhancedMaintenanceGrid.css';

export const EnhancedMaintenanceGrid: React.FC<EnhancedMaintenanceGridProps> = ({
  data,
  timeHeaders,
  viewMode,
  displayMode,
  showBomCode,
  showCycle,
  onCellEdit,
  onSpecificationEdit,
  onColumnResize,
  onRowResize,
  onUpdateItem,
  virtualScrolling = false,
  readOnly = false,
  className = '',
  groupedData,
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
  onShowCycleChange,
  onDisplayModeChange,
  onAddYear,
  onDeleteYear,
  onExportData,
  onImportData,
  onResetData,
  onAIAssistantToggle,
  isAIAssistantOpen = false,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [currentDisplayAreaConfig, setCurrentDisplayAreaConfig] = useState<DisplayAreaConfig | null>(null);

  // Generate columns based on current configuration
  const columns = useMemo((): GridColumn[] => {
    const cols: GridColumn[] = [];

    // Task name column (always visible)
    cols.push({
      id: 'task',
      header: '機器台帳',
      width: 250,
      minWidth: 150,
      maxWidth: 400,
      resizable: true,
      sortable: false,
      type: 'text',
      editable: true,
      accessor: 'task'
    });

    // TAG No. column (conditional)
    if (showBomCode) {
      cols.push({
        id: 'bomCode',
        header: 'TAG No.',
        width: 150,
        minWidth: 100,
        maxWidth: 200,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: false,
        accessor: 'bomCode'
      });
    }

    // Cycle column (conditional)
    if (showCycle) {
      cols.push({
        id: 'cycle',
        header: '周期',
        width: 80,
        minWidth: 60,
        maxWidth: 120,
        resizable: true,
        sortable: false,
        type: 'number',
        editable: true,
        accessor: 'cycle'
      });
    }

    // Specification columns (when in specifications or both mode)
    if (displayMode === 'specifications' || displayMode === 'both') {
      // Collect all unique specification keys from data
      const specKeys = new Set<string>();
      data.forEach(item => {
        if (item.specifications) {
          item.specifications.forEach(spec => {
            if (spec.key && spec.key.trim()) {
              specKeys.add(spec.key);
            }
          });
        }
      });
      
      // Convert to sorted array for consistent ordering
      const sortedSpecKeys = Array.from(specKeys).sort();
      
      // Debug logging for specification keys
      console.log('Specification keys found:', sortedSpecKeys.length, sortedSpecKeys.slice(0, 10));
      
      // Limit the number of specification columns to prevent performance issues
      const maxSpecColumns = 20;
      const limitedSpecKeys = sortedSpecKeys.slice(0, maxSpecColumns);
      
      if (sortedSpecKeys.length > maxSpecColumns) {
        console.warn(`Too many specification keys (${sortedSpecKeys.length}), limiting to ${maxSpecColumns}`);
      }
      
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
      timeHeaders.forEach(timeHeader => {
        cols.push({
          id: `time_${timeHeader}`,
          header: timeHeader,
          width: viewMode === 'cost' ? 120 : 80,
          minWidth: 60,
          maxWidth: 200,
          resizable: true,
          sortable: false,
          type: viewMode === 'cost' ? 'cost' : 'status',
          editable: true,
          accessor: `results.${timeHeader}`
        });
      });
    }

    // Debug logging for total columns
    console.log('Total columns generated:', cols.length, 'displayMode:', displayMode);
    
    return cols;
  }, [data, timeHeaders, viewMode, displayMode, showBomCode, showCycle]);

  // Generate display area configuration
  const displayAreaConfig = useMemo((): DisplayAreaConfig => {
    const fixedColumns = ['task'];
    if (showBomCode) fixedColumns.push('bomCode');
    if (showCycle) fixedColumns.push('cycle');

    const specColumns = columns.filter(col => col.id.startsWith('spec_')).map(col => col.id);
    const maintenanceColumns = columns.filter(col => col.id.startsWith('time_')).map(col => col.id);

    const config = {
      mode: displayMode,
      fixedColumns,
      scrollableAreas: {
        specifications: {
          visible: displayMode === 'specifications' || displayMode === 'both',
          width: specColumns.length * 135, // Average width
          columns: specColumns
        },
        maintenance: {
          visible: displayMode === 'maintenance' || displayMode === 'both',
          width: maintenanceColumns.length * (viewMode === 'cost' ? 120 : 80),
          columns: maintenanceColumns
        }
      }
    };
    
    // Debug logging to check display area configuration
    console.log('Display area config:', {
      mode: displayMode,
      fixedColumns,
      specColumns,
      maintenanceColumns,
      allColumns: columns.map(c => c.id)
    });
    
    return config;
  }, [columns, displayMode, showBomCode, showCycle, viewMode]);

  const {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell
  } = useMaintenanceGridState(columns, data);

  // Performance optimization hooks
  const {
    processedData,
    processedColumns,
    debouncedUpdate,
    startRenderMeasurement,
    endRenderMeasurement,
    getPerformanceMetrics,
    shouldUseVirtualScrolling
  } = usePerformanceOptimization(data, columns, gridState, {
    enableMemoization: true,
    enableDebouncing: true,
    debounceDelay: 16,
    enableBatching: true,
    batchSize: 50
  });

  // Handle cell editing with support for both regular cells and specifications
  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    console.log('[handleCellEdit] Called', { rowId, columnId, value, valueType: typeof value });
    if (readOnly) return;
    
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
                console.log('[handleCellEdit] Converting string status to object:', value);
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
              
              console.log('[handleCellEdit] Updating time column', { timeHeader, statusValue });
              const updatedResults = {
                ...updatedItem.results,
                [timeHeader]: statusValue
              };
              
              onUpdateItem({
                ...updatedItem,
                results: updatedResults,
                rolledUpResults: updatedResults // Update rolled up results as well
              });
            } else {
              // Handle other field edits
              console.log('[handleCellEdit] Updating other field', { columnId, value });
              onUpdateItem({
                ...updatedItem,
                [columnId]: value
              });
            }
          }
        });
      }
    }
  }, [readOnly, onCellEdit, onSpecificationEdit, debouncedUpdate, processedData, onUpdateItem]);

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
    console.log('[Copy] handleCopy called', { selectedCell: gridState.selectedCell, selectedRange: gridState.selectedRange });
    if (!gridState.selectedCell && !gridState.selectedRange) {
      console.log('[Copy] No cell selected, returning');
      return;
    }
    
    const sourceArea = getCurrentDisplayArea();
    console.log('[Copy] Source area:', sourceArea);
    const success = await copyToClipboard(gridState.selectedRange, gridState.selectedCell, sourceArea);
    console.log('[Copy] Copy result:', success);
    
    if (success) {
      setClipboardMessage({ message: `${sourceArea === 'specifications' ? '機器仕様' : '計画実績'}エリアからコピーしました`, severity: 'success' });
    } else {
      setClipboardMessage({ message: 'コピーに失敗しました', severity: 'error' });
    }
  }, [gridState.selectedCell, gridState.selectedRange, getCurrentDisplayArea, copyToClipboard]);

  // Handle paste operation with cross-area support
  const handlePaste = useCallback(async () => {
    console.log('[Paste] handlePaste called', { selectedCell: gridState.selectedCell, readOnly });
    if (!gridState.selectedCell || readOnly) {
      console.log('[Paste] No cell selected or readOnly, returning');
      return;
    }
    
    const targetArea = getCurrentDisplayArea();
    console.log('[Paste] Target area:', targetArea);
    const result = await pasteFromClipboard(gridState.selectedCell, targetArea);
    console.log('[Paste] Paste result:', result);
    
    if (result.isValid) {
      const warningCount = result.warnings.length;
      if (warningCount > 0) {
        setClipboardMessage({ 
          message: `${targetArea === 'specifications' ? '機器仕様' : '計画実績'}エリアにペーストしました（${warningCount}件の警告があります）`, 
          severity: 'warning' 
        });
      } else {
        setClipboardMessage({ 
          message: `${targetArea === 'specifications' ? '機器仕様' : '計画実績'}エリアにペーストしました`, 
          severity: 'success' 
        });
      }
    } else {
      const errorCount = result.errors.length;
      setClipboardMessage({ 
        message: `ペーストに失敗しました（${errorCount}件のエラー）`, 
        severity: 'error' 
      });
    }
  }, [gridState.selectedCell, readOnly, getCurrentDisplayArea, pasteFromClipboard]);

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
  });

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
        onSpecificationEdit={onSpecificationEdit}
        onColumnResize={handleColumnResize}
        onRowResize={handleRowResize}
        onSelectedCellChange={setSelectedCell}
        onEditingCellChange={setEditingCell}
        onSelectedRangeChange={setSelectedRange}
        onUpdateItem={onUpdateItem}
        virtualScrolling={virtualScrolling || shouldUseVirtualScrolling}
        readOnly={readOnly}
        onCopy={handleCopy}
        onPaste={handlePaste}
      />
    );
  }, [
    processedData, processedColumns, currentDisplayAreaConfig, displayAreaConfig,
    gridState, viewMode, groupedData, handleCellEdit, onSpecificationEdit,
    handleColumnResize, handleRowResize, setSelectedCell, setEditingCell,
    setSelectedRange, onUpdateItem, virtualScrolling, shouldUseVirtualScrolling, readOnly,
    handleCopy, handlePaste
  ]);

  // Memoize the toolbar to prevent unnecessary re-renders
  const memoizedToolbar = useMemo(() => (
    <IntegratedToolbar
      searchTerm={searchTerm}
      onSearchChange={onSearchChange || (() => {})}
      level1Filter={level1Filter}
      level2Filter={level2Filter}
      level3Filter={level3Filter}
      onLevel1FilterChange={onLevel1FilterChange || (() => {})}
      onLevel2FilterChange={onLevel2FilterChange || (() => {})}
      onLevel3FilterChange={onLevel3FilterChange || (() => {})}
      hierarchyFilterTree={hierarchyFilterTree}
      level2Options={level2Options}
      level3Options={level3Options}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange || (() => {})}
      timeScale={timeScale}
      onTimeScaleChange={onTimeScaleChange || (() => {})}
      showBomCode={showBomCode}
      showCycle={showCycle}
      onShowBomCodeChange={onShowBomCodeChange || (() => {})}
      onShowCycleChange={onShowCycleChange || (() => {})}
      displayMode={displayMode}
      onDisplayModeChange={onDisplayModeChange || (() => {})}
      onAddYear={onAddYear || (() => {})}
      onDeleteYear={onDeleteYear || (() => {})}
      onExportData={onExportData || (() => {})}
      onImportData={onImportData || (() => {})}
      onResetData={onResetData || (() => {})}
      onAIAssistantToggle={onAIAssistantToggle || (() => {})}
      isAIAssistantOpen={isAIAssistantOpen}
    />
  ), [
    searchTerm, onSearchChange, level1Filter, level2Filter, level3Filter,
    onLevel1FilterChange, onLevel2FilterChange, onLevel3FilterChange,
    hierarchyFilterTree, level2Options, level3Options, viewMode, onViewModeChange,
    timeScale, onTimeScaleChange, showBomCode, showCycle, onShowBomCodeChange,
    onShowCycleChange, displayMode, onDisplayModeChange, onAddYear, onDeleteYear,
    onExportData, onImportData, onResetData, onAIAssistantToggle, isAIAssistantOpen
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
          '&:focus': {
            outline: 'none'
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Integrated Toolbar - Always rendered first and memoized */}
          <Box 
            key="integrated-toolbar" 
            sx={{ 
              flexShrink: 0, 
              zIndex: 10,
              position: 'relative' // Ensure it stays in place
            }}
          >
            {memoizedToolbar}
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
    </>
  );
};

export default EnhancedMaintenanceGrid;