import { useCallback, useMemo, useState, useRef, useEffect } from 'react';

export interface HorizontalVirtualScrollingProps {
  columns: any[];
  columnWidth: number | ((index: number) => number);
  containerWidth: number;
  overscan?: number;
  enableMemoization?: boolean;
}

export interface VirtualColumn {
  index: number;
  left: number;
  width: number;
  data: any;
}

export interface HorizontalVirtualScrollState {
  scrollLeft: number;
  startIndex: number;
  endIndex: number;
  visibleColumns: VirtualColumn[];
  totalWidth: number;
}

/**
 * 水平仮想スクロール用のカスタムフック
 * 大量の列を効率的にレンダリング
 */
export const useHorizontalVirtualScrolling = ({
  columns,
  columnWidth,
  containerWidth,
  overscan = 3,
  enableMemoization = true,
}: HorizontalVirtualScrollingProps) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const cacheRef = useRef<Map<number, VirtualColumn>>(new Map());
  const lastScrollLeftRef = useRef(0);
  const scrollDirectionRef = useRef<'left' | 'right'>('right');

  // Calculate column widths
  const columnWidths = useMemo(() => {
    return columns.map((_, index) => 
      typeof columnWidth === 'function' ? columnWidth(index) : columnWidth
    );
  }, [columns, columnWidth]);

  // Calculate cumulative widths for positioning
  const cumulativeWidths = useMemo(() => {
    const widths: number[] = [0];
    let sum = 0;
    for (let i = 0; i < columnWidths.length; i++) {
      sum += columnWidths[i];
      widths.push(sum);
    }
    return widths;
  }, [columnWidths]);

  // Calculate total width
  const totalWidth = useMemo(() => {
    return cumulativeWidths[cumulativeWidths.length - 1] || 0;
  }, [cumulativeWidths]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    // Binary search for start index
    let startIndex = 0;
    for (let i = 0; i < cumulativeWidths.length - 1; i++) {
      if (cumulativeWidths[i] <= scrollLeft && cumulativeWidths[i + 1] > scrollLeft) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // Find end index
    const viewportEnd = scrollLeft + containerWidth;
    let endIndex = columns.length - 1;
    for (let i = startIndex; i < cumulativeWidths.length - 1; i++) {
      if (cumulativeWidths[i] >= viewportEnd) {
        endIndex = Math.min(columns.length - 1, i + overscan);
        break;
      }
    }

    return { startIndex, endIndex };
  }, [scrollLeft, containerWidth, cumulativeWidths, overscan, columns.length]);

  // Generate virtual columns with memoization
  const visibleColumns = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const newColumns: VirtualColumn[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
      if (index >= columns.length) break;

      // Check cache first if memoization is enabled
      const cacheKey = index;
      if (enableMemoization && cacheRef.current.has(cacheKey)) {
        const cachedColumn = cacheRef.current.get(cacheKey)!;
        // Verify cache validity
        if (cachedColumn.data === columns[index]) {
          newColumns.push(cachedColumn);
          continue;
        }
      }

      // Create new virtual column
      const virtualColumn: VirtualColumn = {
        index,
        left: cumulativeWidths[index],
        width: columnWidths[index],
        data: columns[index],
      };

      newColumns.push(virtualColumn);

      // Cache the column if memoization is enabled
      if (enableMemoization) {
        cacheRef.current.set(cacheKey, virtualColumn);
      }
    }

    return newColumns;
  }, [visibleRange, columns, columnWidths, cumulativeWidths, enableMemoization]);

  // Handle scroll with optimization
  const handleScroll = useCallback((newScrollLeft: number) => {
    // Determine scroll direction
    const direction = newScrollLeft > lastScrollLeftRef.current ? 'right' : 'left';
    scrollDirectionRef.current = direction;
    lastScrollLeftRef.current = newScrollLeft;

    setScrollLeft(newScrollLeft);
  }, []);

  // Scroll to specific column index
  const scrollToColumn = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const maxIndex = columns.length - 1;
    const targetIndex = Math.max(0, Math.min(index, maxIndex));
    
    let targetScrollLeft: number;
    const columnLeft = cumulativeWidths[targetIndex];
    const columnWidth = columnWidths[targetIndex];
    
    switch (align) {
      case 'center':
        targetScrollLeft = columnLeft - containerWidth / 2 + columnWidth / 2;
        break;
      case 'end':
        targetScrollLeft = columnLeft - containerWidth + columnWidth;
        break;
      case 'start':
      default:
        targetScrollLeft = columnLeft;
        break;
    }

    // Ensure scroll position is within bounds
    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, totalWidth - containerWidth));
    
    setScrollLeft(targetScrollLeft);
    return targetScrollLeft;
  }, [columns.length, cumulativeWidths, columnWidths, containerWidth, totalWidth]);

  // Get column at position
  const getColumnAtPosition = useCallback((x: number) => {
    for (let i = 0; i < cumulativeWidths.length - 1; i++) {
      if (cumulativeWidths[i] <= x && cumulativeWidths[i + 1] > x) {
        return { index: i, column: columns[i] };
      }
    }
    return null;
  }, [columns, cumulativeWidths]);

  // Get visible column indices
  const getVisibleIndices = useCallback(() => {
    return visibleColumns.map(col => col.index);
  }, [visibleColumns]);

  // Check if column is visible
  const isColumnVisible = useCallback((index: number) => {
    const { startIndex, endIndex } = visibleRange;
    return index >= startIndex && index <= endIndex;
  }, [visibleRange]);

  // Get scroll progress (0-1)
  const getScrollProgress = useCallback(() => {
    const maxScrollLeft = totalWidth - containerWidth;
    if (maxScrollLeft <= 0) return 0;
    return Math.min(1, scrollLeft / maxScrollLeft);
  }, [scrollLeft, totalWidth, containerWidth]);

  // Cache cleanup for memory management
  useEffect(() => {
    if (!enableMemoization) return;

    const cleanup = () => {
      const { startIndex, endIndex } = visibleRange;
      const cacheKeys = Array.from(cacheRef.current.keys());
      
      // Remove columns that are far from visible range
      const cleanupBuffer = overscan * 3;
      cacheKeys.forEach(key => {
        if (key < startIndex - cleanupBuffer || key > endIndex + cleanupBuffer) {
          cacheRef.current.delete(key);
        }
      });
    };

    // Cleanup cache periodically
    const cleanupInterval = setInterval(cleanup, 5000);
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [visibleRange, overscan, enableMemoization]);

  // Performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      totalColumns: columns.length,
      visibleColumns: visibleColumns.length,
      cacheSize: cacheRef.current.size,
      scrollLeft,
      scrollProgress: getScrollProgress(),
      visibleRange,
      scrollDirection: scrollDirectionRef.current,
    };
  }, [columns.length, visibleColumns.length, scrollLeft, getScrollProgress, visibleRange]);

  return {
    // State
    visibleColumns,
    totalWidth,
    scrollLeft,
    startIndex: visibleRange.startIndex,
    endIndex: visibleRange.endIndex,
    
    // Actions
    handleScroll,
    scrollToColumn,
    
    // Utilities
    getColumnAtPosition,
    getVisibleIndices,
    isColumnVisible,
    getScrollProgress,
    getPerformanceMetrics,
    
    // Computed values
    isScrolledToLeft: scrollLeft === 0,
    isScrolledToRight: scrollLeft >= totalWidth - containerWidth,
    scrollDirection: scrollDirectionRef.current,
  };
};
