import { useState, useCallback } from 'react';
import { GridColumn, GridState, ClipboardData } from '../types';
import { HierarchicalData } from '../../../types';

export const useGridState = (columns: GridColumn[], data: HierarchicalData[]) => {
  const [gridState, setGridState] = useState<GridState>(() => {
    // Initialize column widths from column definitions
    const columnWidths = columns.reduce((acc, column) => {
      acc[column.id] = column.width;
      return acc;
    }, {} as { [columnId: string]: number });

    // Initialize row heights (default 40px)
    const rowHeights = data.reduce((acc, item) => {
      acc[item.id] = 40;
      return acc;
    }, {} as { [rowId: string]: number });

    return {
      selectedCell: null,
      editingCell: null,
      selectedRange: null,
      columnWidths,
      rowHeights,
      clipboardData: null
    };
  });

  const updateColumnWidth = useCallback((columnId: string, width: number) => {
    setGridState(prev => ({
      ...prev,
      columnWidths: {
        ...prev.columnWidths,
        [columnId]: Math.max(width, columns.find(col => col.id === columnId)?.minWidth || 50)
      }
    }));
  }, [columns]);

  const updateRowHeight = useCallback((rowId: string, height: number) => {
    setGridState(prev => ({
      ...prev,
      rowHeights: {
        ...prev.rowHeights,
        [rowId]: Math.max(height, 30) // Minimum row height of 30px
      }
    }));
  }, []);

  const setSelectedCell = useCallback((rowId: string | null, columnId: string | null) => {
    setGridState(prev => ({
      ...prev,
      selectedCell: rowId && columnId ? { rowId, columnId } : null,
      selectedRange: null // Clear range selection when selecting single cell
    }));
  }, []);

  const setSelectedRange = useCallback((startRow: string, startColumn: string, endRow: string, endColumn: string) => {
    setGridState(prev => ({
      ...prev,
      selectedRange: { startRow, startColumn, endRow, endColumn },
      selectedCell: null // Clear single cell selection when selecting range
    }));
  }, []);

  const setClipboardData = useCallback((clipboardData: ClipboardData | null) => {
    setGridState(prev => ({
      ...prev,
      clipboardData
    }));
  }, []);

  const setEditingCell = useCallback((rowId: string | null, columnId: string | null) => {
    setGridState(prev => ({
      ...prev,
      editingCell: rowId && columnId ? { rowId, columnId } : null
    }));
  }, []);

  // Navigation helpers
  const navigateToCell = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'enter') => {
    const currentCell = gridState.selectedCell;
    if (!currentCell) return;

    const currentRowIndex = data.findIndex(item => item.id === currentCell.rowId);
    const currentColumnIndex = columns.findIndex(col => col.id === currentCell.columnId);
    
    if (currentRowIndex === -1 || currentColumnIndex === -1) return;

    let newRowIndex = currentRowIndex;
    let newColumnIndex = currentColumnIndex;

    switch (direction) {
      case 'up':
        newRowIndex = Math.max(0, currentRowIndex - 1);
        break;
      case 'down':
      case 'enter':
        newRowIndex = Math.min(data.length - 1, currentRowIndex + 1);
        break;
      case 'left':
        newColumnIndex = Math.max(0, currentColumnIndex - 1);
        break;
      case 'right':
      case 'tab':
        newColumnIndex = currentColumnIndex + 1;
        // If we're at the end of the row, move to the next row's first column
        if (newColumnIndex >= columns.length) {
          newColumnIndex = 0;
          newRowIndex = Math.min(data.length - 1, currentRowIndex + 1);
        }
        break;
    }

    // Ensure we have valid indices
    if (newRowIndex >= 0 && newRowIndex < data.length && 
        newColumnIndex >= 0 && newColumnIndex < columns.length) {
      const newRowId = data[newRowIndex].id;
      const newColumnId = columns[newColumnIndex].id;
      setSelectedCell(newRowId, newColumnId);
    }
  }, [gridState.selectedCell, data, columns, setSelectedCell]);

  return {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    setClipboardData,
    navigateToCell
  };
};