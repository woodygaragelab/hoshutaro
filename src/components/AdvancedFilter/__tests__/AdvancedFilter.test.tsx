import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AdvancedFilterPanel, useAdvancedFilter } from '../index';
import { FilterField, FilterCondition, SavedFilter } from '../types';
import { useEnhancedSearch } from '../hooks/useEnhancedSearch';
import { applyFilters, validateFilterCondition, generateSearchSuggestions } from '../utils/filterUtils';

// Mock data
const mockData = [
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
    task: 'バルブ点検',
    hierarchyPath: '設備 > バルブ > 制御バルブ',
    bomCode: 'V001',
    cycle: '月次',
    specifications: [
      { key: '型式', value: 'DEF-789', order: 0 },
      { key: 'サイズ', value: '50A', order: 1 }
    ],
    results: {}
  },
  {
    id: '4',
    task: 'センサー点検',
    hierarchyPath: '設備 > センサー > 温度センサー',
    bomCode: 'S001',
    cycle: '週次',
    specifications: [
      { key: '型式', value: 'GHI-012', order: 0 },
      { key: '測定範囲', value: '-20~100℃', order: 1 }
    ],
    results: {}
  }
];

const mockFields: FilterField[] = [
  { key: 'task', label: '機器名', type: 'text' },
  { key: 'hierarchyPath', label: '階層パス', type: 'text' },
  { key: 'bomCode', label: 'BOMコード', type: 'text' },
  { key: 'cycle', label: '周期', type: 'select', options: [
    { value: '年次', label: '年次' },
    { value: '月次', label: '月次' },
    { value: '週次', label: '週次' }
  ]},
];

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const {
    filters,
    savedFilters,
    setFilters,
    saveFilter,
    loadFilter,
    deleteFilter,
    clearFilters,
  } = useAdvancedFilter({
    data: mockData,
    availableFields: mockFields,
    searchTerm: '',
  });

  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <AdvancedFilterPanel
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      filters={filters}
      savedFilters={savedFilters}
      availableFields={mockFields}
      onFilterChange={setFilters}
      onSaveFilter={saveFilter}
      onLoadFilter={loadFilter}
      onDeleteFilter={deleteFilter}
      onClearFilters={clearFilters}
    />
  );
};

describe('AdvancedFilter', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test('renders advanced filter panel', () => {
    render(<TestComponent />);
    
    expect(screen.getByText('高度フィルター')).toBeInTheDocument();
    expect(screen.getAllByText('フィルター条件')).toHaveLength(2); // Tab and heading
    expect(screen.getByText('保存済みフィルター')).toBeInTheDocument();
  });

  test('can add filter condition', async () => {
    render(<TestComponent />);
    
    // Click add condition button
    const addButton = screen.getByText('条件を追加');
    fireEvent.click(addButton);
    
    // Should show filter condition row - check for form elements
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // Field selector
    });
  });

  test('can save filter', async () => {
    render(<TestComponent />);
    
    // Add a condition first
    const addButton = screen.getByText('条件を追加');
    fireEvent.click(addButton);
    
    // Switch to saved filters tab
    const savedFiltersTab = screen.getByText('保存済みフィルター');
    fireEvent.click(savedFiltersTab);
    
    // Should show save button (disabled initially)
    expect(screen.getByText('現在の条件を保存')).toBeInTheDocument();
  });

  test('shows no saved filters message initially', () => {
    render(<TestComponent />);
    
    // Switch to saved filters tab
    const savedFiltersTab = screen.getByText('保存済みフィルター');
    fireEvent.click(savedFiltersTab);
    
    expect(screen.getByText('保存されたフィルターはありません')).toBeInTheDocument();
  });

  test('can clear all filters', async () => {
    render(<TestComponent />);
    
    // Add a condition
    const addButton = screen.getByText('条件を追加');
    fireEvent.click(addButton);
    
    // Clear all filters
    const clearButton = screen.getByText('クリア');
    fireEvent.click(clearButton);
    
    // Should show add condition button again
    await waitFor(() => {
      expect(screen.getByText('条件を追加')).toBeInTheDocument();
    });
  });
});

