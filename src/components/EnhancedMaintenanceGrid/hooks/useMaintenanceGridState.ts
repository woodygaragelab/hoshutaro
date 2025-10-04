import { useState, useCallback, useMemo } from 'react';
import { HierarchicalData } from '../../../types';
import { GridColumn, GridState } from '../../ExcelLikeGrid/types';

export const useMaintenanceGridState = (columns: GridColumn[], data: HierarchicalData[]) => {
  const [selectedCell, setSelectedCellState] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editingCell, setEditingCellState] = useState<{ rowId: string; columnId: string } | null>(null);
  const [selectedRange, setSelectedRangeState] = useState<any>(null);
  const [columnWidths, setColumnWidths] = useState<{ [columnId: string]: number }>({});
  const [rowHeights, setRowHeights] = useState<{ [rowId: string]: number }>({});

  // Initialize column widths from column definitions
  const initialColumnWidths = useMemo(() => {
    const widths: { [columnId: string]: number } = {};
    columns.forEach(column => {
      widths[column.id] = column.width;
    });
    return widths;
  }, [columns]);

  // Merge initial widths with current widths
  const currentColumnWidths = useMemo(() => {
    return { ...initialColumnWidths, ...columnWidths };
  }, [initialColumnWidths, columnWidths]);

  const gridState: GridState = useMemo(() => ({
    selectedCell,
    editingCell,
    selectedRange,
    columnWidths: currentColumnWidths,
    rowHeights,
    clipboardData: null // Will be managed by clipboard hook
  }), [selectedCell, editingCell, selectedRange, currentColumnWidths, rowHeights]);

  const updateColumnWidth = useCallback((columnId: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: width
    }));
  }, []);

  const updateRowHeight = useCallback((rowId: string, height: number) => {
    setRowHeights(prev => ({
      ...prev,
      [rowId]: height
    }));
  }, []);

  const setSelectedCell = useCallback((rowId: string | null, columnId: string | null) => {
    if (rowId && columnId) {
      setSelectedCellState({ rowId, columnId });
    } else {
      setSelectedCellState(null);
    }
    // Clear editing when selection changes
    setEditingCellState(null);
  }, []);

  const setEditingCell = useCallback((rowId: string | null, columnId: string | null) => {
    if (rowId && columnId) {
      setEditingCellState({ rowId, columnId });
      // Ensure the cell is also selected
      setSelectedCellState({ rowId, columnId });
    } else {
      setEditingCellState(null);
    }
  }, []);

  const setSelectedRange = useCallback((range: any) => {
    setSelectedRangeState(range);
  }, []);

  const navigateToCell = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'enter') => {
    if (!selectedCell) return;

    const currentRowIndex = data.findIndex(item => item.id === selectedCell.rowId);
    const currentColumnIndex = columns.findIndex(col => col.id === selectedCell.columnId);
    
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
        newColumnIndex = Math.min(columns.length - 1, currentColumnIndex + 1);
        // If we're at the end of the row, move to next row
        if (newColumnIndex === currentColumnIndex && direction === 'tab') {
          newRowIndex = Math.min(data.length - 1, currentRowIndex + 1);
          newColumnIndex = 0;
        }
        break;
    }

    const newRowId = data[newRowIndex]?.id;
    const newColumnId = columns[newColumnIndex]?.id;

    if (newRowId && newColumnId) {
      setSelectedCell(newRowId, newColumnId);
    }
  }, [selectedCell, data, columns, setSelectedCell]);

  return {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell
  };
};