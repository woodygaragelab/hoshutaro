import { ClipboardData, ClipboardCell, GridColumn } from '../types';
import { HierarchicalData } from '../../../types';

/**
 * Validates if a value is compatible with the target column type
 */
export const validateCellValue = (value: any, columnType: string): { isValid: boolean; errorMessage?: string } => {
  if (value === null || value === undefined || value === '') {
    return { isValid: true }; // Empty values are generally allowed
  }

  switch (columnType) {
    case 'number':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { isValid: false, errorMessage: '数値を入力してください' };
      }
      return { isValid: true };

    case 'date':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return { isValid: false, errorMessage: '有効な日付を入力してください' };
      }
      return { isValid: true };

    case 'status':
      // Status values should be specific strings
      const validStatuses = ['plan', 'actual', 'completed', 'cancelled'];
      if (typeof value === 'string' && validStatuses.includes(value.toLowerCase())) {
        return { isValid: true };
      }
      return { isValid: false, errorMessage: '有効なステータスを入力してください' };

    case 'cost':
      const costValue = Number(value);
      if (isNaN(costValue) || costValue < 0) {
        return { isValid: false, errorMessage: '正の数値を入力してください' };
      }
      return { isValid: true };

    case 'text':
    default:
      return { isValid: true };
  }
};

/**
 * Converts clipboard data to tab-separated values for system clipboard
 */
export const clipboardDataToTSV = (clipboardData: ClipboardData): string => {
  return clipboardData.cells
    .map(row => row.map(cell => String(cell.value || '')).join('\t'))
    .join('\n');
};

/**
 * Parses tab-separated values from system clipboard to clipboard data
 */
export const tsvToClipboardData = (
  tsv: string,
  targetArea: 'specifications' | 'maintenance',
  startCell: { rowId: string; columnId: string },
  columns: GridColumn[],
  data: HierarchicalData[]
): ClipboardData => {
  const rows = tsv.split('\n').filter(row => row.trim() !== '');
  const startRowIndex = data.findIndex(item => item.id === startCell.rowId);
  const startColumnIndex = columns.findIndex(col => col.id === startCell.columnId);

  const cells: ClipboardCell[][] = rows.map((row, rowOffset) => {
    const values = row.split('\t');
    return values.map((value, colOffset) => {
      const targetRowIndex = startRowIndex + rowOffset;
      const targetColumnIndex = startColumnIndex + colOffset;
      
      const targetRow = data[targetRowIndex];
      const targetColumn = columns[targetColumnIndex];
      
      return {
        rowId: targetRow?.id || '',
        columnId: targetColumn?.id || '',
        value: value.trim(),
        type: targetColumn?.type || 'text'
      };
    }).filter(cell => cell.rowId && cell.columnId); // Filter out invalid cells
  });

  return {
    cells: cells.filter(row => row.length > 0), // Filter out empty rows
    sourceArea: targetArea,
    timestamp: Date.now()
  };
};

// Import the existing cell utility functions
import { getCellValue as getExistingCellValue, setCellValue as setExistingCellValue } from './cellUtils';

/**
 * Gets the value from a data item using the column accessor
 * Uses the existing cellUtils implementation with extensions for clipboard-specific patterns
 */
export const getCellValue = (
  item: HierarchicalData,
  column: GridColumn
): any => {
  // Handle specifications array with spec_ prefix
  if (column.id.startsWith('spec_')) {
    const specKey = column.id.replace('spec_', '');
    const spec = item.specifications?.find(s => s.key === specKey);
    return spec?.value || '';
  }
  
  // Handle maintenance data with time_ prefix
  if (column.id.startsWith('time_')) {
    const timeKey = column.id.replace('time_', '');
    const result = item.results?.[timeKey];
    if (result) {
      if (result.planned && result.actual) return '◎';
      if (result.planned) return '〇';
      if (result.actual) return '●';
    }
    return '';
  }
  
  // Use existing cellUtils function for other cases
  return getExistingCellValue(item, column);
};

/**
 * Sets the value in a data item using the column accessor
 * Uses the existing cellUtils implementation with extensions for clipboard-specific patterns
 */
