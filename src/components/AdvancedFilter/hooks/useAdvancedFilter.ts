import { useState, useEffect, useCallback, useMemo } from 'react';
import { FilterCondition, SavedFilter, FilterField, FilterResult } from '../types';
import { HierarchicalData } from '../../../types';
import { applyFilters, generateSearchSuggestions } from '../utils/filterUtils';

interface UseAdvancedFilterProps {
  data: HierarchicalData[];
  availableFields: FilterField[];
  searchTerm: string;
}

interface UseAdvancedFilterReturn {
  // Filter state
  filters: FilterCondition[];
  savedFilters: SavedFilter[];
  filteredData: HierarchicalData[];
  filterResult: FilterResult;
  
  // Search functionality
  searchSuggestions: string[];
  searchHistory: string[];
  
  // Filter actions
  setFilters: (filters: FilterCondition[]) => void;
  addFilter: (filter: FilterCondition) => void;
  updateFilterCondition: (index: number, filter: FilterCondition) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  
  // Saved filter actions
  saveFilter: (name: string, description: string, filters: FilterCondition[]) => void;
  updateSavedFilter: (filterId: string, name: string, description: string, filters: FilterCondition[]) => void;
  duplicateFilter: (filterId: string) => void;
  loadFilter: (filterId: string) => void;
  deleteFilter: (filterId: string) => void;
  
  // Search actions
  addToSearchHistory: (term: string) => void;
  clearSearchHistory: () => void;
}

const STORAGE_KEYS = {
  SAVED_FILTERS: 'hoshitori_saved_filters',
  SEARCH_HISTORY: 'hoshitori_search_history',
} as const;

export const useAdvancedFilter = ({
  data,
  availableFields,
  searchTerm,
}: UseAdvancedFilterProps): UseAdvancedFilterReturn => {
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load saved data from localStorage on mount
  useEffect(() => {
    try {
      const savedFiltersData = localStorage.getItem(STORAGE_KEYS.SAVED_FILTERS);
      if (savedFiltersData) {
        const parsed = JSON.parse(savedFiltersData);
        setSavedFilters(parsed.map((f: any) => ({
          ...f,
          createdAt: new Date(f.createdAt),
          lastUsed: f.lastUsed ? new Date(f.lastUsed) : undefined,
        })));
      }

      const searchHistoryData = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      if (searchHistoryData) {
        setSearchHistory(JSON.parse(searchHistoryData));
      }
    } catch (error) {
      console.error('Failed to load saved filter data:', error);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_FILTERS, JSON.stringify(savedFilters));
    } catch (error) {
      console.error('Failed to save filters:', error);
    }
  }, [savedFilters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, [searchHistory]);

  // Apply filters to data
  const filteredData = useMemo(() => {
    let result = data;
    
    // Apply search term first
    if (searchTerm.trim()) {
      result = result.filter(item => 
        item.task.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.hierarchyPath && item.hierarchyPath.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.specifications && item.specifications.some(spec => 
          spec.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          spec.value.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }
    
    // Apply advanced filters
    if (filters.length > 0) {
      result = applyFilters(result, filters);
    }
    
    return result;
  }, [data, filters, searchTerm]);

  // Generate filter result statistics
  const filterResult = useMemo((): FilterResult => ({
    totalCount: data.length,
    filteredCount: filteredData.length,
  }), [data.length, filteredData.length]);

  // Generate search suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return generateSearchSuggestions(data, filters, searchTerm);
  }, [data, filters, searchTerm]);

  // Filter actions
  const addFilter = useCallback((filter: FilterCondition) => {
    setFilters(prev => [...prev, filter]);
  }, []);

  const updateFilterCondition = useCallback((index: number, filter: FilterCondition) => {
    setFilters(prev => {
      const newFilters = [...prev];
      newFilters[index] = filter;
      return newFilters;
    });
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Saved filter actions
  const saveFilter = useCallback((name: string, description: string, filtersToSave: FilterCondition[]) => {
    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      conditions: filtersToSave,
      createdAt: new Date(),
    };
    
    setSavedFilters(prev => [...prev, newFilter]);
  }, []);

  const updateSavedFilter = useCallback((filterId: string, name: string, description: string, filtersToUpdate: FilterCondition[]) => {
    setSavedFilters(prev => 
      prev.map(f => 
        f.id === filterId 
          ? { ...f, name, description, conditions: filtersToUpdate, lastUsed: new Date() }
          : f
      )
    );
  }, []);

  const duplicateFilter = useCallback((filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      const newFilter: SavedFilter = {
        id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${filter.name} (コピー)`,
        description: filter.description,
        conditions: [...filter.conditions],
        createdAt: new Date(),
      };
      setSavedFilters(prev => [...prev, newFilter]);
    }
  }, [savedFilters]);

  const loadFilter = useCallback((filterId: string) => {
    const filter = savedFilters.find(f => f.id === filterId);
    if (filter) {
      setFilters(filter.conditions);
      
      // Update last used timestamp
      setSavedFilters(prev => 
        prev.map(f => 
          f.id === filterId 
            ? { ...f, lastUsed: new Date() }
            : f
        )
      );
    }
  }, [savedFilters]);

  const deleteFilter = useCallback((filterId: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  // Search history actions
  const addToSearchHistory = useCallback((term: string) => {
    if (!term.trim()) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== term);
      return [term, ...filtered].slice(0, 10); // Keep only last 10 searches
    });
  }, []);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    // Filter state
    filters,
    savedFilters,
    filteredData,
    filterResult,
    
    // Search functionality
    searchSuggestions,
    searchHistory,
    
    // Filter actions
    setFilters,
    addFilter,
    updateFilterCondition,
    removeFilter,
    clearFilters,
    
    // Saved filter actions
    saveFilter,
    updateSavedFilter,
    duplicateFilter,
    loadFilter,
    deleteFilter,
    
    // Search actions
    addToSearchHistory,
    clearSearchHistory,
  };
};