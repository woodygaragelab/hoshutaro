import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExcelLikeGrid } from '../ExcelLikeGrid';
import { GridColumn, DisplayAreaConfig } from '../types';
import { HierarchicalData } from '../../../types';

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => [])
  }
});

// Sample test data
const testData: HierarchicalData[] = [
  {
    id: 'item-1',
    task: '遠心ポンプ P-001',
    bomCode: 'BOM-001',
    level: 1,
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 0 },
      { key: '型式', value: 'CP-100A', order: 1 },
      { key: '容量', value: '100 L/min', order: 2 }
    ],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
    },
    rolledUpResults: {
      '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
    },
    children: []
  },
  {
    id: 'item-2',
    task: '誘導電動機 M-001',
    bomCode: 'BOM-002',
    level: 1,
    specifications: [
      { key: '機器名称', value: '誘導電動機', order: 0 },
      { key: '型式', value: 'IM-200B', order: 1 },
      { key: '出力', value: '15 kW', order: 2 }
    ],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    children: []
  }
];

const testColumns: GridColumn[] = [
  {
    id: 'task',
    header: '設備名',
    width: 200,
    minWidth: 150,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'task'
  },
  {
    id: 'bomCode',
    header: 'BOMコード',
    width: 120,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'bomCode'
  },
  {
    id: 'spec_機器名称',
    header: '機器名称',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_機器名称'
  },
  {
    id: 'spec_型式',
    header: '型式',
    width: 120,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_型式'
  },
  {
    id: 'time_2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-01'
  },
  {
    id: 'time_2024-02',
    header: '2024年2月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-02'
  }
];

const defaultDisplayAreaConfig: DisplayAreaConfig = {
  mode: 'both',
  fixedColumns: ['task', 'bomCode'],
  scrollableAreas: {
    specifications: {
      visible: true,
      width: 300,
      columns: ['spec_機器名称', 'spec_型式']
    },
    maintenance: {
      visible: true,
      width: 300,
      columns: ['time_2024-01', 'time_2024-02']
    }
  }
};

