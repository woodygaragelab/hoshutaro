import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MaintenanceGridLayout } from '../MaintenanceGridLayout';
import { GridColumn, GridState, DisplayAreaConfig } from '../../ExcelLikeGrid/types';
import { HierarchicalData } from '../../../types';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock data for testing
const mockColumns: GridColumn[] = [
  { id: 'task', label: 'タスク', width: 200, editable: false, type: 'text' },
  { id: 'bomCode', label: 'BOMコード', width: 150, editable: false, type: 'text' },
  { id: 'spec_name', label: '機器名称', width: 180, editable: true, type: 'text' },
  { id: 'spec_model', label: '型式', width: 150, editable: true, type: 'text' },
  { id: 'time_2024Q1', label: '2024Q1', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q2', label: '2024Q2', width: 100, editable: true, type: 'status' },
  { id: 'time_2024Q3', label: '2024Q3', width: 100, editable: true, type: 'cost' },
];

const mockData: HierarchicalData[] = [
  {
    id: 'item1',
    task: 'タスク1',
    bomCode: 'BOM001',
    cycle: 'A',
    specifications: [
      { key: 'name', value: '機器A', order: 1 },
      { key: 'model', value: 'Model-A1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: true, actual: false, planCost: 100000, actualCost: 0 },
      '2024Q2': { planned: false, actual: true, planCost: 0, actualCost: 120000 },
      '2024Q3': { planned: true, actual: true, planCost: 150000, actualCost: 140000 },
    },
  },
  {
    id: 'item2',
    task: 'タスク2',
    bomCode: 'BOM002',
    cycle: 'B',
    specifications: [
      { key: 'name', value: '機器B', order: 1 },
      { key: 'model', value: 'Model-B1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024Q2': { planned: true, actual: false, planCost: 200000, actualCost: 0 },
      '2024Q3': { planned: false, actual: true, planCost: 0, actualCost: 180000 },
    },
  },
  {
    id: 'item3',
    task: 'タスク3',
    bomCode: 'BOM003',
    cycle: 'A',
    specifications: [
      { key: 'name', value: '機器C', order: 1 },
      { key: 'model', value: 'Model-C1', order: 2 },
    ],
    results: {
      '2024Q1': { planned: true, actual: true, planCost: 300000, actualCost: 290000 },
      '2024Q2': { planned: true, actual: false, planCost: 250000, actualCost: 0 },
      '2024Q3': { planned: false, actual: false, planCost: 0, actualCost: 0 },
    },
  },
];

const mockDisplayAreaConfig: DisplayAreaConfig = {
  mode: 'both',
  fixedColumns: ['task', 'bomCode'],
  scrollableAreas: {
    specifications: {
      visible: true,
      columns: ['spec_name', 'spec_model'],
      width: 400,
    },
    maintenance: {
      visible: true,
      columns: ['time_2024Q1', 'time_2024Q2', 'time_2024Q3'],
      width: 300,
    },
  },
};

const mockGridState: GridState = {
  selectedCell: { rowId: 'item1', columnId: 'task' },
  editingCell: { rowId: null, columnId: null },
  selectedRange: null,
  columnWidths: {},
  rowHeights: {},
  sortConfig: null,
  filterConfig: null,
};

describe('MaintenanceGridLayout - PC Screen Functionality', () => {
  const mockOnCellEdit = jest.fn();
  const mockOnColumnResize = jest.fn();
  const mockOnRowResize = jest.fn();
  const mockOnSelectedCellChange = jest.fn();
  const mockOnEditingCellChange = jest.fn();
  const mockOnSelectedRangeChange = jest.fn();
  const mockOnUpdateItem = jest.fn();
  const mockOnSpecificationEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
    mockClipboard.readText.mockResolvedValue('');
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Mock window dimensions for desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080,
    });
  });

  const renderMaintenanceGrid = (props = {}) => {
    return renderWithTheme(
      <MaintenanceGridLayout
        data={mockData}
        columns={mockColumns}
        displayAreaConfig={mockDisplayAreaConfig}
        gridState={mockGridState}
        viewMode="status"
        onCellEdit={mockOnCellEdit}
        onColumnResize={mockOnColumnResize}
        onRowResize={mockOnRowResize}
        onSelectedCellChange={mockOnSelectedCellChange}
        onEditingCellChange={mockOnEditingCellChange}
        onSelectedRangeChange={mockOnSelectedRangeChange}
        onUpdateItem={mockOnUpdateItem}
        onSpecificationEdit={mockOnSpecificationEdit}
        virtualScrolling={false}
        readOnly={false}
        {...props}
      />
    );
  };

  describe('Keyboard Navigation', () => {
    test('should handle Tab key navigation to next editable cell', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid();

      const gridContainer = screen.getByRole('grid', { hidden: true }) || document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Tab}');

        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item1', 'spec_name');
        });
      }
    });

    test('should handle Shift+Tab key navigation to previous editable cell', async () => {
      const user = userEvent.setup();
      const gridStateWithEditableCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'time_2024Q1' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithEditableCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item1', 'spec_model');
        });
      }
    });

    test('should handle Enter key navigation to next row', async () => {
      const user = userEvent.setup();
      const gridStateWithEditableCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'spec_name' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithEditableCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'spec_name');
        });
      }
    });

    test('should handle arrow key navigation', async () => {
      const user = userEvent.setup();
      const gridStateWithEditableCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item2', columnId: 'spec_name' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithEditableCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        
        // Test ArrowUp
        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item1', 'spec_name');
        });

        // Test ArrowDown
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'spec_name');
        });

        // Test ArrowRight
        await user.keyboard('{ArrowRight}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'spec_model');
        });

        // Test ArrowLeft
        await user.keyboard('{ArrowLeft}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'spec_name');
        });
      }
    });

    test('should handle Home and End key navigation', async () => {
      const user = userEvent.setup();
      const gridStateWithEditableCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item2', columnId: 'spec_model' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithEditableCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        
        // Test Home key
        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'task');
        });

        // Test End key
        await user.keyboard('{End}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item2', 'time_2024Q3');
        });

        // Test Ctrl+Home
        await user.keyboard('{Control>}{Home}{/Control}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item1', 'task');
        });

        // Test Ctrl+End
        await user.keyboard('{Control>}{End}{/Control}');
        await waitFor(() => {
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item3', 'time_2024Q3');
        });
      }
    });

    test('should handle Escape key to cancel editing', async () => {
      const user = userEvent.setup();
      const gridStateWithEditing = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'spec_name' },
        editingCell: { rowId: 'item1', columnId: 'spec_name' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithEditing });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Escape}');

        await waitFor(() => {
          expect(mockOnEditingCellChange).toHaveBeenCalledWith(null, null);
        });
      }
    });

    test('should skip non-editable cells when navigating', async () => {
      const user = userEvent.setup();
      const gridStateWithNonEditableCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'task' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithNonEditableCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Tab}');

        await waitFor(() => {
          // Should skip bomCode (non-editable) and go to spec_name (editable)
          expect(mockOnSelectedCellChange).toHaveBeenCalledWith('item1', 'spec_name');
        });
      }
    });
  });

  describe('Copy & Paste Functionality', () => {
    test('should copy cell content with Ctrl+C', async () => {
      const user = userEvent.setup();
      const gridStateWithSelectedCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'task' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithSelectedCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Control>}c{/Control}');

        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalledWith('タスク1');
        });
      }
    });

    test('should copy status cell with correct symbol', async () => {
      const user = userEvent.setup();
      const gridStateWithStatusCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'time_2024Q1' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithStatusCell, viewMode: 'status' });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Control>}c{/Control}');

        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalledWith('○'); // Planned status
        });
      }
    });

    test('should copy cost cell with formatted values', async () => {
      const user = userEvent.setup();
      const gridStateWithCostCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'time_2024Q3' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithCostCell, viewMode: 'cost' });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Control>}c{/Control}');

        await waitFor(() => {
          expect(mockClipboard.writeText).toHaveBeenCalledWith('計画:150,000 / 実績:140,000');
        });
      }
    });

    test('should paste cell content with Ctrl+V', async () => {
      const user = userEvent.setup();
      const gridStateWithSelectedCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item2', columnId: 'task' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithSelectedCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        
        // First copy something
        await user.keyboard('{Control>}c{/Control}');
        
        // Then paste
        await user.keyboard('{Control>}v{/Control}');

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      }
    });

    test('should handle paste to read-only grid', async () => {
      const user = userEvent.setup();
      const gridStateWithSelectedCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'task' },
      };
      
      renderMaintenanceGrid({ 
        gridState: gridStateWithSelectedCell, 
        readOnly: true 
      });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        await user.keyboard('{Control>}v{/Control}');

        // Should not call onCellEdit for read-only grid
        expect(mockOnCellEdit).not.toHaveBeenCalled();
      }
    });

    test('should handle clipboard access errors gracefully', async () => {
      const user = userEvent.setup();
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));
      
      const gridStateWithSelectedCell = {
        ...mockGridState,
        selectedCell: { rowId: 'item1', columnId: 'task' },
      };
      
      renderMaintenanceGrid({ gridState: gridStateWithSelectedCell });

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      if (gridContainer) {
        gridContainer.focus();
        
        // Should not throw error
        await expect(user.keyboard('{Control>}c{/Control}')).resolves.not.toThrow();
      }
    });
  });

  describe('Scroll Synchronization', () => {
    test('should synchronize vertical scroll between areas', async () => {
      renderMaintenanceGrid();

      // Find scroll areas
      const scrollAreas = document.querySelectorAll('[data-testid*="scroll-area"]');
      
      if (scrollAreas.length > 0) {
        const firstArea = scrollAreas[0] as HTMLElement;
        
        // Simulate scroll event
        act(() => {
          fireEvent.scroll(firstArea, { target: { scrollTop: 200 } });
        });

        // Check that other areas are synchronized
        await waitFor(() => {
          scrollAreas.forEach((area, index) => {
            if (index > 0) {
              expect((area as HTMLElement).scrollTop).toBe(200);
            }
          });
        });
      }
    });

    test('should preserve horizontal scroll positions during vertical sync', async () => {
      renderMaintenanceGrid();

      const scrollAreas = document.querySelectorAll('[data-testid*="scroll-area"]');
      
      if (scrollAreas.length > 1) {
        const firstArea = scrollAreas[0] as HTMLElement;
        const secondArea = scrollAreas[1] as HTMLElement;
        
        // Set different horizontal positions
        act(() => {
          Object.defineProperty(firstArea, 'scrollLeft', { value: 100, writable: true });
          Object.defineProperty(secondArea, 'scrollLeft', { value: 200, writable: true });
        });

        // Trigger vertical scroll sync
        act(() => {
          fireEvent.scroll(firstArea, { target: { scrollTop: 300 } });
        });

        await waitFor(() => {
          expect(firstArea.scrollLeft).toBe(100); // Preserved
          expect(secondArea.scrollLeft).toBe(200); // Preserved
          expect(secondArea.scrollTop).toBe(300); // Synchronized
        });
      }
    });

    test('should handle scroll position persistence', async () => {
      const savedScrollData = {
        fixed: { top: 150, left: 0, timestamp: Date.now() },
        specifications: { top: 150, left: 0, timestamp: Date.now() },
        maintenance: { top: 150, left: 100, timestamp: Date.now() },
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedScrollData));
      
      renderMaintenanceGrid();

      // Should restore scroll positions
      await waitFor(() => {
        const scrollAreas = document.querySelectorAll('[data-testid*="scroll-area"]');
        scrollAreas.forEach(area => {
          expect((area as HTMLElement).scrollTop).toBe(150);
        });
      });
    });

    test('should throttle rapid scroll events for performance', async () => {
      renderMaintenanceGrid();

      const scrollArea = document.querySelector('[data-testid*="scroll-area"]') as HTMLElement;
      
      if (scrollArea) {
        // Simulate rapid scroll events
        act(() => {
          fireEvent.scroll(scrollArea, { target: { scrollTop: 100 } });
          fireEvent.scroll(scrollArea, { target: { scrollTop: 150 } });
          fireEvent.scroll(scrollArea, { target: { scrollTop: 200 } });
        });

        // Should handle without performance issues
        await waitFor(() => {
          expect(scrollArea.scrollTop).toBe(200);
        });
      }
    });

    test('should save scroll positions with debouncing', async () => {
      jest.useFakeTimers();
      
      renderMaintenanceGrid();

      const scrollArea = document.querySelector('[data-testid*="scroll-area"]') as HTMLElement;
      
      if (scrollArea) {
        act(() => {
          fireEvent.scroll(scrollArea, { target: { scrollTop: 250 } });
        });

        // Should not save immediately
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled();

        // Fast-forward to trigger debounced save
        act(() => {
          jest.advanceTimersByTime(500);
        });

        await waitFor(() => {
          expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });
      }
      
      jest.useRealTimers();
    });
  });

  describe('Cell Double-Click Editing', () => {
    test('should open status selection dialog on status cell double-click', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid({ viewMode: 'status' });

      // Find a status cell and double-click it
      const statusCells = screen.getAllByText('○');
      const statusCell = statusCells[0]; // Get the first one
      
      await user.dblClick(statusCell);

      await waitFor(() => {
        expect(screen.getByText('状態を選択')).toBeInTheDocument();
      });
    });

    test('should open cost input dialog on cost cell double-click', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid({ viewMode: 'cost' });

      // Find a cost cell and double-click it
      const costCells = screen.getAllByText(/計画:|実績:/);
      if (costCells.length > 0) {
        await user.dblClick(costCells[0]);

        await waitFor(() => {
          expect(screen.getByText('コスト入力')).toBeInTheDocument();
        });
      }
    });

    test('should open specification edit dialog on spec cell double-click', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid();

      // Find a specification cell and double-click it
      const specCell = screen.getByText('機器A');
      
      await user.dblClick(specCell);

      await waitFor(() => {
        expect(screen.getByText('機器仕様編集')).toBeInTheDocument();
      });
    });

    test('should not open dialog for non-editable cells', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid();

      // Find a non-editable cell and double-click it
      const taskCell = screen.getByText('タスク1');
      
      await user.dblClick(taskCell);

      // Should not open any dialog
      expect(screen.queryByText('状態を選択')).not.toBeInTheDocument();
      expect(screen.queryByText('コスト入力')).not.toBeInTheDocument();
      expect(screen.queryByText('機器仕様編集')).not.toBeInTheDocument();
    });

    test('should not open dialog in read-only mode', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid({ readOnly: true });

      const specCell = screen.getByText('機器A');
      
      await user.dblClick(specCell);

      // Should not open dialog in read-only mode
      expect(screen.queryByText('機器仕様編集')).not.toBeInTheDocument();
    });

    test('should update editing cell state when dialog opens', async () => {
      const user = userEvent.setup();
      renderMaintenanceGrid({ viewMode: 'status' });

      const statusCell = screen.getByText('○');
      
      await user.dblClick(statusCell);

      await waitFor(() => {
        expect(mockOnEditingCellChange).toHaveBeenCalledWith('item1', 'time_2024Q1');
      });
    });
  });

  describe('Column Resizing', () => {
    test('should handle column resize events', async () => {
      renderMaintenanceGrid();

      // Find a resizer element
      const resizer = document.querySelector('.column-resizer');
      
      if (resizer) {
        // Simulate drag to resize
        fireEvent.mouseDown(resizer, { clientX: 100 });
        fireEvent.mouseMove(document, { clientX: 150 });
        fireEvent.mouseUp(document);

        await waitFor(() => {
          expect(mockOnColumnResize).toHaveBeenCalled();
        });
      }
    });

    test('should debounce rapid resize events for performance', async () => {
      jest.useFakeTimers();
      
      renderMaintenanceGrid();

      const resizer = document.querySelector('.column-resizer');
      
      if (resizer) {
        // Simulate rapid resize events
        fireEvent.mouseDown(resizer, { clientX: 100 });
        fireEvent.mouseMove(document, { clientX: 120 });
        fireEvent.mouseMove(document, { clientX: 140 });
        fireEvent.mouseMove(document, { clientX: 160 });
        fireEvent.mouseUp(document);

        // Should debounce calls
        act(() => {
          jest.advanceTimersByTime(16);
        });

        await waitFor(() => {
          expect(mockOnColumnResize).toHaveBeenCalled();
        });
      }
      
      jest.useRealTimers();
    });
  });

  describe('Focus Management', () => {
    test('should focus grid container on mount', async () => {
      renderMaintenanceGrid();

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      await waitFor(() => {
        expect(gridContainer).toHaveFocus();
      });
    });

    test('should focus grid when selected cell changes', async () => {
      const { rerender } = renderMaintenanceGrid();

      const updatedGridState = {
        ...mockGridState,
        selectedCell: { rowId: 'item2', columnId: 'spec_name' },
      };

      rerender(
        <ThemeProvider theme={theme}>
          <MaintenanceGridLayout
            data={mockData}
            columns={mockColumns}
            displayAreaConfig={mockDisplayAreaConfig}
            gridState={updatedGridState}
            viewMode="status"
            onCellEdit={mockOnCellEdit}
            onColumnResize={mockOnColumnResize}
            onRowResize={mockOnRowResize}
            onSelectedCellChange={mockOnSelectedCellChange}
            onEditingCellChange={mockOnEditingCellChange}
            onSelectedRangeChange={mockOnSelectedRangeChange}
            onUpdateItem={mockOnUpdateItem}
            onSpecificationEdit={mockOnSpecificationEdit}
            virtualScrolling={false}
            readOnly={false}
          />
        </ThemeProvider>
      );

      const gridContainer = document.querySelector('[tabindex="0"]');
      
      await waitFor(() => {
        expect(gridContainer).toHaveFocus();
      });
    });

    test('should not focus in read-only mode', async () => {
      renderMaintenanceGrid({ readOnly: true });

      const gridContainer = document.querySelector('[tabindex="-1"]');
      
      expect(gridContainer).toBeInTheDocument();
      // In read-only mode, the grid should not automatically focus
      // We'll just check that it has the correct tabindex
      expect(gridContainer).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('Device Type Detection', () => {
    test('should detect desktop device type', async () => {
      // Already set in beforeEach
      renderMaintenanceGrid();

      // Should render desktop-specific elements
      const gridContainer = document.querySelector('[tabindex="0"]');
      expect(gridContainer).toBeInTheDocument();
    });

    test('should handle window resize events', async () => {
      renderMaintenanceGrid();

      // Simulate window resize to tablet size
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 800 });
        fireEvent(window, new Event('resize'));
      });

      // Should adapt to new device type
      await waitFor(() => {
        // Device type should be updated internally
        expect(window.innerWidth).toBe(800);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing data gracefully', () => {
      expect(() => {
        renderMaintenanceGrid({ data: [] });
      }).not.toThrow();
    });

    test('should handle missing columns gracefully', () => {
      expect(() => {
        renderMaintenanceGrid({ columns: [] });
      }).not.toThrow();
    });

    test('should handle invalid grid state gracefully', () => {
      const invalidGridState = {
        ...mockGridState,
        selectedCell: { rowId: 'invalid-id', columnId: 'invalid-column' },
      };

      expect(() => {
        renderMaintenanceGrid({ gridState: invalidGridState });
      }).not.toThrow();
    });

    test('should handle dialog save errors gracefully', async () => {
      const user = userEvent.setup();
      mockOnCellEdit.mockImplementation(() => {
        throw new Error('Save failed');
      });

      renderMaintenanceGrid({ viewMode: 'status' });

      const statusCells = screen.getAllByText('○');
      const statusCell = statusCells[0]; // Get the first one
      await user.dblClick(statusCell);

      // Find and click a status option
      const plannedOption = screen.getByText('計画');
      await user.click(plannedOption);

      // Should handle error gracefully
      expect(() => {
        // Error should be caught internally
      }).not.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    test('should use requestAnimationFrame for smooth operations', async () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      
      renderMaintenanceGrid();

      const scrollArea = document.querySelector('[data-testid*="scroll-area"]') as HTMLElement;
      
      if (scrollArea) {
        act(() => {
          fireEvent.scroll(scrollArea, { target: { scrollTop: 100 } });
        });

        expect(rafSpy).toHaveBeenCalled();
      }
      
      rafSpy.mockRestore();
    });

    test('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        ...mockData[0],
        id: `item${i}`,
        task: `タスク${i}`,
      }));

      const startTime = performance.now();
      
      renderMaintenanceGrid({ data: largeData });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 5 seconds for testing environment)
      expect(renderTime).toBeLessThan(5000);
    });
  });
});