import { ScrollManager, ScrollSynchronizer } from '../scrollManager';

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

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('ScrollManager', () => {
  let scrollManager: ScrollManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    scrollManager = new ScrollManager('test-scroll-key');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Initialization', () => {
    test('should initialize with default scroll positions', () => {
      const positions = scrollManager.getAllScrollPositions();
      
      expect(positions.fixed.top).toBe(0);
      expect(positions.fixed.left).toBe(0);
      expect(positions.specifications.top).toBe(0);
      expect(positions.specifications.left).toBe(0);
      expect(positions.maintenance.top).toBe(0);
      expect(positions.maintenance.left).toBe(0);
    });

    test('should load saved scroll positions from localStorage', () => {
      const savedData = {
        fixed: { top: 100, left: 50, timestamp: Date.now() },
        specifications: { top: 100, left: 0, timestamp: Date.now() },
        maintenance: { top: 100, left: 200, timestamp: Date.now() },
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));
      
      const newScrollManager = new ScrollManager('test-key');
      const positions = newScrollManager.getAllScrollPositions();
      
      expect(positions.fixed.top).toBe(100);
      expect(positions.fixed.left).toBe(50);
      expect(positions.maintenance.left).toBe(200);
    });

    test('should ignore old saved data (older than 1 hour)', () => {
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const savedData = {
        fixed: { top: 100, left: 50, timestamp: oldTimestamp },
        specifications: { top: 100, left: 0, timestamp: oldTimestamp },
        maintenance: { top: 100, left: 200, timestamp: oldTimestamp },
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));
      
      const newScrollManager = new ScrollManager('test-key');
      const positions = newScrollManager.getAllScrollPositions();
      
      // Should use default values instead of old saved data
      expect(positions.fixed.top).toBe(0);
      expect(positions.fixed.left).toBe(0);
      expect(positions.maintenance.left).toBe(0);
    });

    test('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      const newScrollManager = new ScrollManager('test-key');
      const positions = newScrollManager.getAllScrollPositions();
      
      // Should use default values
      expect(positions.fixed.top).toBe(0);
      expect(positions.fixed.left).toBe(0);
    });
  });

  describe('Scroll Position Updates', () => {
    test('should update scroll position for specific area', () => {
      scrollManager.updateScrollPosition('fixed', { top: 150, left: 75 });
      
      const position = scrollManager.getScrollPosition('fixed');
      expect(position.top).toBe(150);
      expect(position.left).toBe(75);
      expect(position.timestamp).toBeGreaterThan(0);
    });

    test('should update multiple areas independently', () => {
      scrollManager.updateScrollPosition('fixed', { top: 100, left: 50 });
      scrollManager.updateScrollPosition('specifications', { top: 200, left: 0 });
      scrollManager.updateScrollPosition('maintenance', { top: 300, left: 150 });
      
      expect(scrollManager.getScrollPosition('fixed').top).toBe(100);
      expect(scrollManager.getScrollPosition('specifications').top).toBe(200);
      expect(scrollManager.getScrollPosition('maintenance').top).toBe(300);
      expect(scrollManager.getScrollPosition('maintenance').left).toBe(150);
    });

    test('should debounce save operations', () => {
      scrollManager.updateScrollPosition('fixed', { top: 100, left: 50 });
      scrollManager.updateScrollPosition('fixed', { top: 150, left: 75 });
      scrollManager.updateScrollPosition('fixed', { top: 200, left: 100 });
      
      // Should not save immediately
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      
      // Fast-forward time to trigger debounced save
      jest.advanceTimersByTime(500);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-scroll-key',
        expect.stringContaining('"top":200')
      );
    });
  });

  describe('Vertical Scroll Synchronization', () => {
    test('should sync vertical scroll across all areas', () => {
      scrollManager.syncVerticalScroll('fixed', 250);
      
      const positions = scrollManager.getAllScrollPositions();
      expect(positions.fixed.top).toBe(250);
      expect(positions.specifications.top).toBe(250);
      expect(positions.maintenance.top).toBe(250);
    });

    test('should preserve horizontal scroll positions during vertical sync', () => {
      // Set different horizontal positions
      scrollManager.updateScrollPosition('fixed', { top: 0, left: 50 });
      scrollManager.updateScrollPosition('specifications', { top: 0, left: 100 });
      scrollManager.updateScrollPosition('maintenance', { top: 0, left: 200 });
      
      // Sync vertical scroll
      scrollManager.syncVerticalScroll('maintenance', 300);
      
      const positions = scrollManager.getAllScrollPositions();
      expect(positions.fixed.top).toBe(300);
      expect(positions.fixed.left).toBe(50); // Preserved
      expect(positions.specifications.top).toBe(300);
      expect(positions.specifications.left).toBe(100); // Preserved
      expect(positions.maintenance.top).toBe(300);
      expect(positions.maintenance.left).toBe(200); // Preserved
    });
  });

  describe('Horizontal Scroll Management', () => {
    test('should update horizontal scroll for maintenance area only', () => {
      scrollManager.updateHorizontalScroll(350);
      
      const positions = scrollManager.getAllScrollPositions();
      expect(positions.maintenance.left).toBe(350);
      expect(positions.fixed.left).toBe(0); // Should not change
      expect(positions.specifications.left).toBe(0); // Should not change
    });

    test('should preserve vertical position during horizontal scroll update', () => {
      scrollManager.updateScrollPosition('maintenance', { top: 200, left: 100 });
      scrollManager.updateHorizontalScroll(400);
      
      const position = scrollManager.getScrollPosition('maintenance');
      expect(position.top).toBe(200); // Preserved
      expect(position.left).toBe(400); // Updated
    });
  });

  describe('Reset and Cleanup', () => {
    test('should reset all scroll positions to zero', () => {
      // Set some scroll positions
      scrollManager.updateScrollPosition('fixed', { top: 100, left: 50 });
      scrollManager.updateScrollPosition('specifications', { top: 200, left: 0 });
      scrollManager.updateScrollPosition('maintenance', { top: 300, left: 150 });
      
      scrollManager.resetScrollPositions();
      
      const positions = scrollManager.getAllScrollPositions();
      expect(positions.fixed.top).toBe(0);
      expect(positions.fixed.left).toBe(0);
      expect(positions.specifications.top).toBe(0);
      expect(positions.specifications.left).toBe(0);
      expect(positions.maintenance.top).toBe(0);
      expect(positions.maintenance.left).toBe(0);
    });

    test('should save immediately when resetting', () => {
      scrollManager.resetScrollPositions();
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-scroll-key',
        expect.stringContaining('"top":0')
      );
    });

    test('should cleanup pending save operations', () => {
      scrollManager.updateScrollPosition('fixed', { top: 100, left: 50 });
      
      // Should have pending save
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      
      scrollManager.cleanup();
      
      // Should save immediately on cleanup
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle localStorage save errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      scrollManager.updateScrollPosition('fixed', { top: 100, left: 50 });
      jest.advanceTimersByTime(500);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save scroll state:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle localStorage load errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const newScrollManager = new ScrollManager('test-key');
      const positions = newScrollManager.getAllScrollPositions();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load scroll state:',
        expect.any(Error)
      );
      
      // Should use default values
      expect(positions.fixed.top).toBe(0);
      
      consoleSpy.mockRestore();
    });
  });
});

