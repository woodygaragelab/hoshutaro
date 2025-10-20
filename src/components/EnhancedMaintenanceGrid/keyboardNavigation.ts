import { GridColumn } from '../ExcelLikeGrid/types';
import { HierarchicalData } from '../../types';

export interface NavigationResult {
  rowId: string | null;
  columnId: string | null;
  shouldEdit?: boolean;
}

export interface KeyboardNavigationOptions {
  skipNonEditable?: boolean;
  wrapAround?: boolean;
  allowEditOnEnter?: boolean;
}

/**
 * キーボードナビゲーション用のユーティリティクラス
 */
export class KeyboardNavigationManager {
  private data: HierarchicalData[];
  private columns: GridColumn[];
  private options: KeyboardNavigationOptions;

  constructor(
    data: HierarchicalData[],
    columns: GridColumn[],
    options: KeyboardNavigationOptions = {}
  ) {
    this.data = data;
    this.columns = columns;
    this.options = {
      skipNonEditable: true,
      wrapAround: false,
      allowEditOnEnter: true,
      ...options,
    };
  }

  /**
   * 現在のセル位置を取得
   */
  private getCurrentCellIndex(rowId: string | null, columnId: string | null): {
    rowIndex: number;
    columnIndex: number;
  } {
    const rowIndex = rowId ? this.data.findIndex(item => item.id === rowId) : -1;
    const columnIndex = columnId ? this.columns.findIndex(col => col.id === columnId) : -1;
    
    return { rowIndex, columnIndex };
  }

  /**
   * セルが編集可能かどうかをチェック
   */
  private isCellEditable(rowIndex: number, columnIndex: number): boolean {
    if (rowIndex < 0 || rowIndex >= this.data.length) return false;
    if (columnIndex < 0 || columnIndex >= this.columns.length) return false;

    const column = this.columns[columnIndex];
    return column.editable || false;
  }

  /**
   * 次の編集可能なセルを見つける
   */
  private findNextEditableCell(
    startRowIndex: number,
    startColumnIndex: number,
    direction: 'next' | 'previous'
  ): { rowIndex: number; columnIndex: number } | null {
    const totalCells = this.data.length * this.columns.length;
    let currentIndex = startRowIndex * this.columns.length + startColumnIndex;
    
    const increment = direction === 'next' ? 1 : -1;
    
    for (let i = 0; i < totalCells; i++) {
      currentIndex += increment;
      
      if (this.options.wrapAround) {
        if (currentIndex >= totalCells) currentIndex = 0;
        if (currentIndex < 0) currentIndex = totalCells - 1;
      } else {
        if (currentIndex >= totalCells || currentIndex < 0) break;
      }
      
      const rowIndex = Math.floor(currentIndex / this.columns.length);
      const columnIndex = currentIndex % this.columns.length;
      
      if (this.isCellEditable(rowIndex, columnIndex)) {
        return { rowIndex, columnIndex };
      }
    }
    
    return null;
  }

  /**
   * Tab キーナビゲーション
   */
  handleTabNavigation(
    currentRowId: string | null,
    currentColumnId: string | null,
    shiftKey: boolean = false
  ): NavigationResult {
    const { rowIndex, columnIndex } = this.getCurrentCellIndex(currentRowId, currentColumnId);
    
    if (this.options.skipNonEditable) {
      const direction = shiftKey ? 'previous' : 'next';
      const nextCell = this.findNextEditableCell(rowIndex, columnIndex, direction);
      
      if (nextCell) {
        return {
          rowId: this.data[nextCell.rowIndex].id,
          columnId: this.columns[nextCell.columnIndex].id,
        };
      }
    } else {
      // 通常のTab移動
      let nextColumnIndex = columnIndex + (shiftKey ? -1 : 1);
      let nextRowIndex = rowIndex;
      
      if (nextColumnIndex >= this.columns.length) {
        nextColumnIndex = 0;
        nextRowIndex++;
      } else if (nextColumnIndex < 0) {
        nextColumnIndex = this.columns.length - 1;
        nextRowIndex--;
      }
      
      if (nextRowIndex >= 0 && nextRowIndex < this.data.length) {
        return {
          rowId: this.data[nextRowIndex].id,
          columnId: this.columns[nextColumnIndex].id,
        };
      }
    }
    
    return { rowId: null, columnId: null };
  }

  /**
   * Enter キーナビゲーション
   */
  handleEnterNavigation(
    currentRowId: string | null,
    currentColumnId: string | null,
    shiftKey: boolean = false
  ): NavigationResult {
    const { rowIndex, columnIndex } = this.getCurrentCellIndex(currentRowId, currentColumnId);
    
    let nextRowIndex = rowIndex + (shiftKey ? -1 : 1);
    
    // 同じ列で次の行に移動
    if (nextRowIndex >= 0 && nextRowIndex < this.data.length) {
      const result: NavigationResult = {
        rowId: this.data[nextRowIndex].id,
        columnId: currentColumnId,
      };
      
      // 編集可能なセルの場合は編集モードに入る
      if (this.options.allowEditOnEnter && this.isCellEditable(nextRowIndex, columnIndex)) {
        result.shouldEdit = true;
      }
      
      return result;
    }
    
    return { rowId: null, columnId: null };
  }