export const setCellValue = (
  item: HierarchicalData,
  column: GridColumn,
  value: any
): HierarchicalData => {
  // Handle specifications array with spec_ prefix
  if (column.id.startsWith('spec_')) {
    const specKey = column.id.replace('spec_', '');
    const updatedItem = { ...item };
    const specifications = [...(updatedItem.specifications || [])];
    const specIndex = specifications.findIndex(s => s.key === specKey);
    
    if (specIndex >= 0) {
      specifications[specIndex] = { ...specifications[specIndex], value: String(value) };
    } else {
      specifications.push({ key: specKey, value: String(value), order: specifications.length });
    }
    
    updatedItem.specifications = specifications;
    return updatedItem;
  }
  
  // Handle maintenance data with time_ prefix
  if (column.id.startsWith('time_')) {
    const timeKey = column.id.replace('time_', '');
    const updatedItem = { ...item };
    const newResults = { ...updatedItem.results };
    
    if (!newResults[timeKey]) {
      newResults[timeKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
    }
    
    const result = newResults[timeKey];
    // Parse status symbols
    switch (value) {
      case '◎':
        result.planned = true;
        result.actual = true;
        break;
      case '〇':
        result.planned = true;
        result.actual = false;
        break;
      case '●':
        result.planned = false;
        result.actual = true;
        break;
      default:
        result.planned = false;
        result.actual = false;
    }
    
    updatedItem.results = newResults;
    return updatedItem;
  }
  
  // Use existing cellUtils function for other cases
  return setExistingCellValue(item, column, value);
};

/**
 * Extracts clipboard data from selected cells
 */
export const extractClipboardData = (
  selectedRange: { startRow: string; startColumn: string; endRow: string; endColumn: string } | null,
  selectedCell: { rowId: string; columnId: string } | null,
  data: HierarchicalData[],
  columns: GridColumn[],
  sourceArea: 'specifications' | 'maintenance'
): ClipboardData | null => {
  if (!selectedRange && !selectedCell) {
    return null;
  }

  // If single cell is selected, create a 1x1 range
  const range = selectedRange || {
    startRow: selectedCell!.rowId,
    startColumn: selectedCell!.columnId,
    endRow: selectedCell!.rowId,
    endColumn: selectedCell!.columnId
  };

  const startRowIndex = data.findIndex(item => item.id === range.startRow);
  const endRowIndex = data.findIndex(item => item.id === range.endRow);
  const startColumnIndex = columns.findIndex(col => col.id === range.startColumn);
  const endColumnIndex = columns.findIndex(col => col.id === range.endColumn);

  if (startRowIndex === -1 || endRowIndex === -1 || startColumnIndex === -1 || endColumnIndex === -1) {
    return null;
  }

  const cells: ClipboardCell[][] = [];
  
  for (let rowIndex = Math.min(startRowIndex, endRowIndex); rowIndex <= Math.max(startRowIndex, endRowIndex); rowIndex++) {
    const row: ClipboardCell[] = [];
    const item = data[rowIndex];
    
    for (let colIndex = Math.min(startColumnIndex, endColumnIndex); colIndex <= Math.max(startColumnIndex, endColumnIndex); colIndex++) {
      const column = columns[colIndex];
      const value = getCellValue(item, column);
      
      row.push({
        rowId: item.id,
        columnId: column.id,
        value,
        type: column.type
      });
    }
    
    cells.push(row);
  }

  return {
    cells,
    sourceArea,
    timestamp: Date.now()
  };
};

/**
 * Validates paste operation and returns validation results
 */
export interface PasteValidationResult {
  isValid: boolean;
  errors: Array<{
    rowIndex: number;
    columnIndex: number;
    rowId: string;
    columnId: string;
    error: string;
  }>;
  warnings: Array<{
    rowIndex: number;
    columnIndex: number;
    rowId: string;
    columnId: string;
    warning: string;
  }>;
}

export const validatePasteOperation = (
  clipboardData: ClipboardData,
  targetCell: { rowId: string; columnId: string },
  data: HierarchicalData[],
  columns: GridColumn[],
  readOnly: boolean = false
): PasteValidationResult => {
  const result: PasteValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (readOnly) {
    result.isValid = false;
    result.errors.push({
      rowIndex: 0,
      columnIndex: 0,
      rowId: targetCell.rowId,
      columnId: targetCell.columnId,
      error: 'グリッドは読み取り専用です'
    });
    return result;
  }

  const targetRowIndex = data.findIndex(item => item.id === targetCell.rowId);
  const targetColumnIndex = columns.findIndex(col => col.id === targetCell.columnId);

  if (targetRowIndex === -1 || targetColumnIndex === -1) {
    result.isValid = false;
    result.errors.push({
      rowIndex: 0,
      columnIndex: 0,
      rowId: targetCell.rowId,
      columnId: targetCell.columnId,
      error: '無効な貼り付け位置です'
    });
    return result;
  }

  // Validate each cell in the clipboard data
  clipboardData.cells.forEach((row, rowOffset) => {
    row.forEach((cell, colOffset) => {
      const pasteRowIndex = targetRowIndex + rowOffset;
      const pasteColumnIndex = targetColumnIndex + colOffset;
      
      // Check if target position is within bounds
      if (pasteRowIndex >= data.length) {
        result.warnings.push({
          rowIndex: rowOffset,
          columnIndex: colOffset,
          rowId: cell.rowId,
          columnId: cell.columnId,
          warning: '行の範囲を超えています。スキップされます。'
        });
        return;
      }
      
      if (pasteColumnIndex >= columns.length) {
        result.warnings.push({
          rowIndex: rowOffset,
          columnIndex: colOffset,
          rowId: cell.rowId,
          columnId: cell.columnId,
          warning: '列の範囲を超えています。スキップされます。'
        });
        return;
      }
      
      const targetColumn = columns[pasteColumnIndex];
      const targetItem = data[pasteRowIndex];
      
      // Check if column is editable
      if (!targetColumn.editable) {
        result.warnings.push({
          rowIndex: rowOffset,
          columnIndex: colOffset,
          rowId: targetItem.id,
          columnId: targetColumn.id,
          warning: 'この列は編集できません。スキップされます。'
        });
        return;
      }
      
      // Validate cell value
      const validation = validateCellValue(cell.value, targetColumn.type);
      if (!validation.isValid) {
        result.errors.push({
          rowIndex: rowOffset,
          columnIndex: colOffset,
          rowId: targetItem.id,
          columnId: targetColumn.id,
          error: validation.errorMessage || '無効な値です'
        });
        result.isValid = false;
      }
    });
  });

  return result;
};