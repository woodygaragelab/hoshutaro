import { HierarchicalData } from '../../types';
import { GridColumn } from '../ExcelLikeGrid/types';
// Import types are used in type annotations and JSDoc comments

export interface CellClipboardData {
  rowId: string;
  columnId: string;
  value: any;
  dataType: 'status' | 'cost' | 'specification' | 'text' | 'number';
  displayValue: string;
}

export interface ClipboardData {
  cells: CellClipboardData[];
  format: 'single' | 'range';
  timestamp: number;
  source: 'maintenance-grid';
}

/**
 * コピー&ペースト機能を管理するクラス
 */
export class CopyPasteManager {
  private data: HierarchicalData[];
  private columns: GridColumn[];
  private clipboardData: ClipboardData | null = null;

  constructor(data: HierarchicalData[], columns: GridColumn[]) {
    this.data = data;
    this.columns = columns;
  }

  /**
   * セルの値を取得
   */
  private getCellValue(item: HierarchicalData, column: GridColumn, viewMode: 'status' | 'cost'): any {
    const { id } = column;
    
    if (id === 'task') return item.task;
    if (id === 'bomCode') return item.bomCode;
    
    // Handle specification columns
    if (id.startsWith('spec_')) {
      const specKey = id.replace('spec_', '');
      const spec = item.specifications?.find(s => s.key === specKey);
      return spec?.value || '';
    }
    
    // Handle time columns
    if (id.startsWith('time_')) {
      const timeHeader = id.replace('time_', '');
      const result = item.results?.[timeHeader];
      
      if (viewMode === 'cost') {
        return result ? { 
          planCost: result.planCost || 0, 
          actualCost: result.actualCost || 0,
          planned: result.planned || false,
          actual: result.actual || false
        } : { planCost: 0, actualCost: 0, planned: false, actual: false };
      } else {
        // 星取表モードでもコストデータを含める
        return result ? { 
          planned: result.planned || false, 
          actual: result.actual || false,
          planCost: result.planCost || 0,
          actualCost: result.actualCost || 0
        } : { planned: false, actual: false, planCost: 0, actualCost: 0 };
      }
    }
    
    return '';
  }

  /**
   * セルのデータタイプを判定
   */
  private getCellDataType(column: GridColumn, viewMode: 'status' | 'cost'): 'status' | 'cost' | 'specification' | 'text' | 'number' {
    if (column.id.startsWith('time_')) {
      return viewMode;
    } else if (column.id.startsWith('spec_')) {
      return 'specification';
    } else if (column.type === 'number') {
      return 'number';
    } else {
      return 'text';
    }
  }

