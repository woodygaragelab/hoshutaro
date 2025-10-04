import {
  applyFilterCondition,
  applyFilters,
  getFieldValue,
  generateSearchSuggestions,
  validateFilterCondition,
  createNewFilterCondition
} from '../utils/filterUtils';
import { FilterCondition } from '../types';
import { HierarchicalData } from '../../../types';

const mockData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプ点検',
    hierarchyPath: '設備 > ポンプ > 冷却水ポンプ',
    bomCode: 'P001',
    cycle: '月次',
    specifications: [
      { key: '型式', value: 'ABC-123', order: 0 },
      { key: '容量', value: '100L/min', order: 1 }
    ],
    results: {}
  },
  {
    id: '2',
    task: 'モーター点検',
    hierarchyPath: '設備 > モーター > 駆動モーター',
    bomCode: 'M001',
    cycle: '年次',
    specifications: [
      { key: '型式', value: 'XYZ-456', order: 0 },
      { key: '出力', value: '5kW', order: 1 }
    ],
    results: {}
  },
  {
    id: '3',
    task: '',
    hierarchyPath: '設備 > バルブ > 制御バルブ',
    bomCode: 'V001',
    cycle: '月次',
    specifications: [],
    results: {}
  }
];

describe('FilterUtils Tests', () => {
  describe('getFieldValue', () => {
    test('gets simple field values correctly', () => {
      expect(getFieldValue(mockData[0], 'task')).toBe('ポンプ点検');
      expect(getFieldValue(mockData[0], 'bomCode')).toBe('P001');
      expect(getFieldValue(mockData[0], 'cycle')).toBe('月次');
    });

    test('gets nested field values correctly', () => {
      const nestedData = {
        id: '1',
        task: 'test',
        nested: {
          level1: {
            level2: 'deep value'
          }
        }
      };
      
      expect(getFieldValue(nestedData as any, 'nested.level1.level2')).toBe('deep value');
    });

    test('returns undefined for non-existent fields', () => {
      expect(getFieldValue(mockData[0], 'nonExistent')).toBeUndefined();
      expect(getFieldValue(mockData[0], 'nested.nonExistent')).toBeUndefined();
    });
  });

  describe('applyFilterCondition', () => {
    test('equals operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      };
      
      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(false);
    });

    test('contains operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: 'ポンプ'
      };
      
      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(false);
    });

    test('startsWith operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'bomCode',
        operator: 'startsWith',
        value: 'P'
      };
      
      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(false);
    });

    test('endsWith operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'bomCode',
        operator: 'endsWith',
        value: '001'
      };
      
      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(true);
    });  
  test('greaterThan and lessThan operators work correctly', () => {
      const numericData = {
        id: '1',
        task: 'test',
        value: 50,
        results: {}
      };

      const gtCondition: FilterCondition = {
        id: '1',
        field: 'value',
        operator: 'greaterThan',
        value: 30
      };

      const ltCondition: FilterCondition = {
        id: '2',
        field: 'value',
        operator: 'lessThan',
        value: 100
      };

      expect(applyFilterCondition(numericData as any, gtCondition)).toBe(true);
      expect(applyFilterCondition(numericData as any, ltCondition)).toBe(true);
    });

    test('between operator works correctly', () => {
      const numericData = {
        id: '1',
        task: 'test',
        value: 50,
        results: {}
      };

      const condition: FilterCondition = {
        id: '1',
        field: 'value',
        operator: 'between',
        value: [30, 70]
      };

      expect(applyFilterCondition(numericData as any, condition)).toBe(true);

      const outOfRangeCondition: FilterCondition = {
        id: '1',
        field: 'value',
        operator: 'between',
        value: [80, 100]
      };

      expect(applyFilterCondition(numericData as any, outOfRangeCondition)).toBe(false);
    });

    test('in operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'cycle',
        operator: 'in',
        value: ['月次', '週次']
      };

      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(false);
    });

    test('notIn operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'cycle',
        operator: 'notIn',
        value: ['年次']
      };

      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[1], condition)).toBe(false);
    });

    test('isEmpty operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'isEmpty',
        value: ''
      };

      expect(applyFilterCondition(mockData[2], condition)).toBe(true);
      expect(applyFilterCondition(mockData[0], condition)).toBe(false);
    });

    test('isNotEmpty operator works correctly', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'isNotEmpty',
        value: ''
      };

      expect(applyFilterCondition(mockData[0], condition)).toBe(true);
      expect(applyFilterCondition(mockData[2], condition)).toBe(false);
    });

    test('handles null and undefined values correctly', () => {
      const dataWithNulls = {
        id: '1',
        task: null,
        bomCode: undefined,
        results: {}
      };

      const isEmptyCondition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'isEmpty',
        value: ''
      };

      expect(applyFilterCondition(dataWithNulls as any, isEmptyCondition)).toBe(true);
    });
  });

  describe('applyFilters', () => {
    test('returns all data when no filters applied', () => {
      const result = applyFilters(mockData, []);
      expect(result).toEqual(mockData);
    });

    test('applies single filter correctly', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          field: 'cycle',
          operator: 'equals',
          value: '月次'
        }
      ];

      const result = applyFilters(mockData, filters);
      expect(result).toHaveLength(2);
      expect(result.every(item => item.cycle === '月次')).toBe(true);
    });

    test('applies multiple AND filters correctly', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          field: 'cycle',
          operator: 'equals',
          value: '月次',
          logicalOperator: 'AND'
        },
        {
          id: '2',
          field: 'task',
          operator: 'contains',
          value: 'ポンプ'
        }
      ];

      const result = applyFilters(mockData, filters);
      expect(result).toHaveLength(1);
      expect(result[0].task).toBe('ポンプ点検');
    });

    test('applies multiple OR filters correctly', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          field: 'cycle',
          operator: 'equals',
          value: '年次',
          logicalOperator: 'OR'
        },
        {
          id: '2',
          field: 'bomCode',
          operator: 'startsWith',
          value: 'P'
        }
      ];

      const result = applyFilters(mockData, filters);
      expect(result).toHaveLength(2); // モーター点検 (年次) OR ポンプ点検 (P001)
    });
  });

  describe('generateSearchSuggestions', () => {
    test('generates suggestions from task names', () => {
      const suggestions = generateSearchSuggestions(mockData, [], 'ポン', 5);
      expect(suggestions).toContain('ポンプ点検');
    });

    test('generates suggestions from hierarchy paths', () => {
      const suggestions = generateSearchSuggestions(mockData, [], 'ポンプ', 5);
      expect(suggestions).toContain('冷却水ポンプ');
    });

    test('generates suggestions from specifications', () => {
      const suggestions = generateSearchSuggestions(mockData, [], 'ABC', 5);
      expect(suggestions).toContain('ABC-123');
    });

    test('respects maximum suggestion count', () => {
      const suggestions = generateSearchSuggestions(mockData, [], 'A', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    test('returns empty array for short search terms', () => {
      const suggestions = generateSearchSuggestions(mockData, [], 'A', 5);
      expect(suggestions).toEqual([]);
    });

    test('filters suggestions based on current filters', () => {
      const filters: FilterCondition[] = [
        {
          id: '1',
          field: 'cycle',
          operator: 'equals',
          value: '年次'
        }
      ];

      const suggestions = generateSearchSuggestions(mockData, filters, 'モー', 5);
      expect(suggestions).toContain('モーター点検');
      expect(suggestions).not.toContain('ポンプ点検');
    });
  });

  describe('validateFilterCondition', () => {
    test('validates correct filter condition', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: 'ポンプ'
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('invalidates condition without field', () => {
      const condition: FilterCondition = {
        id: '1',
        field: '',
        operator: 'contains',
        value: 'ポンプ'
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('フィールドを選択してください');
    });

    test('invalidates condition without operator', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: '' as any,
        value: 'ポンプ'
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('演算子を選択してください');
    });

    test('invalidates between operator without array value', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'value',
        operator: 'between',
        value: '50'
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('範囲検索には2つの値が必要です');
    });

    test('validates isEmpty operator without value', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'isEmpty',
        value: ''
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(true);
    });

    test('invalidates condition without value for operators that need it', () => {
      const condition: FilterCondition = {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: ''
      };

      const result = validateFilterCondition(condition);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('値を入力してください');
    });
  });

  describe('createNewFilterCondition', () => {
    test('creates new filter condition with default values', () => {
      const condition = createNewFilterCondition();
      
      expect(condition.id).toBeDefined();
      expect(condition.field).toBe('');
      expect(condition.operator).toBe('contains');
      expect(condition.value).toBe('');
      expect(condition.logicalOperator).toBe('AND');
    });

    test('creates unique IDs for each condition', () => {
      const condition1 = createNewFilterCondition();
      const condition2 = createNewFilterCondition();
      
      expect(condition1.id).not.toBe(condition2.id);
    });
  });
});