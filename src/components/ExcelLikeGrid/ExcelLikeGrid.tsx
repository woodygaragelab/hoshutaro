import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { Box, Paper, Snackbar, Alert } from '@mui/material';
import { ExcelLikeGridProps, DisplayAreaConfig } from './types';
import { DisplayAreaControl } from './DisplayAreaControl';
import { GridLayout } from './GridLayout';
import { useGridState } from './hooks/useGridState';
import { useClipboard } from './hooks/useClipboard';
import { usePerformanceOptimization } from './hooks/usePerformanceOptimization';
import { PerformanceMonitor } from './PerformanceMonitor';
import { calculateOptimalColumnWidth, calculateOptimalRowHeight } from './utils/cellUtils';
import './ExcelLikeGrid.css';

export const ExcelLikeGrid: React.FC<ExcelLikeGridProps> = ({
  data,
  columns,
  displayAreaConfig,
  onCellEdit,
  onColumnResize,
  onRowResize,
  onDisplayAreaChange,
  onCopy,
  onPaste,
  virtualScrolling = false,
  readOnly = false,
  className = ''
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [clipboardMessage, setClipboardMessage] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  
  const {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell
  } = useGridState(columns, data);

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
    data,
    columns,
    onCellEdit,
    onCopy,
    onPaste,
    readOnly
  });

  // Default display area configuration
  const defaultDisplayAreaConfig: DisplayAreaConfig = useMemo(() => ({
    mode: 'maintenance',
    fixedColumns: ['task', 'bomCode'], // Default fixed columns
    scrollableAreas: {
      specifications: {
        visible: false,
        width: 400,
        columns: processedColumns.filter(col => col.id.includes('spec')).map(col => col.id)
      },
      maintenance: {
        visible: true,
        width: 800,
        columns: processedColumns.filter(col => !col.id.includes('spec') && 
          !['task', 'bomCode'].includes(col.id)).map(col => col.id)
      }
    }
  }), [processedColumns]);

  const currentDisplayAreaConfig = displayAreaConfig || defaultDisplayAreaConfig;

  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    if (readOnly || !onCellEdit) return;
    
    // Use debounced update for better performance
    debouncedUpdate(() => {
      onCellEdit(rowId, columnId, value);
    });
  }, [readOnly, onCellEdit, debouncedUpdate]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    updateColumnWidth(columnId, width);
    onColumnResize?.(columnId, width);
  }, [updateColumnWidth, onColumnResize]);

  const handleRowResize = useCallback((rowId: string, height: number) => {
    updateRowHeight(rowId, height);
    onRowResize?.(rowId, height);
  }, [updateRowHeight, onRowResize]);

  const handleColumnAutoResize = useCallback((columnId: string) => {
    const column = processedColumns.find(col => col.id === columnId);
    if (!column) return;

    const optimalWidth = calculateOptimalColumnWidth(
      column,
      processedData,
      column.minWidth,
      column.maxWidth
    );
    
    handleColumnResize(columnId, optimalWidth);
  }, [processedColumns, processedData, handleColumnResize]);

  const handleRowAutoResize = useCallback((rowId: string) => {
    const optimalHeight = calculateOptimalRowHeight(
      rowId,
      processedColumns,
      processedData,
      gridState.columnWidths,
      30, // minHeight
      200 // maxHeight
    );
    
    handleRowResize(rowId, optimalHeight);
  }, [processedColumns, processedData, gridState.columnWidths, handleRowResize]);

  // Determine current display area based on selected cell
  const getCurrentDisplayArea = useCallback((): 'specifications' | 'maintenance' => {
    if (!gridState.selectedCell) return 'maintenance';
    
    const column = processedColumns.find(col => col.id === gridState.selectedCell?.columnId);
    if (!column) return 'maintenance';
    
    // Check if column is in specifications area
    const specColumns = currentDisplayAreaConfig.scrollableAreas.specifications?.columns || [];
    if (specColumns.includes(column.id)) {
      return 'specifications';
    }
    
    return 'maintenance';
  }, [gridState.selectedCell, processedColumns, currentDisplayAreaConfig]);

  // Handle copy operation
  const handleCopy = useCallback(async () => {
    if (!gridState.selectedCell && !gridState.selectedRange) return;
    
    const sourceArea = getCurrentDisplayArea();
    const success = await copyToClipboard(gridState.selectedRange, gridState.selectedCell, sourceArea);
    
    if (success) {
      setClipboardMessage({ message: 'コピーしました', severity: 'success' });
    } else {
      setClipboardMessage({ message: 'コピーに失敗しました', severity: 'error' });
    }
  }, [gridState.selectedCell, gridState.selectedRange, getCurrentDisplayArea, copyToClipboard]);

  // Handle paste operation
  const handlePaste = useCallback(async () => {
    if (!gridState.selectedCell || readOnly) return;
    
    const targetArea = getCurrentDisplayArea();
    const result = await pasteFromClipboard(gridState.selectedCell, targetArea);
    
    if (result.isValid) {
      const warningCount = result.warnings.length;
      if (warningCount > 0) {
        setClipboardMessage({ 
          message: `ペーストしました（${warningCount}件の警告があります）`, 
          severity: 'warning' 
        });
      } else {
        setClipboardMessage({ message: 'ペーストしました', severity: 'success' });
      }
    } else {
      const errorCount = result.errors.length;
      setClipboardMessage({ 
        message: `ペーストに失敗しました（${errorCount}件のエラー）`, 
        severity: 'error' 
      });
    }
  }, [gridState.selectedCell, readOnly, getCurrentDisplayArea, pasteFromClipboard]);

  // Handle keyboard navigation at grid level
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
    handlePaste
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

  const handleDisplayAreaChange = useCallback((config: DisplayAreaConfig) => {
    onDisplayAreaChange?.(config);
  }, [onDisplayAreaChange]);

  return (
    <>
      <Paper 
        ref={gridRef}
        className={`excel-like-grid ${className}`}
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
          {/* Display Area Control */}
          <DisplayAreaControl
            config={currentDisplayAreaConfig}
            onChange={handleDisplayAreaChange}
          />
          
          {/* Grid Layout */}
          <GridLayout
            data={processedData}
            columns={processedColumns}
            displayAreaConfig={currentDisplayAreaConfig}
            gridState={gridState}
            onCellEdit={handleCellEdit}
            onColumnResize={handleColumnResize}
            onRowResize={handleRowResize}
            onColumnAutoResize={handleColumnAutoResize}
            onRowAutoResize={handleRowAutoResize}
            onSelectedCellChange={setSelectedCell}
            onEditingCellChange={setEditingCell}
            onSelectedRangeChange={setSelectedRange}
            virtualScrolling={virtualScrolling || shouldUseVirtualScrolling}
            readOnly={readOnly}
          />
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

export default ExcelLikeGrid;