  /**
   * 値を表示用文字列に変換
   */
  private formatDisplayValue(value: any, dataType: 'status' | 'cost' | 'specification' | 'text' | 'number'): string {
    if (value === null || value === undefined) return '';

    switch (dataType) {
      case 'status':
        const statusValue = value as { planned: boolean; actual: boolean };
        if (statusValue.planned && statusValue.actual) return '◎';
        if (statusValue.planned) return '○';
        if (statusValue.actual) return '●';
        return '';

      case 'cost':
        const costValue = value as { planCost: number; actualCost: number };
        const parts: string[] = [];
        if (costValue.planCost > 0) parts.push(`計画:${costValue.planCost.toLocaleString()}`);
        if (costValue.actualCost > 0) parts.push(`実績:${costValue.actualCost.toLocaleString()}`);
        return parts.join(' / ');

      case 'specification':
        return String(value);

      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);

      case 'text':
      default:
        return String(value);
    }
  }

  /**
   * 単一セルをコピー
   */
  async copySingleCell(
    rowId: string,
    columnId: string,
    viewMode: 'status' | 'cost'
  ): Promise<boolean> {
    const item = this.data.find(d => d.id === rowId);
    const column = this.columns.find(c => c.id === columnId);

    if (!item || !column) return false;

    const value = this.getCellValue(item, column, viewMode);
    const dataType = this.getCellDataType(column, viewMode);
    const displayValue = this.formatDisplayValue(value, dataType);

    const cellData: CellClipboardData = {
      rowId,
      columnId,
      value,
      dataType,
      displayValue,
    };

    this.clipboardData = {
      cells: [cellData],
      format: 'single',
      timestamp: Date.now(),
      source: 'maintenance-grid',
    };

    // システムクリップボードにも保存
    try {
      await navigator.clipboard.writeText(displayValue);
      return true;
    } catch (error) {
      console.warn('Failed to write to system clipboard:', error);
      return true; // 内部クリップボードは成功
    }
  }

  /**
   * 複数セルをコピー（範囲選択）
   */
  async copyCellRange(
    selectedCells: { rowId: string; columnId: string }[],
    viewMode: 'status' | 'cost'
  ): Promise<boolean> {
    if (selectedCells.length === 0) return false;

    const cellsData: CellClipboardData[] = [];

    // セルデータを収集
    for (const { rowId, columnId } of selectedCells) {
      const item = this.data.find(d => d.id === rowId);
      const column = this.columns.find(c => c.id === columnId);

      if (item && column) {
        const value = this.getCellValue(item, column, viewMode);
        const dataType = this.getCellDataType(column, viewMode);
        const displayValue = this.formatDisplayValue(value, dataType);

        cellsData.push({
          rowId,
          columnId,
          value,
          dataType,
          displayValue,
        });
      }
    }

    this.clipboardData = {
      cells: cellsData,
      format: 'range',
      timestamp: Date.now(),
      source: 'maintenance-grid',
    };

    // システムクリップボード用のテキスト形式
    const clipboardText = cellsData.map(cell => cell.displayValue).join('\t');

    try {
      await navigator.clipboard.writeText(clipboardText);
      return true;
    } catch (error) {
      console.warn('Failed to write to system clipboard:', error);
      return true;
    }
  }

  /**
   * セルにペースト
   */
  async pasteSingleCell(
    targetRowId: string,
    targetColumnId: string,
    viewMode: 'status' | 'cost'
  ): Promise<{ success: boolean; value?: any; error?: string }> {
    if (!this.clipboardData || this.clipboardData.cells.length === 0) {
      return { success: false, error: 'クリップボードにデータがありません' };
    }

    const targetItem = this.data.find(d => d.id === targetRowId);
    const targetColumn = this.columns.find(c => c.id === targetColumnId);

    if (!targetItem || !targetColumn) {
      return { success: false, error: '対象セルが見つかりません' };
    }

    const sourceCell = this.clipboardData.cells[0];
    const targetDataType = this.getCellDataType(targetColumn, viewMode);

    // データタイプの互換性チェック
    if (!this.isCompatibleDataType(sourceCell.dataType, targetDataType)) {
      return { 
        success: false, 
        error: `データタイプが互換性がありません: ${sourceCell.dataType} → ${targetDataType}` 
      };
    }

    // 値の変換
    const convertedValue = this.convertValue(sourceCell.value, sourceCell.dataType, targetDataType);

    return { success: true, value: convertedValue };
  }

  /**
   * 複数セルにペースト
   */
  async pasteCellRange(
    targetCells: { rowId: string; columnId: string }[],
    viewMode: 'status' | 'cost'
  ): Promise<{ success: boolean; results: Array<{ rowId: string; columnId: string; value?: any; error?: string }> }> {
    if (!this.clipboardData || this.clipboardData.cells.length === 0) {
      return { 
        success: false, 
        results: targetCells.map(cell => ({ 
          ...cell, 
          error: 'クリップボードにデータがありません' 
        }))
      };
    }

    const results: Array<{ rowId: string; columnId: string; value?: any; error?: string }> = [];
    let successCount = 0;

    for (let i = 0; i < targetCells.length; i++) {
      const targetCell = targetCells[i];

      const pasteResult = await this.pasteSingleCell(targetCell.rowId, targetCell.columnId, viewMode);
      
      if (pasteResult.success) {
        results.push({ ...targetCell, value: pasteResult.value });
        successCount++;
      } else {
        results.push({ ...targetCell, error: pasteResult.error });
      }
    }

    return { success: successCount > 0, results };
  }

  /**
   * データタイプの互換性チェック
   */
  private isCompatibleDataType(
    sourceType: 'status' | 'cost' | 'specification' | 'text' | 'number',
    targetType: 'status' | 'cost' | 'specification' | 'text' | 'number'
  ): boolean {
    // 同じタイプは常に互換性あり
    if (sourceType === targetType) return true;

    // statusとcostは相互に互換性あり（両方ともコストデータを含む）
    if ((sourceType === 'status' && targetType === 'cost') || 
        (sourceType === 'cost' && targetType === 'status')) return true;

    // テキストは他のタイプに変換可能
    if (sourceType === 'text') return true;

    // 数値は文字列に変換可能
    if (sourceType === 'number' && targetType === 'text') return true;

    // 仕様は文字列に変換可能
    if (sourceType === 'specification' && targetType === 'text') return true;

    return false;
  }

  /**
   * 値の変換
   */
  private convertValue(
    value: any,
    sourceType: 'status' | 'cost' | 'specification' | 'text' | 'number',
    targetType: 'status' | 'cost' | 'specification' | 'text' | 'number'
  ): any {
    if (sourceType === targetType) return value;

    // statusとcost間の変換（データを保持）
    if (sourceType === 'status' && targetType === 'cost') {
      return {
        planCost: value.planCost || 0,
        actualCost: value.actualCost || 0,
        planned: value.planned || false,
        actual: value.actual || false
      };
    }
    
    if (sourceType === 'cost' && targetType === 'status') {
      return {
        planned: value.planned || false,
        actual: value.actual || false,
        planCost: value.planCost || 0,
        actualCost: value.actualCost || 0
      };
    }

    switch (targetType) {
      case 'text':
        return this.formatDisplayValue(value, sourceType);

      case 'number':
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const num = parseFloat(value.replace(/[^\d.-]/g, ''));
          return isNaN(num) ? 0 : num;
        }
        return 0;

      case 'status':
        if (sourceType === 'text') {
          const text = String(value).toLowerCase();
          if (text.includes('◎') || text.includes('両方')) return { planned: true, actual: true, planCost: 0, actualCost: 0 };
          if (text.includes('○') || text.includes('計画')) return { planned: true, actual: false, planCost: 0, actualCost: 0 };
          if (text.includes('●') || text.includes('実績')) return { planned: false, actual: true, planCost: 0, actualCost: 0 };
          return { planned: false, actual: false, planCost: 0, actualCost: 0 };
        }
        break;

      case 'cost':
        if (sourceType === 'text') {
          const text = String(value);
          const planMatch = text.match(/計画[:\s]*(\d+)/);
          const actualMatch = text.match(/実績[:\s]*(\d+)/);
          return {
            planCost: planMatch ? parseInt(planMatch[1], 10) : 0,
            actualCost: actualMatch ? parseInt(actualMatch[1], 10) : 0,
            planned: planMatch ? true : false,
            actual: actualMatch ? true : false
          };
        }
        break;

      default:
        return value;
    }

    return value;
  }

  /**
   * クリップボードデータの取得
   */
  getClipboardData(): ClipboardData | null {
    return this.clipboardData;
  }

  /**
   * クリップボードデータのクリア
   */
  clearClipboard(): void {
    this.clipboardData = null;
  }

  /**
   * システムクリップボードからテキストを読み取り
   */
  async readFromSystemClipboard(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.warn('Failed to read from system clipboard:', error);
      return null;
    }
  }
}

/**
 * コピー&ペースト機能用のカスタムフック
 */
export const useCopyPaste = (data: HierarchicalData[], columns: GridColumn[]) => {
  const manager = new CopyPasteManager(data, columns);

  return {
    copySingleCell: manager.copySingleCell.bind(manager),
    copyCellRange: manager.copyCellRange.bind(manager),
    pasteSingleCell: manager.pasteSingleCell.bind(manager),
    pasteCellRange: manager.pasteCellRange.bind(manager),
    getClipboardData: manager.getClipboardData.bind(manager),
    clearClipboard: manager.clearClipboard.bind(manager),
    readFromSystemClipboard: manager.readFromSystemClipboard.bind(manager),
  };
};