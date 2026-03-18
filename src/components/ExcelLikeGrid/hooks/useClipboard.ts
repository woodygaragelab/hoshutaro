/**
 * Clipboard Hook
 * Handle copy/paste operations for grid cells
 */

import { useCallback, useState } from 'react';
import { ClipboardData, GridColumn } from '../types';

export interface UseClipboardOptions {
  data: any[];
  columns: GridColumn[];
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  readOnly?: boolean;
}

export interface UseClipboardResult {
  clipboardData: ClipboardData | null;
  copyToClipboard: (selectedCells: any) => void;
  pasteFromClipboard: (targetCell: any) => void;
  copy: (data: string[][]) => void;
  cut: (data: string[][]) => void;
  paste: () => string[][] | null;
  clear: () => void;
}

/**
 * Custom hook for clipboard operations
 */
export function useClipboard(options: UseClipboardOptions): UseClipboardResult {
  const { data, columns, onCellEdit, readOnly = false } = options;
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);

  const copy = useCallback((data: string[][]) => {
    setClipboardData({
      rows: data,
      source: 'copy',
      timestamp: Date.now(),
    });

    // Also copy to system clipboard
    const text = data.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, []);

  const cut = useCallback((data: string[][]) => {
    setClipboardData({
      rows: data,
      source: 'cut',
      timestamp: Date.now(),
    });

    // Also copy to system clipboard
    const text = data.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, []);

  const paste = useCallback(() => {
    if (!clipboardData) return null;
    return clipboardData.rows;
  }, [clipboardData]);

  const clear = useCallback(() => {
    setClipboardData(null);
  }, []);

  // Copy selected cells to clipboard
  const copyToClipboard = useCallback((selectedCells: any) => {
    // Simplified implementation - just copy empty data for now
    copy([['']]);
  }, [copy]);

  // Paste from clipboard to target cell
  const pasteFromClipboard = useCallback((targetCell: any) => {
    if (readOnly) return;
    
    const data = paste();
    if (!data) return;

    // Simplified implementation - would need actual paste logic
    console.log('Paste data:', data);
  }, [readOnly, paste]);

  return {
    clipboardData,
    copyToClipboard,
    pasteFromClipboard,
    copy,
    cut,
    paste,
    clear,
  };
}