// 複数条件検索のテスト
describe('Multiple Condition Search Tests', () => {
  test('applies single filter condition correctly', () => {
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

  test('applies multiple AND conditions correctly', () => {
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
    expect(result[0].cycle).toBe('月次');
  });

  test('applies multiple OR conditions correctly', () => {
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
        field: 'cycle',
        operator: 'equals',
        value: '週次'
      }
    ];

    const result = applyFilters(mockData, filters);
    expect(result).toHaveLength(2);
    expect(result.some(item => item.cycle === '年次')).toBe(true);
    expect(result.some(item => item.cycle === '週次')).toBe(true);
  });

  test('applies complex AND/OR combinations correctly', () => {
    const filters: FilterCondition[] = [
      {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: 'ポンプ',
        logicalOperator: 'OR'
      },
      {
        id: '2',
        field: 'task',
        operator: 'contains',
        value: 'モーター',
        logicalOperator: 'AND'
      },
      {
        id: '3',
        field: 'cycle',
        operator: 'equals',
        value: '年次'
      }
    ];

    const result = applyFilters(mockData, filters);
    expect(result).toHaveLength(2); // ポンプ点検 OR (モーター点検 AND 年次)
  });

  test('handles different filter operators correctly', () => {
    // Test contains operator
    let filters: FilterCondition[] = [{
      id: '1',
      field: 'hierarchyPath',
      operator: 'contains',
      value: 'ポンプ'
    }];
    let result = applyFilters(mockData, filters);
    expect(result).toHaveLength(1);

    // Test startsWith operator
    filters = [{
      id: '1',
      field: 'bomCode',
      operator: 'startsWith',
      value: 'P'
    }];
    result = applyFilters(mockData, filters);
    expect(result).toHaveLength(1);
    expect(result[0].bomCode).toBe('P001');

    // Test in operator
    filters = [{
      id: '1',
      field: 'cycle',
      operator: 'in',
      value: ['月次', '週次']
    }];
    result = applyFilters(mockData, filters);
    expect(result).toHaveLength(3);
  });

  test('validates filter conditions correctly', () => {
    // Valid condition
    const validCondition: FilterCondition = {
      id: '1',
      field: 'task',
      operator: 'contains',
      value: 'ポンプ'
    };
    expect(validateFilterCondition(validCondition).isValid).toBe(true);

    // Invalid condition - no field
    const invalidField: FilterCondition = {
      id: '1',
      field: '',
      operator: 'contains',
      value: 'ポンプ'
    };
    expect(validateFilterCondition(invalidField).isValid).toBe(false);

    // Invalid condition - no value for non-empty operators
    const invalidValue: FilterCondition = {
      id: '1',
      field: 'task',
      operator: 'contains',
      value: ''
    };
    expect(validateFilterCondition(invalidValue).isValid).toBe(false);

    // Valid condition - isEmpty operator doesn't need value
    const emptyOperator: FilterCondition = {
      id: '1',
      field: 'task',
      operator: 'isEmpty',
      value: ''
    };
    expect(validateFilterCondition(emptyOperator).isValid).toBe(true);
  });
});

