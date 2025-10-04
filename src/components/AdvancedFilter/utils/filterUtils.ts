import { FilterCondition, FilterOperator, LogicalOperator } from '../types';
import { HierarchicalData } from '../../../types';

/**
 * Apply a single filter condition to a data item
 */
export const applyFilterCondition = (item: HierarchicalData, condition: FilterCondition): boolean => {
  const fieldValue = getFieldValue(item, condition.field);
  
  if (fieldValue === undefined || fieldValue === null) {
    return condition.operator === 'isEmpty';
  }

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(condition.value).toLowerCase();
    
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
    
    case 'startsWith':
      return String(fieldValue).toLowerCase().startsWith(String(condition.value).toLowerCase());
    
    case 'endsWith':
      return String(fieldValue).toLowerCase().endsWith(String(condition.value).toLowerCase());
    
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);
    
    case 'between':
      if (Array.isArray(condition.value) && condition.value.length === 2) {
        const numValue = Number(fieldValue);
        return numValue >= Number(condition.value[0]) && numValue <= Number(condition.value[1]);
      }
      return false;
    
    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.some(val => 
          String(fieldValue).toLowerCase() === String(val).toLowerCase()
        );
      }
      return false;
    
    case 'notIn':
      if (Array.isArray(condition.value)) {
        return !condition.value.some(val => 
          String(fieldValue).toLowerCase() === String(val).toLowerCase()
        );
      }
      return true;
    
    case 'isEmpty':
      return fieldValue === '' || fieldValue === null || fieldValue === undefined;
    
    case 'isNotEmpty':
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
    
    default:
      return true;
  }
};

/**
 * Get field value from hierarchical data item
 */
export const getFieldValue = (item: HierarchicalData, fieldPath: string): any => {
  const paths = fieldPath.split('.');
  let value: any = item;
  
  for (const path of paths) {
    if (value && typeof value === 'object') {
      value = value[path];
    } else {
      return undefined;
    }
  }
  
  return value;
};

/**
 * Apply multiple filter conditions with logical operators
 */
export const applyFilters = (data: HierarchicalData[], conditions: FilterCondition[]): HierarchicalData[] => {
  if (conditions.length === 0) {
    return data;
  }

  return data.filter(item => {
    return evaluateFilterGroup(item, conditions);
  });
};

/**
 * Evaluate a group of filter conditions with logical operators
 */
const evaluateFilterGroup = (item: HierarchicalData, conditions: FilterCondition[]): boolean => {
  if (conditions.length === 0) return true;
  if (conditions.length === 1) return applyFilterCondition(item, conditions[0]);

  // Group conditions by logical operator
  const groups: FilterCondition[][] = [];
  let currentGroup: FilterCondition[] = [conditions[0]];
  
  for (let i = 1; i < conditions.length; i++) {
    const condition = conditions[i];
    const prevCondition = conditions[i - 1];
    
    if (prevCondition.logicalOperator === 'OR') {
      // Start new group for OR operation
      groups.push(currentGroup);
      currentGroup = [condition];
    } else {
      // Continue current group for AND operation (default)
      currentGroup.push(condition);
    }
  }
  groups.push(currentGroup);

  // Evaluate each group (AND within group, OR between groups)
  return groups.some(group => 
    group.every(condition => applyFilterCondition(item, condition))
  );
};

/**
 * Generate search suggestions based on current filters and data
 */
export const generateSearchSuggestions = (
  data: HierarchicalData[], 
  currentFilters: FilterCondition[],
  searchTerm: string,
  maxSuggestions: number = 5
): string[] => {
  if (!searchTerm || searchTerm.length < 2) return [];

  const filteredData = applyFilters(data, currentFilters);
  const suggestions = new Set<string>();

  // Search in task names
  filteredData.forEach(item => {
    if (item.task.toLowerCase().includes(searchTerm.toLowerCase())) {
      suggestions.add(item.task);
    }
    
    // Search in hierarchy path
    if (item.hierarchyPath?.toLowerCase().includes(searchTerm.toLowerCase())) {
      const pathParts = item.hierarchyPath.split(' > ');
      pathParts.forEach(part => {
        if (part.toLowerCase().includes(searchTerm.toLowerCase())) {
          suggestions.add(part);
        }
      });
    }
    
    // Search in specifications
    if (item.specifications) {
      item.specifications.forEach(spec => {
        if (spec.key.toLowerCase().includes(searchTerm.toLowerCase())) {
          suggestions.add(spec.key);
        }
        if (spec.value.toLowerCase().includes(searchTerm.toLowerCase())) {
          suggestions.add(spec.value);
        }
      });
    }
  });

  return Array.from(suggestions)
    .filter(suggestion => suggestion.toLowerCase() !== searchTerm.toLowerCase())
    .slice(0, maxSuggestions);
};

/**
 * Validate filter condition
 */
export const validateFilterCondition = (condition: FilterCondition): { isValid: boolean; error?: string } => {
  if (!condition.field) {
    return { isValid: false, error: 'フィールドを選択してください' };
  }
  
  if (!condition.operator) {
    return { isValid: false, error: '演算子を選択してください' };
  }
  
  if (condition.operator === 'between' && (!Array.isArray(condition.value) || condition.value.length !== 2)) {
    return { isValid: false, error: '範囲検索には2つの値が必要です' };
  }
  
  if (['in', 'notIn'].includes(condition.operator) && !Array.isArray(condition.value)) {
    return { isValid: false, error: '複数選択には配列が必要です' };
  }
  
  if (!['isEmpty', 'isNotEmpty'].includes(condition.operator) && 
      (condition.value === undefined || condition.value === null || condition.value === '')) {
    return { isValid: false, error: '値を入力してください' };
  }
  
  return { isValid: true };
};

/**
 * Create a new filter condition with default values
 */
export const createNewFilterCondition = (): FilterCondition => ({
  id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  field: '',
  operator: 'contains',
  value: '',
  logicalOperator: 'AND'
});