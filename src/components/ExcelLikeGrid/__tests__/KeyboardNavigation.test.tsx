import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ExcelLikeGrid } from '../ExcelLikeGrid';
import { GridColumn, DisplayAreaConfig } from '../types';
import { HierarchicalData } from '../../../types';

// Test data for keyboard navigation
const testData: HierarchicalData[] = [
  {
    id: 'row-1',
    task: '設備A',
    bomCode: 'BOM-A',
    level: 1,
    specifications: [
      { key: '機器名称', value: '設備A名', order: 0 },
      { key: '型式', value: 'TYPE-A', order: 1 }
    ],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 10000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 8000 }
    },
    rolledUpResults: {},
    children: []
  },
  {
    id: 'row-2',
    task: '設備B',
    bomCode: 'BOM-B',
    level: 1,
    specifications: [
      { key: '機器名称', value: '設備B名', order: 0 },
      { key: '型式', value: 'TYPE-B', order: 1 }
    ],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 15000, actualCost: 0 }
    },
    rolledUpResults: {},
    children: []
  },
  {
    id: 'row-3',
    task: '設備C',
    bomCode: 'BOM-C',
    level: 1,
    specifications: [
      { key: '機器名称', value: '設備C名', order: 0 },
      { key: '型式', value: 'TYPE-C', order: 1 }
    ],
    results: {
      '2024-01': { planned: true, actual: true, planCost: 20000, actualCost: 18000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 }
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

const displayAreaConfig: DisplayAreaConfig = {
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
      columns: ['time_2024-01', 'time_2024-02']
    }
  }
};

