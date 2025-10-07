/**
 * Accessibility utilities and keyboard navigation helpers
 */

export interface KeyboardNavigationConfig {
  enableArrowKeys?: boolean;
  enableTabNavigation?: boolean;
  enableEnterActivation?: boolean;
  enableEscapeClose?: boolean;
  trapFocus?: boolean;
  announceChanges?: boolean;
}

export class AccessibilityManager {
  private announcer: HTMLElement | null = null;

  constructor() {
    this.createScreenReaderAnnouncer();
  }

  private createScreenReaderAnnouncer() {
    // Create a live region for screen reader announcements
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.style.position = 'absolute';
    this.announcer.style.left = '-10000px';
    this.announcer.style.width = '1px';
    this.announcer.style.height = '1px';
    this.announcer.style.overflow = 'hidden';
    document.body.appendChild(this.announcer);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.announcer) return;

    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = '';
      }
    }, 1000);
  }

  // Focus management utilities
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }

  trapFocus(container: HTMLElement) {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    firstElement.focus();

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  // Keyboard navigation for grids
  setupGridKeyboardNavigation(
    container: HTMLElement,
    config: KeyboardNavigationConfig = {}
  ) {
    const {
      enableArrowKeys = true,
      enableTabNavigation = true,
      enableEnterActivation = true,
      enableEscapeClose = false,
      announceChanges = true,
    } = config;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('[role="gridcell"], [data-cell]') as HTMLElement;
      
      if (!cell) return;

      const row = cell.closest('[role="row"], [data-row]') as HTMLElement;
      if (!row) return;

      const grid = container.querySelector('[role="grid"], [data-grid]') as HTMLElement;
      if (!grid) return;

      if (enableArrowKeys) {
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            this.navigateToNextCell(cell, 'right', announceChanges);
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.navigateToNextCell(cell, 'left', announceChanges);
            break;
          case 'ArrowDown':
            e.preventDefault();
            this.navigateToNextCell(cell, 'down', announceChanges);
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.navigateToNextCell(cell, 'up', announceChanges);
            break;
        }
      }

      if (enableTabNavigation && e.key === 'Tab') {
        // Let default tab behavior work, but announce changes
        if (announceChanges) {
          setTimeout(() => {
            const newCell = document.activeElement?.closest('[role="gridcell"], [data-cell]') as HTMLElement;
            if (newCell) {
              this.announceCellContent(newCell);
            }
          }, 0);
        }
      }

      if (enableEnterActivation && e.key === 'Enter') {
        e.preventDefault();
        const button = cell.querySelector('button');
        const input = cell.querySelector('input');
        
        if (button) {
          button.click();
        } else if (input) {
          input.focus();
        } else {
          // Trigger cell activation
          cell.click();
        }
      }

      if (enableEscapeClose && e.key === 'Escape') {
        // Close any open editors or dialogs
        const editor = cell.querySelector('[data-editor]') as HTMLElement;
        if (editor) {
          editor.blur();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  private navigateToNextCell(
    currentCell: HTMLElement,
    direction: 'up' | 'down' | 'left' | 'right',
    announce: boolean = true
  ) {
    const row = currentCell.closest('[role="row"], [data-row]') as HTMLElement;
    const grid = currentCell.closest('[role="grid"], [data-grid]') as HTMLElement;
    
    if (!row || !grid) return;

    let targetCell: HTMLElement | null = null;

    switch (direction) {
      case 'right':
        targetCell = currentCell.nextElementSibling as HTMLElement;
        break;
      case 'left':
        targetCell = currentCell.previousElementSibling as HTMLElement;
        break;
      case 'down': {
        const nextRow = row.nextElementSibling as HTMLElement;
        if (nextRow) {
          const cellIndex = Array.from(row.children).indexOf(currentCell);
          targetCell = nextRow.children[cellIndex] as HTMLElement;
        }
        break;
      }
      case 'up': {
        const prevRow = row.previousElementSibling as HTMLElement;
        if (prevRow) {
          const cellIndex = Array.from(row.children).indexOf(currentCell);
          targetCell = prevRow.children[cellIndex] as HTMLElement;
        }
        break;
      }
    }

    if (targetCell && (targetCell.matches('[role="gridcell"], [data-cell]'))) {
      const focusableElement = this.getFocusableElements(targetCell)[0] || targetCell;
      focusableElement.focus();
      
      if (announce) {
        this.announceCellContent(targetCell);
      }
    }
  }

  private announceCellContent(cell: HTMLElement) {
    const content = cell.textContent?.trim() || '';
    const columnHeader = this.getColumnHeader(cell);
    const rowHeader = this.getRowHeader(cell);
    
    let announcement = content;
    if (columnHeader) {
      announcement = `${columnHeader}, ${announcement}`;
    }
    if (rowHeader) {
      announcement = `${rowHeader}, ${announcement}`;
    }
    
    this.announce(announcement);
  }

  private getColumnHeader(cell: HTMLElement): string | null {
    const grid = cell.closest('[role="grid"], [data-grid]') as HTMLElement;
    if (!grid) return null;

    const row = cell.closest('[role="row"], [data-row]') as HTMLElement;
    if (!row) return null;

    const cellIndex = Array.from(row.children).indexOf(cell);
    const headerRow = grid.querySelector('[role="row"]:first-child, [data-header-row]') as HTMLElement;
    
    if (headerRow) {
      const headerCell = headerRow.children[cellIndex] as HTMLElement;
      return headerCell?.textContent?.trim() || null;
    }
    
    return null;
  }

  private getRowHeader(cell: HTMLElement): string | null {
    const row = cell.closest('[role="row"], [data-row]') as HTMLElement;
    if (!row) return null;

    const firstCell = row.children[0] as HTMLElement;
    return firstCell?.textContent?.trim() || null;
  }

  // Color contrast utilities
  checkColorContrast(foreground: string, background: string): number {
    const getLuminance = (color: string): number => {
      // Simple luminance calculation (would need more robust implementation for production)
      const rgb = this.hexToRgb(color);
      if (!rgb) return 0;

      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  private hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  // ARIA utilities
  setAriaLabel(element: HTMLElement, label: string) {
    element.setAttribute('aria-label', label);
  }

  setAriaDescribedBy(element: HTMLElement, describedById: string) {
    element.setAttribute('aria-describedby', describedById);
  }

  setAriaExpanded(element: HTMLElement, expanded: boolean) {
    element.setAttribute('aria-expanded', expanded.toString());
  }

  setAriaSelected(element: HTMLElement, selected: boolean) {
    element.setAttribute('aria-selected', selected.toString());
  }

  destroy() {
    if (this.announcer) {
      document.body.removeChild(this.announcer);
      this.announcer = null;
    }
  }
}

// Singleton instance
export const accessibilityManager = new AccessibilityManager();

// React hook for accessibility features
export const useAccessibility = () => {
  return {
    announce: accessibilityManager.announce.bind(accessibilityManager),
    trapFocus: accessibilityManager.trapFocus.bind(accessibilityManager),
    setupGridKeyboardNavigation: accessibilityManager.setupGridKeyboardNavigation.bind(accessibilityManager),
    checkColorContrast: accessibilityManager.checkColorContrast.bind(accessibilityManager),
    setAriaLabel: accessibilityManager.setAriaLabel.bind(accessibilityManager),
    setAriaDescribedBy: accessibilityManager.setAriaDescribedBy.bind(accessibilityManager),
    setAriaExpanded: accessibilityManager.setAriaExpanded.bind(accessibilityManager),
    setAriaSelected: accessibilityManager.setAriaSelected.bind(accessibilityManager),
  };
};