  /**
   * 矢印キーナビゲーション
   */
  handleArrowNavigation(
    currentRowId: string | null,
    currentColumnId: string | null,
    direction: 'up' | 'down' | 'left' | 'right'
  ): NavigationResult {
    const { rowIndex, columnIndex } = this.getCurrentCellIndex(currentRowId, currentColumnId);
    
    let nextRowIndex = rowIndex;
    let nextColumnIndex = columnIndex;
    
    switch (direction) {
      case 'up':
        nextRowIndex = Math.max(0, rowIndex - 1);
        break;
      case 'down':
        nextRowIndex = Math.min(this.data.length - 1, rowIndex + 1);
        break;
      case 'left':
        nextColumnIndex = Math.max(0, columnIndex - 1);
        break;
      case 'right':
        nextColumnIndex = Math.min(this.columns.length - 1, columnIndex + 1);
        break;
    }
    
    // 編集可能セルのスキップ
    if (this.options.skipNonEditable) {
      // 指定方向で最初に見つかる編集可能セルに移動
      const searchDirection = direction === 'up' || direction === 'left' ? 'previous' : 'next';
      const nextCell = this.findNextEditableCell(nextRowIndex, nextColumnIndex, searchDirection);
      
      if (nextCell) {
        return {
          rowId: this.data[nextCell.rowIndex].id,
          columnId: this.columns[nextCell.columnIndex].id,
        };
      }
    }
    
    if (nextRowIndex !== rowIndex || nextColumnIndex !== columnIndex) {
      return {
        rowId: this.data[nextRowIndex].id,
        columnId: this.columns[nextColumnIndex].id,
      };
    }
    
    return { rowId: null, columnId: null };
  }

  /**
   * Home/End キーナビゲーション
   */
  handleHomeEndNavigation(
    currentRowId: string | null,
    key: 'Home' | 'End',
    ctrlKey: boolean = false
  ): NavigationResult {
    const { rowIndex } = this.getCurrentCellIndex(currentRowId, null);
    
    if (ctrlKey) {
      // Ctrl+Home: 最初のセル, Ctrl+End: 最後のセル
      if (key === 'Home') {
        return {
          rowId: this.data[0]?.id || null,
          columnId: this.columns[0]?.id || null,
        };
      } else {
        return {
          rowId: this.data[this.data.length - 1]?.id || null,
          columnId: this.columns[this.columns.length - 1]?.id || null,
        };
      }
    } else {
      // Home: 行の最初のセル, End: 行の最後のセル
      if (rowIndex >= 0 && rowIndex < this.data.length) {
        return {
          rowId: this.data[rowIndex].id,
          columnId: key === 'Home' ? this.columns[0]?.id || null : this.columns[this.columns.length - 1]?.id || null,
        };
      }
    }
    
    return { rowId: null, columnId: null };
  }

  /**
   * キーボードイベントハンドラー
   */
  handleKeyDown(
    event: KeyboardEvent,
    currentRowId: string | null,
    currentColumnId: string | null,
    isEditing: boolean = false
  ): NavigationResult | null {
    // 編集中の場合はEscapeキーのみ処理
    if (isEditing && event.key !== 'Escape') {
      return null;
    }

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        return this.handleTabNavigation(currentRowId, currentColumnId, event.shiftKey);
        
      case 'Enter':
        event.preventDefault();
        return this.handleEnterNavigation(currentRowId, currentColumnId, event.shiftKey);
        
      case 'ArrowUp':
        event.preventDefault();
        return this.handleArrowNavigation(currentRowId, currentColumnId, 'up');
        
      case 'ArrowDown':
        event.preventDefault();
        return this.handleArrowNavigation(currentRowId, currentColumnId, 'down');
        
      case 'ArrowLeft':
        event.preventDefault();
        return this.handleArrowNavigation(currentRowId, currentColumnId, 'left');
        
      case 'ArrowRight':
        event.preventDefault();
        return this.handleArrowNavigation(currentRowId, currentColumnId, 'right');
        
      case 'Home':
        event.preventDefault();
        return this.handleHomeEndNavigation(currentRowId, 'Home', event.ctrlKey);
        
      case 'End':
        event.preventDefault();
        return this.handleHomeEndNavigation(currentRowId, 'End', event.ctrlKey);
        
      case 'Escape':
        if (isEditing) {
          event.preventDefault();
          return { rowId: currentRowId, columnId: currentColumnId }; // 編集キャンセル
        }
        break;
        
      default:
        return null;
    }
    
    return null;
  }
}

/**
 * キーボードナビゲーション用のカスタムフック
 */
export const useKeyboardNavigation = (
  data: HierarchicalData[],
  columns: GridColumn[],
  options?: KeyboardNavigationOptions
) => {
  const navigationManager = new KeyboardNavigationManager(data, columns, options);
  
  return {
    handleKeyDown: navigationManager.handleKeyDown.bind(navigationManager),
    handleTabNavigation: navigationManager.handleTabNavigation.bind(navigationManager),
    handleEnterNavigation: navigationManager.handleEnterNavigation.bind(navigationManager),
    handleArrowNavigation: navigationManager.handleArrowNavigation.bind(navigationManager),
  };
};