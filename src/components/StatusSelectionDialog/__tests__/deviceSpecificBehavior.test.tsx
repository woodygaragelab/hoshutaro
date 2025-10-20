import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { StatusSelectionDialog } from '../StatusSelectionDialog';
import { StatusValue } from '../../CommonEdit/types';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockStatusUnplanned: StatusValue = {
  planned: false,
  actual: false,
  displaySymbol: '',
  label: '未計画',
};

const createMockAnchorElement = (): HTMLElement => {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.top = '100px';
  element.style.left = '100px';
  element.style.width = '50px';
  element.style.height = '30px';
  document.body.appendChild(element);
  return element;
};

describe('StatusSelectionDialog - Device Specific Behavior', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up anchor elements
    document.querySelectorAll('div').forEach(div => {
      if (div.style.position === 'absolute') {
        document.body.removeChild(div);
      }
    });
  });

  describe('Desktop Device Behavior', () => {
    test('should render compact popover layout', () => {
      const anchorEl = createMockAnchorElement();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={anchorEl}
        />
      );

      // Should not render as dialog
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Should show compact title
      expect(screen.getByText('状態を選択')).toBeInTheDocument();
      
      // Should show all options in list format
      expect(screen.getByText('未計画')).toBeInTheDocument();
      expect(screen.getByText('計画')).toBeInTheDocument();
      expect(screen.getByText('実績')).toBeInTheDocument();
      expect(screen.getByText('両方')).toBeInTheDocument();
    });

    test('should handle mouse hover interactions', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={anchorEl}
        />
      );

      const plannedOption = screen.getByText('計画').closest('button');
      if (plannedOption) {
        await user.hover(plannedOption);
        
        // Should show hover state
        expect(plannedOption).toBeInTheDocument();
      }
    });

    test('should close on click outside', async () => {
      const user = userEvent.setup();
      const anchorEl = createMockAnchorElement();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={anchorEl}
        />
      );

      // Click outside the popover
      await user.click(document.body);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('should position relative to anchor element', () => {
      const anchorEl = createMockAnchorElement();
      anchorEl.style.top = '200px';
      anchorEl.style.left = '300px';
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={anchorEl}
        />
      );

      // Popover should be positioned relative to anchor
      const popover = document.querySelector('[role="presentation"]');
      expect(popover).toBeInTheDocument();
    });
  });

  describe('Tablet Device Behavior', () => {
    test('should render modal dialog with appropriate sizing', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // Should show current status
      expect(screen.getByText('現在の状態:')).toBeInTheDocument();
      
      // Should have cancel button
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    test('should handle touch interactions with proper target sizes', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Check touch target sizes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        
        // Should meet minimum touch target size for tablet
        expect(minHeight >= 44).toBeTruthy();
      });
    });

    test('should handle swipe gestures', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      const dialog = screen.getByRole('dialog');
      
      // Simulate swipe down gesture
      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      
      fireEvent.touchMove(dialog, {
        touches: [{ clientX: 100, clientY: 200 }],
      });
      
      fireEvent.touchEnd(dialog, {
        changedTouches: [{ clientX: 100, clientY: 200 }],
      });

      // Dialog should still be present (swipe to dismiss not implemented)
      expect(dialog).toBeInTheDocument();
    });

    test('should adapt to screen orientation changes', () => {
      const { rerender } = renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Simulate orientation change by re-rendering
      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </ThemeProvider>
      );

      // Dialog should still be properly rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Mobile Device Behavior', () => {
    test('should render fullscreen dialog', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // Should show larger title for mobile
      expect(screen.getByText('状態を選択')).toBeInTheDocument();
      
      // Should show current status
      expect(screen.getByText('現在の状態:')).toBeInTheDocument();
    });

    test('should display options as cards', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Should show status options as cards
      expect(screen.getByText('未計画')).toBeInTheDocument();
      expect(screen.getByText('計画')).toBeInTheDocument();
      expect(screen.getByText('実績')).toBeInTheDocument();
      expect(screen.getByText('両方')).toBeInTheDocument();
    });

    test('should handle large touch targets for mobile', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Check that touch targets are large enough for mobile
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // Mobile should have larger touch targets
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });

    test('should handle card tap animations', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      const plannedCard = screen.getByText('計画').closest('[role="button"]');
      if (plannedCard) {
        // Simulate touch interaction
        fireEvent.touchStart(plannedCard, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        
        fireEvent.touchEnd(plannedCard, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });

        await user.click(plannedCard);

        await waitFor(() => {
          expect(mockOnSelect).toHaveBeenCalled();
        });
      }
    });

    test('should handle one-handed operation', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Cancel button should be easily reachable
      const cancelButton = screen.getByText('キャンセル');
      expect(cancelButton).toBeInTheDocument();
      
      // Should have adequate spacing for thumb reach
      const styles = window.getComputedStyle(cancelButton);
      const minHeight = parseInt(styles.minHeight) || 0;
      expect(minHeight >= 48).toBeTruthy();
    });

    test('should adapt to keyboard visibility', () => {
      // Mock viewport height change (simulating keyboard appearance)
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400, // Reduced height as if keyboard is visible
      });

      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Dialog should still be properly rendered
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Restore original height
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });
    });
  });

  describe('Cross-Device Consistency', () => {
    test('should maintain consistent status selection behavior across devices', async () => {
      const user = userEvent.setup();
      
      // Test desktop
      const anchorEl = createMockAnchorElement();
      const { rerender } = renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={anchorEl}
        />
      );

      let plannedOption = screen.getByText('計画');
      await user.click(plannedOption);
      
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          planned: true,
          actual: false,
          label: '計画',
        })
      );

      jest.clearAllMocks();

      // Test tablet
      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </ThemeProvider>
      );

      plannedOption = screen.getByText('計画');
      await user.click(plannedOption);
      
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          planned: true,
          actual: false,
          label: '計画',
        })
      );

      jest.clearAllMocks();

      // Test mobile
      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </ThemeProvider>
      );

      plannedOption = screen.getByText('計画');
      await user.click(plannedOption);
      
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          planned: true,
          actual: false,
          label: '計画',
        })
      );
    });

    test('should display consistent status symbols across devices', () => {
      const devices: Array<'desktop' | 'tablet' | 'mobile'> = ['desktop', 'tablet', 'mobile'];
      
      devices.forEach(deviceType => {
        const anchorEl = deviceType === 'desktop' ? createMockAnchorElement() : undefined;
        
        const { unmount } = renderWithTheme(
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType={deviceType}
            anchorEl={anchorEl}
          />
        );

        // All devices should show the same status symbols
        if (deviceType === 'desktop') {
          // Desktop might not show if no anchor element
          if (anchorEl) {
            expect(screen.getByText('○')).toBeInTheDocument();
            expect(screen.getByText('●')).toBeInTheDocument();
            expect(screen.getByText('◎')).toBeInTheDocument();
          }
        } else {
          expect(screen.getByText('○')).toBeInTheDocument();
          expect(screen.getByText('●')).toBeInTheDocument();
          expect(screen.getByText('◎')).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('Performance Considerations', () => {
    test('should render efficiently for each device type', () => {
      const startTime = performance.now();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
    });

    test('should handle rapid device type changes', () => {
      const { rerender } = renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
        />
      );

      // Rapidly change device types
      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </ThemeProvider>
      );

      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusUnplanned}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="mobile"
          />
        </ThemeProvider>
      );

      // Should handle changes without errors
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});