// 保存済みフィルターのテスト
describe('Saved Filter Tests', () => {
  let hookResult: any;

  const TestHookComponent = () => {
    hookResult = useAdvancedFilter({
      data: mockData,
      availableFields: mockFields,
      searchTerm: '',
    });
    return null;
  };

  beforeEach(() => {
    localStorage.clear();
    render(<TestHookComponent />);
  });

  test('saves filter correctly', () => {
    const testFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      }
    ];

    act(() => {
      hookResult.saveFilter('月次フィルター', '月次点検項目のフィルター', testFilters);
    });

    expect(hookResult.savedFilters).toHaveLength(1);
    expect(hookResult.savedFilters[0].name).toBe('月次フィルター');
    expect(hookResult.savedFilters[0].description).toBe('月次点検項目のフィルター');
    expect(hookResult.savedFilters[0].conditions).toEqual(testFilters);
  });

  test('loads saved filter correctly', () => {
    const testFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: 'ポンプ'
      }
    ];

    // Save filter first
    act(() => {
      hookResult.saveFilter('ポンプフィルター', '', testFilters);
    });

    const savedFilterId = hookResult.savedFilters[0].id;

    // Load the filter
    act(() => {
      hookResult.loadFilter(savedFilterId);
    });

    expect(hookResult.filters).toEqual(testFilters);
    expect(hookResult.savedFilters[0].lastUsed).toBeDefined();
  });

  test('deletes saved filter correctly', () => {
    const testFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '年次'
      }
    ];

    // Save filter first
    act(() => {
      hookResult.saveFilter('年次フィルター', '', testFilters);
    });

    expect(hookResult.savedFilters).toHaveLength(1);
    const savedFilterId = hookResult.savedFilters[0].id;

    // Delete the filter
    act(() => {
      hookResult.deleteFilter(savedFilterId);
    });

    expect(hookResult.savedFilters).toHaveLength(0);
  });

  test('updates saved filter correctly', () => {
    const initialFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      }
    ];

    const updatedFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '年次'
      }
    ];

    // Save initial filter
    act(() => {
      hookResult.saveFilter('テストフィルター', '初期説明', initialFilters);
    });

    const savedFilterId = hookResult.savedFilters[0].id;

    // Update the filter
    act(() => {
      hookResult.updateSavedFilter(savedFilterId, '更新されたフィルター', '更新された説明', updatedFilters);
    });

    expect(hookResult.savedFilters).toHaveLength(1);
    expect(hookResult.savedFilters[0].name).toBe('更新されたフィルター');
    expect(hookResult.savedFilters[0].description).toBe('更新された説明');
    expect(hookResult.savedFilters[0].conditions).toEqual(updatedFilters);
  });

  test('duplicates saved filter correctly', () => {
    const testFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'task',
        operator: 'contains',
        value: 'センサー'
      }
    ];

    // Save original filter
    act(() => {
      hookResult.saveFilter('センサーフィルター', 'センサー関連', testFilters);
    });

    const originalFilterId = hookResult.savedFilters[0].id;

    // Duplicate the filter
    act(() => {
      hookResult.duplicateFilter(originalFilterId);
    });

    expect(hookResult.savedFilters).toHaveLength(2);
    expect(hookResult.savedFilters[1].name).toBe('センサーフィルター (コピー)');
    expect(hookResult.savedFilters[1].conditions).toEqual(testFilters);
    expect(hookResult.savedFilters[1].id).not.toBe(originalFilterId);
  });

  test('persists saved filters in localStorage', () => {
    const testFilters: FilterCondition[] = [
      {
        id: '1',
        field: 'bomCode',
        operator: 'startsWith',
        value: 'P'
      }
    ];

    // Save filter
    act(() => {
      hookResult.saveFilter('Pコードフィルター', '', testFilters);
    });

    // Check localStorage
    const savedData = localStorage.getItem('hoshitori_saved_filters');
    expect(savedData).toBeTruthy();
    
    const parsedData = JSON.parse(savedData!);
    expect(parsedData).toHaveLength(1);
    expect(parsedData[0].name).toBe('Pコードフィルター');
  });
});

// リアルタイム検索のテスト
describe('Real-time Search Tests', () => {
  test('generates search suggestions correctly', () => {
    const suggestions = generateSearchSuggestions(mockData, [], 'ポン', 5);
    expect(suggestions).toContain('ポンプ点検');
    expect(suggestions).toContain('ポンプ');
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
    expect(suggestions).toContain('モーター');
  });

  test('searches in specifications correctly', () => {
    const suggestions = generateSearchSuggestions(mockData, [], 'ABC', 5);
    expect(suggestions).toContain('ABC-123');
  });

  test('handles empty search term', () => {
    const suggestions = generateSearchSuggestions(mockData, [], '', 5);
    expect(suggestions).toEqual([]);
  });

  test('limits suggestion count', () => {
    const suggestions = generateSearchSuggestions(mockData, [], 'A', 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });
});

describe('Enhanced Search Hook Tests', () => {
  let hookResult: any;

  const TestEnhancedSearchComponent = ({ searchTerm = '', filters = [] }: { searchTerm?: string; filters?: FilterCondition[] }) => {
    hookResult = useEnhancedSearch({
      data: mockData,
      filters,
      searchTerm,
      debounceMs: 100
    });
    return null;
  };

  test('initializes correctly', () => {
    render(<TestEnhancedSearchComponent />);
    
    expect(hookResult.searchResult.items).toEqual(mockData);
    expect(hookResult.searchResult.totalCount).toBe(mockData.length);
    expect(hookResult.searchResult.hasResults).toBe(true);
    expect(hookResult.isSearching).toBe(false);
  });

  test('performs search correctly', async () => {
    render(<TestEnhancedSearchComponent searchTerm="ポンプ" />);
    
    // Wait for debounce
    await waitFor(() => {
      expect(hookResult.searchResult.items).toHaveLength(1);
      expect(hookResult.searchResult.items[0].task).toBe('ポンプ点検');
    }, { timeout: 200 });
  });

  test('combines filters and search correctly', async () => {
    const filters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      }
    ];

    render(<TestEnhancedSearchComponent searchTerm="点検" filters={filters} />);
    
    await waitFor(() => {
      expect(hookResult.searchResult.items).toHaveLength(2); // ポンプ点検 and バルブ点検 (both 月次)
    }, { timeout: 200 });
  });

  test('generates suggestions correctly', async () => {
    render(<TestEnhancedSearchComponent searchTerm="ポン" />);
    
    await waitFor(() => {
      expect(hookResult.suggestions.length).toBeGreaterThan(0);
    }, { timeout: 200 });
  });

  test('manages search history correctly', () => {
    render(<TestEnhancedSearchComponent />);
    
    act(() => {
      hookResult.addToHistory('ポンプ');
      hookResult.addToHistory('モーター');
    });

    expect(hookResult.searchHistory).toEqual(['モーター', 'ポンプ']);

    act(() => {
      hookResult.clearHistory();
    });

    expect(hookResult.searchHistory).toEqual([]);
  });

  test('handles debouncing correctly', async () => {
    const { rerender } = render(<TestEnhancedSearchComponent searchTerm="" />);
    
    expect(hookResult.isSearching).toBe(false);

    rerender(<TestEnhancedSearchComponent searchTerm="ポンプ" />);
    expect(hookResult.isSearching).toBe(true);

    await waitFor(() => {
      expect(hookResult.isSearching).toBe(false);
    }, { timeout: 200 });
  });
});

