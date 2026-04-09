import { useState, useCallback, useMemo } from 'react';
import { HierarchicalData } from '../../../types';
import { GridColumn, GridState, GridRange, GridSelection } from '../types';

export const useMaintenanceGridState = (columns: GridColumn[], visibleRowIds: string[]) => {
  const [selectedCell, setSelectedCellState] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editingCell, setEditingCellState] = useState<{ rowId: string; columnId: string } | null>(null);
  const [selectedRange, setSelectedRangeState] = useState<GridRange | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartCell, setDragStartCell] = useState<GridSelection | null>(null);

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

  // Merge initial widths with current widths - use stable reference
  const currentColumnWidths = useMemo(() => {
    const merged = { ...initialColumnWidths, ...columnWidths };
    return merged;
  }, [initialColumnWidths, columnWidths]);

  // Create stable gridState object to prevent infinite re-renders
  // Use useMemo with proper dependencies to avoid circular dependencies
  const gridState: GridState = useMemo(() => ({
    selectedCell,
    editingCell,
    selectedRange,
    columnWidths: currentColumnWidths,
    rowHeights,
    sortColumn: null,
    sortDirection: null,
    scrollPosition: { x: 0, y: 0 },
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
      // Clear range when a single cell is selected normally (not dragging)
      if (!isDragging) {
        setSelectedRangeState({ start: { rowId, columnId }, end: { rowId, columnId } });
      }
    } else {
      setSelectedCellState(null);
      setSelectedRangeState(null);
    }
    // Clear editing when selection changes
    setEditingCellState(null);
  }, [isDragging]);

  const setEditingCell = useCallback((rowId: string | null, columnId: string | null) => {
    if (rowId && columnId) {
      setEditingCellState({ rowId, columnId });
      // Ensure the cell is also selected
      setSelectedCellState({ rowId, columnId });
      // Keep the cell in range so it doesn't lose its background highlight
      setSelectedRangeState({ start: { rowId, columnId }, end: { rowId, columnId } });
    } else {
      setEditingCellState(null);
    }
  }, []);

  const setSelectedRange = useCallback((range: GridRange | null | ((prev: GridRange | null) => GridRange | null)) => {
    setSelectedRangeState(typeof range === 'function' ? range : range);
  }, []);

  // Range selection by mouse drag
  const startDragSelection = useCallback((rowId: string, columnId: string) => {
    setIsDragging(true);
    setDragStartCell({ rowId, columnId });
    setSelectedCellState({ rowId, columnId });
    setSelectedRangeState({ start: { rowId, columnId }, end: { rowId, columnId } });
    setEditingCellState(null);
  }, []);

  const updateDragSelection = useCallback((rowId: string, columnId: string) => {
    if (isDragging && dragStartCell) {
      setSelectedRangeState({
        start: dragStartCell,
        end: { rowId, columnId }
      });
    }
  }, [isDragging, dragStartCell]);

  const endDragSelection = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isCellInSelectedRange = useCallback((rowId: string, columnId: string) => {
    if (!selectedRange || !selectedRange.start || !selectedRange.end) return false;

    // Fast path: if start and end are identical to the cell, then yes.
    if ((selectedRange.start.rowId === rowId && selectedRange.start.columnId === columnId) &&
        (selectedRange.end.rowId === rowId && selectedRange.end.columnId === columnId)) {
      return true;
    }

    const startRowIdx = visibleRowIds.indexOf(selectedRange.start?.rowId || '');
    const endRowIdx = visibleRowIds.indexOf(selectedRange.end?.rowId || '');
    const currentRowIdx = visibleRowIds.indexOf(rowId);

    const startColIdx = columns.findIndex(c => c.id === selectedRange.start?.columnId);
    const endColIdx = columns.findIndex(c => c.id === selectedRange.end?.columnId);
    const currentColIdx = columns.findIndex(c => c.id === columnId);

    if (startRowIdx === -1 || endRowIdx === -1 || currentRowIdx === -1) return false;
    if (startColIdx === -1 || endColIdx === -1 || currentColIdx === -1) return false;

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    return currentRowIdx >= minRow && currentRowIdx <= maxRow &&
           currentColIdx >= minCol && currentColIdx <= maxCol;
  }, [selectedRange, visibleRowIds, columns]);


  const navigateToCell = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'tab' | 'enter') => {
    if (!selectedCell) return;

    const currentRowIndex = visibleRowIds.indexOf(selectedCell.rowId);
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
        newRowIndex = Math.min(visibleRowIds.length - 1, currentRowIndex + 1);
        break;
      case 'left':
        newColumnIndex = Math.max(0, currentColumnIndex - 1);
        break;
      case 'right':
      case 'tab':
        newColumnIndex = Math.min(columns.length - 1, currentColumnIndex + 1);
        // If we're at the end of the row, move to next row
        if (newColumnIndex === currentColumnIndex && direction === 'tab') {
          newRowIndex = Math.min(visibleRowIds.length - 1, currentRowIndex + 1);
          newColumnIndex = 0;
        }
        break;
    }

    const newRowId = visibleRowIds[newRowIndex];
    const newColumnId = columns[newColumnIndex]?.id;

    if (newRowId && newColumnId) {
      setSelectedCell(newRowId, newColumnId);
    }
  }, [selectedCell, visibleRowIds, columns, setSelectedCell]);

  return {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setSelectedRange,
    setEditingCell,
    navigateToCell,
    // Drag selection API
    isDragging,
    startDragSelection,
    updateDragSelection,
    endDragSelection,
    isCellInSelectedRange
  };
};
