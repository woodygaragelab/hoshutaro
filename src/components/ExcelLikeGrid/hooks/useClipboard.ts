import { useCallback } from 'react';
import { ClipboardData, GridColumn } from '../types';
import { HierarchicalData } from '../../../types';
import {
  extractClipboardData,
  clipboardDataToTSV,
  tsvToClipboardData,
  validatePasteOperation,
  PasteValidationResult
} from '../utils/clipboardUtils';

export interface UseClipboardProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  onCellEdit?: (rowId: string, columnId: string, value: any) => void;
  onCopy?: (data: ClipboardData) => void;
  onPaste?: (data: ClipboardData, targetCell: { rowId: string; columnId: string }) => Promise<boolean>;
  readOnly?: boolean;
}

export interface UseClipboardReturn {
  copyToClipboard: (
    selectedRange: { startRow: string; startColumn: string; endRow: string; endColumn: string } | null,
    selectedCell: { rowId: string; columnId: string } | null,
    sourceArea: 'specifications' | 'maintenance'
  ) => Promise<boolean>;
  pasteFromClipboard: (
    targetCell: { rowId: string; columnId: string },
    targetArea: 'specifications' | 'maintenance'
  ) => Promise<PasteValidationResult>;
  pasteClipboardData: (
    clipboardData: ClipboardData,
    targetCell: { rowId: string; columnId: string }
  ) => Promise<PasteValidationResult>;
}

export const useClipboard = ({
  data,
  columns,
  onCellEdit,
  onCopy,
  onPaste,
  readOnly = false
}: UseClipboardProps): UseClipboardReturn => {

  const copyToClipboard = useCallback(async (
    selectedRange: { startRow: string; startColumn: string; endRow: string; endColumn: string } | null,
    selectedCell: { rowId: string; columnId: string } | null,
    sourceArea: 'specifications' | 'maintenance'
  ): Promise<boolean> => {
    try {
      const clipboardData = extractClipboardData(selectedRange, selectedCell, data, columns, sourceArea);
      
      if (!clipboardData) {
        return false;
      }

      // Convert to TSV format for system clipboard
      const tsvData = clipboardDataToTSV(clipboardData);
      
      // Write to system clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tsvData);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = tsvData;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      // Notify parent component
      onCopy?.(clipboardData);
      
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [data, columns, onCopy]);

  const pasteFromClipboard = useCallback(async (
    targetCell: { rowId: string; columnId: string },
    targetArea: 'specifications' | 'maintenance'
  ): Promise<PasteValidationResult> => {
    try {
      let clipboardText = '';
      
      // Read from system clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        clipboardText = await navigator.clipboard.readText();
      } else {
        // Fallback for older browsers - this won't work in most cases due to security restrictions
        // The user would need to use Ctrl+V which triggers the paste event
        throw new Error('Clipboard API not available. Please use Ctrl+V to paste.');
      }

      if (!clipboardText.trim()) {
        return {
          isValid: false,
          errors: [{
            rowIndex: 0,
            columnIndex: 0,
            rowId: targetCell.rowId,
            columnId: targetCell.columnId,
            error: 'クリップボードが空です'
          }],
          warnings: []
        };
      }

      // Convert TSV to clipboard data
      const clipboardData = tsvToClipboardData(clipboardText, targetArea, targetCell, columns, data);
      
      return await pasteClipboardData(clipboardData, targetCell);
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      return {
        isValid: false,
        errors: [{
          rowIndex: 0,
          columnIndex: 0,
          rowId: targetCell.rowId,
          columnId: targetCell.columnId,
          error: error instanceof Error ? error.message : 'ペーストに失敗しました'
        }],
        warnings: []
      };
    }
  }, [columns, data]);

  const pasteClipboardData = useCallback(async (
    clipboardData: ClipboardData,
    targetCell: { rowId: string; columnId: string }
  ): Promise<PasteValidationResult> => {
    // Validate the paste operation
    const validation = validatePasteOperation(clipboardData, targetCell, data, columns, readOnly);
    
    if (!validation.isValid) {
      return validation;
    }

    // If there's a custom paste handler, use it
    if (onPaste) {
      const success = await onPaste(clipboardData, targetCell);
      if (!success) {
        return {
          isValid: false,
          errors: [{
            rowIndex: 0,
            columnIndex: 0,
            rowId: targetCell.rowId,
            columnId: targetCell.columnId,
            error: 'ペースト操作が失敗しました'
          }],
          warnings: []
        };
      }
      return validation;
    }

    // Default paste implementation
    try {
      const targetRowIndex = data.findIndex(item => item.id === targetCell.rowId);
      const targetColumnIndex = columns.findIndex(col => col.id === targetCell.columnId);

      // Apply the paste operation
      clipboardData.cells.forEach((row, rowOffset) => {
        row.forEach((cell, colOffset) => {
          const pasteRowIndex = targetRowIndex + rowOffset;
          const pasteColumnIndex = targetColumnIndex + colOffset;
          
          // Skip if out of bounds or not editable
          if (pasteRowIndex >= data.length || pasteColumnIndex >= columns.length) {
            return;
          }
          
          const targetColumn = columns[pasteColumnIndex];
          const targetItem = data[pasteRowIndex];
          
          if (!targetColumn.editable) {
            return;
          }
          
          // Apply the cell edit
          onCellEdit?.(targetItem.id, targetColumn.id, cell.value);
        });
      });

      return validation;
    } catch (error) {
      console.error('Failed to apply paste operation:', error);
      return {
        isValid: false,
        errors: [{
          rowIndex: 0,
          columnIndex: 0,
          rowId: targetCell.rowId,
          columnId: targetCell.columnId,
          error: 'ペースト操作の適用に失敗しました'
        }],
        warnings: []
      };
    }
  }, [data, columns, readOnly, onCellEdit, onPaste]);

  return {
    copyToClipboard,
    pasteFromClipboard,
    pasteClipboardData
  };
};