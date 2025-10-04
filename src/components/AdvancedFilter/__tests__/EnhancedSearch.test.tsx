import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useEnhancedSearch } from '../hooks/useEnhancedSearch';
import { FilterCondition } from '../types';
import { HierarchicalData } from '../../../types';

// Mock data for testing
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
    task: 'バルブ点検',
    hierarchyPath: '設備 > バルブ > 制御バルブ',
    bomCode: 'V001',
    cycle: '月次',
    specifications: [
      { key: '型式', value: 'DEF-789', order: 0 }
    ],
    results: {}
  }
];

describe('Enhanced Search Hook Tests', () => {
  let hookResult: any;

  const TestComponent = ({ 
    searchTerm = '', 
    filters = [], 
    debounceMs = 50 
  }: { 
    searchTerm?: string; 
    filters?: FilterCondition[]; 
    debounceMs?: number;
  }) => {
    hookResult = useEnhancedSearch({
      data: mockData,
      filters,
      searchTerm,
      debounceMs
    });
    return null;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test('initializes with correct default values', () => {
    render(<TestComponent />);
    
    expect(hookResult.searchResult.items).toEqual(mockData);
    expect(hookResult.searchResult.totalCount).toBe(mockData.length);
    expect(hookResult.searchResult.hasResults).toBe(true);
    expect(hookResult.isSearching).toBe(false);
    expect(hookResult.suggestions).toEqual([]);
    expect(hookResult.alternativeSuggestions).toEqual([]);
    expect(hookResult.searchHistory).toEqual([]);
  });

  test('performs real-time search correctly', async () => {
    const { rerender } = render(<TestComponent searchTerm="ポンプ" />);
    
    // Should show searching state initially
    expect(hookResult.isSearching).toBe(true);
    
    // Wait for debounce to complete
    await waitFor(() => {
      expect(hookResult.isSearching).toBe(false);
      expect(hookResult.searchResult.items).toHaveLength(1);
      expect(hookResult.searchResult.items[0].task).toBe('ポンプ点検');
    }, { timeout: 100 });
  });

  test('combines filters with search correctly', async () => {
    const filters: FilterCondition[] = [
      {
        id: '1',
        field: 'cycle',
        operator: 'equals',
        value: '月次'
      }
    ];

    render(<TestComponent searchTerm="点検" filters={filters} />);
    
    await waitFor(() => {
      expect(hookResult.searchResult.items).toHaveLength(2); // ポンプ点検 and バルブ点検
      expect(hookResult.searchResult.items.every((item: any) => item.cycle === '月次')).toBe(true);
    }, { timeout: 100 });
  });

  test('generates search suggestions', async () => {
    render(<TestComponent searchTerm="ポン" />);
    
    await waitFor(() => {
      expect(hookResult.suggestions.length).toBeGreaterThan(0);
    }, { timeout: 100 });
  });

  test('generates alternative suggestions when no results', async () => {
    render(<TestComponent searchTerm="存在しない検索語" />);
    
    await waitFor(() => {
      expect(hookResult.searchResult.hasResults).toBe(false);
      expect(hookResult.alternativeSuggestions.length).toBeGreaterThan(0);
    }, { timeout: 100 });
  });

  test('manages search history correctly', () => {
    render(<TestComponent />);
    
    // Add items to history
    hookResult.addToHistory('ポンプ');
    hookResult.addToHistory('モーター');
    hookResult.addToHistory('バルブ');
    
    expect(hookResult.searchHistory).toEqual(['バルブ', 'モーター', 'ポンプ']);
    
    // Clear history
    hookResult.clearHistory();
    expect(hookResult.searchHistory).toEqual([]);
  });

  test('limits search history to maximum items', () => {
    render(<TestComponent />);
    
    // Add more than 10 items
    for (let i = 0; i < 15; i++) {
      hookResult.addToHistory(`検索語${i}`);
    }
    
    expect(hookResult.searchHistory).toHaveLength(10);
    expect(hookResult.searchHistory[0]).toBe('検索語14'); // Most recent first
  });

  test('persists search history in localStorage', () => {
    render(<TestComponent />);
    
    hookResult.addToHistory('テスト検索');
    
    const savedHistory = localStorage.getItem('hoshitori_search_history');
    expect(savedHistory).toBeTruthy();
    
    const parsedHistory = JSON.parse(savedHistory!);
    expect(parsedHistory).toContain('テスト検索');
  });

  test('loads search history from localStorage', () => {
    // Pre-populate localStorage
    const existingHistory = ['既存の検索1', '既存の検索2'];
    localStorage.setItem('hoshitori_search_history', JSON.stringify(existingHistory));
    
    render(<TestComponent />);
    
    expect(hookResult.searchHistory).toEqual(existingHistory);
  });

  test('handles localStorage errors gracefully', () => {
    // Mock localStorage to throw error
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = jest.fn(() => {
      throw new Error('localStorage error');
    });
    
    // Should not crash
    expect(() => render(<TestComponent />)).not.toThrow();
    
    // Restore original localStorage
    localStorage.getItem = originalGetItem;
  });

  test('measures search performance', async () => {
    render(<TestComponent searchTerm="ポンプ" />);
    
    await waitFor(() => {
      expect(hookResult.searchResult.searchTime).toBeGreaterThan(0);
    }, { timeout: 100 });
  });

  test('handles empty search terms correctly', () => {
    render(<TestComponent searchTerm="" />);
    
    expect(hookResult.searchResult.items).toEqual(mockData);
    expect(hookResult.suggestions).toEqual([]);
    expect(hookResult.alternativeSuggestions).toEqual([]);
  });

  test('handles short search terms correctly', () => {
    render(<TestComponent searchTerm="a" />);
    
    expect(hookResult.suggestions).toEqual([]);
  });

  test('debounces search input correctly', async () => {
    const { rerender } = render(<TestComponent searchTerm="" debounceMs={100} />);
    
    // Rapidly change search term
    rerender(<TestComponent searchTerm="ポ" debounceMs={100} />);
    expect(hookResult.isSearching).toBe(true);
    
    rerender(<TestComponent searchTerm="ポン" debounceMs={100} />);
    expect(hookResult.isSearching).toBe(true);
    
    rerender(<TestComponent searchTerm="ポンプ" debounceMs={100} />);
    expect(hookResult.isSearching).toBe(true);
    
    // Wait for debounce to complete
    await waitFor(() => {
      expect(hookResult.isSearching).toBe(false);
    }, { timeout: 150 });
  });

  test('ignores short terms in search history', () => {
    render(<TestComponent />);
    
    hookResult.addToHistory('a');
    hookResult.addToHistory('');
    hookResult.addToHistory('  ');
    
    expect(hookResult.searchHistory).toEqual([]);
  });

  test('removes duplicates from search history', () => {
    render(<TestComponent />);
    
    hookResult.addToHistory('ポンプ');
    hookResult.addToHistory('モーター');
    hookResult.addToHistory('ポンプ'); // Duplicate
    
    expect(hookResult.searchHistory).toEqual(['ポンプ', 'モーター']);
  });
});