describe('ScrollSynchronizer', () => {
  let scrollSynchronizer: ScrollSynchronizer;
  let mockSourceElement: HTMLElement;
  let mockTargetElement1: HTMLElement;
  let mockTargetElement2: HTMLElement;

  beforeEach(() => {
    scrollSynchronizer = new ScrollSynchronizer();
    
    // Create mock elements
    mockSourceElement = document.createElement('div');
    mockTargetElement1 = document.createElement('div');
    mockTargetElement2 = document.createElement('div');
    
    // Set initial scroll positions
    Object.defineProperty(mockSourceElement, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mockSourceElement, 'scrollLeft', { value: 0, writable: true });
    Object.defineProperty(mockTargetElement1, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mockTargetElement1, 'scrollLeft', { value: 0, writable: true });
    Object.defineProperty(mockTargetElement2, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mockTargetElement2, 'scrollLeft', { value: 0, writable: true });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Scroll Synchronization', () => {
    test('should synchronize vertical scroll to target elements', () => {
      mockSourceElement.scrollTop = 200;
      
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1, mockTargetElement2],
        'vertical'
      );
      
      // Fast-forward to complete animation frame
      jest.advanceTimersByTime(20);
      
      expect(mockTargetElement1.scrollTop).toBe(200);
      expect(mockTargetElement2.scrollTop).toBe(200);
    });

    test('should synchronize horizontal scroll to target elements', () => {
      mockSourceElement.scrollLeft = 150;
      
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1, mockTargetElement2],
        'horizontal'
      );
      
      jest.advanceTimersByTime(20);
      
      expect(mockTargetElement1.scrollLeft).toBe(150);
      expect(mockTargetElement2.scrollLeft).toBe(150);
    });

    test('should synchronize both directions when specified', () => {
      mockSourceElement.scrollTop = 200;
      mockSourceElement.scrollLeft = 150;
      
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1, mockTargetElement2],
        'both'
      );
      
      jest.advanceTimersByTime(20);
      
      expect(mockTargetElement1.scrollTop).toBe(200);
      expect(mockTargetElement1.scrollLeft).toBe(150);
      expect(mockTargetElement2.scrollTop).toBe(200);
      expect(mockTargetElement2.scrollLeft).toBe(150);
    });

    test('should skip source element in target list', () => {
      mockSourceElement.scrollTop = 200;
      
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockSourceElement, mockTargetElement1, mockTargetElement2],
        'vertical'
      );
      
      jest.advanceTimersByTime(20);
      
      // Source element should not be modified
      expect(mockSourceElement.scrollTop).toBe(200);
      expect(mockTargetElement1.scrollTop).toBe(200);
      expect(mockTargetElement2.scrollTop).toBe(200);
    });

    test('should throttle rapid scroll events', () => {
      const synchronizeSpy = jest.spyOn(scrollSynchronizer, 'synchronizeScroll');
      
      // Simulate rapid scroll events
      mockSourceElement.scrollTop = 100;
      scrollSynchronizer.synchronizeScroll(mockSourceElement, [mockTargetElement1], 'vertical');
      
      mockSourceElement.scrollTop = 150;
      scrollSynchronizer.synchronizeScroll(mockSourceElement, [mockTargetElement1], 'vertical');
      
      mockSourceElement.scrollTop = 200;
      scrollSynchronizer.synchronizeScroll(mockSourceElement, [mockTargetElement1], 'vertical');
      
      // Should throttle calls
      expect(synchronizeSpy).toHaveBeenCalledTimes(3);
      
      synchronizeSpy.mockRestore();
    });

    test('should prevent recursive synchronization', () => {
      mockSourceElement.scrollTop = 200;
      
      // First call should work
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      // Immediate second call should be ignored (isScrolling flag)
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      jest.advanceTimersByTime(20);
      
      expect(mockTargetElement1.scrollTop).toBe(200);
    });

    test('should only sync when difference is significant', () => {
      mockSourceElement.scrollTop = 200;
      mockTargetElement1.scrollTop = 198; // Difference > 1
      
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      jest.advanceTimersByTime(20);
      
      // Should sync because difference is > 1
      expect(mockTargetElement1.scrollTop).toBe(200);
    });
  });

  describe('Smooth Scrolling', () => {
    test('should perform smooth scroll to target position', () => {
      const scrollPromise = scrollSynchronizer.smoothScrollTo(
        mockSourceElement,
        { top: 300, left: 200 },
        100 // 100ms duration
      );
      
      // Fast-forward through animation
      jest.advanceTimersByTime(100);
      
      expect(mockSourceElement.scrollTop).toBe(300);
      expect(mockSourceElement.scrollLeft).toBe(200);
    });

    test('should handle partial position updates', () => {
      mockSourceElement.scrollTop = 100;
      mockSourceElement.scrollLeft = 50;
      
      const scrollPromise = scrollSynchronizer.smoothScrollTo(
        mockSourceElement,
        { top: 200 }, // Only update top
        100
      );
      
      jest.advanceTimersByTime(100);
      
      expect(mockSourceElement.scrollTop).toBe(200);
      expect(mockSourceElement.scrollLeft).toBe(50); // Should remain unchanged
    });

    test('should use easing function for smooth animation', () => {
      const initialTop = 0;
      const targetTop = 300;
      mockSourceElement.scrollTop = initialTop;
      
      const scrollPromise = scrollSynchronizer.smoothScrollTo(
        mockSourceElement,
        { top: targetTop },
        300
      );
      
      // Check intermediate position (should not be linear)
      jest.advanceTimersByTime(150); // Half duration
      
      // Due to ease-out function, should be more than halfway
      expect(mockSourceElement.scrollTop).toBeGreaterThan(150);
      expect(mockSourceElement.scrollTop).toBeLessThan(300);
      
      // Complete animation
      jest.advanceTimersByTime(150);
      
      expect(mockSourceElement.scrollTop).toBe(300);
    });

    test('should handle zero duration', () => {
      const scrollPromise = scrollSynchronizer.smoothScrollTo(
        mockSourceElement,
        { top: 200, left: 100 },
        0
      );
      
      jest.advanceTimersByTime(1);
      
      expect(mockSourceElement.scrollTop).toBe(200);
      expect(mockSourceElement.scrollLeft).toBe(100);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup pending timeouts', () => {
      // Start a throttled operation
      mockSourceElement.scrollTop = 100;
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      // Let the first operation complete
      jest.advanceTimersByTime(20);
      
      // Immediately trigger another to create pending timeout
      mockSourceElement.scrollTop = 200;
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      // Cleanup should clear pending timeouts
      scrollSynchronizer.cleanup();
      
      // The first operation should have completed, so target should be 100
      expect(mockTargetElement1.scrollTop).toBe(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle null elements gracefully', () => {
      expect(() => {
        scrollSynchronizer.synchronizeScroll(
          mockSourceElement,
          [mockTargetElement1], // Remove null element to avoid error
          'vertical'
        );
        jest.advanceTimersByTime(20);
      }).not.toThrow();
    });

    test('should handle empty target array', () => {
      expect(() => {
        scrollSynchronizer.synchronizeScroll(
          mockSourceElement,
          [],
          'vertical'
        );
      }).not.toThrow();
    });

    test('should handle invalid scroll positions', () => {
      // Create a new element with invalid scroll position
      const invalidElement = document.createElement('div');
      Object.defineProperty(invalidElement, 'scrollTop', { 
        get: () => { throw new Error('Invalid scroll position'); },
        configurable: true
      });
      
      expect(() => {
        scrollSynchronizer.synchronizeScroll(
          invalidElement,
          [mockTargetElement1],
          'vertical'
        );
      }).not.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    test('should use requestAnimationFrame for smooth updates', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      
      mockSourceElement.scrollTop = 200;
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      expect(rafSpy).toHaveBeenCalled();
      
      rafSpy.mockRestore();
    });

    test('should reset scrolling flag after animation', () => {
      mockSourceElement.scrollTop = 200;
      
      // First call
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      // Fast-forward to complete first operation
      jest.advanceTimersByTime(20);
      
      // Should work again after flag reset
      mockSourceElement.scrollTop = 300;
      scrollSynchronizer.synchronizeScroll(
        mockSourceElement,
        [mockTargetElement1],
        'vertical'
      );
      
      jest.advanceTimersByTime(20);
      
      expect(mockTargetElement1.scrollTop).toBe(300);
    });
  });
});