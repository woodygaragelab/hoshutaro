import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Box, Paper, Snackbar, Alert } from '@mui/material';
import { EnhancedMaintenanceGridProps, DisplayAreaConfig, GridColumn } from '../ExcelLikeGrid/types';
import DisplayAreaControl from './DisplayAreaControl';
import MaintenanceGridLayout from './MaintenanceGridLayout';
import Legend from './Legend';
import MobileGridView from './MobileGridView';
import TabletGridView from './TabletGridView';
import { useMaintenanceGridState } from './hooks/useMaintenanceGridState';
import { useClipboard } from '../ExcelLikeGrid/hooks/useClipboard';
import { usePerformanceOptimization } from '../ExcelLikeGrid/hooks/usePerformanceOptimization';
import { PerformanceMonitor } from '../ExcelLikeGrid/PerformanceMonitor';
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
  responsive
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
      header: '作業内容',
      width: 250,
      minWidth: 150,
      maxWidth: 400,
      resizable: true,
      sortable: false,
      type: 'text',
      editable: true,
      accessor: 'task'
    });

    // BOM Code column (conditional)
    if (showBomCode) {
      cols.push({
        id: 'bomCode',
        header: 'BOM Code',
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
      // Dynamic specification columns based on data
      const maxSpecs = Math.max(...data.map(item => item.specifications?.length || 0));
      for (let i = 0; i < Math.max(maxSpecs, 3); i++) {
        cols.push({
          id: `spec_key_${i}`,
          header: `仕様項目${i + 1}`,
          width: 120,
          minWidth: 80,
          maxWidth: 200,
          resizable: true,
          sortable: false,
          type: 'text',
          editable: true,
          accessor: `specifications.${i}.key`
        });
        cols.push({
          id: `spec_value_${i}`,
          header: `仕様値${i + 1}`,
          width: 150,
          minWidth: 100,
          maxWidth: 250,
          resizable: true,
          sortable: false,
          type: 'text',
          editable: true,
          accessor: `specifications.${i}.value`
        });
      }
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

    return cols;
  }, [data, timeHeaders, viewMode, displayMode, showBomCode, showCycle]);

  // Generate display area configuration
  const displayAreaConfig = useMemo((): DisplayAreaConfig => {
    const fixedColumns = ['task'];
    if (showBomCode) fixedColumns.push('bomCode');
    if (showCycle) fixedColumns.push('cycle');

    const specColumns = columns.filter(col => col.id.startsWith('spec_')).map(col => col.id);
    const maintenanceColumns = columns.filter(col => col.id.startsWith('time_')).map(col => col.id);

    return {
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

  const {
    copyToClipboard,
    pasteFromClipboard
  } = useClipboard({
    data: processedData,
    columns: processedColumns,
    onCellEdit,
    readOnly
  });

  // Handle cell editing with support for both regular cells and specifications
  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    if (readOnly) return;
    
    // Check if this is a specification edit
    if (columnId.startsWith('spec_')) {
      const [, type, indexStr] = columnId.split('_');
      const specIndex = parseInt(indexStr, 10);
      const field = type as 'key' | 'value';
      
      if (onSpecificationEdit) {
        debouncedUpdate(() => {
          onSpecificationEdit(rowId, specIndex, field, value);
          
          // Trigger cross-area synchronization
          // When specification is edited, update the corresponding item
          const updatedItem = processedData.find(item => item.id === rowId);
          if (updatedItem && onUpdateItem) {
            const newSpecs = [...(updatedItem.specifications || [])];
            if (!newSpecs[specIndex]) {
              newSpecs[specIndex] = { key: '', value: '', order: specIndex + 1 };
            }
            newSpecs[specIndex] = {
              ...newSpecs[specIndex],
              [field]: value
            };
            
            onUpdateItem({
              ...updatedItem,
              specifications: newSpecs
            });
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
              const updatedResults = {
                ...updatedItem.results,
                [timeHeader]: value
              };
              
              onUpdateItem({
                ...updatedItem,
                results: updatedResults,
                rolledUpResults: updatedResults // Update rolled up results as well
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
  }, [readOnly, onCellEdit, onSpecificationEdit, debouncedUpdate, processedData, onUpdateItem]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    updateColumnWidth(columnId, width);
    onColumnResize?.(columnId, width);
  }, [updateColumnWidth, onColumnResize]);

  const handleRowResize = useCallback((rowId: string, height: number) => {
    updateRowHeight(rowId, height);
    onRowResize?.(rowId, height);
  }, [updateRowHeight, onRowResize]);

  // Handle display area changes
  const handleDisplayAreaChange = useCallback((config: DisplayAreaConfig) => {
    setCurrentDisplayAreaConfig(config);
  }, []);

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
    const success = await copyToClipboard(gridState.selectedRange, gridState.selectedCell, sourceArea);
    
    if (success) {
      setClipboardMessage({ message: `${sourceArea === 'specifications' ? '機器仕様' : '計画実績'}エリアからコピーしました`, severity: 'success' });
    } else {
      setClipboardMessage({ message: 'コピーに失敗しました', severity: 'error' });
    }
  }, [gridState.selectedCell, gridState.selectedRange, getCurrentDisplayArea, copyToClipboard]);

  // Handle paste operation with cross-area support
  const handlePaste = useCallback(async () => {
    if (!gridState.selectedCell || readOnly) return;
    
    const targetArea = getCurrentDisplayArea();
    const result = await pasteFromClipboard(gridState.selectedCell, targetArea);
    
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
            setShowPerformanceMonitor(!showPerformanceMonitor);
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

  // Focus the grid when a cell is selected
  useEffect(() => {
    if (gridState.selectedCell && gridRef.current) {
      gridRef.current.focus();
    }
  }, [gridState.selectedCell]);

  // Performance measurement
  useEffect(() => {
    startRenderMeasurement();
    return () => {
      endRenderMeasurement();
    };
  });

  // Render responsive view based on screen size
  const renderResponsiveView = () => {
    if (!responsive) {
      // Fallback to desktop view if responsive is not provided
      return (
        <MaintenanceGridLayout
          data={processedData}
          columns={processedColumns}
          displayAreaConfig={currentDisplayAreaConfig || displayAreaConfig}
          gridState={gridState}
          viewMode={viewMode}
          groupedData={groupedData}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onSelectedCellChange={setSelectedCell}
          onEditingCellChange={setEditingCell}
          onSelectedRangeChange={setSelectedRange}
          onUpdateItem={onUpdateItem}
          virtualScrolling={virtualScrolling || shouldUseVirtualScrolling}
          readOnly={readOnly}
        />
      );
    }

    if (responsive.isMobile) {
      return (
        <MobileGridView
          data={processedData}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          showBomCode={showBomCode}
          showCycle={showCycle}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={onSpecificationEdit}
          responsive={responsive}
          groupedData={groupedData}
        />
      );
    } else if (responsive.isTablet) {
      return (
        <TabletGridView
          data={processedData}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          showBomCode={showBomCode}
          showCycle={showCycle}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={onSpecificationEdit}
          responsive={responsive}
          groupedData={groupedData}
        />
      );
    } else {
      // Desktop view
      return (
        <MaintenanceGridLayout
          data={processedData}
          columns={processedColumns}
          displayAreaConfig={currentDisplayAreaConfig || displayAreaConfig}
          gridState={gridState}
          viewMode={viewMode}
          groupedData={groupedData}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onSelectedCellChange={setSelectedCell}
          onEditingCellChange={setEditingCell}
          onSelectedRangeChange={setSelectedRange}
          onUpdateItem={onUpdateItem}
          virtualScrolling={virtualScrolling || shouldUseVirtualScrolling}
          readOnly={readOnly}
        />
      );
    }
  };

  return (
    <>
      <Paper 
        ref={gridRef}
        className={`enhanced-maintenance-grid ${className} ${responsive?.isMobile ? 'mobile-view' : responsive?.isTablet ? 'tablet-view' : 'desktop-view'}`}
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
          {/* Display Area Control and Legend - Hide on mobile for space */}
          {!responsive?.isMobile && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: responsive?.getSpacing ? `${responsive.getSpacing('sm')}px` : '8px 16px',
              borderBottom: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.default'
            }}>
              <DisplayAreaControl
                config={currentDisplayAreaConfig || displayAreaConfig}
                onChange={handleDisplayAreaChange}
              />
              <Legend viewMode={viewMode} />
            </Box>
          )}
          
          {/* Responsive Grid Layout */}
          {renderResponsiveView()}
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

      {/* Performance Monitor */}
      <PerformanceMonitor
        metrics={getPerformanceMetrics()}
        dataSize={processedData.length}
        columnCount={processedColumns.length}
        virtualScrollingEnabled={virtualScrolling || shouldUseVirtualScrolling}
        visible={showPerformanceMonitor}
      />
    </>
  );
};

export default EnhancedMaintenanceGrid;