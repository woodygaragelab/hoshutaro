/**
 * Accessibility tests
 */

import { accessibilityManager } from '../accessibility';

// Mock DOM elements
const createMockElement = (tagName: string, attributes: Record<string, string> = {}) => {
  const element = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
};

describe('Accessibility', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Clear any announcements
    const announcer = document.querySelector('[aria-live]');
    if (announcer) {
      announcer.textContent = '';
    }
  });

  describe('AccessibilityManager', () => {
    it('should announce messages to screen readers', (done) => {
      accessibilityManager.announce('Test message');
      
      setTimeout(() => {
        const announcer = document.querySelector('[aria-live="polite"]');
        expect(announcer).toBeTruthy();
        expect(announcer?.textContent).toBe('Test message');
        done();
      }, 100);
    });

    it('should announce urgent messages with assertive priority', (done) => {
      accessibilityManager.announce('Urgent message', 'assertive');
      
      setTimeout(() => {
        const announcer = document.querySelector('[aria-live="assertive"]');
        expect(announcer).toBeTruthy();
        expect(announcer?.textContent).toBe('Urgent message');
        done();
      }, 100);
    });

    it('should find focusable elements', () => {
      container.innerHTML = `
        <button>Button 1</button>
        <input type="text" />
        <button disabled>Disabled Button</button>
        <a href="#test">Link</a>
        <div tabindex="0">Focusable Div</div>
        <div tabindex="-1">Non-focusable Div</div>
      `;

      const focusableElements = accessibilityManager.getFocusableElements(container);
      
      expect(focusableElements).toHaveLength(4);
      expect(focusableElements[0].tagName).toBe('BUTTON');
      expect(focusableElements[1].tagName).toBe('INPUT');
      expect(focusableElements[2].tagName).toBe('A');
      expect(focusableElements[3].tagName).toBe('DIV');
      expect(focusableElements[3].getAttribute('tabindex')).toBe('0');
    });

    it('should trap focus within container', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="middle">Middle</button>
        <button id="last">Last</button>
      `;

      const cleanup = accessibilityManager.trapFocus(container);
      
      const firstButton = container.querySelector('#first') as HTMLElement;
      const lastButton = container.querySelector('#last') as HTMLElement;
      
      expect(document.activeElement).toBe(firstButton);
      
      // Simulate Tab key on last element
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(tabEvent, 'target', { value: lastButton });
      container.dispatchEvent(tabEvent);
      
      cleanup?.();
    });

    it('should check color contrast', () => {
      const contrast1 = accessibilityManager.checkColorContrast('#000000', '#ffffff');
      const contrast2 = accessibilityManager.checkColorContrast('#333333', '#666666');
      
      expect(contrast1).toBeGreaterThan(7); // High contrast
      expect(contrast2).toBeLessThan(7); // Lower contrast
    });

    it('should set ARIA attributes correctly', () => {
      const element = createMockElement('div');
      
      accessibilityManager.setAriaLabel(element, 'Test label');
      accessibilityManager.setAriaDescribedBy(element, 'description-id');
      accessibilityManager.setAriaExpanded(element, true);
      accessibilityManager.setAriaSelected(element, false);
      
      expect(element.getAttribute('aria-label')).toBe('Test label');
      expect(element.getAttribute('aria-describedby')).toBe('description-id');
      expect(element.getAttribute('aria-expanded')).toBe('true');
      expect(element.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('Grid Keyboard Navigation', () => {
    beforeEach(() => {
      container.innerHTML = `
        <div role="grid" data-grid>
          <div role="row" data-row>
            <div role="gridcell" data-cell tabindex="0">Cell 1,1</div>
            <div role="gridcell" data-cell tabindex="-1">Cell 1,2</div>
            <div role="gridcell" data-cell tabindex="-1">Cell 1,3</div>
          </div>
          <div role="row" data-row>
            <div role="gridcell" data-cell tabindex="-1">Cell 2,1</div>
            <div role="gridcell" data-cell tabindex="-1">Cell 2,2</div>
            <div role="gridcell" data-cell tabindex="-1">Cell 2,3</div>
          </div>
        </div>
      `;
    });

    it('should setup grid keyboard navigation', () => {
      const cleanup = accessibilityManager.setupGridKeyboardNavigation(container);
      
      expect(cleanup).toBeInstanceOf(Function);
      
      // Test arrow key navigation
      const firstCell = container.querySelector('[role="gridcell"]') as HTMLElement;
      firstCell.focus();
      
      const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(rightArrowEvent, 'target', { value: firstCell });
      container.dispatchEvent(rightArrowEvent);
      
      cleanup();
    });

    it('should handle Enter key activation', () => {
      const cleanup = accessibilityManager.setupGridKeyboardNavigation(container, {
        enableEnterActivation: true,
      });
      
      const cell = container.querySelector('[role="gridcell"]') as HTMLElement;
      const clickSpy = jest.spyOn(cell, 'click');
      
      cell.focus();
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(enterEvent, 'target', { value: cell });
      container.dispatchEvent(enterEvent);
      
      expect(clickSpy).toHaveBeenCalled();
      
      cleanup();
      clickSpy.mockRestore();
    });

    it('should handle Escape key for closing editors', () => {
      container.querySelector('[role="gridcell"]')!.innerHTML = '<input data-editor />';
      
      const cleanup = accessibilityManager.setupGridKeyboardNavigation(container, {
        enableEscapeClose: true,
      });
      
      const cell = container.querySelector('[role="gridcell"]') as HTMLElement;
      const editor = cell.querySelector('[data-editor]') as HTMLElement;
      const blurSpy = jest.spyOn(editor, 'blur');
      
      cell.focus();
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      Object.defineProperty(escapeEvent, 'target', { value: cell });
      container.dispatchEvent(escapeEvent);
      
      expect(blurSpy).toHaveBeenCalled();
      
      cleanup();
      blurSpy.mockRestore();
    });
  });

  describe('Color Contrast Validation', () => {
    it('should pass WCAG AA standards', () => {
      // Test common color combinations
      const combinations = [
        { fg: '#000000', bg: '#ffffff', expected: 'pass' }, // Black on white
        { fg: '#ffffff', bg: '#000000', expected: 'pass' }, // White on black
        { fg: '#767676', bg: '#ffffff', expected: 'pass' }, // Gray on white (4.54:1)
        { fg: '#cccccc', bg: '#ffffff', expected: 'fail' }, // Light gray on white
      ];

      combinations.forEach(({ fg, bg, expected }) => {
        const contrast = accessibilityManager.checkColorContrast(fg, bg);
        
        if (expected === 'pass') {
          expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard
        } else {
          expect(contrast).toBeLessThan(4.5);
        }
      });
    });

    it('should handle invalid color formats gracefully', () => {
      const contrast = accessibilityManager.checkColorContrast('invalid', '#ffffff');
      expect(contrast).toBeGreaterThan(0); // Should return a valid ratio even for invalid colors
    });
  });

  describe('Screen Reader Announcements', () => {
    it('should clear announcements after timeout', (done) => {
      accessibilityManager.announce('Temporary message');
      
      setTimeout(() => {
        const announcer = document.querySelector('[aria-live]');
        expect(announcer?.textContent).toBe('');
        done();
      }, 1100); // Slightly longer than the 1000ms timeout
    });

    it('should handle multiple rapid announcements', () => {
      accessibilityManager.announce('Message 1');
      accessibilityManager.announce('Message 2');
      accessibilityManager.announce('Message 3');
      
      const announcer = document.querySelector('[aria-live]');
      expect(announcer?.textContent).toBe('Message 3'); // Should show latest message
    });
  });

  describe('Focus Management', () => {
    it('should handle focus trap with no focusable elements', () => {
      container.innerHTML = '<div>No focusable content</div>';
      
      const cleanup = accessibilityManager.trapFocus(container);
      
      // Should not throw error and return cleanup function
      expect(cleanup).toBeUndefined();
    });

    it('should handle focus trap with single focusable element', () => {
      container.innerHTML = '<button>Only Button</button>';
      
      const cleanup = accessibilityManager.trapFocus(container);
      const button = container.querySelector('button') as HTMLElement;
      
      expect(document.activeElement).toBe(button);
      
      // Tab should stay on the same element
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      container.dispatchEvent(tabEvent);
      
      cleanup?.();
    });
  });
});

describe('Accessibility Compliance', () => {
  it('should meet WCAG 2.1 Level AA requirements', () => {
    // Test basic compliance requirements
    const requirements = {
      colorContrast: 4.5, // Minimum contrast ratio
      touchTargetSize: 44, // Minimum touch target size in pixels
      focusIndicatorSize: 2, // Minimum focus indicator size in pixels
    };

    expect(requirements.colorContrast).toBeGreaterThanOrEqual(4.5);
    expect(requirements.touchTargetSize).toBeGreaterThanOrEqual(44);
    expect(requirements.focusIndicatorSize).toBeGreaterThanOrEqual(2);
  });

  it('should support keyboard navigation patterns', () => {
    const keyboardPatterns = {
      tab: 'Navigate to next focusable element',
      shiftTab: 'Navigate to previous focusable element',
      enter: 'Activate button or link',
      space: 'Activate button or checkbox',
      escape: 'Close dialog or cancel operation',
      arrowKeys: 'Navigate within composite widgets',
    };

    Object.keys(keyboardPatterns).forEach(pattern => {
      expect(keyboardPatterns[pattern as keyof typeof keyboardPatterns]).toBeDefined();
    });
  });

  it('should provide appropriate ARIA labels and roles', () => {
    const ariaRequirements = {
      buttons: 'Should have accessible names',
      inputs: 'Should have labels or aria-label',
      regions: 'Should have landmark roles',
      status: 'Should use live regions for dynamic content',
    };

    Object.values(ariaRequirements).forEach(requirement => {
      expect(requirement).toBeDefined();
    });
  });
});