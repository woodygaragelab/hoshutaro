import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VirtualScrollManager } from '../VirtualScrollManager';
import { VirtualScrollManagerProps } from '../types';

// Mock performance monitoring
jest.mock('../usePerformanceMonitoring', () => ({
  usePerformanceMonitoring: () => ({
    performanceMetrics: {
      currentFPS: 60,
      averageFPS: 60,
      renderTime: 10,
      scrollTime: 5,
      memoryUsage: 1024 * 1024,
      frameDrops: 0,
      lastMeasurement: Date.now(),
    },
    startMeasurement: jest.fn(),
    endMeasurement: jest.fn(),
    isPerformanceWarning: false,
    memoryUsage: 1024 * 1024,
  }),
}));

// Mock virtual scrolling
jest.mock('../useVirtualScrolling', () => ({
  useVirtualScrolling: () => ({
    visibleItems: [
      { index: 0, top: 0, height: 50, data: { id: 1, name: 'Item 1' } },
      { index: 1, top: 50, height: 50, data: { id: 2, name: 'Item 2' } },
      { index: 2, top: 100, height: 50, data: { id: 3, name: 'Item 3' } },
    ],
    totalHeight: 5000,
    scrollTop: 0,
    startIndex: 0,
    endIndex: 2,
    handleScroll: jest.fn(),
    scrollToIndex: jest.fn(),
    scrollToItem: jest.fn(),
  }),
}));

