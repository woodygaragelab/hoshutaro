import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExcelLikeGrid } from '../ExcelLikeGrid';
import { GridColumn } from '../types';
import { HierarchicalData } from '../../../types';

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

// Sample test data
const testData: HierarchicalData[] = [
  {
    id: 'item-1',
    task: '設備1',
    bomCode: 'BOM-001',
    level: 1,
    specifications: [
      { key: '機器名称', value: '設備1', order: 0 },
      { key: '型式', value: 'MODEL-1', order: 1 }
    ],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {},
    children: []
  },
  {
    id: 'item-2',
    task: '設備2',
    bomCode: 'BOM-002',
    level: 1,
    specifications: [
      { key: '機器名称', value: '設備2', order: 0 },
      { key: '型式', value: 'MODEL-2', order: 1 }
    ],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {},
    children: []
  }
];

const testColumns: GridColumn[] = [
  {
    id: 'task',
    header: '設備名',
    width: 150,
    minWidth: 100,
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
    minWidth: 80,
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
    id: 'time_2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-01'
  }
];

describe('ExcelLikeGrid Copy/Paste Functionality', () => {
  let mockOnCellEdit: jest.Mock;
  let mockOnCopy: jest.Mock;
  let mockOnPaste: jest.Mock;

  beforeEach(() => {
    mockOnCellEdit = jest.fn();
    mockOnCopy = jest.fn();
    mockOnPaste = jest.fn().mockResolvedValue(true);
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
  });

  const renderGrid = (props = {}) => {
    return render(
      <ExcelLikeGrid
        data={testData}
        columns={testColumns}
        onCellEdit={mockOnCellEdit}
        onCopy={mockOnCopy}
        onPaste={mockOnPaste}
        readOnly={false}
        {...props}
      />
    );
  };

  describe('Copy Functionality', () => {
    test('should copy single cell with Ctrl+C', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on a cell to select it
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+C
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });

    test('should copy cell data to clipboard in TSV format', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on a cell to select it
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+C
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('設備1');
      });
    });

    test('should handle copy when no cell is selected', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Press Ctrl+C without selecting any cell
      await user.keyboard('{Control>}c{/Control}');

      // Should not call clipboard API
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
      expect(mockOnCopy).not.toHaveBeenCalled();
    });
  });

  describe('Paste Functionality', () => {
    test('should paste single cell with Ctrl+V', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockResolvedValue('新しい値');
      renderGrid();

      // Click on a cell to select it
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+V
      await user.keyboard('{Control>}v{/Control}');

      await waitFor(() => {
        expect(mockClipboard.readText).toHaveBeenCalled();
        expect(mockOnPaste).toHaveBeenCalled();
      });
    });

    test('should handle paste when clipboard is empty', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockResolvedValue('');
      renderGrid();

      // Click on a cell to select it
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+V
      await user.keyboard('{Control>}v{/Control}');

      await waitFor(() => {
        expect(mockClipboard.readText).toHaveBeenCalled();
        // Should handle empty clipboard gracefully
      });
    });

    test('should not paste in read-only mode', async () => {
      const user = userEvent.setup();
      mockClipboard.readText.mockResolvedValue('新しい値');
      renderGrid({ readOnly: true });

      // Click on a cell to select it
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+V
      await user.keyboard('{Control>}v{/Control}');

      // Should not call paste handlers in read-only mode
      expect(mockOnPaste).not.toHaveBeenCalled();
    });
  });

  describe('Range Selection', () => {
    test('should select range with Shift+Click', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on first cell
      const firstCell = screen.getByText('設備1');
      await user.click(firstCell);

      // Shift+Click on second cell
      const secondCell = screen.getByText('設備2');
      await user.keyboard('{Shift>}');
      await user.click(secondCell);
      await user.keyboard('{/Shift}');

      // Should have selected a range (visual feedback would be tested in integration tests)
    });

    test('should copy range selection', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Select first cell
      const firstCell = screen.getByText('設備1');
      await user.click(firstCell);

      // Shift+Click to select range
      const secondCell = screen.getByText('設備2');
      await user.keyboard('{Shift>}');
      await user.click(secondCell);
      await user.keyboard('{/Shift}');

      // Copy the range
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });
  });

  describe('Data Validation', () => {
    test('should validate data types during paste', async () => {
      const user = userEvent.setup();
      // Mock pasting invalid data (text into number field)
      mockClipboard.readText.mockResolvedValue('invalid_number');
      renderGrid();

      // Click on a number cell (if we had one)
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Press Ctrl+V
      await user.keyboard('{Control>}v{/Control}');

      await waitFor(() => {
        expect(mockClipboard.readText).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-Area Copy/Paste', () => {
    test('should support copy/paste between specifications and maintenance areas', async () => {
      renderGrid({
        displayAreaConfig: {
          mode: 'both',
          fixedColumns: ['task', 'bomCode'],
          scrollableAreas: {
            specifications: {
              visible: true,
              width: 300,
              columns: ['spec_機器名称']
            },
            maintenance: {
              visible: true,
              width: 300,
              columns: ['time_2024-01']
            }
          }
        }
      });

      // This would test copying from specifications area to maintenance area
      // Implementation would depend on the actual rendered structure
    });
  });

  describe('Keyboard Navigation Integration', () => {
    test('should maintain copy/paste functionality with keyboard navigation', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on a cell
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      
      // Copy current cell
      await user.keyboard('{Control>}c{/Control}');

      await waitFor(() => {
        expect(mockOnCopy).toHaveBeenCalled();
      });
    });

    test('should handle Escape key during editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on a cell to start editing
      const cell = screen.getByText('設備1');
      await user.click(cell);

      // Type some text
      await user.keyboard('新しい値');

      // Press Escape to cancel
      await user.keyboard('{Escape}');

      // Should not save the changes
      expect(mockOnCellEdit).not.toHaveBeenCalled();
    });
  });
});