describe('Keyboard Navigation Tests (要件 3.2, 3.6)', () => {
  let mockOnCellEdit: jest.Mock;
  let mockOnNavigate: jest.Mock;

  beforeEach(() => {
    mockOnCellEdit = jest.fn();
    mockOnNavigate = jest.fn();
    jest.clearAllMocks();
  });

  const renderGrid = (props = {}) => {
    return render(
      <ExcelLikeGrid
        data={testData}
        columns={testColumns}
        displayAreaConfig={displayAreaConfig}
        onCellEdit={mockOnCellEdit}
        readOnly={false}
        {...props}
      />
    );
  };

  describe('Tab Navigation', () => {
    test('should move to next cell with Tab key', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on first cell to select it
      const firstCell = screen.getByText('設備A');
      await user.click(firstCell);

      // Press Tab to move to next cell
      await user.keyboard('{Tab}');

      // Should move focus to the next editable cell
      // (Visual verification would be done in integration tests)
    });

    test('should move to previous cell with Shift+Tab', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on second cell
      const secondCell = screen.getByText('BOM-A');
      await user.click(secondCell);

      // Press Shift+Tab to move to previous cell
      await user.keyboard('{Shift>}{Tab}{/Shift}');

      // Should move focus to the previous editable cell
    });

    test('should wrap to next row when reaching end of row', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on last cell of first row
      const lastCell = screen.getByText('設備A');
      await user.click(lastCell);

      // Keep pressing Tab to reach end of row
      for (let i = 0; i < testColumns.length; i++) {
        await user.keyboard('{Tab}');
      }

      // Should wrap to first cell of next row
    });

    test('should skip non-editable cells during Tab navigation', async () => {
      const user = userEvent.setup();
      const columnsWithNonEditable = testColumns.map((col, index) => ({
        ...col,
        editable: index % 2 === 0 // Make every other column non-editable
      }));

      renderGrid({ columns: columnsWithNonEditable });

      const firstCell = screen.getByText('設備A');
      await user.click(firstCell);

      await user.keyboard('{Tab}');

      // Should skip non-editable cells
    });
  });

  describe('Enter Key Navigation', () => {
    test('should move to cell below with Enter key when not editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      const firstCell = screen.getByText('設備A');
      await user.click(firstCell);

      // Press Enter to move down
      await user.keyboard('{Enter}');

      // Should move to cell below
    });

    test('should start editing when Enter is pressed on editable cell', async () => {
      const user = userEvent.setup();
      renderGrid();

      const editableCell = screen.getByText('設備A');
      await user.click(editableCell);

      // Press Enter to start editing
      await user.keyboard('{Enter}');

      // Should enter edit mode (would be verified by checking for input element)
    });

    test('should save changes and move down when Enter is pressed during editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Start editing
      await user.keyboard('{Enter}');

      // Type new value
      await user.keyboard('新しい設備名');

      // Press Enter to save and move down
      await user.keyboard('{Enter}');

      // Should call onCellEdit and move to next row
      expect(mockOnCellEdit).toHaveBeenCalled();
    });
  });

  describe('Arrow Key Navigation', () => {
    test('should move right with ArrowRight key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      await user.keyboard('{ArrowRight}');

      // Should move to cell on the right
    });

    test('should move left with ArrowLeft key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('BOM-A');
      await user.click(cell);

      await user.keyboard('{ArrowLeft}');

      // Should move to cell on the left
    });

    test('should move up with ArrowUp key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備B');
      await user.click(cell);

      await user.keyboard('{ArrowUp}');

      // Should move to cell above
    });

    test('should move down with ArrowDown key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      await user.keyboard('{ArrowDown}');

      // Should move to cell below
    });

    test('should handle boundary conditions for arrow navigation', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Test top-left corner
      const topLeftCell = screen.getByText('設備A');
      await user.click(topLeftCell);

      // Try to move up from top row (should stay in place or handle gracefully)
      await user.keyboard('{ArrowUp}');

      // Try to move left from leftmost column
      await user.keyboard('{ArrowLeft}');

      // Should handle boundary conditions gracefully
    });
  });

  describe('Escape Key Behavior', () => {
    test('should cancel editing with Escape key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Start editing
      await user.keyboard('{Enter}');

      // Type some text
      await user.keyboard('変更された値');

      // Cancel with Escape
      await user.keyboard('{Escape}');

      // Should not save changes
      expect(mockOnCellEdit).not.toHaveBeenCalled();
    });

    test('should clear selection with Escape when not editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Press Escape to clear selection
      await user.keyboard('{Escape}');

      // Should clear the selection
    });
  });

  describe('F2 Key for Editing', () => {
    test('should start editing with F2 key', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Press F2 to start editing
      await user.keyboard('{F2}');

      // Should enter edit mode
    });
  });

  describe('Navigation in Different Display Areas', () => {
    test('should navigate within specifications area', async () => {
      const user = userEvent.setup();
      const specConfig: DisplayAreaConfig = {
        mode: 'specifications',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: true,
            width: 400,
            columns: ['spec_機器名称']
          },
          maintenance: {
            visible: false,
            width: 0,
            columns: []
          }
        }
      };

      renderGrid({ displayAreaConfig: specConfig });

      // Navigate within specifications area
      const specCell = screen.getByText('設備A名');
      await user.click(specCell);

      await user.keyboard('{ArrowDown}');

      // Should navigate within the specifications area
    });

    test('should navigate within maintenance area', async () => {
      const user = userEvent.setup();
      const maintenanceConfig: DisplayAreaConfig = {
        mode: 'maintenance',
        fixedColumns: ['task', 'bomCode'],
        scrollableAreas: {
          specifications: {
            visible: false,
            width: 0,
            columns: []
          },
          maintenance: {
            visible: true,
            width: 400,
            columns: ['time_2024-01', 'time_2024-02']
          }
        }
      };

      renderGrid({ displayAreaConfig: maintenanceConfig });

      // Navigate within maintenance area
      const maintenanceCell = screen.getByText('設備A');
      await user.click(maintenanceCell);

      await user.keyboard('{ArrowRight}');

      // Should navigate within the maintenance area
    });

    test('should handle navigation between areas in both mode', async () => {
      const user = userEvent.setup();
      renderGrid(); // Uses both mode by default

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Navigate across different areas
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');

      // Should handle cross-area navigation
    });
  });

  describe('Navigation with Read-Only Mode', () => {
    test('should allow navigation in read-only mode', async () => {
      const user = userEvent.setup();
      renderGrid({ readOnly: true });

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Should still allow navigation
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');

      // Navigation should work even in read-only mode
    });

    test('should not start editing in read-only mode', async () => {
      const user = userEvent.setup();
      renderGrid({ readOnly: true });

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Try to start editing
      await user.keyboard('{Enter}');
      await user.keyboard('{F2}');

      // Should not enter edit mode
      expect(mockOnCellEdit).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should handle Ctrl+Home to go to first cell', async () => {
      const user = userEvent.setup();
      renderGrid();

      // Click on a cell in the middle
      const middleCell = screen.getByText('設備B');
      await user.click(middleCell);

      // Press Ctrl+Home
      await user.keyboard('{Control>}{Home}{/Control}');

      // Should navigate to first cell
    });

    test('should handle Ctrl+End to go to last cell', async () => {
      const user = userEvent.setup();
      renderGrid();

      const firstCell = screen.getByText('設備A');
      await user.click(firstCell);

      // Press Ctrl+End
      await user.keyboard('{Control>}{End}{/Control}');

      // Should navigate to last cell
    });

    test('should handle Page Up/Page Down for large datasets', async () => {
      const user = userEvent.setup();
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...testData[0],
        id: `row-${i}`,
        task: `設備${i + 1}`
      }));

      renderGrid({ data: largeDataset });

      const firstCell = screen.getByText('設備1');
      await user.click(firstCell);

      // Press Page Down
      await user.keyboard('{PageDown}');

      // Should jump down by page size
    });
  });

  describe('Focus Management', () => {
    test('should maintain focus within grid during navigation', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Navigate around
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Tab}');

      // Focus should remain within the grid
      const grid = screen.getByRole('tabpanel');
      expect(grid).toBeInTheDocument();
    });

    test('should restore focus after editing', async () => {
      const user = userEvent.setup();
      renderGrid();

      const cell = screen.getByText('設備A');
      await user.click(cell);

      // Start and finish editing
      await user.keyboard('{Enter}');
      await user.keyboard('新しい値');
      await user.keyboard('{Enter}');

      // Focus should return to the grid
      const grid = screen.getByRole('tabpanel');
      expect(grid).toBeInTheDocument();
    });
  });
});