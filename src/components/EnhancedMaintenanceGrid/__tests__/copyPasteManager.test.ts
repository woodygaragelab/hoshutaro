import { CopyPasteManager } from '../copyPasteManager';
import { GridColumn } from '../../ExcelLikeGrid/types';
import { HierarchicalData } from '../../../types';

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

// Mock data for testing
const mockColumns: GridColumn[] = [
  { id: 'task', label: 'タスク', width: 200, editable: false, type: 'text' },
  { id: 'bomCode', label: 'BOMコード', width: 150, editable: false, type: 'text' },
  { id: 'cycle', label: 'サイクル', width: 100, editable: false, type: 'text' },
  { id: 'spec_name', label: '機器名称', width: 180, editable: true, type: 'text' },
  { id: 'spec_model', label: '型式', width: 150, editable: true, type: 'text' },
  { id: 'time_2024Q1', label: '2024Q1', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q2', label: '2024Q2', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q3', label: '2024Q3', width: 100, editable: true, type: 'cost' },
];

const mockData: HierarchicalData[] = [
  {
    id: 'item1',
    task: 'タスク1',
    bomCode: 'BOM001',
    cycle: 'A',
    specifications: [
      { key: 'name', value: '機器A', order: 1 },
      { key: 'model', value: 'Model-A1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: true, actual: false, planCost: 100000, actualCost: 0 },
      '2024Q2': { planned: false, actual: true, planCost: 0, actualCost: 120000 },
      '2024Q3': { planned: true, actual: true, planCost: 150000, actualCost: 140000 },
    },
  },
  {
    id: 'item2',
    task: 'タスク2',
    bomCode: 'BOM002',
    cycle: 'B',
    specifications: [
      { key: 'name', value: '機器B', order: 1 },
      { key: 'model', value: 'Model-B1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024Q2': { planned: true, actual: false, planCost: 200000, actualCost: 0 },
      '2024Q3': { planned: false, actual: true, planCost: 0, actualCost: 180000 },
    },
  },
  {
    id: 'item3',
    task: 'タスク3',
    bomCode: 'BOM003',
    cycle: 'A',
    specifications: [
      { key: 'name', value: '機器C', order: 1 },
      { key: 'model', value: 'Model-C1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: true, actual: true, planCost: 300000, actualCost: 290000 },
      '2024Q2': { planned: true, actual: false, planCost: 250000, actualCost: 0 },
      '2024Q3': { planned: false, actual: false, planCost: 0, actualCost: 0 },
    },
  },
];

describe('CopyPasteManager', () => {
  let copyPasteManager: CopyPasteManager;

  beforeEach(() => {
    copyPasteManager = new CopyPasteManager(mockData, mockColumns);
    jest.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
    mockClipboard.readText.mockResolvedValue('');
  });

  describe('Single Cell Copy', () => {
    test('should copy text cell successfully', async () => {
      const result = await copyPasteManager.copySingleCell('item1', 'task', 'status');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('タスク1');
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData).not.toBeNull();
      expect(clipboardData?.cells).toHaveLength(1);
      expect(clipboardData?.cells[0]).toEqual({
        rowId: 'item1',
        columnId: 'task',
        value: 'タスク1',
        dataType: 'text',
        displayValue: 'タスク1',
      });
    });

    test('should copy status cell in status view mode', async () => {
      const result = await copyPasteManager.copySingleCell('item1', 'time_2024Q1', 'status');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('○');
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0]).toEqual({
        rowId: 'item1',
        columnId: 'time_2024Q1',
        value: { planned: true, actual: false },
        dataType: 'status',
        displayValue: '○',
      });
    });

    test('should copy cost cell in cost view mode', async () => {
      const result = await copyPasteManager.copySingleCell('item1', 'time_2024Q3', 'cost');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('計画:150,000 / 実績:140,000');
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0]).toEqual({
        rowId: 'item1',
        columnId: 'time_2024Q3',
        value: { planCost: 150000, actualCost: 140000 },
        dataType: 'cost',
        displayValue: '計画:150,000 / 実績:140,000',
      });
    });

    test('should copy specification cell', async () => {
      const result = await copyPasteManager.copySingleCell('item1', 'spec_name', 'status');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('機器A');
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0]).toEqual({
        rowId: 'item1',
        columnId: 'spec_name',
        value: '機器A',
        dataType: 'specification',
        displayValue: '機器A',
      });
    });

    test('should handle different status symbols correctly', async () => {
      // Test unplanned status (empty)
      await copyPasteManager.copySingleCell('item2', 'time_2024Q1', 'status');
      let clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0].displayValue).toBe('');

      // Test actual status (●)
      await copyPasteManager.copySingleCell('item1', 'time_2024Q2', 'status');
      clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0].displayValue).toBe('●');

      // Test both status (◎)
      await copyPasteManager.copySingleCell('item1', 'time_2024Q3', 'status');
      clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells[0].displayValue).toBe('◎');
    });

    test('should handle copy failure gracefully', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));
      
      const result = await copyPasteManager.copySingleCell('item1', 'task', 'status');
      
      expect(result).toBe(true); // Should still return true for internal clipboard
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData).not.toBeNull();
    });

    test('should return false for invalid cell reference', async () => {
      const result = await copyPasteManager.copySingleCell('invalid-id', 'task', 'status');
      
      expect(result).toBe(false);
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Cell Copy', () => {
    test('should copy multiple cells successfully', async () => {
      const selectedCells = [
        { rowId: 'item1', columnId: 'task' },
        { rowId: 'item1', columnId: 'bomCode' },
        { rowId: 'item1', columnId: 'time_2024Q1' },
      ];

      const result = await copyPasteManager.copyCellRange(selectedCells, 'status');
      
      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('タスク1\tBOM001\t○');
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells).toHaveLength(3);
      expect(clipboardData?.format).toBe('range');
    });

    test('should handle empty selection', async () => {
      const result = await copyPasteManager.copyCellRange([], 'status');
      
      expect(result).toBe(false);
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    test('should skip invalid cells in range', async () => {
      const selectedCells = [
        { rowId: 'item1', columnId: 'task' },
        { rowId: 'invalid-id', columnId: 'task' },
        { rowId: 'item1', columnId: 'invalid-column' },
        { rowId: 'item2', columnId: 'bomCode' },
      ];

      const result = await copyPasteManager.copyCellRange(selectedCells, 'status');
      
      expect(result).toBe(true);
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData?.cells).toHaveLength(2); // Only valid cells
      expect(clipboardData?.cells[0].value).toBe('タスク1');
      expect(clipboardData?.cells[1].value).toBe('BOM002');
    });
  });

  describe('Single Cell Paste', () => {
    beforeEach(async () => {
      // Set up clipboard data
      await copyPasteManager.copySingleCell('item1', 'task', 'status');
    });

    test('should paste to compatible cell successfully', async () => {
      const result = await copyPasteManager.pasteSingleCell('item2', 'task', 'status');
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('タスク1');
      expect(result.error).toBeUndefined();
    });

    test('should handle paste to non-existent cell', async () => {
      const result = await copyPasteManager.pasteSingleCell('invalid-id', 'task', 'status');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('対象セルが見つかりません');
    });

    test('should handle empty clipboard', async () => {
      copyPasteManager.clearClipboard();
      
      const result = await copyPasteManager.pasteSingleCell('item2', 'task', 'status');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('クリップボードにデータがありません');
    });

    test('should convert status to text', async () => {
      // Copy status cell
      await copyPasteManager.copySingleCell('item1', 'time_2024Q1', 'status');
      
      // Paste to text cell
      const result = await copyPasteManager.pasteSingleCell('item2', 'task', 'status');
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('○');
    });

    test('should convert cost to text', async () => {
      // Copy cost cell
      await copyPasteManager.copySingleCell('item1', 'time_2024Q3', 'cost');
      
      // Paste to text cell
      const result = await copyPasteManager.pasteSingleCell('item2', 'task', 'cost');
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('計画:150,000 / 実績:140,000');
    });

    test('should convert text to status', async () => {
      // Copy text that represents status
      await copyPasteManager.copySingleCell('item1', 'task', 'status');
      copyPasteManager.getClipboardData()!.cells[0].value = '◎';
      copyPasteManager.getClipboardData()!.cells[0].dataType = 'text';
      
      // Paste to status cell
      const result = await copyPasteManager.pasteSingleCell('item2', 'time_2024Q1', 'status');
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ planned: true, actual: true });
    });

    test('should convert text to cost', async () => {
      // Copy text that represents cost
      await copyPasteManager.copySingleCell('item1', 'task', 'status');
      copyPasteManager.getClipboardData()!.cells[0].value = '計画:100000 実績:90000';
      copyPasteManager.getClipboardData()!.cells[0].dataType = 'text';
      
      // Paste to cost cell
      const result = await copyPasteManager.pasteSingleCell('item2', 'time_2024Q3', 'cost');
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ planCost: 100000, actualCost: 90000 });
    });

    test('should handle incompatible data types', async () => {
      // Copy status cell
      await copyPasteManager.copySingleCell('item1', 'time_2024Q1', 'status');
      
      // Try to paste to cost cell (should be compatible via conversion)
      const result = await copyPasteManager.pasteSingleCell('item2', 'time_2024Q3', 'cost');
      
      expect(result.success).toBe(true); // Status can be converted to text, then to cost
    });
  });

  describe('Multiple Cell Paste', () => {
    beforeEach(async () => {
      // Set up clipboard data with multiple cells
      const selectedCells = [
        { rowId: 'item1', columnId: 'task' },
        { rowId: 'item1', columnId: 'bomCode' },
      ];
      await copyPasteManager.copyCellRange(selectedCells, 'status');
    });

    test('should paste to multiple cells successfully', async () => {
      const targetCells = [
        { rowId: 'item2', columnId: 'task' },
        { rowId: 'item2', columnId: 'bomCode' },
      ];

      const result = await copyPasteManager.pasteCellRange(targetCells, 'status');
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].value).toBe('タスク1');
      expect(result.results[1].value).toBe('BOM001');
    });

    test('should handle circular paste when target is larger than source', async () => {
      const targetCells = [
        { rowId: 'item2', columnId: 'task' },
        { rowId: 'item2', columnId: 'bomCode' },
        { rowId: 'item2', columnId: 'cycle' },
        { rowId: 'item3', columnId: 'task' },
      ];

      const result = await copyPasteManager.pasteCellRange(targetCells, 'status');
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(4);
      // Should repeat source data
      expect(result.results[0].value).toBe('タスク1');
      expect(result.results[1].value).toBe('BOM001');
      expect(result.results[2].value).toBe('タスク1'); // Circular
      expect(result.results[3].value).toBe('BOM001'); // Circular
    });

    test('should handle partial failures in range paste', async () => {
      const targetCells = [
        { rowId: 'item2', columnId: 'task' },
        { rowId: 'invalid-id', columnId: 'task' },
        { rowId: 'item3', columnId: 'task' },
      ];

      const result = await copyPasteManager.pasteCellRange(targetCells, 'status');
      
      expect(result.success).toBe(true); // Some succeeded
      expect(result.results).toHaveLength(3);
      expect(result.results[0].value).toBe('タスク1');
      expect(result.results[1].error).toBe('対象セルが見つかりません');
      expect(result.results[2].value).toBe('タスク1');
    });

    test('should handle empty clipboard for range paste', async () => {
      copyPasteManager.clearClipboard();
      
      const targetCells = [
        { rowId: 'item2', columnId: 'task' },
        { rowId: 'item3', columnId: 'task' },
      ];

      const result = await copyPasteManager.pasteCellRange(targetCells, 'status');
      
      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].error).toBe('クリップボードにデータがありません');
      expect(result.results[1].error).toBe('クリップボードにデータがありません');
    });
  });

  describe('Data Type Conversion', () => {
    test('should identify compatible data types correctly', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const isCompatible = (manager as any).isCompatibleDataType;
      
      expect(isCompatible('text', 'text')).toBe(true);
      expect(isCompatible('status', 'status')).toBe(true);
      expect(isCompatible('text', 'status')).toBe(true);
      expect(isCompatible('number', 'text')).toBe(true);
      expect(isCompatible('specification', 'text')).toBe(true);
      expect(isCompatible('status', 'cost')).toBe(false);
    });

    test('should convert values correctly', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const convertValue = (manager as any).convertValue;
      
      // Number to text
      expect(convertValue(12345, 'number', 'text')).toBe('12,345');
      
      // Text to number
      expect(convertValue('12,345', 'text', 'number')).toBe(12345);
      expect(convertValue('abc', 'text', 'number')).toBe(0);
      
      // Text to status
      expect(convertValue('◎', 'text', 'status')).toEqual({ planned: true, actual: true });
      expect(convertValue('○', 'text', 'status')).toEqual({ planned: true, actual: false });
      expect(convertValue('●', 'text', 'status')).toEqual({ planned: false, actual: true });
      expect(convertValue('', 'text', 'status')).toEqual({ planned: false, actual: false });
      
      // Text to cost
      expect(convertValue('計画:100000 実績:90000', 'text', 'cost')).toEqual({
        planCost: 100000,
        actualCost: 90000,
      });
    });
  });

  describe('Display Value Formatting', () => {
    test('should format status values correctly', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const formatDisplayValue = (manager as any).formatDisplayValue;
      
      expect(formatDisplayValue({ planned: true, actual: false }, 'status')).toBe('○');
      expect(formatDisplayValue({ planned: false, actual: true }, 'status')).toBe('●');
      expect(formatDisplayValue({ planned: true, actual: true }, 'status')).toBe('◎');
      expect(formatDisplayValue({ planned: false, actual: false }, 'status')).toBe('');
    });

    test('should format cost values correctly', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const formatDisplayValue = (manager as any).formatDisplayValue;
      
      expect(formatDisplayValue({ planCost: 100000, actualCost: 90000 }, 'cost'))
        .toBe('計画:100,000 / 実績:90,000');
      expect(formatDisplayValue({ planCost: 100000, actualCost: 0 }, 'cost'))
        .toBe('計画:100,000');
      expect(formatDisplayValue({ planCost: 0, actualCost: 90000 }, 'cost'))
        .toBe('実績:90,000');
      expect(formatDisplayValue({ planCost: 0, actualCost: 0 }, 'cost'))
        .toBe('');
    });

    test('should format number values correctly', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const formatDisplayValue = (manager as any).formatDisplayValue;
      
      expect(formatDisplayValue(12345, 'number')).toBe('12,345');
      expect(formatDisplayValue('12345', 'number')).toBe('12345');
    });

    test('should handle null and undefined values', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const formatDisplayValue = (manager as any).formatDisplayValue;
      
      expect(formatDisplayValue(null, 'text')).toBe('');
      expect(formatDisplayValue(undefined, 'text')).toBe('');
    });
  });

  describe('System Clipboard Integration', () => {
    test('should read from system clipboard', async () => {
      mockClipboard.readText.mockResolvedValue('test clipboard content');
      
      const result = await copyPasteManager.readFromSystemClipboard();
      
      expect(result).toBe('test clipboard content');
      expect(mockClipboard.readText).toHaveBeenCalled();
    });

    test('should handle system clipboard read failure', async () => {
      mockClipboard.readText.mockRejectedValue(new Error('Access denied'));
      
      const result = await copyPasteManager.readFromSystemClipboard();
      
      expect(result).toBeNull();
    });

    test('should clear internal clipboard', () => {
      copyPasteManager.clearClipboard();
      
      const clipboardData = copyPasteManager.getClipboardData();
      expect(clipboardData).toBeNull();
    });
  });

  describe('Cell Value Retrieval', () => {
    test('should get basic field values', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const getCellValue = (manager as any).getCellValue;
      
      expect(getCellValue(mockData[0], { id: 'task' }, 'status')).toBe('タスク1');
      expect(getCellValue(mockData[0], { id: 'bomCode' }, 'status')).toBe('BOM001');
      expect(getCellValue(mockData[0], { id: 'cycle' }, 'status')).toBe('A');
    });

    test('should get specification values', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const getCellValue = (manager as any).getCellValue;
      
      expect(getCellValue(mockData[0], { id: 'spec_name' }, 'status')).toBe('機器A');
      expect(getCellValue(mockData[0], { id: 'spec_model' }, 'status')).toBe('Model-A1');
      expect(getCellValue(mockData[0], { id: 'spec_nonexistent' }, 'status')).toBe('');
    });

    test('should get time-based values in different view modes', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const getCellValue = (manager as any).getCellValue;
      
      // Status view mode
      const statusValue = getCellValue(mockData[0], { id: 'time_2024Q1' }, 'status');
      expect(statusValue).toEqual({ planned: true, actual: false });
      
      // Cost view mode
      const costValue = getCellValue(mockData[0], { id: 'time_2024Q1' }, 'cost');
      expect(costValue).toEqual({ planCost: 100000, actualCost: 0 });
    });

    test('should handle missing time data', () => {
      const manager = new CopyPasteManager(mockData, mockColumns);
      
      // Access private method through type assertion
      const getCellValue = (manager as any).getCellValue;
      
      const statusValue = getCellValue(mockData[0], { id: 'time_2025Q1' }, 'status');
      expect(statusValue).toEqual({ planned: false, actual: false });
      
      const costValue = getCellValue(mockData[0], { id: 'time_2025Q1' }, 'cost');
      expect(costValue).toEqual({ planCost: 0, actualCost: 0 });
    });
  });
});