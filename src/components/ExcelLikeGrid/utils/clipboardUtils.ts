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
      // Status values can be symbols (○, ●, ◎) or specific strings
      const validStatuses = ['plan', 'actual', 'completed', 'cancelled', '○', '●', '◎', '〇'];
      if (typeof value === 'string' && (validStatuses.includes(value) || validStatuses.includes(value.toLowerCase()))) {
        return { isValid: true };
      }
      // Also allow boolean objects for status
      if (typeof value === 'object' && value !== null && ('planned' in value || 'actual' in value)) {
        return { isValid: true };
      }
      return { isValid: true }; // Allow any value for status, will be converted during paste

    case 'cost':
      // Allow cost objects or numeric values
      if (typeof value === 'object' && value !== null) {
        return { isValid: true };
      }
      const costValue = Number(value);
      if (isNaN(costValue) || costValue < 0) {
        return { isValid: true }; // Allow any value, will be converted during paste
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
    .map(row => row.map(cell => {
      const value = cell.value;
      // オブジェクト形式の値を文字列に変換
      if (typeof value === 'object' && value !== null) {
        if ('planned' in value && 'actual' in value) {
          // コストデータを含むJSON文字列として保存
          return JSON.stringify({
            planned: value.planned || false,
            actual: value.actual || false,
            planCost: value.planCost || 0,
            actualCost: value.actualCost || 0
          });
        }
      }
      return String(value || '');
    }).join('\t'))
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
      
      let parsedValue: any = value.trim();
      
      // time_列の場合、JSON文字列または記号をパース
      if (targetColumn?.id.startsWith('time_')) {
        // JSON文字列の場合
        if (parsedValue.startsWith('{')) {
          try {
            parsedValue = JSON.parse(parsedValue);
          } catch (e) {
            console.warn('Failed to parse JSON value:', parsedValue);
            parsedValue = { planned: false, actual: false, planCost: 0, actualCost: 0 };
          }
        } else {
          // 星取表の記号をオブジェクトに変換
          if (parsedValue === '◎') {
            parsedValue = { planned: true, actual: true, planCost: 0, actualCost: 0 };
          } else if (parsedValue === '○' || parsedValue === '〇') {
            parsedValue = { planned: true, actual: false, planCost: 0, actualCost: 0 };
          } else if (parsedValue === '●') {
            parsedValue = { planned: false, actual: true, planCost: 0, actualCost: 0 };
          } else if (parsedValue === '') {
            parsedValue = { planned: false, actual: false, planCost: 0, actualCost: 0 };
          }
        }
      }
      
      return {
        rowId: targetRow?.id || '',
        columnId: targetColumn?.id || '',
        value: parsedValue,
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
  
  // Handle maintenance data with time_ prefix - コストデータも含める
  if (column.id.startsWith('time_')) {
    const timeKey = column.id.replace('time_', '');
    const result = item.results?.[timeKey];
    if (result) {
      // オブジェクト形式で返す（コストデータを含む）
      return {
        planned: result.planned || false,
        actual: result.actual || false,
        planCost: result.planCost || 0,
        actualCost: result.actualCost || 0
      };
    }
    return { planned: false, actual: false, planCost: 0, actualCost: 0 };
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
    
    // オブジェクト形式の値を処理
    if (typeof value === 'object' && value !== null && ('planned' in value || 'actual' in value)) {
      result.planned = value.planned || false;
      result.actual = value.actual || false;
      result.planCost = value.planCost || 0;
      result.actualCost = value.actualCost || 0;
    } else {
      // 文字列の場合は記号をパース
      switch (value) {
        case '◎':
          result.planned = true;
          result.actual = true;
          break;
        case '〇':
        case '○':
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
  console.log('[validatePasteOperation] Starting validation', { clipboardData, targetCell, readOnly });
  const result: PasteValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (readOnly) {
    console.log('[validatePasteOperation] Grid is read-only');
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
  console.log('[validatePasteOperation] Target indices', { targetRowIndex, targetColumnIndex });

  if (targetRowIndex === -1 || targetColumnIndex === -1) {
    console.log('[validatePasteOperation] Invalid target position');
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
      console.log('[validatePasteOperation] Cell validation', { 
        rowOffset, 
        colOffset, 
        value: cell.value, 
        columnType: targetColumn.type, 
        validation 
      });
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

  console.log('[validatePasteOperation] Validation complete', result);
  return result;
};