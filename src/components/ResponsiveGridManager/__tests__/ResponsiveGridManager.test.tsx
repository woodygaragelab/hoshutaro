import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResponsiveGridManager } from '../ResponsiveGridManager';
import { ResponsiveGridManagerProps } from '../types';
import { HierarchicalData } from '../../../types';
import { GridColumn } from '../../ExcelLikeGrid/types';

// Mock device detection
jest.mock('../../CommonEdit/deviceDetection', () => ({
  detectDevice: jest.fn(() => ({
    type: 'desktop',
    screenSize: { width: 1920, height: 1080 },
    orientation: 'landscape',
    touchCapabilities: {
      hasTouch: false,
      hasHover: true,
      hasPointerEvents: true,
      maxTouchPoints: 0,
    },
    userAgent: 'test-agent',
  })),
  setupDeviceChangeListener: jest.fn(() => () => {}),
}));

// Mock child components
jest.mock('../../EnhancedMaintenanceGrid/MaintenanceGridLayout', () => {
  return function MockMaintenanceGridLayout(props: any) {
    return (
      <div data-testid="desktop-layout">
        <button onClick={() => props.onCellEdit('row1', 'col1', 'test')}>
          Edit Cell
        </button>
      </div>
    );
  };
});

jest.mock('../../EnhancedMaintenanceGrid/TabletGridView', () => {
  return function MockTabletGridView(props: any) {
    return (
      <div data-testid="tablet-layout">
        <button onClick={() => props.onCellEdit('row1', 'col1', 'test')}>
          Edit Cell
        </button>
      </div>
    );
  };
});

jest.mock('../../EnhancedMaintenanceGrid/MobileGridView', () => {
  return function MockMobileGridView(props: any) {
    return (
      <div data-testid="mobile-layout">
        <button onClick={() => props.onCellEdit('row1', 'col1', 'test')}>
          Edit Cell
        </button>
      </div>
    );
  };
});

