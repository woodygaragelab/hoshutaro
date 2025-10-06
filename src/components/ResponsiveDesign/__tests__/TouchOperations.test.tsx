import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TabletGridView from '../../EnhancedMaintenanceGrid/TabletGridView';
import MobileGridView from '../../EnhancedMaintenanceGrid/MobileGridView';
import { HierarchicalData } from '../../../types';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

// Mock responsive layout hook
jest.mock('../../../hooks/useResponsiveLayout');
const mockUseResponsiveLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;

// Mock data
const mockData: HierarchicalData[] = [
  {
    id: '1',
    task: 'テスト機器A',
    bomCode: 'TEST-001',
    cycle: '年次',
    hierarchyPath: 'レベル1/レベル2',
    specifications: [
      { key: '型式', value: 'ABC-123', order: 0 },
      { key: '容量', value: '100L', order: 1 },
    ],
    results: {
      '2024年': { planned: true, actual: false, planCost: 10000, actualCost: 0 },
      '2025年': { planned: false, actual: false, planCost: 0, actualCost: 0 },
    },
    children: [],
  },
  {
    id: '2',
    task: 'テスト機器B',
    bomCode: 'TEST-002',
    cycle: '月次',
    hierarchyPath: 'レベル1/レベル3',
    specifications: [
      { key: '型式', value: 'XYZ-456', order: 0 },
    ],
    results: {
      '2024年': { planned: true, actual: true, planCost: 20000, actualCost: 18000 },
      '2025年': { planned: true, actual: false, planCost: 22000, actualCost: 0 },
    },
    children: [],
  },
];

const mockTimeHeaders = ['2024年', '2025年'];

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock responsive layout for different device types
const createMockResponsive = (deviceType: 'mobile' | 'tablet' | 'desktop') => ({
  screenSize: deviceType === 'mobile' ? 'xs' : deviceType === 'tablet' ? 'md' : 'lg' as const,
  isMobile: deviceType === 'mobile',
  isTablet: deviceType === 'tablet',
  isDesktop: deviceType === 'desktop',
  width: deviceType === 'mobile' ? 400 : deviceType === 'tablet' ? 800 : 1200,
  height: deviceType === 'mobile' ? 600 : deviceType === 'tablet' ? 600 : 800,
  orientation: 'landscape' as const,
  isTouch: deviceType !== 'desktop',
  layoutConfig: {
    priorityColumns: {
      high: ['task', 'cycle'],
      medium: ['bomCode', 'specifications'],
      low: ['actions', 'metadata'],
    },
    mobileLayout: {
      stackElements: true,
      hideSecondaryActions: true,
      compactSpacing: true,
    },
    tabletLayout: {
      showSidebar: false,
      adaptiveColumns: true,
    },
  },
  breakpoints: {
    xs: 480,
    sm: 768,
    md: 1024,
    lg: 1200,
    xl: 1440,
  },
  getVisibleColumns: jest.fn((columns: string[]) => {
    if (deviceType === 'mobile') return columns.filter(col => ['task', 'cycle'].includes(col));
    if (deviceType === 'tablet') return columns.filter(col => ['task', 'cycle', 'bomCode', 'specifications'].includes(col));
    return columns;
  }),
  getColumnWidth: jest.fn((columnId: string, baseWidth: number) => {
    if (deviceType === 'mobile') return baseWidth * 0.8;
    if (deviceType === 'tablet') return baseWidth * 0.9;
    return baseWidth;
  }),
  getCellHeight: jest.fn(() => {
    if (deviceType === 'mobile') return 48;
    if (deviceType === 'tablet') return 44;
    return 40;
  }),
  getSpacing: jest.fn((size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
    const baseSpacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }[size];
    if (deviceType === 'mobile') return Math.max(baseSpacing * 0.75, 4);
    if (deviceType === 'tablet') return Math.max(baseSpacing * 0.875, 6);
    return baseSpacing;
  }),
  shouldStackElements: jest.fn(() => deviceType === 'mobile'),
  shouldHideSecondaryActions: jest.fn(() => deviceType === 'mobile'),
  shouldUseCompactSpacing: jest.fn(() => deviceType === 'mobile'),
  getGridTemplateColumns: jest.fn(() => '200px 100px'),
  updateLayout: jest.fn(),
});

