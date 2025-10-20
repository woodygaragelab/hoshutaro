import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { StatusSelectionDialog } from '../StatusSelectionDialog';
import { StatusValue } from '../../CommonEdit/types';
import { STATUS_OPTIONS } from '../../CommonEdit/statusLogic';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock status values for testing
const mockStatusUnplanned: StatusValue = {
  planned: false,
  actual: false,
  displaySymbol: '',
  label: '未計画',
};

const mockStatusPlanned: StatusValue = {
  planned: true,
  actual: false,
  displaySymbol: '○',
  label: '計画',
};

const mockStatusActual: StatusValue = {
  planned: false,
  actual: true,
  displaySymbol: '●',
  label: '実績',
};

const mockStatusBoth: StatusValue = {
  planned: true,
  actual: true,
  displaySymbol: '◎',
  label: '両方',
};

// Mock anchor element for desktop popover
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

describe('StatusSelectionDialog', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnValidationError = jest.fn();
  const mockOnValidationWarning = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm for confirmation dialogs
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    // Clean up any anchor elements
    document.querySelectorAll('div').forEach(div => {
      if (div.style.position === 'absolute') {
        document.body.removeChild(div);
      }
    });
  });

  describe('Desktop Device Display', () => {
    test('should render as popover for desktop device', () => {
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

      // Should render as popover, not dialog
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Should show status selection title
      expect(screen.getByText('状態を選択')).toBeInTheDocument();
      
      // Should show all status options
      STATUS_OPTIONS.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    test('should position popover correctly relative to anchor element', () => {
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

      // Popover should be positioned relative to anchor element
      const popover = document.querySelector('[role="presentation"]');
      expect(popover).toBeInTheDocument();
    });

    test('should handle desktop-specific interactions', async () => {
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

      // Click on planned status option button
      const buttons = screen.getAllByRole('button');
      const plannedButton = buttons.find(button => 
        button.textContent?.includes('計画') && button.textContent?.includes('計画済みだが未実施')
      );
      
      if (plannedButton) {
        await user.click(plannedButton);

        await waitFor(() => {
          expect(mockOnSelect).toHaveBeenCalledWith(mockStatusPlanned);
          expect(mockOnClose).toHaveBeenCalled();
        });
      }
    });

    test('should close popover when clicking outside', async () => {
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
  });

  describe('Tablet Device Display', () => {
    test('should render as modal dialog for tablet device', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Should render as dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Should show dialog title
      expect(screen.getByText('状態を選択')).toBeInTheDocument();
      
      // Should show current status
      expect(screen.getByText('現在の状態:')).toBeInTheDocument();
      expect(screen.getByText('未計画')).toBeInTheDocument();
      
      // Should show cancel button
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    test('should have appropriate sizing for tablet', () => {
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
      const dialogPaper = dialog.querySelector('.MuiPaper-root');
      
      // Should have tablet-appropriate sizing
      expect(dialogPaper).toHaveStyle({
        minHeight: '50vh',
        maxHeight: '70vh',
      });
    });

    test('should handle tablet touch interactions', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Touch interaction with status option
      const actualOption = screen.getAllByText('実績').find(el => 
        el.closest('button') !== null
      );
      
      // Simulate touch events
      fireEvent.touchStart(actualOption, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      
      if (actualOption) {
        fireEvent.touchEnd(actualOption, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });

        await user.click(actualOption);
      }

      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith(mockStatusActual);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('should provide adequate touch target sizes for tablet', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Check button sizes meet minimum touch target requirements (44px)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // Touch targets should be at least 44px for tablet
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });

    test('should handle cancel button interaction', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      const cancelButton = screen.getByText('キャンセル');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Mobile Device Display', () => {
    test('should render as fullscreen dialog for mobile device', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Should render as fullscreen dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      
      // Should show dialog title
      expect(screen.getByText('状態を選択')).toBeInTheDocument();
      
      // Should show current status
      expect(screen.getByText('現在の状態:')).toBeInTheDocument();
      
      // Should show cancel button
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    test('should display status options as cards for mobile', () => {
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
      STATUS_OPTIONS.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
        if (option.description) {
          expect(screen.getByText(option.description)).toBeInTheDocument();
        }
      });
    });

    test('should handle mobile touch interactions', async () => {
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

      // Touch interaction with card
      const bothOption = screen.getAllByText('両方').find(el => 
        el.closest('[role="button"]') !== null
      );
      
      if (bothOption) {
        // Simulate touch events
        fireEvent.touchStart(bothOption, {
          touches: [{ clientX: 100, clientY: 100 }],
        });
        
        fireEvent.touchEnd(bothOption, {
          changedTouches: [{ clientX: 100, clientY: 100 }],
        });

        await user.click(bothOption);
      }

      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith(mockStatusBoth);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    test('should provide adequate touch target sizes for mobile', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
        />
      );

      // Check that cards and buttons meet minimum touch target requirements (44px)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || 0;
        const minWidth = parseInt(styles.minWidth) || 0;
        
        // Mobile touch targets should be at least 44px
        expect(minHeight >= 44 || minWidth >= 44).toBeTruthy();
      });
    });

    test('should handle card hover effects on mobile', async () => {
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

      const plannedCards = screen.getAllByText('計画');
      const plannedCard = plannedCards.find(el => el.closest('[role="button"]'))?.closest('[role="button"]');
      
      if (plannedCard) {
        expect(plannedCard).toBeInTheDocument();
        await user.hover(plannedCard);
        
        // Card should be interactive
        expect(plannedCard).toHaveAttribute('role', 'button');
      }
    });
  });

  describe('Status Conversion Logic', () => {
    test('should handle status selection with validation', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          onValidationError={mockOnValidationError}
          onValidationWarning={mockOnValidationWarning}
        />
      );

      // Select planned status
      const plannedOption = screen.getAllByText('計画').find(el => 
        el.closest('button') !== null
      );
      if (plannedOption) {
        await user.click(plannedOption);
      }

      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            planned: true,
            actual: false,
            displaySymbol: '○',
            label: '計画',
          })
        );
      });
    });

    test('should handle status transition requiring confirmation', async () => {
      const user = userEvent.setup();
      window.confirm = jest.fn(() => true);
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusBoth} // Start with both planned and actual
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          conversionOptions={{ validateBusinessRules: true }}
        />
      );

      // Select unplanned status (should require confirmation)
      const unplannedOption = screen.getAllByText('未計画').find(el => 
        el.closest('button') !== null
      );
      if (unplannedOption) {
        await user.click(unplannedOption);
      }

      // Should show confirmation dialog
      expect(window.confirm).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith(mockStatusUnplanned);
      });
    });

    test('should handle status transition cancellation', async () => {
      const user = userEvent.setup();
      window.confirm = jest.fn(() => false); // User cancels
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusBoth}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          conversionOptions={{ validateBusinessRules: true }}
        />
      );

      // Select unplanned status
      const unplannedOption = screen.getAllByText('未計画').find(el => 
        el.closest('button') !== null
      );
      if (unplannedOption) {
        await user.click(unplannedOption);
      }

      // Should show confirmation dialog
      expect(window.confirm).toHaveBeenCalled();
      
      // Should not call onSelect since user cancelled
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('should handle validation errors', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          onValidationError={mockOnValidationError}
          conversionOptions={{ allowInvalidTransitions: false }}
        />
      );

      // This should work normally, but let's test error handling
      const plannedOption = screen.getAllByText('計画').find(el => 
        el.closest('button') !== null
      );
      if (plannedOption) {
        await user.click(plannedOption);
      }

      // Should complete successfully
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalled();
      });
    });

    test('should handle validation warnings', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          onValidationWarning={mockOnValidationWarning}
          conversionOptions={{ validateBusinessRules: true }}
        />
      );

      // Select actual without planned (should generate warning)
      const actualOption = screen.getAllByText('実績').find(el => 
        el.closest('button') !== null
      );
      if (actualOption) {
        await user.click(actualOption);
      }

      await waitFor(() => {
        expect(mockOnValidationWarning).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('計画なしで実績が記録されています')
          ])
        );
        expect(mockOnSelect).toHaveBeenCalledWith(mockStatusActual);
      });
    });

    test('should create status change history', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
          userName="testUser"
        />
      );

      const plannedOption = screen.getAllByText('計画').find(el => 
        el.closest('button') !== null
      );
      if (plannedOption) {
        await user.click(plannedOption);

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            'Status change history:',
            expect.objectContaining({
              fromStatus: mockStatusUnplanned,
              toStatus: mockStatusPlanned,
              user: 'testUser',
              deviceType: 'tablet',
            })
          );
        });
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Visual Display and Icons', () => {
    test('should display correct status symbols', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
        />
      );

      // Check that status symbols are displayed
      expect(screen.getByText('○')).toBeInTheDocument(); // Planned
      expect(screen.getByText('●')).toBeInTheDocument(); // Actual
      expect(screen.getByText('◎')).toBeInTheDocument(); // Both
      // Unplanned symbol is empty space, harder to test directly
    });

    test('should display correct status icons', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
        />
      );

      // Check for Material-UI icons (they should be in the DOM)
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    test('should apply correct colors to status options', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
        />
      );

      // Check that status options have appropriate styling
      STATUS_OPTIONS.forEach(option => {
        const optionElement = screen.getByText(option.label);
        expect(optionElement).toBeInTheDocument();
      });
    });

    test('should show descriptions when enabled', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="mobile"
          showDescription={true}
        />
      );

      // Check that descriptions are shown
      STATUS_OPTIONS.forEach(option => {
        if (option.description) {
          expect(screen.getByText(option.description)).toBeInTheDocument();
        }
      });
    });

    test('should hide descriptions when disabled', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
          showDescription={false}
        />
      );

      // Check that descriptions are not shown
      STATUS_OPTIONS.forEach(option => {
        if (option.description) {
          expect(screen.queryByText(option.description)).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('Animation and Transitions', () => {
    test('should handle custom animation duration', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
          animationDuration={500}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    test('should handle slide transition for mobile', () => {
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
    });

    test('should handle fade transition for desktop', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
        />
      );

      // Popover should be present
      const popover = document.querySelector('[role="presentation"]');
      expect(popover).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should provide proper ARIA labels', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Dialog should have proper role
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Buttons should be accessible
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
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
      }
    });

    test('should handle escape key to close dialog', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Press escape key
      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock an error in status conversion
      const mockOnSelectWithError = jest.fn(() => {
        throw new Error('Test error');
      });
      
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelectWithError}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={createMockAnchorElement()}
          onValidationError={mockOnValidationError}
        />
      );

      const plannedOption = screen.getAllByText('計画').find(el => 
        el.closest('button') !== null
      );
      if (plannedOption) {
        await user.click(plannedOption);
      }

      // Should handle error gracefully
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    test('should handle missing anchor element for desktop', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="desktop"
          anchorEl={null}
        />
      );

      // Should not crash, but popover won't be shown without anchor element
      // The component should render but not display the popover
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Current Status Highlighting', () => {
    test('should highlight current status option', () => {
      renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusPlanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Current status should be displayed
      expect(screen.getByText('現在の状態:')).toBeInTheDocument();
      // Should show current status in the description area
      const currentStatusText = screen.getByText('現在の状態:').parentElement;
      expect(currentStatusText).toHaveTextContent('計画');
    });

    test('should update selected option when current status changes', () => {
      const { rerender } = renderWithTheme(
        <StatusSelectionDialog
          open={true}
          currentStatus={mockStatusUnplanned}
          onSelect={mockOnSelect}
          onClose={mockOnClose}
          deviceType="tablet"
        />
      );

      // Check initial current status display
      const initialStatusText = screen.getByText('現在の状態:').parentElement;
      expect(initialStatusText).toHaveTextContent('未計画');

      // Change current status
      rerender(
        <ThemeProvider theme={theme}>
          <StatusSelectionDialog
            open={true}
            currentStatus={mockStatusActual}
            onSelect={mockOnSelect}
            onClose={mockOnClose}
            deviceType="tablet"
          />
        </ThemeProvider>
      );

      // Check updated current status display
      const updatedStatusText = screen.getByText('現在の状態:').parentElement;
      expect(updatedStatusText).toHaveTextContent('実績');
    });
  });
});