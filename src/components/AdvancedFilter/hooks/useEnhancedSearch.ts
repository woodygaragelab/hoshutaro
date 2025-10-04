import { useState, useEffect, useMemo, useCallback } from 'react';
import { HierarchicalData } from '../../../types';
import { FilterCondition } from '../types';
import { applyFilters } from '../utils/filterUtils';
import {
  createSearchIndex,
  searchWithIndex,
  generateSmartSuggestions,
  generateAlternativeSuggestions,
  debounce,
  SearchIndex,
} from '../utils/searchOptimization';

interface UseEnhancedSearchProps {
  data: HierarchicalData[];
  filters: FilterCondition[];
  searchTerm: string;
  debounceMs?: number;
}

interface SearchResult {
  items: HierarchicalData[];
  totalCount: number;
  searchTime: number;
  hasResults: boolean;
}

interface UseEnhancedSearchReturn {
  searchResult: SearchResult;
  suggestions: string[];
  alternativeSuggestions: string[];
  isSearching: boolean;
  searchHistory: string[];
  addToHistory: (term: string) => void;
  clearHistory: () => void;
}

const SEARCH_HISTORY_KEY = 'hoshitori_search_history';
const MAX_HISTORY_ITEMS = 10;

export const useEnhancedSearch = ({
  data,
  filters,
  searchTerm,
  debounceMs = 300,
}: UseEnhancedSearchProps): UseEnhancedSearchReturn => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save search history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [searchHistory]);

  // Debounce search term
  const debouncedSetSearchTerm = useMemo(
    () => debounce((term: string) => {
      setDebouncedSearchTerm(term);
      setIsSearching(false);
    }, debounceMs),
    [debounceMs]
  );

  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
      debouncedSetSearchTerm(searchTerm);
    }
  }, [searchTerm, debouncedSearchTerm, debouncedSetSearchTerm]);

  // Create search index
  const searchIndex = useMemo((): SearchIndex[] => {
    return createSearchIndex(data);
  }, [data]);

  // Apply filters first, then search
  const filteredData = useMemo(() => {
    return applyFilters(data, filters);
  }, [data, filters]);

  const filteredSearchIndex = useMemo((): SearchIndex[] => {
    const filteredIds = new Set(filteredData.map(item => item.id));
    return searchIndex.filter(index => filteredIds.has(index.id));
  }, [searchIndex, filteredData]);

  // Perform search
  const searchResult = useMemo((): SearchResult => {
    const startTime = performance.now();
    
    let items: HierarchicalData[];
    
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      items = filteredData;
    } else {
      items = searchWithIndex(filteredSearchIndex, debouncedSearchTerm);
    }
    
    const endTime = performance.now();
    const searchTime = endTime - startTime;
    
    return {
      items,
      totalCount: filteredData.length,
      searchTime,
      hasResults: items.length > 0,
    };
  }, [filteredData, filteredSearchIndex, debouncedSearchTerm]);

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }
    return generateSmartSuggestions(filteredSearchIndex, debouncedSearchTerm, 8);
  }, [filteredSearchIndex, debouncedSearchTerm]);

  // Generate alternative suggestions when no results
  const alternativeSuggestions = useMemo(() => {
    if (searchResult.hasResults || !debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }
    return generateAlternativeSuggestions(searchIndex, debouncedSearchTerm, 5);
  }, [searchIndex, debouncedSearchTerm, searchResult.hasResults]);

  // Search history management
  const addToHistory = useCallback((term: string) => {
    if (!term.trim() || term.length < 2) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== term);
      return [term, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    searchResult,
    suggestions,
    alternativeSuggestions,
    isSearching,
    searchHistory,
    addToHistory,
    clearHistory,
  };
};