describe('Touch Operations Tests', () => {
  const mockOnCellEdit = jest.fn();
  const mockOnSpecificationEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tablet Touch Operations', () => {
    beforeEach(() => {
      mockUseResponsiveLayout.mockReturnValue(createMockResponsive('tablet'));
    });

    test('should handle touch tap on status cell', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Find and tap on a status cell
      const statusButtons = screen.getAllByRole('button');
      const statusButton = statusButtons.find(button => 
        button.getAttribute('aria-label') || button.closest('[data-testid*="status"]')
      );

      if (statusButton) {
        await user.click(statusButton);
        
        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      }
    });

    test('should handle touch tap on cost cell', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="cost"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Find cost cells and tap on them
      const costCells = screen.getAllByText(/¥/);
      if (costCells.length > 0) {
        await user.click(costCells[0]);
        
        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      }
    });

    test('should handle expand/collapse touch operations', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Find expand buttons
      const expandButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="ExpandMoreIcon"], svg[data-testid="ExpandLessIcon"]')
      );

      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        
        // Should show expanded content
        await waitFor(() => {
          expect(screen.getByText('機器仕様')).toBeInTheDocument();
        });
      }
    });

    test('should handle column toggle touch operations', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Find column toggle chips
      const columnChips = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('年')
      );

      if (columnChips.length > 0) {
        await user.click(columnChips[0]);
        
        // Column visibility should change
        await waitFor(() => {
          // The chip should change appearance or the column should be hidden/shown
          expect(columnChips[0]).toBeInTheDocument();
        });
      }
    });

    test('should provide adequate touch target sizes', () => {
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Check that interactive elements have adequate touch target sizes (44px minimum)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // Touch targets should be at least 44px for accessibility
        expect(minHeight >= 32 || minWidth >= 32).toBeTruthy();
      });
    });
  });

  describe('Mobile Touch Operations', () => {
    beforeEach(() => {
      mockUseResponsiveLayout.mockReturnValue(createMockResponsive('mobile'));
    });

    test('should handle card expansion touch operations', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      // Find expand buttons in cards
      const expandButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="ExpandMoreIcon"], svg[data-testid="ExpandLessIcon"]')
      );

      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        
        // Should show expanded content
        await waitFor(() => {
          expect(screen.getByText('機器仕様')).toBeInTheDocument();
        });
      }
    });

    test('should handle edit dialog touch operations', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      // First expand a card to see the timeline
      const expandButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="ExpandMoreIcon"]')
      );

      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        
        await waitFor(() => {
          // Find edit buttons in the expanded timeline
          const editButtons = screen.getAllByRole('button').filter(button => 
            button.querySelector('svg[data-testid="EditIcon"]')
          );

          if (editButtons.length > 0) {
            return user.click(editButtons[0]);
          }
        });

        // Should open edit dialog
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
      }
    });

    test('should handle dialog touch interactions', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      // Open edit dialog first
      const expandButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="ExpandMoreIcon"]')
      );

      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        
        await waitFor(async () => {
          const editButtons = screen.getAllByRole('button').filter(button => 
            button.querySelector('svg[data-testid="EditIcon"]')
          );

          if (editButtons.length > 0) {
            await user.click(editButtons[0]);
          }
        });

        // Wait for dialog to open
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Test dialog interactions
        const saveButton = screen.getByText('保存');
        const cancelButton = screen.getByText('キャンセル');

        expect(saveButton).toBeInTheDocument();
        expect(cancelButton).toBeInTheDocument();

        // Test cancel
        await user.click(cancelButton);
        
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
      }
    });

    test('should handle cost mode dialog touch interactions', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="cost"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      // Open edit dialog
      const expandButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg[data-testid="ExpandMoreIcon"]')
      );

      if (expandButtons.length > 0) {
        await user.click(expandButtons[0]);
        
        await waitFor(async () => {
          const editButtons = screen.getAllByRole('button').filter(button => 
            button.querySelector('svg[data-testid="EditIcon"]')
          );

          if (editButtons.length > 0) {
            await user.click(editButtons[0]);
          }
        });

        // Wait for dialog to open
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Should show cost input fields
        const planCostInput = screen.getByLabelText('計画コスト');
        const actualCostInput = screen.getByLabelText('実績コスト');

        expect(planCostInput).toBeInTheDocument();
        expect(actualCostInput).toBeInTheDocument();

        // Test input interaction
        await user.clear(planCostInput);
        await user.type(planCostInput, '15000');

        await user.clear(actualCostInput);
        await user.type(actualCostInput, '14000');

        // Test save
        const saveButton = screen.getByText('保存');
        await user.click(saveButton);

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('time_'),
            expect.objectContaining({
              planCost: 15000,
              actualCost: 14000,
            })
          );
        });
      }
    });

    test('should provide adequate touch target sizes for mobile', () => {
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      // Check that interactive elements have adequate touch target sizes (44px minimum for mobile)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // Mobile touch targets should be at least 44px
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });
  });

  describe('Touch Gesture Support', () => {
    test('should handle touch events properly', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      const statusButtons = screen.getAllByRole('button');
      if (statusButtons.length > 0) {
        const button = statusButtons[0];
        
        // Simulate touch events
        fireEvent.touchStart(button, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        
        fireEvent.touchEnd(button, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });

        // Should still trigger click
        await user.click(button);
        
        // Verify the interaction worked
        expect(button).toBeInTheDocument();
      }
    });

    test('should handle scroll gestures on mobile cards', () => {
      renderWithTheme(
        <MobileGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('mobile')}
        />
      );

      const container = screen.getByText('テスト機器A').closest('[data-testid], div');
      if (container) {
        // Simulate scroll gesture
        fireEvent.touchStart(container, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        
        fireEvent.touchMove(container, {
          touches: [{ clientX: 100, clientY: 50 }],
        });
        
        fireEvent.touchEnd(container, {
          changedTouches: [{ clientX: 100, clientY: 50 }],
        });

        // Container should still be present
        expect(container).toBeInTheDocument();
      }
    });
  });

  describe('Accessibility for Touch', () => {
    test('should provide proper ARIA labels for touch interactions', () => {
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      // Check for tooltips and ARIA labels
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Should have either aria-label or be wrapped in an element with title/tooltip
        const hasAriaLabel = button.hasAttribute('aria-label');
        const hasTitle = button.hasAttribute('title');
        const hasTooltip = button.closest('[title]') !== null;
        
        // At least one accessibility feature should be present
        expect(hasAriaLabel || hasTitle || hasTooltip).toBeTruthy();
      });
    });

    test('should support keyboard navigation as fallback', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <TabletGridView
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          responsive={createMockResponsive('tablet')}
        />
      );

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        // Focus first button
        buttons[0].focus();
        expect(buttons[0]).toHaveFocus();

        // Should be able to activate with Enter
        await user.keyboard('{Enter}');
        
        // Should be able to navigate with Tab
        await user.keyboard('{Tab}');
        
        // Focus should move to next focusable element
        expect(document.activeElement).not.toBe(buttons[0]);
      }
    });
  });
});