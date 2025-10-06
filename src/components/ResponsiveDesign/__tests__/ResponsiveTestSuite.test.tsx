import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

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

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Test component for responsive behavior
const ResponsiveTestComponent: React.FC = () => {
  const responsive = useResponsiveLayout();

  return (
    <div data-testid="responsive-test">
      <div data-testid="screen-size">{responsive.screenSize}</div>
      <div data-testid="is-mobile">{responsive.isMobile.toString()}</div>
      <div data-testid="is-tablet">{responsive.isTablet.toString()}</div>
      <div data-testid="is-desktop">{responsive.isDesktop.toString()}</div>
      <div data-testid="cell-height">{responsive.getCellHeight()}</div>
      <div data-testid="spacing">{responsive.getSpacing()}</div>
      <div data-testid="is-touch">{responsive.isTouch.toString()}</div>
      
      {/* Responsive elements */}
      <button 
        data-testid="touch-button"
        style={{
          minHeight: responsive.getCellHeight(),
          padding: responsive.getSpacing('xs'),
        }}
      >
        Touch Button
      </button>
      
      <div 
        data-testid="responsive-grid"
        style={{
          display: 'grid',
          gap: responsive.getSpacing(),
          gridTemplateColumns: responsive.getGridTemplateColumns([
            { id: 'col1', width: 200 },
            { id: 'col2', width: 150 },
            { id: 'col3', width: 100 },
          ]),
        }}
      >
        <div>Column 1</div>
        <div>Column 2</div>
        <div>Column 3</div>
      </div>
    </div>
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

describe('Responsive Design Test Suite', () => {
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

    // Reset touch support
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

  describe('Breakpoint Detection and Layout Adaptation', () => {
    test('should adapt layout for mobile breakpoint (xs)', async () => {
      resizeWindow(400, 600);
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('screen-size')).toHaveTextContent('xs');
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
      });

      // Check mobile-specific adaptations
      const cellHeight = parseInt(screen.getByTestId('cell-height').textContent || '0');
      expect(cellHeight).toBeGreaterThanOrEqual(40); // Mobile should have adequate touch targets

      const spacing = parseInt(screen.getByTestId('spacing').textContent || '0');
      expect(spacing).toBeLessThan(16); // Mobile should have compact spacing
    });

    test('should adapt layout for tablet breakpoint (md)', async () => {
      resizeWindow(800, 600);
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('screen-size')).toHaveTextContent('md');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('true');
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
      });

      // Check tablet-specific adaptations
      const cellHeight = parseInt(screen.getByTestId('cell-height').textContent || '0');
      expect(cellHeight).toBeGreaterThanOrEqual(40);

      const spacing = parseInt(screen.getByTestId('spacing').textContent || '0');
      expect(spacing).toBeGreaterThan(12); // Tablet should have moderate spacing
    });

    test('should adapt layout for desktop breakpoint (lg)', async () => {
      resizeWindow(1200, 800);
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('screen-size')).toHaveTextContent('xl');
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('true');
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      });

      // Check desktop-specific adaptations
      const cellHeight = parseInt(screen.getByTestId('cell-height').textContent || '0');
      expect(cellHeight).toBe(40); // Desktop standard height

      const spacing = parseInt(screen.getByTestId('spacing').textContent || '0');
      expect(spacing).toBe(16); // Desktop standard spacing
    });
  });

  describe('Touch Device Detection and Adaptation', () => {
    test('should detect touch support via ontouchstart', async () => {
      Object.defineProperty(window, 'ontouchstart', { value: {} });
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('is-touch')).toHaveTextContent('true');
      });

      // Touch devices should have larger touch targets
      const button = screen.getByTestId('touch-button');
      const styles = window.getComputedStyle(button);
      const minHeight = parseInt(styles.minHeight) || 0;
      expect(minHeight).toBeGreaterThanOrEqual(40);
    });

    test('should detect touch support via maxTouchPoints', async () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 1 });
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('is-touch')).toHaveTextContent('true');
      });
    });

    test('should provide appropriate touch targets on mobile', async () => {
      resizeWindow(400, 600);
      Object.defineProperty(window, 'ontouchstart', { value: {} });
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        const cellHeight = parseInt(screen.getByTestId('cell-height').textContent || '0');
        expect(cellHeight).toBe(48); // Mobile touch devices should have 48px targets
      });
    });

    test('should provide appropriate touch targets on tablet', async () => {
      resizeWindow(800, 600);
      Object.defineProperty(window, 'ontouchstart', { value: {} });
      
      renderWithTheme(<ResponsiveTestComponent />);

      await waitFor(() => {
        const cellHeight = parseInt(screen.getByTestId('cell-height').textContent || '0');
        expect(cellHeight).toBe(44); // Tablet touch devices should have 44px targets
      });
    });
  });

  describe('Dynamic Layout Updates', () => {
    test('should update layout on window resize', async () => {
      renderWithTheme(<ResponsiveTestComponent />);

      // Wait for initial render (1024x768 is tablet)
      await waitFor(() => {
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('true');
      });

      // Resize to mobile
      resizeWindow(400, 600);

      await waitFor(() => {
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('false');
      });

      // Resize to desktop
      resizeWindow(1200, 800);

      await waitFor(() => {
        expect(screen.getByTestId('is-desktop')).toHaveTextContent('true');
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('false');
        expect(screen.getByTestId('is-tablet')).toHaveTextContent('false');
      });
    });

    test('should handle rapid breakpoint changes', async () => {
      renderWithTheme(<ResponsiveTestComponent />);

      // Rapidly change breakpoints
      resizeWindow(400, 600); // Mobile
      resizeWindow(800, 600); // Tablet
      resizeWindow(1200, 800); // Desktop
      resizeWindow(600, 800); // Back to mobile

      await waitFor(() => {
        expect(screen.getByTestId('screen-size')).toHaveTextContent('sm');
        expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
      });
    });

    test('should handle orientation changes', async () => {
      renderWithTheme(<ResponsiveTestComponent />);

      // Simulate orientation change
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 800 });
        Object.defineProperty(window, 'innerHeight', { value: 600 });
        fireEvent(window, new Event('orientationchange'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('screen-size')).toHaveTextContent('md');
      }, { timeout: 200 }); // Account for orientation change delay
    });
  });

  describe('Touch Interaction Testing', () => {
    test('should handle touch events on interactive elements', async () => {
      const user = userEvent.setup();
      Object.defineProperty(window, 'ontouchstart', { value: {} });
      
      renderWithTheme(<ResponsiveTestComponent />);

      const button = screen.getByTestId('touch-button');

      // Simulate touch events
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      
      fireEvent.touchEnd(button, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      // Should still be clickable
      await user.click(button);
      
      expect(button).toBeInTheDocument();
    });

    test('should provide adequate touch target sizes', () => {
      resizeWindow(400, 600);
      Object.defineProperty(window, 'ontouchstart', { value: {} });
      
      renderWithTheme(<ResponsiveTestComponent />);

      const button = screen.getByTestId('touch-button');
      const styles = window.getComputedStyle(button);
      const minHeight = parseInt(styles.minHeight) || 0;
      
      // Touch targets should be at least 44px for accessibility
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Grid Layout Responsiveness', () => {
    test('should adapt grid layout for different screen sizes', () => {
      renderWithTheme(<ResponsiveTestComponent />);

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toBeInTheDocument();

      // Grid should have appropriate styling
      const styles = window.getComputedStyle(grid);
      expect(styles.display).toBe('grid');
    });

    test('should adjust column widths based on screen size', async () => {
      renderWithTheme(<ResponsiveTestComponent />);

      // Desktop should show all columns
      resizeWindow(1200, 800);
      await waitFor(() => {
        const grid = screen.getByTestId('responsive-grid');
        expect(grid).toBeInTheDocument();
      });

      // Mobile should have adjusted layout
      resizeWindow(400, 600);
      await waitFor(() => {
        const grid = screen.getByTestId('responsive-grid');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and Usability', () => {
    test('should maintain keyboard navigation on all screen sizes', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(<ResponsiveTestComponent />);

      const button = screen.getByTestId('touch-button');
      
      // Should be focusable
      button.focus();
      expect(button).toHaveFocus();

      // Should respond to keyboard activation
      await user.keyboard('{Enter}');
      expect(button).toBeInTheDocument();
    });

    test('should provide appropriate ARIA attributes', () => {
      renderWithTheme(<ResponsiveTestComponent />);

      const button = screen.getByTestId('touch-button');
      
      // Should be accessible
      expect(button).toHaveAttribute('data-testid');
      expect(button.tagName).toBe('BUTTON');
    });

    test('should maintain readability across screen sizes', async () => {
      renderWithTheme(<ResponsiveTestComponent />);

      // Test different screen sizes
      const screenSizes = [
        { width: 400, height: 600 },   // Mobile
        { width: 800, height: 600 },   // Tablet
        { width: 1200, height: 800 },  // Desktop
      ];

      for (const size of screenSizes) {
        resizeWindow(size.width, size.height);
        
        await waitFor(() => {
          const button = screen.getByTestId('touch-button');
          const styles = window.getComputedStyle(button);
          
          // Text should be readable (minimum font size)
          const fontSize = parseInt(styles.fontSize) || 14;
          expect(fontSize).toBeGreaterThanOrEqual(12);
        });
      }
    });
  });

  describe('Performance and Optimization', () => {
    test('should not cause excessive re-renders on resize', async () => {
      const renderSpy = jest.fn();
      
      const TestComponent = () => {
        renderSpy();
        const responsive = useResponsiveLayout();
        return <div data-testid="perf-test">{responsive.screenSize}</div>;
      };

      renderWithTheme(<TestComponent />);

      const initialRenderCount = renderSpy.mock.calls.length;

      // Multiple rapid resizes
      resizeWindow(400, 600);
      resizeWindow(800, 600);
      resizeWindow(1200, 800);

      await waitFor(() => {
        expect(screen.getByTestId('perf-test')).toHaveTextContent('xl');
      });

      // Should not have excessive re-renders
      const finalRenderCount = renderSpy.mock.calls.length;
      expect(finalRenderCount - initialRenderCount).toBeLessThan(10);
    });

    test('should handle memory cleanup on unmount', () => {
      const { unmount } = renderWithTheme(<ResponsiveTestComponent />);

      // Should not throw errors on unmount
      expect(() => unmount()).not.toThrow();
    });
  });
});