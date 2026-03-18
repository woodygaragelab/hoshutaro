/**
 * Performance Optimization Hook
 * Optimize rendering performance for large grids
 */

import { useCallback, useMemo, useRef } from 'react';
import { GridColumn, GridState } from '../types';

export interface PerformanceOptimizationOptions {
  enableMemoization?: boolean;
  enableDebouncing?: boolean;
  debounceDelay?: number;
  enableBatching?: boolean;
  batchSize?: number;
  virtualScrollThreshold?: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  scrollTime: number;
  fps?: number;
}

export interface UsePerformanceOptimizationResult {
  processedData: any[];
  processedColumns: GridColumn[];
  debouncedUpdate: (callback: () => void) => void;
  startRenderMeasurement: () => void;
  endRenderMeasurement: () => void;
  getPerformanceMetrics: () => PerformanceMetrics;
  shouldUseVirtualScrolling: boolean;
}

/**
 * Custom hook for performance optimization
 */
export function usePerformanceOptimization(
  data: any[],
  columns: GridColumn[],
  gridState: GridState,
  options: PerformanceOptimizationOptions = {}
): UsePerformanceOptimizationResult {
  const {
    enableMemoization = true,
    enableDebouncing = true,
    debounceDelay = 16,
    virtualScrollThreshold = 1000,
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    updateTime: 0,
    scrollTime: 0,
  });

  const renderStartRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize processed data
  const processedData = useMemo(() => {
    if (!enableMemoization) return data;
    return data;
  }, [data, enableMemoization]);

  // Memoize processed columns
  const processedColumns = useMemo(() => {
    if (!enableMemoization) return columns;
    return columns;
  }, [columns, enableMemoization]);

  // Debounced update
  const debouncedUpdate = useCallback((callback: () => void) => {
    if (!enableDebouncing) {
      callback();
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      callback();
    }, debounceDelay);
  }, [enableDebouncing, debounceDelay]);

  // Start render measurement
  const startRenderMeasurement = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  // End render measurement
  const endRenderMeasurement = useCallback(() => {
    const renderTime = performance.now() - renderStartRef.current;
    metricsRef.current.renderTime = renderTime;
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Determine if virtual scrolling should be used
  const shouldUseVirtualScrolling = useMemo(() => {
    return data.length > virtualScrollThreshold;
  }, [data.length, virtualScrollThreshold]);

  return {
    processedData,
    processedColumns,
    debouncedUpdate,
    startRenderMeasurement,
    endRenderMeasurement,
    getPerformanceMetrics,
    shouldUseVirtualScrolling,
  };
}
