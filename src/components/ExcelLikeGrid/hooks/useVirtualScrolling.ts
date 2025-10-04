import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { HierarchicalData } from '../../../types';
import { GridState } from '../types';

interface VirtualScrollingState {
  scrollTop: number;
  scrollLeft: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  overscanStartIndex: number;
  overscanEndIndex: number;
}

interface VirtualScrollingOptions {
  itemHeight?: number;
  overscanCount?: number;
  enableHorizontalScrolling?: boolean;
  enableSmoothScrolling?: boolean;
}

export const useVirtualScrolling = (
  data: HierarchicalData[],
  gridState: GridState,
  containerHeight: number,
  options: VirtualScrollingOptions = {}
) => {
  const {
    itemHeight = 40,
    overscanCount = 5,
    enableHorizontalScrolling = true,
    enableSmoothScrolling = true
  } = options;

  const [virtualState, setVirtualState] = useState<VirtualScrollingState>({
    scrollTop: 0,
    scrollLeft: 0,
    visibleStartIndex: 0,
    visibleEndIndex: 0,
    overscanStartIndex: 0,
    overscanEndIndex: 0
  });

  const scrollElementRef = useRef<HTMLElement | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate visible range based on scroll position
  const calculateVisibleRange = useCallback((scrollTop: number, height: number) => {
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(
      data.length - 1,
      Math.ceil((scrollTop + height) / itemHeight)
    );

    const overscanStartIndex = Math.max(0, visibleStartIndex - overscanCount);
    const overscanEndIndex = Math.min(data.length - 1, visibleEndIndex + overscanCount);

    return {
      visibleStartIndex,
      visibleEndIndex,
      overscanStartIndex,
      overscanEndIndex
    };
  }, [data.length, itemHeight, overscanCount]);

  // Handle scroll events
  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    const scrollTop = target.scrollTop;
    const scrollLeft = target.scrollLeft;

    isScrollingRef.current = true;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Calculate new visible range
    const range = calculateVisibleRange(scrollTop, containerHeight);

    setVirtualState(prev => ({
      ...prev,
      scrollTop,
      scrollLeft,
      ...range
    }));

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  }, [calculateVisibleRange, containerHeight]);

  // Scroll to specific item
  const scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    if (!scrollElementRef.current) return;

    const targetScrollTop = (() => {
      const itemTop = index * itemHeight;
      const itemBottom = itemTop + itemHeight;
      const currentScrollTop = virtualState.scrollTop;
      const viewportHeight = containerHeight;

      switch (align) {
        case 'start':
          return itemTop;
        case 'end':
          return itemBottom - viewportHeight;
        case 'center':
          return itemTop - (viewportHeight - itemHeight) / 2;
        case 'auto':
        default:
          // Only scroll if item is not visible
          if (itemTop < currentScrollTop) {
            return itemTop;
          } else if (itemBottom > currentScrollTop + viewportHeight) {
            return itemBottom - viewportHeight;
          }
          return currentScrollTop;
      }
    })();

    if (enableSmoothScrolling) {
      scrollElementRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    } else {
      scrollElementRef.current.scrollTop = targetScrollTop;
    }
  }, [virtualState.scrollTop, containerHeight, itemHeight, enableSmoothScrolling]);

  // Scroll to selected cell
  const scrollToSelectedCell = useCallback(() => {
    if (!gridState.selectedCell) return;

    const selectedIndex = data.findIndex(item => item.id === gridState.selectedCell?.rowId);
    if (selectedIndex >= 0) {
      scrollToItem(selectedIndex, 'auto');
    }
  }, [gridState.selectedCell, data, scrollToItem]);

  // Get visible items
  const visibleItems = useMemo(() => {
    const { overscanStartIndex, overscanEndIndex } = virtualState;
    return data.slice(overscanStartIndex, overscanEndIndex + 1).map((item, index) => ({
      item,
      index: overscanStartIndex + index,
      style: {
        position: 'absolute' as const,
        top: (overscanStartIndex + index) * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight
      }
    }));
  }, [data, virtualState, itemHeight]);

  // Total height for scrollbar
  const totalHeight = useMemo(() => {
    return data.length * itemHeight;
  }, [data.length, itemHeight]);

  // Update visible range when container height changes
  useEffect(() => {
    const range = calculateVisibleRange(virtualState.scrollTop, containerHeight);
    setVirtualState(prev => ({
      ...prev,
      ...range
    }));
  }, [containerHeight, calculateVisibleRange, virtualState.scrollTop]);

  // Auto-scroll to selected cell when it changes
  useEffect(() => {
    if (gridState.selectedCell) {
      scrollToSelectedCell();
    }
  }, [gridState.selectedCell, scrollToSelectedCell]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    virtualState,
    visibleItems,
    totalHeight,
    isScrolling: isScrollingRef.current,
    scrollElementRef,
    handleScroll,
    scrollToItem,
    scrollToSelectedCell
  };
};