import { KeyboardNavigationManager } from '../keyboardNavigation';
import { GridColumn } from '../../ExcelLikeGrid/types';
import { HierarchicalData } from '../../../types';

// Mock data for testing
const mockColumns: GridColumn[] = [
  { id: 'task', label: 'タスク', width: 200, editable: false, type: 'text' },
  { id: 'bomCode', label: 'BOMコード', width: 150, editable: false, type: 'text' },
  { id: 'spec_name', label: '機器名称', width: 180, editable: true, type: 'text' },
  { id: 'spec_model', label: '型式', width: 150, editable: true, type: 'text' },
  { id: 'time_2024Q1', label: '2024Q1', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q2', label: '2024Q2', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q3', label: '2024Q3', width: 100, editable: true, type: 'status' },
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

describe('KeyboardNavigationManager', () => {
  let navigationManager: KeyboardNavigationManager;

  beforeEach(() => {
    navigationManager = new KeyboardNavigationManager(mockData, mockColumns, {
      skipNonEditable: true,
      wrapAround: false,
      allowEditOnEnter: true,
    });
  });

  describe('Tab Navigation', () => {
    test('should move to next editable cell with Tab key', () => {
      const result = navigationManager.handleTabNavigation('item1', 'task', false);
      
      // Should skip non-editable columns and move to first editable column
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_name');
    });

    test('should move to previous editable cell with Shift+Tab', () => {
      const result = navigationManager.handleTabNavigation('item1', 'time_2024Q1', true);
      
      // Should move to previous editable cell
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_model');
    });

    test('should wrap to next row when reaching end of current row', () => {
      const result = navigationManager.handleTabNavigation('item1', 'time_2024Q3', false);
      
      // Should move to first editable cell of next row
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('spec_name');
    });

    test('should wrap to previous row when reaching beginning of current row', () => {
      const result = navigationManager.handleTabNavigation('item2', 'spec_name', true);
      
      // Should move to last editable cell of previous row
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('time_2024Q3');
    });

    test('should return null when at last cell and no wrap around', () => {
      const result = navigationManager.handleTabNavigation('item3', 'time_2024Q3', false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should handle wrap around when enabled', () => {
      const wrapNavigationManager = new KeyboardNavigationManager(mockData, mockColumns, {
        skipNonEditable: true,
        wrapAround: true,
        allowEditOnEnter: true,
      });

      const result = wrapNavigationManager.handleTabNavigation('item3', 'time_2024Q3', false);
      
      // Should wrap to first editable cell
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_name');
    });
  });

  describe('Enter Navigation', () => {
    test('should move to next row in same column with Enter key', () => {
      const result = navigationManager.handleEnterNavigation('item1', 'spec_name', false);
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('spec_name');
      expect(result.shouldEdit).toBe(true);
    });

    test('should move to previous row in same column with Shift+Enter', () => {
      const result = navigationManager.handleEnterNavigation('item2', 'time_2024Q1', true);
      
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('time_2024Q1');
      expect(result.shouldEdit).toBe(true);
    });

    test('should return null when at first row and moving up', () => {
      const result = navigationManager.handleEnterNavigation('item1', 'spec_name', true);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should return null when at last row and moving down', () => {
      const result = navigationManager.handleEnterNavigation('item3', 'time_2024Q2', false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should not set shouldEdit for non-editable cells', () => {
      const result = navigationManager.handleEnterNavigation('item1', 'task', false);
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('task');
      expect(result.shouldEdit).toBeUndefined();
    });
  });

  describe('Arrow Key Navigation', () => {
    test('should move up with ArrowUp key', () => {
      const result = navigationManager.handleArrowNavigation('item2', 'spec_name', 'up');
      
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_name');
    });

    test('should move down with ArrowDown key', () => {
      const result = navigationManager.handleArrowNavigation('item1', 'time_2024Q1', 'down');
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('time_2024Q1');
    });

    test('should move left with ArrowLeft key', () => {
      const result = navigationManager.handleArrowNavigation('item1', 'time_2024Q1', 'left');
      
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_model');
    });

    test('should move right with ArrowRight key', () => {
      const result = navigationManager.handleArrowNavigation('item1', 'spec_name', 'right');
      
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_model');
    });

    test('should not move beyond boundaries', () => {
      // Test top boundary
      const upResult = navigationManager.handleArrowNavigation('item1', 'spec_name', 'up');
      expect(upResult.rowId).toBe('item1');
      expect(upResult.columnId).toBe('spec_name');

      // Test bottom boundary
      const downResult = navigationManager.handleArrowNavigation('item3', 'time_2024Q3', 'down');
      expect(downResult.rowId).toBe('item3');
      expect(downResult.columnId).toBe('time_2024Q3');

      // Test left boundary
      const leftResult = navigationManager.handleArrowNavigation('item1', 'task', 'left');
      expect(leftResult.rowId).toBe('item1');
      expect(leftResult.columnId).toBe('task');

      // Test right boundary
      const rightResult = navigationManager.handleArrowNavigation('item1', 'time_2024Q3', 'right');
      expect(rightResult.rowId).toBe('item1');
      expect(rightResult.columnId).toBe('time_2024Q3');
    });

    test('should skip non-editable cells when skipNonEditable is true', () => {
      const result = navigationManager.handleArrowNavigation('item1', 'spec_name', 'left');
      
      // Should skip non-editable 'bomCode' and 'task' columns
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_name'); // Should stay in place or find next editable
    });
  });

  describe('Home/End Navigation', () => {
    test('should move to first column with Home key', () => {
      const result = navigationManager.handleHomeEndNavigation('item2', 'Home', false);
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('task');
    });

    test('should move to last column with End key', () => {
      const result = navigationManager.handleHomeEndNavigation('item2', 'End', false);
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('time_2024Q3');
    });

    test('should move to first cell with Ctrl+Home', () => {
      const result = navigationManager.handleHomeEndNavigation('item2', 'Home', true);
      
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('task');
    });

    test('should move to last cell with Ctrl+End', () => {
      const result = navigationManager.handleHomeEndNavigation('item2', 'End', true);
      
      expect(result.rowId).toBe('item3');
      expect(result.columnId).toBe('time_2024Q3');
    });
  });

  describe('Keyboard Event Handler', () => {
    test('should handle Tab key event', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'task', false);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.rowId).toBe('item1');
      expect(result?.columnId).toBe('spec_name');
    });

    test('should handle Enter key event', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'spec_name', false);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.rowId).toBe('item2');
      expect(result?.columnId).toBe('spec_name');
      expect(result?.shouldEdit).toBe(true);
    });

    test('should handle arrow key events', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'time_2024Q1', false);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.rowId).toBe('item2');
      expect(result?.columnId).toBe('time_2024Q1');
    });

    test('should handle Escape key during editing', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'spec_name', true);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result?.rowId).toBe('item1');
      expect(result?.columnId).toBe('spec_name');
    });

    test('should ignore other keys during editing', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'a' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'spec_name', true);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should handle Home and End keys', () => {
      const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
      const homePreventDefaultSpy = jest.spyOn(homeEvent, 'preventDefault');
      
      const homeResult = navigationManager.handleKeyDown(homeEvent, 'item2', 'time_2024Q2', false);
      
      expect(homePreventDefaultSpy).toHaveBeenCalled();
      expect(homeResult?.rowId).toBe('item2');
      expect(homeResult?.columnId).toBe('task');

      const endEvent = new KeyboardEvent('keydown', { key: 'End' });
      const endPreventDefaultSpy = jest.spyOn(endEvent, 'preventDefault');
      
      const endResult = navigationManager.handleKeyDown(endEvent, 'item2', 'spec_name', false);
      
      expect(endPreventDefaultSpy).toHaveBeenCalled();
      expect(endResult?.rowId).toBe('item2');
      expect(endResult?.columnId).toBe('time_2024Q3');
    });

    test('should return null for unhandled keys', () => {
      const mockEvent = new KeyboardEvent('keydown', { key: 'F1' });
      const preventDefaultSpy = jest.spyOn(mockEvent, 'preventDefault');
      
      const result = navigationManager.handleKeyDown(mockEvent, 'item1', 'spec_name', false);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty data array', () => {
      const emptyNavigationManager = new KeyboardNavigationManager([], mockColumns);
      
      const result = emptyNavigationManager.handleTabNavigation(null, null, false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should handle empty columns array', () => {
      const emptyColumnsManager = new KeyboardNavigationManager(mockData, []);
      
      const result = emptyColumnsManager.handleTabNavigation('item1', null, false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should handle invalid row ID', () => {
      const result = navigationManager.handleTabNavigation('invalid-id', 'spec_name', false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should handle invalid column ID', () => {
      const result = navigationManager.handleTabNavigation('item1', 'invalid-column', false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });

    test('should handle all non-editable columns', () => {
      const nonEditableColumns: GridColumn[] = [
        { id: 'task', label: 'タスク', width: 200, editable: false, type: 'text' },
        { id: 'bomCode', label: 'BOMコード', width: 150, editable: false, type: 'text' },
      ];
      
      const nonEditableManager = new KeyboardNavigationManager(mockData, nonEditableColumns, {
        skipNonEditable: true,
      });
      
      const result = nonEditableManager.handleTabNavigation('item1', 'task', false);
      
      expect(result.rowId).toBeNull();
      expect(result.columnId).toBeNull();
    });
  });

  describe('Configuration Options', () => {
    test('should respect skipNonEditable option when false', () => {
      const allCellsManager = new KeyboardNavigationManager(mockData, mockColumns, {
        skipNonEditable: false,
        wrapAround: false,
        allowEditOnEnter: true,
      });

      const result = allCellsManager.handleTabNavigation('item1', 'task', false);
      
      // Should move to next column regardless of editability
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('bomCode');
    });

    test('should respect allowEditOnEnter option when false', () => {
      const noEditManager = new KeyboardNavigationManager(mockData, mockColumns, {
        skipNonEditable: true,
        wrapAround: false,
        allowEditOnEnter: false,
      });

      const result = noEditManager.handleEnterNavigation('item1', 'spec_name', false);
      
      expect(result.rowId).toBe('item2');
      expect(result.columnId).toBe('spec_name');
      expect(result.shouldEdit).toBeUndefined();
    });

    test('should handle default options', () => {
      const defaultManager = new KeyboardNavigationManager(mockData, mockColumns);
      
      const result = defaultManager.handleTabNavigation('item1', 'task', false);
      
      // Should use default behavior (skip non-editable)
      expect(result.rowId).toBe('item1');
      expect(result.columnId).toBe('spec_name');
    });
  });
});