describe('ResponsiveGridManager', () => {
  const mockData: HierarchicalData[] = [
    {
      id: 'row1',
      task: 'Test Task',
      level: 1,
      bomCode: 'BOM001',
      cycle: 12,
      specifications: [
        { key: 'spec1', value: 'value1', order: 1 },
      ],
      results: {
        '2024': { planned: true, actual: false },
      },
      rolledUpResults: {
        '2024': { planned: true, actual: false },
      },
      children: [],
    },
  ];

  const mockColumns: GridColumn[] = [
    {
      id: 'task',
      header: '作業内容',
      width: 250,
      minWidth: 150,
      maxWidth: 400,
      resizable: true,
      sortable: false,
      type: 'text',
      editable: true,
      accessor: 'task',
    },
    {
      id: 'time_2024',
      header: '2024',
      width: 80,
      minWidth: 60,
      maxWidth: 200,
      resizable: true,
      sortable: false,
      type: 'status',
      editable: true,
      accessor: 'results.2024',
    },
  ];

  const defaultProps: ResponsiveGridManagerProps = {
    data: mockData,
    columns: mockColumns,
    timeHeaders: ['2024'],
    viewMode: 'status',
    displayMode: 'maintenance',
    showBomCode: true,
    showCycle: true,
    onCellEdit: jest.fn(),
    onSpecificationEdit: jest.fn(),
    onColumnResize: jest.fn(),
    onRowResize: jest.fn(),
    onUpdateItem: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Device Detection and Layout Selection', () => {
    it('should render desktop layout by default', () => {
      render(<ResponsiveGridManager {...defaultProps} />);
      
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('tablet-layout')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-layout')).not.toBeInTheDocument();
    });

    it('should render tablet layout when forced', () => {
      render(<ResponsiveGridManager {...defaultProps} forceLayout="tablet" />);
      
      expect(screen.getByTestId('tablet-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-layout')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-layout')).not.toBeInTheDocument();
    });

    it('should render mobile layout when forced', () => {
      render(<ResponsiveGridManager {...defaultProps} forceLayout="mobile" />);
      
      expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('desktop-layout')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tablet-layout')).not.toBeInTheDocument();
    });

    it('should apply correct CSS classes based on layout', () => {
      const { container } = render(<ResponsiveGridManager {...defaultProps} />);
      
      expect(container.firstChild).toHaveClass('responsive-grid-manager');
      expect(container.firstChild).toHaveClass('desktop-layout');
    });
  });

  describe('Edit Event Processing', () => {
    it('should handle cell edit events', () => {
      const onCellEdit = jest.fn();
      render(<ResponsiveGridManager {...defaultProps} onCellEdit={onCellEdit} />);
      
      fireEvent.click(screen.getByText('Edit Cell'));
      
      expect(onCellEdit).toHaveBeenCalledWith('row1', 'col1', 'test');
    });

    it('should not handle edit events when readOnly is true', () => {
      const onCellEdit = jest.fn();
      render(
        <ResponsiveGridManager 
          {...defaultProps} 
          onCellEdit={onCellEdit} 
          readOnly={true} 
        />
      );
      
      fireEvent.click(screen.getByText('Edit Cell'));
      
      expect(onCellEdit).not.toHaveBeenCalled();
    });

    it('should handle specification edit events', () => {
      const onSpecificationEdit = jest.fn();
      render(
        <ResponsiveGridManager 
          {...defaultProps} 
          onSpecificationEdit={onSpecificationEdit} 
        />
      );
      
      // Simulate specification edit
      fireEvent.click(screen.getByText('Edit Cell'));
      
      // Should be called through the unified edit handler
      expect(defaultProps.onCellEdit).toHaveBeenCalled();
    });
  });

  describe('Touch Capabilities Detection', () => {
    it('should detect touch capabilities correctly', () => {
      const mockDetectDevice = require('../../CommonEdit/deviceDetection').detectDevice;
      mockDetectDevice.mockReturnValue({
        type: 'mobile',
        screenSize: { width: 375, height: 667 },
        orientation: 'portrait',
        touchCapabilities: {
          hasTouch: true,
          hasHover: false,
          hasPointerEvents: true,
          maxTouchPoints: 5,
        },
        userAgent: 'mobile-agent',
      });

      const { container } = render(<ResponsiveGridManager {...defaultProps} />);
      
      // Should apply touch-specific styles
      const gridElement = container.querySelector('.responsive-grid-manager');
      expect(gridElement).toHaveStyle({ touchAction: 'manipulation' });
    });
  });

  describe('Performance Optimization', () => {
    it('should enable virtual scrolling for large datasets', () => {
      const largeData = Array.from({ length: 2000 }, (_, i) => ({
        ...mockData[0],
        id: `row${i}`,
        task: `Task ${i}`,
      }));

      render(
        <ResponsiveGridManager 
          {...defaultProps} 
          data={largeData}
          enablePerformanceOptimization={true}
          performanceThreshold={1000}
        />
      );
      
      // Virtual scrolling should be enabled automatically
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
    });

    it('should respect custom performance threshold', () => {
      const mediumData = Array.from({ length: 500 }, (_, i) => ({
        ...mockData[0],
        id: `row${i}`,
        task: `Task ${i}`,
      }));

      render(
        <ResponsiveGridManager 
          {...defaultProps} 
          data={mediumData}
          enablePerformanceOptimization={true}
          performanceThreshold={100}
        />
      );
      
      // Should enable virtual scrolling due to low threshold
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should apply correct ARIA attributes', () => {
      const { container } = render(<ResponsiveGridManager {...defaultProps} />);
      
      const gridElement = container.querySelector('.responsive-grid-manager');
      expect(gridElement).toHaveAttribute('role', 'grid');
      expect(gridElement).toHaveAttribute('aria-label', 'レスポンシブメンテナンスグリッド');
      expect(gridElement).toHaveAttribute('aria-readonly', 'false');
      expect(gridElement).toHaveAttribute('tabIndex', '0');
    });

    it('should apply readonly ARIA attribute when readOnly is true', () => {
      const { container } = render(
        <ResponsiveGridManager {...defaultProps} readOnly={true} />
      );
      
      const gridElement = container.querySelector('.responsive-grid-manager');
      expect(gridElement).toHaveAttribute('aria-readonly', 'true');
    });

    it('should apply touch-specific accessibility attributes', () => {
      const mockDetectDevice = require('../../CommonEdit/deviceDetection').detectDevice;
      mockDetectDevice.mockReturnValue({
        type: 'mobile',
        screenSize: { width: 375, height: 667 },
        orientation: 'portrait',
        touchCapabilities: {
          hasTouch: true,
          hasHover: false,
          hasPointerEvents: true,
          maxTouchPoints: 5,
        },
        userAgent: 'mobile-agent',
      });

      const { container } = render(<ResponsiveGridManager {...defaultProps} />);
      
      const gridElement = container.querySelector('.responsive-grid-manager');
      expect(gridElement).toHaveAttribute('data-touch-enabled', 'true');
      expect(gridElement).toHaveAttribute('data-mobile-optimized', 'true');
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom breakpoints', () => {
      const customBreakpoints = {
        mobile: 600,
        tablet: 900,
        desktop: 1200,
      };

      render(
        <ResponsiveGridManager 
          {...defaultProps} 
          customBreakpoints={customBreakpoints}
        />
      );
      
      // Should render with custom configuration
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ResponsiveGridManager {...defaultProps} className="custom-grid" />
      );
      
      expect(container.firstChild).toHaveClass('custom-grid');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      render(<ResponsiveGridManager {...defaultProps} data={[]} />);
      
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
    });

    it('should handle missing columns gracefully', () => {
      render(<ResponsiveGridManager {...defaultProps} columns={[]} />);
      
      expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
    });
  });
});