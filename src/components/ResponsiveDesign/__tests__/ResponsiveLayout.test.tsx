import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useResponsiveLayout, useDeviceCapabilities } from '../../../hooks/useResponsiveLayout';
import ResponsiveDemo from '../../../ResponsiveDemo';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Test component that uses responsive layout
const TestResponsiveComponent: React.FC<{ width?: number; height?: number }> = ({ 
  width = 1024, 
  height = 768 
}) => {
  const responsive = useResponsiveLayout();
  const capabilities = useDeviceCapabilities();

  return (
    <div data-testid="responsive-component">
      <div data-testid="screen-size">{responsive.screenSize}</div>
      <div data-testid="is-mobile">{responsive.isMobile.toString()}</div>
      <div data-testid="is-tablet">{responsive.isTablet.toString()}</div>
      <div data-testid="is-desktop">{responsive.isDesktop.toString()}</div>
      <div data-testid="width">{responsive.width}</div>
      <div data-testid="height">{responsive.height}</div>
      <div data-testid="orientation">{responsive.orientation}</div>
      <div data-testid="is-touch">{responsive.isTouch.toString()}</div>
      <div data-testid="cell-height">{responsive.getCellHeight()}</div>
      <div data-testid="spacing">{responsive.getSpacing()}</div>
      <div data-testid="has-touch">{capabilities.hasTouch.toString()}</div>
      <div data-testid="has-hover">{capabilities.hasHover.toString()}</div>
      <div data-testid="has-pointer">{capabilities.hasPointer.toString()}</div>
    </div>
  );
};

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ResponsiveLayout Tests', () => {
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

    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Breakpoint Detection', () => {
    test('should detect extra small screen (xs) - below 480px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('screen-size')).toHaveTextContent('xs');
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
      expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
    });

    test('should detect small screen (sm) - 480px to 767px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600 });
      Object.defineProperty(window, 'innerHeight', { value: 800 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('screen-size')).toHaveTextContent('sm');
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
      expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
    });

    test('should detect medium screen (md) - 768px to 1023px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('screen-size')).toHaveTextContent('md');
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
      expect(screen.getByTestId('is-tablet')).toHaveTextContent('true');
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
    });

    test('should detect large screen (lg) - 1024px to 1199px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1100 });
      Object.defineProperty(window, 'innerHeight', { value: 800 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('screen-size')).toHaveTextContent('lg');
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
      expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('true');
    });

    test('should detect extra large screen (xl) - 1200px and above', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1400 });
      Object.defineProperty(window, 'innerHeight', { value: 900 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('screen-size')).toHaveTextContent('xl');
      expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
      expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('true');
    });
  });

  describe('Orientation Detection', () => {
    test('should detect landscape orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024 });
      Object.defineProperty(window, 'innerHeight', { value: 768 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('orientation')).toHaveTextContent('landscape');
    });

    test('should detect portrait orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768 });
      Object.defineProperty(window, 'innerHeight', { value: 1024 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('orientation')).toHaveTextContent('portrait');
    });
  });

  describe('Touch Detection', () => {
    test('should detect touch support via ontouchstart', () => {
      Object.defineProperty(window, 'ontouchstart', { value: {} });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('is-touch')).toHaveTextContent('true');
      expect(screen.getByTestId('has-touch')).toHaveTextContent('true');
    });

    test('should detect touch support via maxTouchPoints', () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 1 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('is-touch')).toHaveTextContent('true');
      expect(screen.getByTestId('has-touch')).toHaveTextContent('true');
    });

    test('should detect no touch support', () => {
      Object.defineProperty(window, 'ontouchstart', { value: undefined });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('is-touch')).toHaveTextContent('false');
      expect(screen.getByTestId('has-touch')).toHaveTextContent('false');
    });
  });

  describe('Device Capabilities', () => {
    test('should detect hover capability', () => {
      window.matchMedia = jest.fn().mockImplementation((query) => {
        if (query === '(hover: hover)') {
          return mockMatchMedia(true);
        }
        return mockMatchMedia(false);
      });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('has-hover')).toHaveTextContent('true');
    });

    test('should detect no hover capability', () => {
      window.matchMedia = jest.fn().mockImplementation((query) => {
        if (query === '(hover: hover)') {
          return mockMatchMedia(false);
        }
        return mockMatchMedia(false);
      });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('has-hover')).toHaveTextContent('false');
    });

    test('should detect fine pointer capability', () => {
      window.matchMedia = jest.fn().mockImplementation((query) => {
        if (query === '(pointer: fine)') {
          return mockMatchMedia(true);
        }
        return mockMatchMedia(false);
      });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('has-pointer')).toHaveTextContent('true');
    });

    test('should detect coarse pointer capability', () => {
      window.matchMedia = jest.fn().mockImplementation((query) => {
        if (query === '(pointer: fine)') {
          return mockMatchMedia(false);
        }
        return mockMatchMedia(false);
      });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('has-pointer')).toHaveTextContent('false');
    });
  });

  describe('Responsive Layout Calculations', () => {
    test('should calculate mobile cell height for touch devices', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });
      Object.defineProperty(window, 'ontouchstart', { value: {} });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('cell-height')).toHaveTextContent('48');
    });

    test('should calculate mobile cell height for non-touch devices', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });
      Object.defineProperty(window, 'ontouchstart', { value: undefined });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('cell-height')).toHaveTextContent('40');
    });

    test('should calculate tablet cell height for touch devices', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'ontouchstart', { value: {} });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('cell-height')).toHaveTextContent('44');
    });

    test('should calculate desktop cell height', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('cell-height')).toHaveTextContent('40');
    });

    test('should calculate mobile spacing', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });

      renderWithTheme(<TestResponsiveComponent />);

      const spacing = parseInt(screen.getByTestId('spacing').textContent || '0');
      expect(spacing).toBeLessThan(16); // Should be reduced from base 16px
    });

    test('should calculate tablet spacing', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });

      renderWithTheme(<TestResponsiveComponent />);

      const spacing = parseInt(screen.getByTestId('spacing').textContent || '0');
      expect(spacing).toBeGreaterThan(12); // Should be between mobile and desktop
      expect(spacing).toBeLessThan(16);
    });

    test('should calculate desktop spacing', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });

      renderWithTheme(<TestResponsiveComponent />);

      expect(screen.getByTestId('spacing')).toHaveTextContent('16');
    });
  });

  describe('Window Resize Handling', () => {
    test('should update layout on window resize', async () => {
      const { rerender } = renderWithTheme(<TestResponsiveComponent />);

      // Initial desktop state
      expect(screen.getByTestId('is-desktop')).toHaveTextContent('true');

      // Simulate window resize to mobile
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 400 });
        Object.defineProperty(window, 'innerHeight', { value: 600 });
        fireEvent(window, new Event('resize'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
      });
    });

    test('should update layout on orientation change', async () => {
      renderWithTheme(<TestResponsiveComponent />);

      // Initial landscape
      expect(screen.getByTestId('orientation')).toHaveTextContent('landscape');

      // Simulate orientation change to portrait
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 768 });
        Object.defineProperty(window, 'innerHeight', { value: 1024 });
        fireEvent(window, new Event('orientationchange'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('orientation')).toHaveTextContent('portrait');
      }, { timeout: 200 }); // Account for the 100ms delay in orientation change
    });
  });

  describe('Column Visibility', () => {
    const TestColumnVisibility: React.FC = () => {
      const responsive = useResponsiveLayout();
      const allColumns = ['task', 'cycle', 'bomCode', 'specifications', 'actions', 'metadata'];
      const visibleColumns = responsive.getVisibleColumns(allColumns);

      return (
        <div>
          <div data-testid="visible-columns">{visibleColumns.join(',')}</div>
          <div data-testid="visible-count">{visibleColumns.length}</div>
        </div>
      );
    };

    test('should show only high priority columns on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });

      renderWithTheme(<TestColumnVisibility />);

      const visibleColumns = screen.getByTestId('visible-columns').textContent;
      expect(visibleColumns).toContain('task');
      expect(visibleColumns).toContain('cycle');
      expect(visibleColumns).not.toContain('actions');
      expect(visibleColumns).not.toContain('metadata');
    });

    test('should show high and medium priority columns on tablet', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });

      renderWithTheme(<TestColumnVisibility />);

      const visibleColumns = screen.getByTestId('visible-columns').textContent;
      expect(visibleColumns).toContain('task');
      expect(visibleColumns).toContain('cycle');
      expect(visibleColumns).toContain('bomCode');
      expect(visibleColumns).toContain('specifications');
      expect(visibleColumns).not.toContain('actions');
      expect(visibleColumns).not.toContain('metadata');
    });

    test('should show all columns on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });

      renderWithTheme(<TestColumnVisibility />);

      const visibleColumns = screen.getByTestId('visible-columns').textContent;
      const visibleCount = parseInt(screen.getByTestId('visible-count').textContent || '0');
      expect(visibleCount).toBe(6); // All columns should be visible
    });
  });

  describe('Grid Template Columns', () => {
    const TestGridTemplate: React.FC = () => {
      const responsive = useResponsiveLayout();
      const columns = [
        { id: 'task', width: 200 },
        { id: 'cycle', width: 100 },
        { id: 'bomCode', width: 120 },
        { id: 'specifications', width: 150 },
        { id: 'actions', width: 80 },
        { id: 'metadata', width: 100 },
      ];
      const gridTemplate = responsive.getGridTemplateColumns(columns);

      return (
        <div data-testid="grid-template">{gridTemplate}</div>
      );
    };

    test('should generate grid template for mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 400 });

      renderWithTheme(<TestGridTemplate />);

      const gridTemplate = screen.getByTestId('grid-template').textContent;
      // Should only include high priority columns
      expect(gridTemplate).toContain('px');
      expect(gridTemplate?.split(' ').length).toBeLessThan(6); // Fewer columns than desktop
    });

    test('should generate grid template for desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });

      renderWithTheme(<TestGridTemplate />);

      const gridTemplate = screen.getByTestId('grid-template').textContent;
      // Should include all columns
      expect(gridTemplate?.split(' ').length).toBe(6); // All columns
    });
  });
});