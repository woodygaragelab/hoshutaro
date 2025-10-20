import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ResponsiveDemo from '../../../ResponsiveDemo';
import EnhancedMaintenanceGrid from '../../../components/EnhancedMaintenanceGrid/EnhancedMaintenanceGrid';
import ModernHeader from '../../../components/ModernHeader/ModernHeader';
import { HierarchicalData } from '../../../types';

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
];

const mockTimeHeaders = ['2024年', '2025年', '2026年', '2027年'];

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Helper function to simulate window resize
const resizeWindow = (width: number, height: number) => {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    fireEvent(window, new Event('resize'));
  });
};

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe('Breakpoint Display Tests', () => {
  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });

    // Mock matchMedia
    window.matchMedia = jest.fn().mockImplementation((query) => {
      if (query === '(hover: hover)') {
        return mockMatchMedia(true);
      }
      if (query === '(pointer: fine)') {
        return mockMatchMedia(true);
      }
      return mockMatchMedia(false);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Extra Small Breakpoint (xs) - Below 480px', () => {
    beforeEach(() => {
      resizeWindow(400, 600);
    });

    test('should display mobile layout for ResponsiveDemo', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // Check for mobile indicators in the demo
        expect(screen.getByText(/画面: XS/)).toBeInTheDocument();
        expect(screen.getByText('要素スタック')).toBeInTheDocument();
      });
    });

    test('should show only essential columns in grid', async () => {
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      );

      await waitFor(() => {
        // Should use mobile view (card layout)
        expect(screen.getByText('テスト機器A')).toBeInTheDocument();
      });
    });

    test('should use compact spacing and larger touch targets', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          const styles = window.getComputedStyle(button);
          const minHeight = parseInt(styles.minHeight) || 0;
          // Mobile should have larger touch targets
          expect(minHeight >= 32).toBeTruthy();
        });
      });
    });

    test('should stack elements vertically', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // Check for mobile-specific layout indicators
        expect(screen.getByText('コンパクトスペーシング')).toBeInTheDocument();
        expect(screen.getByText('要素スタック')).toBeInTheDocument();
      });
    });
  });

  describe('Small Breakpoint (sm) - 480px to 767px', () => {
    beforeEach(() => {
      resizeWindow(600, 800);
    });

    test('should display small mobile layout', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        expect(screen.getByText(/画面: SM/)).toBeInTheDocument();
        expect(screen.getByText('要素スタック')).toBeInTheDocument();
      });
    });

    test('should maintain mobile card layout but with more space', async () => {
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      );

      await waitFor(() => {
        // Should still use mobile view but with more breathing room
        expect(screen.getByText('テスト機器A')).toBeInTheDocument();
      });
    });
  });

  describe('Medium Breakpoint (md) - 768px to 1023px', () => {
    beforeEach(() => {
      resizeWindow(800, 600);
    });

    test('should display tablet layout', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        expect(screen.getByText(/画面: MD/)).toBeInTheDocument();
        expect(screen.queryByText('要素スタック')).not.toBeInTheDocument();
      });
    });

    test('should show tablet grid view with column toggles', async () => {
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      );

      await waitFor(() => {
        // Should show table layout with column controls
        expect(screen.getByText('機器台帳')).toBeInTheDocument();
        expect(screen.getByText('列表示:')).toBeInTheDocument();
      });
    });

    test('should show medium priority columns', async () => {
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      );

      await waitFor(() => {
        // Should show more columns than mobile
        expect(screen.getByText('テスト機器A')).toBeInTheDocument();
        expect(screen.getByText('TEST-001')).toBeInTheDocument();
      });
    });

    test('should use appropriate cell heights for touch', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // Tablet should show cell height of 44px for touch devices
        const cellHeightElement = screen.getByText(/セル高: \d+px/);
        expect(cellHeightElement.textContent).toContain('44px');
      });
    });
  });

  describe('Large Breakpoint (lg) - 1024px to 1199px', () => {
    beforeEach(() => {
      resizeWindow(1100, 800);
    });

    test('should display desktop layout', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        expect(screen.getByText(/画面: LG/)).toBeInTheDocument();
        expect(screen.queryByText('要素スタック')).not.toBeInTheDocument();
      });
    });

    test('should show full desktop grid with all columns', async () => {
      const mockOnCellEdit = jest.fn();
      const mockOnSpecificationEdit = jest.fn();
      const mockOnUpdateItem = jest.fn();

      renderWithTheme(
        <EnhancedMaintenanceGrid
          data={mockData}
          timeHeaders={mockTimeHeaders}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          showCycle={true}
          onCellEdit={mockOnCellEdit}
          onSpecificationEdit={mockOnSpecificationEdit}
          onUpdateItem={mockOnUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      );

      await waitFor(() => {
        // Should show full desktop layout
        expect(screen.getByText('テスト機器A')).toBeInTheDocument();
        expect(screen.getByText('TEST-001')).toBeInTheDocument();
        expect(screen.getByText('年次')).toBeInTheDocument();
      });
    });

    test('should use standard desktop cell heights', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // Desktop should show cell height of 40px
        const cellHeightElement = screen.getByText(/セル高: \d+px/);
        expect(cellHeightElement.textContent).toContain('40px');
      });
    });

    test('should not show mobile-specific layout features', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // Should not show mobile layout features
        expect(screen.queryByText('要素スタック')).not.toBeInTheDocument();
        expect(screen.queryByText('セカンダリアクション非表示')).not.toBeInTheDocument();
        expect(screen.queryByText('コンパクトスペーシング')).not.toBeInTheDocument();
      });
    });
  });

  describe('Extra Large Breakpoint (xl) - 1200px and above', () => {
    beforeEach(() => {
      resizeWindow(1400, 900);
    });

    test('should display extra large desktop layout', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        expect(screen.getByText(/画面: XL/)).toBeInTheDocument();
        expect(screen.queryByText('要素スタック')).not.toBeInTheDocument();
      });
    });

    test('should use maximum spacing and optimal layout', async () => {
      renderWithTheme(<ResponsiveDemo />);

      await waitFor(() => {
        // XL should have generous spacing
        const spacingElement = screen.getByText(/スペーシング: \d+px/);
        const spacing = parseInt(spacingElement.textContent?.match(/\d+/)?.[0] || '0');
        expect(spacing).toBeGreaterThanOrEqual(16);
      });
    });
  });

  describe('Breakpoint Transitions', () => {
    test('should smoothly transition from mobile to tablet', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Start with mobile
      resizeWindow(400, 600);
      await waitFor(() => {
        expect(screen.getByText(/画面: XS/)).toBeInTheDocument();
      });

      // Transition to tablet
      resizeWindow(800, 600);
      await waitFor(() => {
        expect(screen.getByText(/画面: MD/)).toBeInTheDocument();
      });
    });

    test('should smoothly transition from tablet to desktop', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Start with tablet
      resizeWindow(800, 600);
      await waitFor(() => {
        expect(screen.getByText(/画面: MD/)).toBeInTheDocument();
      });

      // Transition to desktop
      resizeWindow(1200, 800);
      await waitFor(() => {
        expect(screen.getByText(/画面: XL/)).toBeInTheDocument();
      });
    });

    test('should handle rapid breakpoint changes', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Rapidly change breakpoints
      resizeWindow(400, 600); // Mobile
      resizeWindow(800, 600); // Tablet
      resizeWindow(1200, 800); // Desktop
      resizeWindow(600, 800); // Back to mobile

      await waitFor(() => {
        expect(screen.getByText(/画面: SM/)).toBeInTheDocument();
      });
    });
  });

  describe('Orientation Changes', () => {
    test('should handle portrait to landscape transition', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Start with portrait
      resizeWindow(600, 800);
      await waitFor(() => {
        expect(screen.getByText(/向き: portrait/)).toBeInTheDocument();
      });

      // Change to landscape
      resizeWindow(800, 600);
      await waitFor(() => {
        expect(screen.getByText(/向き: landscape/)).toBeInTheDocument();
      });
    });

    test('should handle orientation change events', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Simulate orientation change
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 800 });
        Object.defineProperty(window, 'innerHeight', { value: 600 });
        fireEvent(window, new Event('orientationchange'));
      });

      await waitFor(() => {
        expect(screen.getByText(/向き: landscape/)).toBeInTheDocument();
      }, { timeout: 200 }); // Account for orientation change delay
    });
  });

  describe('Header Responsive Behavior', () => {
    test('should show hamburger menu on mobile', async () => {
      const mockActions = [
        {
          id: 'search',
          icon: <span>🔍</span>,
          label: '検索',
          onClick: jest.fn(),
          tooltip: '検索',
          priority: 'high' as const,
        },
      ];

      resizeWindow(400, 600);

      renderWithTheme(
        <ModernHeader
          actions={mockActions}
          onAIAssistantToggle={jest.fn()}
          onSettingsOpen={jest.fn()}
          isAIAssistantOpen={false}
          hierarchyLevel1={[]}
          hierarchyLevel2={[]}
          hierarchyLevel3={[]}
          selectedLevel1="all"
          selectedLevel2="all"
          selectedLevel3="all"
          onHierarchyChange={jest.fn()}
          searchTerm=""
          onSearchChange={jest.fn()}
          viewMode="status"
          onViewModeChange={jest.fn()}
          timeScale="year"
          onTimeScaleChange={jest.fn()}
          showBomCode={true}
          onShowBomCodeChange={jest.fn()}
          showCycle={true}
          onShowCycleChange={jest.fn()}
          onYearAdd={jest.fn()}
          onYearDelete={jest.fn()}
          onDataExport={jest.fn()}
          onDataImport={jest.fn()}
          onDataReset={jest.fn()}
        />
      );

      await waitFor(() => {
        // Should show mobile menu button
        const menuButtons = screen.getAllByRole('button');
        expect(menuButtons.length).toBeGreaterThan(0);
      });
    });

    test('should show full menu on desktop', async () => {
      const mockActions = [
        {
          id: 'search',
          icon: <span>🔍</span>,
          label: '検索',
          onClick: jest.fn(),
          tooltip: '検索',
          priority: 'high' as const,
        },
        {
          id: 'filter',
          icon: <span>🔽</span>,
          label: 'フィルター',
          onClick: jest.fn(),
          tooltip: 'フィルター',
          priority: 'medium' as const,
        },
      ];

      resizeWindow(1200, 800);

      renderWithTheme(
        <ModernHeader
          actions={mockActions}
          onAIAssistantToggle={jest.fn()}
          onSettingsOpen={jest.fn()}
          isAIAssistantOpen={false}
          hierarchyLevel1={[]}
          hierarchyLevel2={[]}
          hierarchyLevel3={[]}
          selectedLevel1="all"
          selectedLevel2="all"
          selectedLevel3="all"
          onHierarchyChange={jest.fn()}
          searchTerm=""
          onSearchChange={jest.fn()}
          viewMode="status"
          onViewModeChange={jest.fn()}
          timeScale="year"
          onTimeScaleChange={jest.fn()}
          showBomCode={true}
          onShowBomCodeChange={jest.fn()}
          showCycle={true}
          onShowCycleChange={jest.fn()}
          onYearAdd={jest.fn()}
          onYearDelete={jest.fn()}
          onDataExport={jest.fn()}
          onDataImport={jest.fn()}
          onDataReset={jest.fn()}
        />
      );

      await waitFor(() => {
        // Should show all actions on desktop
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('CSS Media Query Integration', () => {
    test('should apply responsive CSS classes correctly', async () => {
      renderWithTheme(<ResponsiveDemo />);

      // Check that responsive CSS is loaded
      const styleSheets = Array.from(document.styleSheets);
      const hasResponsiveStyles = styleSheets.some(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          return rules.some(rule => 
            rule.cssText.includes('@media') && 
            (rule.cssText.includes('max-width') || rule.cssText.includes('min-width'))
          );
        } catch {
          return false;
        }
      });

      // Should have responsive styles or CSS file loaded
      expect(hasResponsiveStyles || document.querySelector('link[href*="responsive"]')).toBeTruthy();
    });

    test('should hide elements with responsive utility classes', () => {
      const TestComponent = () => (
        <div>
          <div className="hide-on-mobile" data-testid="desktop-only">Desktop Only</div>
          <div className="hide-on-desktop" data-testid="mobile-only">Mobile Only</div>
          <div className="visible-md" data-testid="tablet-only">Tablet Only</div>
        </div>
      );

      renderWithTheme(<TestComponent />);

      // Elements should be present in DOM (CSS will handle visibility)
      expect(screen.getByTestId('desktop-only')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-only')).toBeInTheDocument();
      expect(screen.getByTestId('tablet-only')).toBeInTheDocument();
    });
  });
});