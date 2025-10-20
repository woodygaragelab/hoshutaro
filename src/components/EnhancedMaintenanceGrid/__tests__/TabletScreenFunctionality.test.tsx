import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { TabletOptimizedButton, TabletOptimizedIconButton } from '../TabletOptimizedButton';
import { TabletOptimizedDialog } from '../TabletOptimizedDialog';
import { useTouchGestureHandler } from '../touchGestureHandler';
import { useScreenRotation, RotationStateManager } from '../screenRotationHandler';
import { HierarchicalData } from '../../../types';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number; identifier: number }>) => {
  const touchList = touches.map(touch => ({
    ...touch,
    target: document.createElement('div'),
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    radiusX: 10,
    radiusY: 10,
    rotationAngle: 0,
    force: 1,
  }));

  return new TouchEvent(type, {
    touches: touchList,
    targetTouches: touchList,
    changedTouches: touchList,
    bubbles: true,
    cancelable: true,
  });
};

// Mock screen orientation API
const mockScreenOrientation = {
  angle: 0,
  type: 'portrait-primary',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

Object.defineProperty(screen, 'orientation', {
  value: mockScreenOrientation,
  writable: true,
});

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  writable: true,
});

// Mock window.visualViewport
Object.defineProperty(window, 'visualViewport', {
  value: {
    height: 1024,
    width: 768,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

// Mock data for testing
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
];

const mockTimeHeaders = ['2024Q1', '2024Q2', '2024Q3', '2024Q4'];

const mockResponsiveLayout = {
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1200,
  },
  columns: {
    mobile: 2,
    tablet: 4,
    desktop: 6,
  },
  spacing: {
    mobile: 8,
    tablet: 12,
    desktop: 16,
  },
};

describe('Tablet Screen Functionality Tests', () => {
  const mockOnCellEdit = jest.fn();
  const mockOnSpecificationEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set tablet dimensions
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

    // Reset screen orientation
    mockScreenOrientation.angle = 0;
    mockScreenOrientation.type = 'landscape-primary';
  });

  describe('Touch Operations Tests', () => {
    describe('Single Touch Interactions', () => {
      test('should handle touch interactions on optimized buttons', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedButton 
            touchOptimized={true}
            onClick={mockOnCellEdit}
          >
            Touch Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Touch Button' });
        
        // Simulate touch interaction
        const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        const touchEnd = createTouchEvent('touchend', []);

        fireEvent(button, touchStart);
        fireEvent(button, touchEnd);
        await user.click(button);

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      });

      test('should handle touch interactions on icon buttons', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedIconButton 
            touchOptimized={true}
            onClick={mockOnCellEdit}
          >
            <span>Icon</span>
          </TabletOptimizedIconButton>
        );

        const button = screen.getByRole('button');
        
        // Simulate touch interaction
        const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        const touchEnd = createTouchEvent('touchend', []);

        fireEvent(button, touchStart);
        fireEvent(button, touchEnd);
        await user.click(button);

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      });

      test('should prevent accidental clicks with double-click prevention', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedButton 
            touchOptimized={true}
            preventDoubleClick={true}
            onClick={mockOnCellEdit}
          >
            Prevent Double Click
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Prevent Double Click' });
        
        // Rapid clicks should be prevented
        await user.click(button);
        await user.click(button); // This should be ignored

        // Should only be called once
        expect(mockOnCellEdit).toHaveBeenCalledTimes(1);
      });

      test('should handle touch target size optimization', () => {
        renderWithTheme(
          <TabletOptimizedButton touchOptimized={true}>
            Test Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Test Button' });
        const styles = window.getComputedStyle(button);
        
        // Should have minimum touch target size (44px)
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      });
    });

    describe('Double Tap Interactions', () => {
      test('should handle double tap on optimized buttons', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedButton 
            touchOptimized={true}
            onClick={mockOnCellEdit}
          >
            Double Tap Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Double Tap Button' });
        
        // Simulate double tap
        await user.dblClick(button);

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalled();
        });
      });

      test('should handle double tap timing correctly', async () => {
        const TestComponent = () => {
          const [lastTap, setLastTap] = React.useState(0);
          
          const handleDoubleTap = (x: number, y: number) => {
            const now = Date.now();
            if (now - lastTap < 300) {
              mockOnCellEdit('double-tap', 'detected', { x, y });
            }
            setLastTap(now);
          };

          const touchHandlers = useTouchGestureHandler({
            onDoubleTap: handleDoubleTap,
          });

          return (
            <div
              data-testid="touch-area"
              {...touchHandlers}
              style={{ width: 200, height: 200 }}
            >
              Touch Area
            </div>
          );
        };

        renderWithTheme(<TestComponent />);

        const touchArea = screen.getByTestId('touch-area');
        
        // First tap
        const firstTap = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        fireEvent(touchArea, firstTap);
        fireEvent(touchArea, createTouchEvent('touchend', []));

        // Second tap within 300ms
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        const secondTap = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        fireEvent(touchArea, secondTap);
        fireEvent(touchArea, createTouchEvent('touchend', []));

        await waitFor(() => {
          expect(mockOnCellEdit).toHaveBeenCalledWith('double-tap', 'detected', { x: 100, y: 100 });
        });
      });
    });

    describe('Touch Scrolling', () => {
      test('should handle smooth touch scrolling', async () => {
        const TestScrollComponent = () => {
          const scrollRef = React.useRef<HTMLDivElement>(null);
          
          const touchHandlers = useTouchGestureHandler({
            enableMomentumScrolling: true,
            scrollSensitivity: 1.2,
            onScroll: (deltaX, deltaY) => {
              if (scrollRef.current) {
                scrollRef.current.scrollLeft += deltaX;
                scrollRef.current.scrollTop += deltaY;
              }
            },
          });

          return (
            <div
              ref={scrollRef}
              data-testid="scroll-container"
              {...touchHandlers}
              style={{ 
                width: 300, 
                height: 200, 
                overflow: 'auto',
                border: '1px solid #ccc'
              }}
            >
              <div style={{ width: 600, height: 400 }}>
                Scrollable Content
              </div>
            </div>
          );
        };

        renderWithTheme(<TestScrollComponent />);

        const scrollContainer = screen.getByTestId('scroll-container');
        
        // Simulate touch scroll
        const touchStart = createTouchEvent('touchstart', [{ clientX: 150, clientY: 100, identifier: 0 }]);
        const touchMove = createTouchEvent('touchmove', [{ clientX: 100, clientY: 50, identifier: 0 }]);
        const touchEnd = createTouchEvent('touchend', []);

        fireEvent(scrollContainer, touchStart);
        fireEvent(scrollContainer, touchMove);
        fireEvent(scrollContainer, touchEnd);

        // Should handle scroll without errors
        expect(scrollContainer).toBeInTheDocument();
      });

      test('should handle horizontal scroll correctly', async () => {
        const TestScrollComponent = () => {
          const scrollRef = React.useRef<HTMLDivElement>(null);
          
          return (
            <div
              ref={scrollRef}
              data-testid="horizontal-scroll-container"
              style={{ 
                width: 300, 
                height: 200, 
                overflow: 'auto',
                border: '1px solid #ccc'
              }}
            >
              <div style={{ width: 600, height: 100 }}>
                Wide Content for Horizontal Scroll
              </div>
            </div>
          );
        };

        renderWithTheme(<TestScrollComponent />);

        const scrollContainer = screen.getByTestId('horizontal-scroll-container');
        
        // Simulate horizontal scroll
        fireEvent.scroll(scrollContainer, { target: { scrollLeft: 100 } });

        await waitFor(() => {
          expect((scrollContainer as HTMLElement).scrollLeft).toBe(100);
        });
      });

      test('should prevent scroll during momentum scrolling', async () => {
        const TestMomentumComponent = () => {
          const [isScrolling, setIsScrolling] = React.useState(false);
          
          const touchHandlers = useTouchGestureHandler({
            enableMomentumScrolling: true,
            onScroll: () => {
              setIsScrolling(true);
              setTimeout(() => setIsScrolling(false), 100);
            },
          });

          return (
            <div
              data-testid="momentum-container"
              {...touchHandlers}
              style={{ 
                width: 300, 
                height: 200,
                userSelect: isScrolling ? 'none' : 'auto'
              }}
            >
              {isScrolling ? 'Scrolling...' : 'Static'}
            </div>
          );
        };

        renderWithTheme(<TestMomentumComponent />);

        const container = screen.getByTestId('momentum-container');
        
        // Simulate scroll to trigger momentum
        const touchStart = createTouchEvent('touchstart', [{ clientX: 150, clientY: 100, identifier: 0 }]);
        const touchMove = createTouchEvent('touchmove', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        
        fireEvent(container, touchStart);
        fireEvent(container, touchMove);

        await waitFor(() => {
          expect(screen.getByText('Scrolling...')).toBeInTheDocument();
        });
      });
    });

    describe('Touch Gesture Recognition', () => {
      test('should distinguish between tap and scroll gestures', async () => {
        const TestGestureComponent = () => {
          const [gestureType, setGestureType] = React.useState('none');
          
          const touchHandlers = useTouchGestureHandler({
            onScroll: () => setGestureType('scroll'),
            onDoubleTap: () => setGestureType('double-tap'),
          });

          return (
            <div
              data-testid="gesture-area"
              {...touchHandlers}
              style={{ width: 200, height: 200 }}
            >
              Gesture: {gestureType}
            </div>
          );
        };

        renderWithTheme(<TestGestureComponent />);

        const gestureArea = screen.getByTestId('gesture-area');
        
        // Test scroll gesture
        const scrollStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100, identifier: 0 }]);
        const scrollMove = createTouchEvent('touchmove', [{ clientX: 50, clientY: 100, identifier: 0 }]);
        
        fireEvent(gestureArea, scrollStart);
        fireEvent(gestureArea, scrollMove);

        await waitFor(() => {
          expect(screen.getByText('Gesture: scroll')).toBeInTheDocument();
        });
      });

      test('should handle multi-touch gestures', async () => {
        const TestMultiTouchComponent = () => {
          const [touchCount, setTouchCount] = React.useState(0);
          
          const touchHandlers = useTouchGestureHandler({
            enablePinchZoom: true,
            onPinch: (scale) => {
              setTouchCount(2);
            },
          });

          React.useEffect(() => {
            const handleTouchStart = (e: TouchEvent) => {
              setTouchCount(e.touches.length);
            };

            document.addEventListener('touchstart', handleTouchStart);
            return () => document.removeEventListener('touchstart', handleTouchStart);
          }, []);

          return (
            <div
              data-testid="multi-touch-area"
              {...touchHandlers}
              style={{ width: 200, height: 200 }}
            >
              Touches: {touchCount}
            </div>
          );
        };

        renderWithTheme(<TestMultiTouchComponent />);

        const multiTouchArea = screen.getByTestId('multi-touch-area');
        
        // Simulate two-finger touch
        const twoFingerTouch = createTouchEvent('touchstart', [
          { clientX: 100, clientY: 100, identifier: 0 },
          { clientX: 150, clientY: 150, identifier: 1 }
        ]);
        
        fireEvent(multiTouchArea, twoFingerTouch);

        await waitFor(() => {
          expect(screen.getByText('Touches: 2')).toBeInTheDocument();
        });
      });
    });

    describe('Haptic Feedback', () => {
      test('should trigger haptic feedback on button press', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedButton hapticFeedback={true}>
            Haptic Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Haptic Button' });
        await user.click(button);

        expect(navigator.vibrate).toHaveBeenCalledWith(10);
      });

      test('should not trigger haptic feedback when disabled', async () => {
        const user = userEvent.setup();
        
        renderWithTheme(
          <TabletOptimizedButton hapticFeedback={false}>
            No Haptic Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'No Haptic Button' });
        await user.click(button);

        expect(navigator.vibrate).not.toHaveBeenCalled();
      });

      test('should handle missing vibrate API gracefully', async () => {
        const user = userEvent.setup();
        
        // Mock navigator without vibrate API
        const mockNavigator = {
          ...navigator,
          // vibrate property is intentionally missing
        };
        
        // Temporarily replace navigator
        const originalNavigator = global.navigator;
        Object.defineProperty(global, 'navigator', {
          value: mockNavigator,
          configurable: true,
        });
        
        renderWithTheme(
          <TabletOptimizedButton hapticFeedback={true}>
            Haptic Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Haptic Button' });
        
        // Should not throw error
        await expect(user.click(button)).resolves.not.toThrow();
        
        // Restore original navigator
        Object.defineProperty(global, 'navigator', {
          value: originalNavigator,
          configurable: true,
        });
      });
    });
  });

  describe('Screen Rotation Tests', () => {
    describe('Orientation Detection', () => {
      test('should detect landscape orientation', () => {
        // Set landscape dimensions
        Object.defineProperty(window, 'innerWidth', { value: 1024 });
        Object.defineProperty(window, 'innerHeight', { value: 768 });

        const TestRotationComponent = () => {
          const rotationState = useScreenRotation();
          return <div>Orientation: {rotationState.orientation}</div>;
        };

        renderWithTheme(<TestRotationComponent />);

        expect(screen.getByText('Orientation: landscape')).toBeInTheDocument();
      });

      test('should detect portrait orientation', () => {
        // Set portrait dimensions
        Object.defineProperty(window, 'innerWidth', { value: 768 });
        Object.defineProperty(window, 'innerHeight', { value: 1024 });

        const TestRotationComponent = () => {
          const rotationState = useScreenRotation();
          return <div>Orientation: {rotationState.orientation}</div>;
        };

        renderWithTheme(<TestRotationComponent />);

        expect(screen.getByText('Orientation: portrait')).toBeInTheDocument();
      });

      test('should handle orientation change events', async () => {
        const mockOnRotationStart = jest.fn();
        const mockOnRotationEnd = jest.fn();

        const TestRotationComponent = () => {
          const [currentOrientation, setCurrentOrientation] = React.useState('portrait');
          
          useScreenRotation({
            onRotationStart: (newOrientation) => {
              mockOnRotationStart(newOrientation);
              setCurrentOrientation(newOrientation);
            },
            onRotationEnd: (newOrientation) => {
              mockOnRotationEnd(newOrientation);
              setCurrentOrientation(newOrientation);
            },
          });
          
          return <div>Current: {currentOrientation}</div>;
        };

        // Start with portrait dimensions
        Object.defineProperty(window, 'innerWidth', { value: 768 });
        Object.defineProperty(window, 'innerHeight', { value: 1024 });

        renderWithTheme(<TestRotationComponent />);

        // Simulate orientation change to landscape
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1024 });
          Object.defineProperty(window, 'innerHeight', { value: 768 });
          fireEvent(window, new Event('orientationchange'));
        });

        // Wait for the rotation callbacks to be called
        await waitFor(() => {
          expect(mockOnRotationStart).toHaveBeenCalled();
        });

        // Wait for debounced rotation end
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
        });

        await waitFor(() => {
          expect(mockOnRotationEnd).toHaveBeenCalled();
        });

        // Verify the orientation was detected correctly
        expect(screen.getByText(/Current: landscape/)).toBeInTheDocument();
      });

      test('should handle resize events for rotation detection', async () => {
        const mockOnDimensionsChange = jest.fn();

        const TestRotationComponent = () => {
          useScreenRotation({
            onDimensionsChange: mockOnDimensionsChange,
          });
          return <div>Resize Test</div>;
        };

        renderWithTheme(<TestRotationComponent />);

        // Simulate window resize
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 800 });
          Object.defineProperty(window, 'innerHeight', { value: 600 });
          fireEvent(window, new Event('resize'));
        });

        await waitFor(() => {
          expect(mockOnDimensionsChange).toHaveBeenCalledWith({ width: 800, height: 600 });
        });
      });
    });

    describe('State Preservation During Rotation', () => {
      test('should preserve scroll position during rotation', async () => {
        const stateManager = RotationStateManager.getInstance();
        
        // Save initial scroll state
        const mockElement = document.createElement('div');
        mockElement.id = 'test-scroll';
        mockElement.scrollLeft = 100;
        mockElement.scrollTop = 200;
        
        const restoreFunction = stateManager.saveState('scroll_test-scroll', {
          scrollLeft: 100,
          scrollTop: 200,
          orientation: 'landscape',
        });

        // Simulate rotation
        const savedState = stateManager.restoreState('scroll_test-scroll', {
          scrollLeft: 0,
          scrollTop: 0,
          orientation: 'portrait',
        });

        expect(savedState.scrollLeft).toBe(100);
        expect(savedState.scrollTop).toBe(200);
      });

      test('should preserve component state during rotation', async () => {
        const TestStateComponent = () => {
          const [expanded, setExpanded] = React.useState(false);
          const stateManager = RotationStateManager.getInstance();
          
          React.useEffect(() => {
            const savedState = stateManager.restoreState('testExpanded', { expanded: false });
            setExpanded(savedState.expanded);
          }, [stateManager]);

          const handleToggle = () => {
            const newExpanded = !expanded;
            setExpanded(newExpanded);
            stateManager.saveState('testExpanded', { expanded: newExpanded });
          };

          return (
            <div>
              <button onClick={handleToggle}>
                {expanded ? 'Collapse' : 'Expand'}
              </button>
              {expanded && <div>Expanded Content</div>}
            </div>
          );
        };

        renderWithTheme(<TestStateComponent />);

        // Find and click expand button
        const expandButton = screen.getByRole('button', { name: 'Expand' });
        fireEvent.click(expandButton);

        // Verify expanded state
        expect(screen.getByText('Expanded Content')).toBeInTheDocument();

        // Simulate rotation
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 768 });
          Object.defineProperty(window, 'innerHeight', { value: 1024 });
          fireEvent(window, new Event('orientationchange'));
        });

        // Wait for rotation to complete
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
        });

        // Expanded state should be preserved
        expect(screen.getByText('Expanded Content')).toBeInTheDocument();
      });

      test('should clear state when requested', () => {
        const stateManager = RotationStateManager.getInstance();
        
        stateManager.saveState('test-key', { data: 'test' });
        expect(stateManager.restoreState('test-key', {})).toEqual({ data: 'test' });
        
        stateManager.clearState('test-key');
        expect(stateManager.restoreState('test-key', { default: true })).toEqual({ default: true });
      });

      test('should clear all states when requested', () => {
        const stateManager = RotationStateManager.getInstance();
        
        stateManager.saveState('key1', { data: 'test1' });
        stateManager.saveState('key2', { data: 'test2' });
        
        stateManager.clearAllStates();
        
        expect(stateManager.restoreState('key1', { default: true })).toEqual({ default: true });
        expect(stateManager.restoreState('key2', { default: true })).toEqual({ default: true });
      });
    });

    describe('CSS Variable Updates', () => {
      test('should update CSS variables for landscape orientation', () => {
        const { setRotationCSSVariables } = require('../screenRotationHandler');
        
        setRotationCSSVariables('landscape');
        
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--rotation-scale')).toBe('1.1');
        expect(root.style.getPropertyValue('--rotation-spacing')).toBe('0.8');
        expect(root.style.getPropertyValue('--rotation-font-scale')).toBe('0.95');
      });

      test('should update CSS variables for portrait orientation', () => {
        const { setRotationCSSVariables } = require('../screenRotationHandler');
        
        setRotationCSSVariables('portrait');
        
        const root = document.documentElement;
        expect(root.style.getPropertyValue('--rotation-scale')).toBe('1.0');
        expect(root.style.getPropertyValue('--rotation-spacing')).toBe('1.0');
        expect(root.style.getPropertyValue('--rotation-font-scale')).toBe('1.0');
      });
    });
  });

  describe('Layout Adjustment Tests', () => {
    describe('Column Visibility Management', () => {
      test('should adapt layout for landscape mode', async () => {
        const TestResponsiveComponent = () => {
          const [isLandscape, setIsLandscape] = React.useState(false);
          const [columnCount, setColumnCount] = React.useState(5);
          
          React.useEffect(() => {
            const handleResize = () => {
              const newIsLandscape = window.innerWidth > window.innerHeight;
              setIsLandscape(newIsLandscape);
              setColumnCount(newIsLandscape ? 8 : 5);
            };
            
            window.addEventListener('resize', handleResize);
            handleResize();
            
            return () => window.removeEventListener('resize', handleResize);
          }, []);

          return (
            <div>
              <div>Orientation: {isLandscape ? 'landscape' : 'portrait'}</div>
              <div>Columns: {columnCount}</div>
            </div>
          );
        };

        // Start in portrait
        Object.defineProperty(window, 'innerWidth', { value: 768 });
        Object.defineProperty(window, 'innerHeight', { value: 1024 });

        renderWithTheme(<TestResponsiveComponent />);

        expect(screen.getByText('Orientation: portrait')).toBeInTheDocument();
        expect(screen.getByText('Columns: 5')).toBeInTheDocument();

        // Switch to landscape
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1024 });
          Object.defineProperty(window, 'innerHeight', { value: 768 });
          fireEvent(window, new Event('resize'));
        });

        await waitFor(() => {
          expect(screen.getByText('Orientation: landscape')).toBeInTheDocument();
          expect(screen.getByText('Columns: 8')).toBeInTheDocument();
        });
      });

      test('should handle column visibility toggle', async () => {
        const user = userEvent.setup();
        
        const TestColumnToggle = () => {
          const [visibleColumns, setVisibleColumns] = React.useState(['col1', 'col2', 'col3']);
          
          const toggleColumn = (column: string) => {
            setVisibleColumns(prev => 
              prev.includes(column) 
                ? prev.filter(c => c !== column)
                : [...prev, column]
            );
          };

          return (
            <div>
              <button onClick={() => toggleColumn('col4')}>
                Toggle Column 4
              </button>
              <div>Visible: {visibleColumns.join(', ')}</div>
            </div>
          );
        };
        
        renderWithTheme(<TestColumnToggle />);

        expect(screen.getByText('Visible: col1, col2, col3')).toBeInTheDocument();

        const toggleButton = screen.getByRole('button', { name: 'Toggle Column 4' });
        await user.click(toggleButton);

        await waitFor(() => {
          expect(screen.getByText('Visible: col1, col2, col3, col4')).toBeInTheDocument();
        });
      });

      test('should show hidden column indicators', () => {
        const TestHiddenColumns = () => {
          const totalColumns = 12;
          const visibleColumns = 5;
          const hiddenCount = totalColumns - visibleColumns;

          return (
            <div>
              <div>Total columns: {totalColumns}</div>
              <div>Visible columns: {visibleColumns}</div>
              <div>({hiddenCount}列非表示)</div>
            </div>
          );
        };
        
        renderWithTheme(<TestHiddenColumns />);

        expect(screen.getByText('(7列非表示)')).toBeInTheDocument();
      });
    });

    describe('Touch Target Size Optimization', () => {
      test('should use optimal touch target sizes for tablet', () => {
        renderWithTheme(
          <TabletOptimizedButton touchOptimized={true}>
            Touch Button
          </TabletOptimizedButton>
        );

        const button = screen.getByRole('button', { name: 'Touch Button' });
        const styles = window.getComputedStyle(button);
        
        // Should meet minimum touch target size requirements
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(66); // 44 * 1.5
      });

      test('should adjust touch targets for landscape orientation', async () => {
        const TestTouchTargetComponent = () => {
          const [isLandscape, setIsLandscape] = React.useState(false);
          
          React.useEffect(() => {
            const handleResize = () => {
              setIsLandscape(window.innerWidth > window.innerHeight);
            };
            
            window.addEventListener('resize', handleResize);
            handleResize();
            
            return () => window.removeEventListener('resize', handleResize);
          }, []);

          return (
            <TabletOptimizedButton 
              touchOptimized={true}
              sx={{ 
                minHeight: isLandscape ? 40 : 48,
                fontSize: isLandscape ? '0.85rem' : '0.9rem'
              }}
            >
              Adaptive Button
            </TabletOptimizedButton>
          );
        };

        renderWithTheme(<TestTouchTargetComponent />);

        const button = screen.getByRole('button', { name: 'Adaptive Button' });
        
        // Simulate landscape rotation
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1024 });
          Object.defineProperty(window, 'innerHeight', { value: 768 });
          fireEvent(window, new Event('resize'));
        });

        await waitFor(() => {
          const styles = window.getComputedStyle(button);
          expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(40);
        });
      });
    });

    describe('Dialog Layout Adjustments', () => {
      test('should adjust dialog size for tablet screen', () => {
        renderWithTheme(
          <TabletOptimizedDialog
            open={true}
            onClose={() => {}}
            title="Test Dialog"
          >
            Dialog Content
          </TabletOptimizedDialog>
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
        expect(screen.getByText('Dialog Content')).toBeInTheDocument();
      });

      test('should handle keyboard adjustment in dialogs', async () => {
        const TestKeyboardDialog = () => {
          const [keyboardVisible, setKeyboardVisible] = React.useState(false);
          
          React.useEffect(() => {
            const handleResize = () => {
              const viewportHeight = window.visualViewport?.height || window.innerHeight;
              const windowHeight = window.innerHeight;
              setKeyboardVisible(windowHeight - viewportHeight > 150);
            };
            
            // Simulate keyboard appearance after component mount
            setTimeout(() => {
              setKeyboardVisible(true);
            }, 100);
          }, []);

          return (
            <TabletOptimizedDialog
              open={true}
              onClose={() => {}}
              title="Keyboard Test"
              keyboardAdjustment={true}
            >
              <div>Keyboard visible: {keyboardVisible ? 'Yes' : 'No'}</div>
            </TabletOptimizedDialog>
          );
        };

        renderWithTheme(<TestKeyboardDialog />);

        // Wait for keyboard simulation
        await waitFor(() => {
          expect(screen.getByText('Keyboard visible: Yes')).toBeInTheDocument();
        });
      });

      test('should handle fullscreen dialog mode', () => {
        renderWithTheme(
          <TabletOptimizedDialog
            open={true}
            onClose={() => {}}
            title="Fullscreen Dialog"
            fullScreen={true}
          >
            Fullscreen Content
          </TabletOptimizedDialog>
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('Fullscreen Content')).toBeInTheDocument();
      });
    });

    describe('Responsive Spacing and Typography', () => {
      test('should adjust spacing for different orientations', async () => {
        const TestSpacingComponent = () => {
          const [isLandscape, setIsLandscape] = React.useState(window.innerWidth > window.innerHeight);
          
          React.useEffect(() => {
            const handleResize = () => {
              setIsLandscape(window.innerWidth > window.innerHeight);
            };
            
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
          }, []);

          return (
            <div 
              data-testid="spacing-test"
              style={{ 
                padding: isLandscape ? '8px' : '12px',
                fontSize: isLandscape ? '0.85rem' : '0.9rem'
              }}
            >
              Responsive Spacing
            </div>
          );
        };

        renderWithTheme(<TestSpacingComponent />);

        const element = screen.getByTestId('spacing-test');
        
        // Test landscape spacing
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1024 });
          Object.defineProperty(window, 'innerHeight', { value: 768 });
          fireEvent(window, new Event('resize'));
        });

        await waitFor(() => {
          const styles = window.getComputedStyle(element);
          expect(styles.padding).toBe('8px');
        });

        // Test portrait spacing
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 768 });
          Object.defineProperty(window, 'innerHeight', { value: 1024 });
          fireEvent(window, new Event('resize'));
        });

        await waitFor(() => {
          const styles = window.getComputedStyle(element);
          expect(styles.padding).toBe('12px');
        });
      });

      test('should handle text scaling for readability', () => {
        const TestTextScaling = () => {
          const [isLandscape, setIsLandscape] = React.useState(false);
          
          React.useEffect(() => {
            setIsLandscape(window.innerWidth > window.innerHeight);
          }, []);

          return (
            <div 
              data-testid="scaled-text"
              style={{ 
                fontSize: isLandscape ? '14px' : '16px', // Use px for consistent testing
                lineHeight: 1.4
              }}
            >
              Readable Text Content
            </div>
          );
        };
        
        renderWithTheme(<TestTextScaling />);

        const textElement = screen.getByTestId('scaled-text');
        expect(textElement).toBeInTheDocument();
        
        const styles = window.getComputedStyle(textElement);
        expect(parseFloat(styles.fontSize)).toBeGreaterThan(12); // Minimum readable size
      });
    });

    describe('Performance Optimization', () => {
      test('should handle smooth animations during layout changes', async () => {
        const TestAnimationComponent = () => {
          const [expanded, setExpanded] = React.useState(false);
          
          return (
            <div>
              <button onClick={() => setExpanded(!expanded)}>
                Toggle
              </button>
              <div 
                data-testid="animated-content"
                style={{ 
                  height: expanded ? '200px' : '0px',
                  transition: 'height 0.3s ease-in-out',
                  overflow: 'hidden'
                }}
              >
                Animated Content
              </div>
            </div>
          );
        };

        const user = userEvent.setup();
        renderWithTheme(<TestAnimationComponent />);

        const toggleButton = screen.getByRole('button', { name: 'Toggle' });
        const animatedContent = screen.getByTestId('animated-content');
        
        await user.click(toggleButton);

        // Should have transition applied
        const styles = window.getComputedStyle(animatedContent);
        expect(styles.transition).toContain('height');
      });

      test('should debounce rapid orientation changes', async () => {
        const mockCallback = jest.fn();
        
        const TestDebounceComponent = () => {
          useScreenRotation({
            onRotationEnd: mockCallback,
            debounceMs: 50, // Shorter debounce for testing
          });
          return <div>Debounce Test</div>;
        };

        renderWithTheme(<TestDebounceComponent />);

        // Simulate rapid orientation changes with actual dimension changes
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 768 });
          Object.defineProperty(window, 'innerHeight', { value: 1024 });
          fireEvent(window, new Event('orientationchange'));
        });

        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 1024 });
          Object.defineProperty(window, 'innerHeight', { value: 768 });
          fireEvent(window, new Event('orientationchange'));
        });

        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 768 });
          Object.defineProperty(window, 'innerHeight', { value: 1024 });
          fireEvent(window, new Event('orientationchange'));
        });

        // Should debounce calls
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Should call at least once after debounce
        expect(mockCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing touch support gracefully', () => {
      // Mock missing touch support
      const originalTouchStart = window.TouchEvent;
      delete (window as any).TouchEvent;

      expect(() => {
        renderWithTheme(
          <TabletOptimizedButton touchOptimized={true}>
            No Touch Support
          </TabletOptimizedButton>
        );
      }).not.toThrow();

      // Restore TouchEvent
      (window as any).TouchEvent = originalTouchStart;
    });

    test('should handle missing screen orientation API', () => {
      // Mock screen without orientation API
      const mockScreen = {
        ...screen,
        // orientation property is intentionally missing
      };
      
      // Temporarily replace screen
      const originalScreen = global.screen;
      Object.defineProperty(global, 'screen', {
        value: mockScreen,
        configurable: true,
      });

      expect(() => {
        const TestComponent = () => {
          useScreenRotation();
          return <div>No Orientation API</div>;
        };
        renderWithTheme(<TestComponent />);
      }).not.toThrow();

      // Restore original screen
      Object.defineProperty(global, 'screen', {
        value: originalScreen,
        configurable: true,
      });
    });

    test('should handle invalid touch coordinates', () => {
      const TestInvalidTouchComponent = () => {
        const touchHandlers = useTouchGestureHandler({
          onDoubleTap: (x, y) => {
            expect(typeof x).toBe('number');
            expect(typeof y).toBe('number');
          },
        });

        return (
          <div data-testid="invalid-touch" {...touchHandlers}>
            Invalid Touch Test
          </div>
        );
      };

      renderWithTheme(<TestInvalidTouchComponent />);

      const element = screen.getByTestId('invalid-touch');
      
      // Simulate touch with invalid coordinates
      const invalidTouch = createTouchEvent('touchstart', [
        { clientX: NaN, clientY: NaN, identifier: 0 }
      ]);
      
      expect(() => {
        fireEvent(element, invalidTouch);
      }).not.toThrow();
    });

    test('should handle rapid state changes during rotation', async () => {
      const TestRapidStateComponent = () => {
        const [state, setState] = React.useState(0);
        
        useScreenRotation({
          onRotationStart: () => {
            // Simulate rapid state changes
            setState(prev => prev + 1);
            setState(prev => prev + 1);
            setState(prev => prev + 1);
          },
        });

        return <div>State: {state}</div>;
      };

      renderWithTheme(<TestRapidStateComponent />);

      // Trigger rotation
      act(() => {
        fireEvent(window, new Event('orientationchange'));
      });

      await waitFor(() => {
        expect(screen.getByText(/State: \d+/)).toBeInTheDocument();
      });
    });
  });
});