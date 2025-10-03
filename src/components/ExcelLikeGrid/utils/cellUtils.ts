import { HierarchicalData } from '../../../types';
import { GridColumn } from '../types';

/**
 * Get the value from a cell based on the column configuration
 */
export const getCellValue = (item: HierarchicalData, column: GridColumn): any => {
  if (column.accessor) {
    // Use accessor path to get nested values
    const path = column.accessor.split('.');
    let value: any = item;
    
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  // Default mapping for common fields
  switch (column.id) {
    case 'task':
      return item.task;
    case 'bomCode':
      return item.bomCode;
    case 'cycle':
      return item.cycle;
    case 'level':
      return item.level;
    default:
      // Check if it's a time-based column (results data)
      if (item.results && item.results[column.id]) {
        const result = item.results[column.id];
        if (column.type === 'status') {
          if (result.planned && result.actual) return '◎';
          if (result.planned) return '〇';
          if (result.actual) return '●';
          return '';
        } else if (column.type === 'cost') {
          return `${result.planCost || 0} / ${result.actualCost || 0}`;
        }
      }
      
      // Check specifications
      const spec = item.specifications?.find(s => s.key === column.id);
      if (spec) {
        return spec.value;
      }
      
      return '';
  }
};

/**
 * Set the value in a cell and return the updated item
 */
export const setCellValue = (item: HierarchicalData, column: GridColumn, value: any): any => {
  if (column.accessor) {
    // Handle nested value setting
    const path = column.accessor.split('.');
    const newItem = { ...item };
    let current: any = newItem;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[path[path.length - 1]] = value;
    return newItem;
  }

  // Default mapping for common fields
  switch (column.id) {
    case 'task':
    case 'bomCode':
    case 'cycle':
    case 'level':
      return { ...item, [column.id]: value };
    default:
      // Handle time-based columns (results data)
      if (column.type === 'status' || column.type === 'cost') {
        const newResults = { ...item.results };
        if (!newResults[column.id]) {
          newResults[column.id] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
        }
        
        if (column.type === 'status') {
          // Parse status symbols
          const result = newResults[column.id];
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
        }
        
        return { ...item, results: newResults };
      }
      
      // Handle specifications
      const newSpecs = [...(item.specifications || [])];
      const existingSpecIndex = newSpecs.findIndex(s => s.key === column.id);
      
      if (existingSpecIndex >= 0) {
        newSpecs[existingSpecIndex] = { ...newSpecs[existingSpecIndex], value: String(value) };
      } else {
        newSpecs.push({ key: column.id, value: String(value), order: newSpecs.length });
      }
      
      return { ...item, specifications: newSpecs };
  }
};

/**
 * Calculate optimal column width based on content
 */
export const calculateOptimalColumnWidth = (
  column: GridColumn,
  data: HierarchicalData[],
  minWidth?: number,
  maxWidth?: number
): number => {
  // Create a temporary canvas element to measure text width
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    return column.width; // Fallback to current width
  }

  // Set font properties (should match your grid's font)
  context.font = '14px "Roboto", "Helvetica", "Arial", sans-serif';
  
  let maxContentWidth = 0;
  
  // Measure header text
  const headerWidth = context.measureText(column.header).width;
  maxContentWidth = Math.max(maxContentWidth, headerWidth);
  
  // Measure content in each row
  data.forEach(item => {
    const cellValue = getCellValue(item, column);
    const displayValue = cellValue?.toString() || '';
    const contentWidth = context.measureText(displayValue).width;
    maxContentWidth = Math.max(maxContentWidth, contentWidth);
  });
  
  // Add padding (16px on each side for padding + some extra space)
  const calculatedWidth = maxContentWidth + 40;
  
  // Apply min/max constraints
  const finalMinWidth = minWidth || column.minWidth || 50;
  const finalMaxWidth = maxWidth || column.maxWidth || 500;
  
  return Math.max(finalMinWidth, Math.min(calculatedWidth, finalMaxWidth));
};

/**
 * Calculate optimal row height based on content
 */
export const calculateOptimalRowHeight = (
  rowId: string,
  columns: GridColumn[],
  data: HierarchicalData[],
  columnWidths: { [columnId: string]: number },
  minHeight?: number,
  maxHeight?: number
): number => {
  const item = data.find(d => d.id === rowId);
  if (!item) {
    return minHeight || 40; // Default height
  }

  // Create a temporary canvas element to measure text height
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    return minHeight || 40; // Fallback to default height
  }

  // Set font properties
  context.font = '14px "Roboto", "Helvetica", "Arial", sans-serif';
  
  let maxRequiredHeight = 0;
  
  columns.forEach(column => {
    const cellValue = getCellValue(item, column);
    const displayValue = cellValue?.toString() || '';
    
    if (displayValue.length === 0) {
      return; // Skip empty cells
    }
    
    const columnWidth = columnWidths[column.id] || column.width;
    const availableWidth = columnWidth - 16; // Account for padding
    
    // Calculate how many lines the text would need
    const words = displayValue.split(' ');
    let currentLine = '';
    let lineCount = 1;
    
    words.forEach((word: string) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = context.measureText(testLine).width;
      
      if (testWidth > availableWidth && currentLine) {
        lineCount++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    // Calculate height needed (line height is typically 1.2 * font size)
    const lineHeight = 16.8; // 14px * 1.2
    const requiredHeight = lineCount * lineHeight + 16; // Add padding
    
    maxRequiredHeight = Math.max(maxRequiredHeight, requiredHeight);
  });
  
  // Apply min/max constraints
  const finalMinHeight = minHeight || 30;
  const finalMaxHeight = maxHeight || 200;
  
  return Math.max(finalMinHeight, Math.min(maxRequiredHeight, finalMaxHeight));
};

/**
 * Estimate text width for a given string and font
 */
export const estimateTextWidth = (text: string, fontSize: number = 14): number => {
  // Rough estimation: average character width is about 0.6 * fontSize for most fonts
  return text.length * fontSize * 0.6;
};

/**
 * Check if text would overflow in a given width
 */
export const wouldTextOverflow = (text: string, availableWidth: number, fontSize: number = 14): boolean => {
  const estimatedWidth = estimateTextWidth(text, fontSize);
  return estimatedWidth > availableWidth;
};