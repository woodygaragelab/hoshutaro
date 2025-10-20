import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { UseVirtualScrollingProps, VirtualScrollState, VirtualItem } from './types';

/**
 * 仮想スクロール用のカスタムフック
 * 大量データの効率的なレンダリングを実現
 */
export const useVirtualScrolling = ({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  enableMemoization = true,
}: UseVirtualScrollingProps) => {
  const [scrollTop, setScrollTop] = useState(0);
  const cacheRef = useRef<Map<number, VirtualItem>>(new Map());
  const lastScrollTopRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down'>('down');

  // Calculate total height
  const totalHeight = useMemo(() => {
    return items.length * itemHeight;
  }, [items.length, itemHeight]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + containerItemCount + overscan * 2
    );

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, overscan, items.length]);

  // Generate virtual items with memoization
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const newItems: VirtualItem[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
      if (index >= items.length) break;

      // Check cache first if memoization is enabled
      const cacheKey = index;
      if (enableMemoization && cacheRef.current.has(cacheKey)) {
        const cachedItem = cacheRef.current.get(cacheKey)!;
        // Verify cache validity
        if (cachedItem.data === items[index]) {
          newItems.push(cachedItem);
          continue;
        }
      }

      // Create new virtual item
      const virtualItem: VirtualItem = {
        index,
        top: index * itemHeight,
        height: itemHeight,
        data: items[index],
      };

      newItems.push(virtualItem);

      // Cache the item if memoization is enabled
      if (enableMemoization) {
        cacheRef.current.set(cacheKey, virtualItem);
      }
    }

    return newItems;
  }, [visibleRange, items, itemHeight, enableMemoization]);

  // Handle scroll with optimization
  const handleScroll = useCallback((newScrollTop: number) => {
    // Determine scroll direction
    const direction = newScrollTop > lastScrollTopRef.current ? 'down' : 'up';
    scrollDirectionRef.current = direction;
    lastScrollTopRef.current = newScrollTop;

    setScrollTop(newScrollTop);
  }, []);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const maxIndex = items.length - 1;
    const targetIndex = Math.max(0, Math.min(index, maxIndex));
    
    let targetScrollTop: number;
    
    switch (align) {
      case 'center':
        targetScrollTop = targetIndex * itemHeight - containerHeight / 2 + itemHeight / 2;
        break;
      case 'end':
        targetScrollTop = targetIndex * itemHeight - containerHeight + itemHeight;
        break;
      case 'start':
      default:
        targetScrollTop = targetIndex * itemHeight;
        break;
    }

    // Ensure scroll position is within bounds
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));
    
    setScrollTop(targetScrollTop);
    return targetScrollTop;
  }, [items.length, itemHeight, containerHeight, totalHeight]);

  // Scroll to specific item
  const scrollToItem = useCallback((item: any, align: 'start' | 'center' | 'end' = 'start') => {
    const index = items.findIndex(i => i === item);
    if (index >= 0) {
      return scrollToIndex(index, align);
    }
    return scrollTop;
  }, [items, scrollToIndex, scrollTop]);

  // Get item at position
  const getItemAtPosition = useCallback((y: number) => {
    const index = Math.floor(y / itemHeight);
    if (index >= 0 && index < items.length) {
      return { index, item: items[index] };
    }
    return null;
  }, [items, itemHeight]);

  // Get visible item indices
  const getVisibleIndices = useCallback(() => {
    return visibleItems.map(item => item.index);
  }, [visibleItems]);

  // Check if item is visible
  const isItemVisible = useCallback((index: number) => {
    const { startIndex, endIndex } = visibleRange;
    return index >= startIndex && index <= endIndex;
  }, [visibleRange]);

  // Get scroll progress (0-1)
  const getScrollProgress = useCallback(() => {
    const maxScrollTop = totalHeight - containerHeight;
    if (maxScrollTop <= 0) return 0;
    return Math.min(1, scrollTop / maxScrollTop);
  }, [scrollTop, totalHeight, containerHeight]);

  // Cache cleanup for memory management
  useEffect(() => {
    if (!enableMemoization) return;

    const cleanup = () => {
      const { startIndex, endIndex } = visibleRange;
      const cacheKeys = Array.from(cacheRef.current.keys());
      
      // Remove items that are far from visible range
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
      totalItems: items.length,
      visibleItems: visibleItems.length,
      cacheSize: cacheRef.current.size,
      scrollTop,
      scrollProgress: getScrollProgress(),
      visibleRange,
      scrollDirection: scrollDirectionRef.current,
    };
  }, [items.length, visibleItems.length, scrollTop, getScrollProgress, visibleRange]);

  return {
    // State
    visibleItems,
    totalHeight,
    scrollTop,
    startIndex: visibleRange.startIndex,
    endIndex: visibleRange.endIndex,
    
    // Actions
    handleScroll,
    scrollToIndex,
    scrollToItem,
    
    // Utilities
    getItemAtPosition,
    getVisibleIndices,
    isItemVisible,
    getScrollProgress,
    getPerformanceMetrics,
    
    // Computed values
    isScrolledToTop: scrollTop === 0,
    isScrolledToBottom: scrollTop >= totalHeight - containerHeight,
    scrollDirection: scrollDirectionRef.current,
  };
};