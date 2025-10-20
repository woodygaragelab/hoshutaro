import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef, 
  useState,
  memo,
  startTransition
} from 'react';
import { Box } from '@mui/material';
import { VirtualScrollManagerProps, VirtualScrollState, VirtualItem } from './types';
import { useVirtualScrolling } from './useVirtualScrolling';
import { usePerformanceMonitoring } from './usePerformanceMonitoring';

/**
 * VirtualScrollManager - 大量データ対応の仮想スクロール実装
 * 
 * 機能:
 * - 大量データ対応の仮想スクロール実装
 * - 60FPS以上のスムーズな応答実現
 * - メモリ使用量の最適化
 */
export const VirtualScrollManager: React.FC<VirtualScrollManagerProps> = memo(({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  renderItem,
  onScroll,
  className = '',
  // Performance options
  enablePerformanceMonitoring = true,
  targetFPS = 60,
  memoryThreshold = 50 * 1024 * 1024, // 50MB
  // Optimization options
  enableMemoization = true,
  enableBatching = true,
  batchSize = 50,
  enableLazyLoading = false,
  // Accessibility options
  enableAccessibility = true,
  ariaLabel = '仮想スクロールリスト',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  // Virtual scrolling logic
  const {
    visibleItems,
    totalHeight,
    scrollTop,
    startIndex,
    endIndex,
    handleScroll: handleVirtualScroll,
    scrollToIndex,
    scrollToItem,
  } = useVirtualScrolling({
    items,
    itemHeight,
    containerHeight,
    overscan,
    enableMemoization,
  });

  // Performance monitoring
  const {
    performanceMetrics,
    startMeasurement,
    endMeasurement,
    isPerformanceWarning,
    memoryUsage,
  } = usePerformanceMonitoring({
    enabled: enablePerformanceMonitoring,
    targetFPS,
    memoryThreshold,
  });

  // Batched rendering state
  const [renderBatch, setRenderBatch] = useState<VirtualItem[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  // Handle scroll events with performance optimization
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    startMeasurement('scroll');
    
    const scrollElement = event.currentTarget;
    const newScrollTop = scrollElement.scrollTop;
    
    // Use React 18's startTransition for non-urgent updates
    startTransition(() => {
      handleVirtualScroll(newScrollTop);
      onScroll?.(event);
    });
    
    endMeasurement('scroll');
  }, [handleVirtualScroll, onScroll, startMeasurement, endMeasurement]);

  // Batched rendering for performance
  useEffect(() => {
    if (!enableBatching) {
      setRenderBatch(visibleItems);
      return;
    }

    setIsRendering(true);
    
    // Process items in batches to avoid blocking the main thread
    const processBatch = (items: VirtualItem[], batchIndex: number = 0) => {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, items.length);
      const batch = items.slice(start, end);
      
      if (batch.length === 0) {
        setIsRendering(false);
        return;
      }
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        setRenderBatch(prev => {
          if (batchIndex === 0) {
            // First batch - replace all
            return batch;
          } else {
            // Subsequent batches - append
            return [...prev, ...batch];
          }
        });
        
        if (end < items.length) {
          // Process next batch
          processBatch(items, batchIndex + 1);
        } else {
          setIsRendering(false);
        }
      });
    };
    
    processBatch(visibleItems);
  }, [visibleItems, enableBatching, batchSize]);

  // Memoized item renderer
  const MemoizedItem = useMemo(() => {
    if (!enableMemoization) {
      return ({ item, style }: { item: VirtualItem; style: React.CSSProperties }) => (
        <div style={style}>
          {renderItem(item.data, item.index)}
        </div>
      );
    }

    return memo(({ item, style }: { item: VirtualItem; style: React.CSSProperties }) => (
      <div style={style}>
        {renderItem(item.data, item.index)}
      </div>
    ), (prevProps, nextProps) => {
      // Custom comparison for better memoization
      return (
        prevProps.item.index === nextProps.item.index &&
        prevProps.item.data === nextProps.item.data &&
        prevProps.style.top === nextProps.style.top &&
        prevProps.style.height === nextProps.style.height
      );
    });
  }, [renderItem, enableMemoization]);

  // Lazy loading implementation
  const shouldLoadItem = useCallback((index: number) => {
    if (!enableLazyLoading) return true;
    
    // Load items that are within the visible range or close to it
    const loadingBuffer = overscan * 2;
    return index >= startIndex - loadingBuffer && index <= endIndex + loadingBuffer;
  }, [enableLazyLoading, overscan, startIndex, endIndex]);

  // Accessibility helpers
  const getAccessibilityProps = useCallback(() => {
    if (!enableAccessibility) return {};
    
    return {
      role: 'list',
      'aria-label': ariaLabel,
      'aria-rowcount': items.length,
      'aria-setsize': items.length,
      tabIndex: 0,
      // Performance metrics for screen readers
      'aria-busy': isRendering,
      'aria-live': isPerformanceWarning ? 'polite' : 'off',
    };
  }, [enableAccessibility, ariaLabel, items.length, isRendering, isPerformanceWarning]);

  // Performance warning display (only show when explicitly enabled)
  const renderPerformanceWarning = () => {
    // Only show performance warning if explicitly requested and there's actually a warning
    if (!enablePerformanceMonitoring || !isPerformanceWarning) return null;
    
    return (
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'warning.main',
          color: 'warning.contrastText',
          padding: 1,
          borderRadius: 1,
          fontSize: '0.75rem',
          zIndex: 1000,
          display: 'none', // Hidden by default - can be shown via dev tools or debug mode
        }}
      >
        パフォーマンス警告: FPS {performanceMetrics.currentFPS.toFixed(1)} / 
        メモリ {(memoryUsage / 1024 / 1024).toFixed(1)}MB
      </Box>
    );
  };

  return (
    <Box
      ref={containerRef}
      className={`virtual-scroll-manager ${className}`}
      sx={{
        position: 'relative',
        height: containerHeight,
        overflow: 'hidden',
        // Performance optimizations
        willChange: 'scroll-position',
        contain: 'layout style paint',
        // Smooth scrolling
        scrollBehavior: 'smooth',
        // Touch optimizations
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
      {...getAccessibilityProps()}
    >
      {/* Performance warning - Disabled by default to prevent UI clutter */}
      {/* {renderPerformanceWarning()} */}
      
      {/* Scrollable container */}
      <Box
        ref={scrollElementRef}
        onScroll={handleScroll}
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          // Scrollbar styling
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'grey.100',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'grey.400',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: 'grey.600',
            },
          },
        }}
      >
        {/* Virtual container with total height */}
        <Box
          sx={{
            height: totalHeight,
            position: 'relative',
          }}
        >
          {/* Rendered items */}
          {renderBatch.map((item) => {
            if (!shouldLoadItem(item.index)) {
              // Placeholder for lazy loading
              return (
                <Box
                  key={item.index}
                  sx={{
                    position: 'absolute',
                    top: item.top,
                    left: 0,
                    right: 0,
                    height: itemHeight,
                    backgroundColor: 'grey.50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'grey.500',
                    fontSize: '0.875rem',
                  }}
                >
                  読み込み中...
                </Box>
              );
            }
            
            return (
              <MemoizedItem
                key={item.index}
                item={item}
                style={{
                  position: 'absolute',
                  top: item.top,
                  left: 0,
                  right: 0,
                  height: itemHeight,
                }}
              />
            );
          })}
        </Box>
      </Box>
      
      {/* Loading indicator for batched rendering - Only show for significant delays */}
      {isRendering && enableBatching && renderBatch.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            padding: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              border: '2px solid currentColor',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          レンダリング中...
        </Box>
      )}
    </Box>
  );
});

VirtualScrollManager.displayName = 'VirtualScrollManager';

export default VirtualScrollManager;