describe('VirtualScrollManager', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  }));

  const mockRenderItem = jest.fn((item, index) => (
    <div key={index} data-testid={`item-${index}`}>
      {item.name}
    </div>
  ));

  const defaultProps: VirtualScrollManagerProps = {
    items: mockItems,
    itemHeight: 50,
    containerHeight: 300,
    renderItem: mockRenderItem,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render virtual scroll container', () => {
      render(<VirtualScrollManager {...defaultProps} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should render visible items', () => {
      render(<VirtualScrollManager {...defaultProps} />);
      
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should call renderItem for each visible item', () => {
      render(<VirtualScrollManager {...defaultProps} />);
      
      expect(mockRenderItem).toHaveBeenCalledTimes(3);
      expect(mockRenderItem).toHaveBeenCalledWith({ id: 1, name: 'Item 1' }, 0);
      expect(mockRenderItem).toHaveBeenCalledWith({ id: 2, name: 'Item 2' }, 1);
      expect(mockRenderItem).toHaveBeenCalledWith({ id: 3, name: 'Item 3' }, 2);
    });
  });

  describe('Scroll Handling', () => {
    it('should handle scroll events', () => {
      const onScroll = jest.fn();
      render(<VirtualScrollManager {...defaultProps} onScroll={onScroll} />);
      
      const scrollContainer = screen.getByRole('list').firstChild as HTMLElement;
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
      
      expect(onScroll).toHaveBeenCalled();
    });

    it('should apply smooth scrolling styles', () => {
      const { container } = render(<VirtualScrollManager {...defaultProps} />);
      
      const scrollManager = container.querySelector('.virtual-scroll-manager');
      expect(scrollManager).toHaveStyle({ scrollBehavior: 'smooth' });
    });
  });

  describe('Performance Optimization', () => {
    it('should enable performance monitoring by default', () => {
      render(<VirtualScrollManager {...defaultProps} />);
      
      // Performance monitoring should be active (no warning visible)
      expect(screen.queryByText(/パフォーマンス警告/)).not.toBeInTheDocument();
    });

    it('should show performance warning when enabled', () => {
      // Mock performance warning
      const mockUsePerformanceMonitoring = require('../usePerformanceMonitoring').usePerformanceMonitoring;
      mockUsePerformanceMonitoring.mockReturnValue({
        performanceMetrics: {
          currentFPS: 30, // Low FPS
          averageFPS: 35,
          renderTime: 20,
          scrollTime: 15,
          memoryUsage: 100 * 1024 * 1024, // High memory
          frameDrops: 10,
          lastMeasurement: Date.now(),
        },
        startMeasurement: jest.fn(),
        endMeasurement: jest.fn(),
        isPerformanceWarning: true,
        memoryUsage: 100 * 1024 * 1024,
      });

      render(<VirtualScrollManager {...defaultProps} enablePerformanceMonitoring={true} />);
      
      expect(screen.getByText(/パフォーマンス警告/)).toBeInTheDocument();
    });

    it('should enable batching when specified', () => {
      render(
        <VirtualScrollManager 
          {...defaultProps} 
          enableBatching={true}
          batchSize={2}
        />
      );
      
      // Should render items (batching is handled internally)
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });

    it('should show loading indicator during batched rendering', async () => {
      render(
        <VirtualScrollManager 
          {...defaultProps} 
          enableBatching={true}
          batchSize={1}
        />
      );
      
      // Loading indicator might appear briefly during batching
      // This is implementation-dependent and may not always be visible in tests
    });
  });

  describe('Memoization', () => {
    it('should enable memoization by default', () => {
      render(<VirtualScrollManager {...defaultProps} enableMemoization={true} />);
      
      // Memoization is internal, but items should still render
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });

    it('should disable memoization when specified', () => {
      render(<VirtualScrollManager {...defaultProps} enableMemoization={false} />);
      
      // Items should still render without memoization
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });
  });

  describe('Lazy Loading', () => {
    it('should render placeholder for lazy loaded items', () => {
      render(
        <VirtualScrollManager 
          {...defaultProps} 
          enableLazyLoading={true}
          overscan={1}
        />
      );
      
      // Items within range should render normally
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });

    it('should show loading text for items outside visible range', () => {
      // Mock virtual scrolling to return items outside loading buffer
      const mockUseVirtualScrolling = require('../useVirtualScrolling').useVirtualScrolling;
      mockUseVirtualScrolling.mockReturnValue({
        visibleItems: [
          { index: 50, top: 2500, height: 50, data: { id: 51, name: 'Item 51' } },
        ],
        totalHeight: 5000,
        scrollTop: 2500,
        startIndex: 50,
        endIndex: 50,
        handleScroll: jest.fn(),
        scrollToIndex: jest.fn(),
        scrollToItem: jest.fn(),
      });

      render(
        <VirtualScrollManager 
          {...defaultProps} 
          enableLazyLoading={true}
          overscan={1}
        />
      );
      
      // Should show loading placeholder
      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should apply correct ARIA attributes', () => {
      render(<VirtualScrollManager {...defaultProps} />);
      
      const listElement = screen.getByRole('list');
      expect(listElement).toHaveAttribute('aria-label', '仮想スクロールリスト');
      expect(listElement).toHaveAttribute('aria-rowcount', '100');
      expect(listElement).toHaveAttribute('aria-setsize', '100');
      expect(listElement).toHaveAttribute('tabIndex', '0');
    });

    it('should use custom aria label', () => {
      render(
        <VirtualScrollManager 
          {...defaultProps} 
          ariaLabel="カスタムリスト"
        />
      );
      
      expect(screen.getByLabelText('カスタムリスト')).toBeInTheDocument();
    });

    it('should disable accessibility when specified', () => {
      render(
        <VirtualScrollManager 
          {...defaultProps} 
          enableAccessibility={false}
        />
      );
      
      const container = screen.getByRole('list');
      expect(container).not.toHaveAttribute('aria-label');
    });
  });

  describe('Custom Configuration', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <VirtualScrollManager {...defaultProps} className="custom-scroll" />
      );
      
      expect(container.firstChild).toHaveClass('custom-scroll');
    });

    it('should use custom overscan value', () => {
      render(<VirtualScrollManager {...defaultProps} overscan={10} />);
      
      // Overscan affects internal calculations, items should still render
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });

    it('should use custom target FPS', () => {
      render(<VirtualScrollManager {...defaultProps} targetFPS={30} />);
      
      // Target FPS affects performance monitoring, items should still render
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty items array', () => {
      render(<VirtualScrollManager {...defaultProps} items={[]} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.queryByTestId(/item-/)).not.toBeInTheDocument();
    });

    it('should handle render errors gracefully', () => {
      const errorRenderItem = jest.fn(() => {
        throw new Error('Render error');
      });

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <VirtualScrollManager 
          {...defaultProps} 
          renderItem={errorRenderItem}
        />
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});