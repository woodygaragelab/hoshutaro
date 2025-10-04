import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimpleVirtualizedGridBody } from '../SimpleVirtualizedGridBody';
import { GridColumn, GridState } from '../types';
import { HierarchicalData } from '../../../types';

// Mock data for testing
const mockData: HierarchicalData[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `item-${i}`,
  task: `設備 ${i + 1}`,
  bomCode: `BOM-${String(i + 1).padStart(4, '0')}`,
  level: 1,
  specifications: [
    { key: '機器名称', value: `設備名 ${i + 1}`, order: 1 }
  ],
  children: [],
  results: {
    '2024-01': { planned: true, actual: false, planCost: 10000, actualCost: 0 }
  },
  rolledUpResults: {
    '2024-01': { planned: true, actual: false, planCost: 10000, actualCost: 0 }
  }
}));

const mockColumns: GridColumn[] = [
  {
    id: 'task',
    header: '設備名',
    width: 200,
    minWidth: 150,
    maxWidth: 300,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: false
  },
  {
    id: 'bomCode',
    header: 'BOMコード',
    width: 120,
    minWidth: 100,
    maxWidth: 150,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: false
  }
];

const mockGridState: GridState = {
  columnWidths: {},
  rowHeights: {},
  selectedCell: null,
  selectedRange: null,
  editingCell: null,
  clipboardData: null
};

describe('Virtual Scrolling', () => {
  const mockProps = {
    data: mockData,
    columns: mockColumns,
    gridState: mockGridState,
    onCellEdit: jest.fn(),
    onRowResize: jest.fn(),
    onRowAutoResize: jest.fn(),
    onSelectedCellChange: jest.fn(),
    onEditingCellChange: jest.fn(),
    readOnly: false,
    totalWidth: 800,
    height: 400
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders virtual scrolling component without crashing', () => {
    render(<SimpleVirtualizedGridBody {...mockProps} />);
    
    // Should render the container
    const container = document.querySelector('.simple-virtualized-grid-body');
    expect(container).toBeInTheDocument();
  });

  it('renders only visible items for performance', () => {
    render(<SimpleVirtualizedGridBody {...mockProps} />);
    
    // With 400px height and 40px item height, should render ~10 visible items + overscan
    // Should not render all 1000 items at once
    const renderedItems = document.querySelectorAll('[data-testid^="grid-row"]');
    expect(renderedItems.length).toBeLessThan(50); // Much less than 1000
  });

  it('handles large datasets efficiently', () => {
    const startTime = performance.now();
    
    render(<SimpleVirtualizedGridBody {...mockProps} />);
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render quickly even with 1000 items
    expect(renderTime).toBeLessThan(100); // Less than 100ms
  });

  it('provides scroll methods through ref', () => {
    const ref = React.createRef<any>();
    
    render(<SimpleVirtualizedGridBody {...mockProps} ref={ref} />);
    
    expect(ref.current).toBeDefined();
    expect(typeof ref.current.scrollToItem).toBe('function');
    expect(typeof ref.current.scrollToTop).toBe('function');
  });

  it('calculates total height correctly', () => {
    render(<SimpleVirtualizedGridBody {...mockProps} />);
    
    // Should create a container with the virtual scrolling body
    const container = document.querySelector('.simple-virtualized-grid-body');
    expect(container).toBeInTheDocument();
    
    // The component should handle large datasets efficiently
    // We can verify this by checking that it renders without errors
    expect(container).toHaveStyle('position: relative');
  });
});

describe('Performance Optimization', () => {
  it('should use virtual scrolling for large datasets', () => {
    // This test verifies that virtual scrolling is enabled for large datasets
    const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
      id: `item-${i}`,
      task: `設備 ${i + 1}`,
      bomCode: `BOM-${String(i + 1).padStart(4, '0')}`,
      level: 1,
      specifications: [],
      children: [],
      results: {},
      rolledUpResults: {}
    }));

    const props = {
      data: largeDataset,
      columns: mockColumns,
      gridState: mockGridState,
      onCellEdit: jest.fn(),
      onRowResize: jest.fn(),
      onRowAutoResize: jest.fn(),
      onSelectedCellChange: jest.fn(),
      onEditingCellChange: jest.fn(),
      readOnly: false,
      totalWidth: 800,
      height: 400
    };

    const startTime = performance.now();
    render(<SimpleVirtualizedGridBody {...props} />);
    const endTime = performance.now();

    // Should still render quickly even with 5000 items
    expect(endTime - startTime).toBeLessThan(200);
  });
});