describe('useAdvancedFilter hook', () => {
  test('initializes with empty filters', () => {
    // Clear localStorage before test
    localStorage.clear();
    
    let hookResult: any;
    
    const TestHookComponent = () => {
      hookResult = useAdvancedFilter({
        data: mockData,
        availableFields: mockFields,
        searchTerm: '',
      });
      return null;
    };
    
    render(<TestHookComponent />);
    
    expect(hookResult.filters).toEqual([]);
    expect(hookResult.savedFilters).toEqual([]);
  });

  test('filters data correctly with search term', () => {
    let hookResult: any;
    
    const TestHookComponent = () => {
      hookResult = useAdvancedFilter({
        data: mockData,
        availableFields: mockFields,
        searchTerm: 'ポンプ',
      });
      return null;
    };
    
    render(<TestHookComponent />);
    
    // Should filter to only pump-related items
    expect(hookResult.filteredData).toHaveLength(1);
    expect(hookResult.filteredData[0].task).toBe('ポンプ点検');
  });

  test('manages filter operations correctly', () => {
    let hookResult: any;
    
    const TestHookComponent = () => {
      hookResult = useAdvancedFilter({
        data: mockData,
        availableFields: mockFields,
        searchTerm: '',
      });
      return null;
    };
    
    render(<TestHookComponent />);

    const testFilter: FilterCondition = {
      id: '1',
      field: 'cycle',
      operator: 'equals',
      value: '月次'
    };

    // Add filter
    act(() => {
      hookResult.addFilter(testFilter);
    });

    expect(hookResult.filters).toHaveLength(1);
    expect(hookResult.filters[0]).toEqual(testFilter);

    // Update filter
    const updatedFilter = { ...testFilter, value: '年次' };
    act(() => {
      hookResult.updateFilterCondition(0, updatedFilter);
    });

    expect(hookResult.filters[0].value).toBe('年次');

    // Remove filter
    act(() => {
      hookResult.removeFilter(0);
    });

    expect(hookResult.filters).toHaveLength(0);
  });

  test('manages search history correctly', () => {
    let hookResult: any;
    
    const TestHookComponent = () => {
      hookResult = useAdvancedFilter({
        data: mockData,
        availableFields: mockFields,
        searchTerm: '',
      });
      return null;
    };
    
    render(<TestHookComponent />);

    // Add to search history
    act(() => {
      hookResult.addToSearchHistory('ポンプ');
      hookResult.addToSearchHistory('モーター');
      hookResult.addToSearchHistory('バルブ');
    });

    expect(hookResult.searchHistory).toEqual(['バルブ', 'モーター', 'ポンプ']);

    // Clear search history
    act(() => {
      hookResult.clearSearchHistory();
    });

    expect(hookResult.searchHistory).toEqual([]);
  });

  test('generates filter result statistics correctly', () => {
    let hookResult: any;
    
    const TestHookComponent = () => {
      hookResult = useAdvancedFilter({
        data: mockData,
        availableFields: mockFields,
        searchTerm: 'ポンプ',
      });
      return null;
    };
    
    render(<TestHookComponent />);

    expect(hookResult.filterResult.totalCount).toBe(mockData.length);
    expect(hookResult.filterResult.filteredCount).toBe(1);
  });
});