/**
 * Horizontal Virtual Scrolling Hook
 * Efficiently renders only visible columns for large datasets
 */

import { useMemo, useCallback } from 'react';
import { GridColumn } from '../ExcelLikeGrid/types';

export interface HorizontalVirtualScrollingConfig {
  columns: GridColumn[];
  columnWidth: number | ((index: number) => number);
  containerWidth: number;
  scrollLeft?: number;
  overscan?: number;
  enableMemoization?: boolean;
}

export interface HorizontalVirtualScrollingConfigWithScroll extends HorizontalVirtualScrollingConfig {
  scrollLeft: number;
}

export interface VirtualColumn extends GridColumn {
  data: GridColumn;
  left: number;
}

export interface HorizontalVirtualScrollingResult {
  visibleColumns: VirtualColumn[];
  visibleStartIndex: number;
  visibleEndIndex: number;
  totalWidth: number;
  offsetLeft: number;
  handleScroll: (scrollLeft: number) => void;
}

/**
 * Custom hook for horizontal virtual scrolling
 */
export function useHorizontalVirtualScrolling(
  config: HorizontalVirtualScrollingConfig
): HorizontalVirtualScrollingResult {
  const {
    columns,
    columnWidth,
    containerWidth,
    scrollLeft = 0,
    overscan = 5,
  } = config;

  // Calculate cumulative widths for fast position lookup
  const cumulativeWidths = useMemo(() => {
    const widths: number[] = [0];
    let total = 0;

    for (let i = 0; i < columns.length; i++) {
      const width = typeof columnWidth === 'function' ? columnWidth(i) : columnWidth;
      total += width;
      widths.push(total);
    }

    return widths;
  }, [columns, columnWidth]);

  // Calculate visible range
  const { visibleStartIndex, visibleEndIndex, offsetLeft } = useMemo(() => {
    const viewportStart = scrollLeft;
    const viewportEnd = scrollLeft + containerWidth;

    // Binary search for start index
    let start = 0;
    let end = columns.length - 1;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (cumulativeWidths[mid] < viewportStart) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    // Binary search for end index
    let endIdx = start;
    while (endIdx < columns.length && cumulativeWidths[endIdx] < viewportEnd) {
      endIdx++;
    }

    // Apply overscan
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(columns.length, endIdx + overscan);

    return {
      visibleStartIndex: startWithOverscan,
      visibleEndIndex: endWithOverscan,
      offsetLeft: cumulativeWidths[startWithOverscan],
    };
  }, [scrollLeft, containerWidth, columns.length, cumulativeWidths, overscan]);

  // Get visible columns with data and left position
  const visibleColumns = useMemo(() => {
    return columns.slice(visibleStartIndex, visibleEndIndex).map((col, idx) => ({
      ...col,
      data: col,
      left: cumulativeWidths[visibleStartIndex + idx],
    }));
  }, [columns, visibleStartIndex, visibleEndIndex, cumulativeWidths]);

  const totalWidth = cumulativeWidths[cumulativeWidths.length - 1];

  // Handle scroll - no-op since we use scrollLeft from config
  const handleScroll = useCallback((newScrollLeft: number) => {
    // This is handled by the parent component passing scrollLeft to config
  }, []);

  return {
    visibleColumns,
    visibleStartIndex,
    visibleEndIndex,
    totalWidth,
    offsetLeft,
    handleScroll,
  };
}
