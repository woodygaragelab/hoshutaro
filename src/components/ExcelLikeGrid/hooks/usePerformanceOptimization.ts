import { useCallback, useMemo, useRef, useEffect } from 'react';
import { GridColumn, GridState } from '../types';
import { HierarchicalData } from '../../../types';

interface PerformanceOptimizationOptions {
  enableMemoization?: boolean;
  enableDebouncing?: boolean;
  debounceDelay?: number;
  enableBatching?: boolean;
  batchSize?: number;
}

interface PerformanceMetrics {
  renderTime: number;
  updateCount: number;
  lastUpdate: number;
  averageRenderTime: number;
}

export const usePerformanceOptimization = (
  data: HierarchicalData[],
  columns: GridColumn[],
  gridState: GridState,
  options: PerformanceOptimizationOptions = {}
) => {
  const {
    enableMemoization = true,
    enableDebouncing = true,
    debounceDelay = 16, // ~60fps
    enableBatching = true,
    batchSize = 50
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    updateCount: 0,
    lastUpdate: 0,
    averageRenderTime: 0
  });

  const renderStartTimeRef = useRef<number>(0);
  const pendingUpdatesRef = useRef<Array<() => void>>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized data processing
  const processedData = useMemo(() => {
    if (!enableMemoization) return data;
    
    const startTime = performance.now();
    
    // Process data for better rendering performance
    const processed = data.map((item, index) => ({
      ...item,
      _index: index,
      _renderKey: `${item.id}-${item.task}-${Object.keys(item.results || {}).length}`,
      _hasSpecifications: Boolean(item.specifications && item.specifications.length > 0)
    }));
    
    const endTime = performance.now();
    metricsRef.current.renderTime = endTime - startTime;
    
    return processed;
  }, [data, enableMemoization]);

  // Memoized column processing
  const processedColumns = useMemo(() => {
    if (!enableMemoization) return columns;
    
    return columns.map(col => ({
      ...col,
      _width: gridState.columnWidths[col.id] || col.width,
      _isResizable: col.resizable !== false,
      _isSortable: col.sortable !== false
    }));
  }, [columns, gridState.columnWidths, enableMemoization]);

  // Debounced update function
  const debouncedUpdate = useCallback((updateFn: () => void) => {
    if (!enableDebouncing) {
      updateFn();
      return;
    }

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      updateFn();
      batchTimeoutRef.current = null;
    }, debounceDelay);
  }, [enableDebouncing, debounceDelay]);

  // Batched update function
  const batchUpdate = useCallback((updateFn: () => void) => {
    if (!enableBatching) {
      updateFn();
      return;
    }

    pendingUpdatesRef.current.push(updateFn);

    if (pendingUpdatesRef.current.length >= batchSize) {
      // Execute all pending updates
      const updates = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    }
  }, [enableBatching, batchSize]);

  // Performance monitoring
  const startRenderMeasurement = useCallback(() => {
    renderStartTimeRef.current = performance.now();
  }, []);

  const endRenderMeasurement = useCallback(() => {
    const endTime = performance.now();
    const renderTime = endTime - renderStartTimeRef.current;
    
    metricsRef.current.renderTime = renderTime;
    metricsRef.current.updateCount += 1;
    metricsRef.current.lastUpdate = endTime;
    
    // Calculate average render time
    const { updateCount, averageRenderTime } = metricsRef.current;
    metricsRef.current.averageRenderTime = 
      (averageRenderTime * (updateCount - 1) + renderTime) / updateCount;
  }, []);

  // Optimized cell value getter
  const getCellValue = useCallback((item: HierarchicalData, columnId: string) => {
    // Fast path for common columns
    switch (columnId) {
      case 'task':
        return item.task;
      case 'bomCode':
        return item.bomCode;
      default:
        // Check maintenance data (results)
        if (item.results && columnId in item.results) {
          const result = item.results[columnId];
          // Return a simple representation for display
          if (result.planned && result.actual) return 'both';
          if (result.planned) return 'plan';
          if (result.actual) return 'actual';
          return '';
        }
        
        // Check specifications
        if (item.specifications && columnId.startsWith('spec_')) {
          const specIndex = parseInt(columnId.replace('spec_', ''), 10);
          return item.specifications[specIndex]?.value || '';
        }
        
        return '';
    }
  }, []);

  // Optimized cell change detector
  const hasCellChanged = useCallback((
    prevItem: HierarchicalData,
    nextItem: HierarchicalData,
    columnId: string
  ): boolean => {
    const prevValue = getCellValue(prevItem, columnId);
    const nextValue = getCellValue(nextItem, columnId);
    return prevValue !== nextValue;
  }, [getCellValue]);

  // Memory cleanup
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // Execute any remaining batched updates
      if (pendingUpdatesRef.current.length > 0) {
        const updates = [...pendingUpdatesRef.current];
        pendingUpdatesRef.current = [];
        updates.forEach(update => update());
      }
    };
  }, []);

  // Performance metrics getter
  const getPerformanceMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Check if virtual scrolling should be enabled based on performance
  const shouldUseVirtualScrolling = useMemo(() => {
    const dataSize = data.length;
    const columnCount = columns.length;
    const complexity = dataSize * columnCount;
    
    // Enable virtual scrolling for large datasets or complex grids
    return complexity > 10000 || dataSize > 500;
  }, [data.length, columns.length]);

  return {
    processedData,
    processedColumns,
    debouncedUpdate,
    batchUpdate,
    startRenderMeasurement,
    endRenderMeasurement,
    getCellValue,
    hasCellChanged,
    getPerformanceMetrics,
    shouldUseVirtualScrolling
  };
};