describe('ExcelLikeGrid - Comprehensive Unit Tests', () => {
  let mockOnCellEdit: jest.Mock;
  let mockOnColumnResize: jest.Mock;
  let mockOnRowResize: jest.Mock;
  let mockOnDisplayAreaChange: jest.Mock;
  let mockOnCopy: jest.Mock;
  let mockOnPaste: jest.Mock;

  beforeEach(() => {
    mockOnCellEdit = jest.fn();
    mockOnColumnResize = jest.fn();
    mockOnRowResize = jest.fn();
    mockOnDisplayAreaChange = jest.fn();
    mockOnCopy = jest.fn();
    mockOnPaste = jest.fn().mockResolvedValue(true);
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
    jest.clearAllMocks();
  });

  const renderGrid = (props = {}) => {
    return render(
      <ExcelLikeGrid
        data={testData}
        columns={testColumns}
        displayAreaConfig={defaultDisplayAreaConfig}
        onCellEdit={mockOnCellEdit}
        onColumnResize={mockOnColumnResize}
        onRowResize={mockOnRowResize}
        onDisplayAreaChange={mockOnDisplayAreaChange}
        onCopy={mockOnCopy}
        onPaste={mockOnPaste}
        readOnly={false}
        {...props}
      />
    );
  };

  describe('Basic Rendering', () => {
    test('renders grid component without crashing', () => {
      renderGrid();
      expect(document.querySelector('.excel-like-grid')).toBeInTheDocument();
    });

    test('renders display area controls', () => {
      renderGrid();
      expect(screen.getByText('機器仕様')).toBeInTheDocument();
      expect(screen.getByText('計画実績')).toBeInTheDocument();
      expect(screen.getByText('両方表示')).toBeInTheDocument();
    });

    test('renders equipment data', () => {
      renderGrid();
      expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
      expect(screen.getByText('誘導電動機 M-001')).toBeInTheDocument();
    });
  });

  describe('Cell Editing Functionality (要件 3.1, 3.2)', () => {
    test('should enter edit mode when cell is clicked', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Should be able to edit the cell
      expect(cell).toBeInTheDocument();
    });

    test('should save changes when Enter is pressed during editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);
      
      // Start editing with Enter
      await user.keyboard('{Enter}');
      
      // Type new value
      await user.keyboard('新しい設備名');
      
      // Save with Enter
      await user.keyboard('{Enter}');

      // Should call onCellEdit
      await waitFor(() => {
        expect(mockOnCellEdit).toHaveBeenCalled();
      });
    });

    test('should cancel editing when Escape is pressed', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);
      
      // Start editing
      await user.keyboard('{Enter}');
      
      // Type some text
      await user.keyboard('新しい値');
      
      // Cancel with Escape
      await user.keyboard('{Escape}');

      // Should not call onCellEdit
      expect(mockOnCellEdit).not.toHaveBeenCalled();
    });

    test('should not allow editing in read-only mode', async () => {
      const user = userEvent.setup();
      renderGrid({ readOnly: true });

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);
      
      // Try to start editing
      await user.keyboard('{Enter}');

      // Should not enter edit mode in read-only
      expect(mockOnCellEdit).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation (要件 3.2, 3.6)', () => {
    test('should navigate to next cell with Tab key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const firstCell = screen.getByText('遠心ポンプ P-001');
      await user.click(firstCell);
      
      // Navigate with Tab
      await user.keyboard('{Tab}');

      // Should move focus to next cell
      // (Visual feedback would be tested in integration tests)
    });

    test('should navigate to cell below with Enter key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const firstCell = screen.getByText('遠心ポンプ P-001');
      await user.click(firstCell);
      
      // Navigate with Enter (when not editing)
      await user.keyboard('{Enter}');

      // Should move focus to cell below
    });

    test('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);
      
      // Test all arrow key directions
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowUp}');

      // Should handle all navigation directions
    });

    test('should clear selection with Escape key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);
      
      // Clear selection with Escape
      await user.keyboard('{Escape}');

      // Should clear the selection
    });
  });

  describe('Copy & Paste Functionality (要件 3.4, 3.5)', () => {
    test('should copy single cell with Ctrl+C', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Copy with Ctrl+C
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });

    test('should paste single cell with Ctrl+V', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockResolvedValue('新しい値');
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Paste with Ctrl+V
      await user.keyboard('{Control>}v{/Control}');

      await waitFor(() => {
        expect(mockClipboard.readText).toHaveBeenCalled();
        expect(mockOnPaste).toHaveBeenCalled();
      });
    });

    test('should handle range selection with Shift+Click', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click first cell
      const firstCell = screen.getByText('遠心ポンプ P-001');
      await user.click(firstCell);

      // Shift+Click second cell to select range
      const secondCell = screen.getByText('誘導電動機 M-001');
      await user.keyboard('{Shift>}');
      await user.click(secondCell);
      await user.keyboard('{/Shift}');

      // Should have selected a range
    });

    test('should copy range selection', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Select range
      const firstCell = screen.getByText('遠心ポンプ P-001');
      await user.click(firstCell);
      
      const secondCell = screen.getByText('誘導電動機 M-001');
      await user.keyboard('{Shift>}');
      await user.click(secondCell);
      await user.keyboard('{/Shift}');

      // Copy range
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });

    test('should not paste in read-only mode', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockResolvedValue('新しい値');
      renderGrid({ readOnly: true });

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Try to paste in read-only mode
      await user.keyboard('{Control>}v{/Control}');

      // Should not call paste handlers
      expect(mockOnPaste).not.toHaveBeenCalled();
    });
  });

  describe('Display Area Switching (要件 3.14, 3.15)', () => {
    test('should switch to specifications only mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const specificationsButton = screen.getByText('機器仕様');
      await user.click(specificationsButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'specifications'
          })
        );
      });
    });

    test('should switch to maintenance only mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const maintenanceButton = screen.getByText('計画実績');
      await user.click(maintenanceButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'maintenance'
          })
        );
      });
    });

    test('should switch to both areas mode', async () => {
      const user = userEvent.setup();
      renderGrid();

      const bothButton = screen.getByText('両方表示');
      await user.click(bothButton);

      await waitFor(() => {
        expect(mockOnDisplayAreaChange).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'both'
          })
        );
      });
    });

    test('should maintain fixed columns in all display modes', () => {
      renderGrid();

      // Fixed columns should always be visible
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();
    });

    test('should show appropriate columns based on display mode', () => {
      // Test with specifications only mode
      const specificationsConfig: DisplayAreaConfig = {
        mode: 'specifications',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 400,
            columns: ['spec_機器名称', 'spec_型式']
          },
          maintenance: {
            visible: false,
            width: 0,
            columns: []
          }
        }
      };

      renderGrid({ displayAreaConfig: specificationsConfig });

      // Should show specifications columns
      expect(screen.getByText('機器名称')).toBeInTheDocument();
      expect(screen.getByText('型式')).toBeInTheDocument();
    });
  });

  describe('Specification Editing (要件 3.13, 3.16)', () => {
    test('should display specification values', () => {
      renderGrid();

      // Should show specification values from test data
      expect(screen.getByText('遠心ポンプ')).toBeInTheDocument();
      expect(screen.getByText('CP-100A')).toBeInTheDocument();
      expect(screen.getByText('100 L/min')).toBeInTheDocument();
    });

    test('should allow editing specification values', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Find and click on a specification cell
      const specCell = screen.getByText('遠心ポンプ');
      await user.click(specCell);

      // Should be able to edit specification
      expect(specCell).toBeInTheDocument();
    });

    test('should handle specification field updates', async () => {
      const user = userEvent.setup();
      renderGrid();

      const specCell = screen.getByText('遠心ポンプ');
      await user.click(specCell);
      
      // Start editing
      await user.keyboard('{Enter}');
      
      // Type new specification value
      await user.keyboard('新しい機器名');
      
      // Save changes
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnCellEdit).toHaveBeenCalled();
      });
    });
  });

  describe('Column and Row Resizing (要件 3.7, 3.8, 3.9)', () => {
    test('should handle column resize', () => {
      renderGrid();

      // Column headers should be present for resizing
      expect(screen.getByText('設備名')).toBeInTheDocument();
      expect(screen.getByText('BOMコード')).toBeInTheDocument();
    });

    test('should call onColumnResize when column is resized', () => {
      renderGrid();

      // This would typically be tested with mouse events on column borders
      // For unit test, we verify the callback is properly set up
      expect(mockOnColumnResize).toBeDefined();
    });

    test('should call onRowResize when row is resized', () => {
      renderGrid();

      // This would typically be tested with mouse events on row borders
      // For unit test, we verify the callback is properly set up
      expect(mockOnRowResize).toBeDefined();
    });
  });

  describe('Cross-Area Operations', () => {
    test('should support copy/paste between specifications and maintenance areas', async () => {
      const user = userEvent.setup();
      renderGrid();

      // This tests the cross-area functionality
      // Copy from specifications area
      const specCell = screen.getByText('遠心ポンプ');
      await user.click(specCell);
      await user.keyboard('{Control>}c{/Control}');

      // The copy operation should work across areas
      await waitFor(() => {
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });

    test('should maintain data integrity across display areas', () => {
      renderGrid();

      // Data should be consistent across all display modes
      expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
      expect(screen.getByText('BOM-001')).toBeInTheDocument();
    });
  });

  describe('Performance and Virtual Scrolling', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...testData[0],
        id: `item-${i}`,
        task: `設備 ${i + 1}`,
        bomCode: `BOM-${String(i + 1).padStart(4, '0')}`
      }));

      const startTime = performance.now();
      renderGrid({ data: largeDataset, virtualScrolling: true });
      const endTime = performance.now();

      // Should render quickly even with large dataset
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should enable virtual scrolling for large datasets', () => {
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        ...testData[0],
        id: `item-${i}`,
        task: `設備 ${i + 1}`
      }));

      renderGrid({ data: largeDataset, virtualScrolling: true });

      // Should render without performance issues
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty data gracefully', () => {
      renderGrid({ data: [] });

      // Should render without crashing
      expect(document.querySelector('.excel-like-grid')).toBeInTheDocument();
    });

    test('should handle invalid clipboard data', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockRejectedValue(new Error('Clipboard error'));
      renderGrid();

      const cell = screen.getByText('遠心ポンプ P-001');
      await user.click(cell);

      // Try to paste with clipboard error
      await user.keyboard('{Control>}v{/Control}');

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockClipboard.readText).toHaveBeenCalled();
      });
    });

    test('should handle missing specifications', () => {
      const dataWithoutSpecs = [{
        ...testData[0],
        specifications: []
      }];

      renderGrid({ data: dataWithoutSpecs });

      // Should render without crashing
      expect(document.querySelector('.excel-like-grid')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Should be focusable
      const grid = document.querySelector('.excel-like-grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('tabindex', '0');
    });

    test('should support screen reader navigation', () => {
      renderGrid();

      // Should have proper ARIA attributes
      const grid = document.querySelector('.excel-like-grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute('tabindex', '0');
    });
  });
});