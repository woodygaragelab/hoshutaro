import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ResponsiveGridState, 
  ResponsiveLayout, 
  ResponsiveBreakpoints,
  GridPerformanceMetrics,
  ResponsiveGridEvent,
  ResponsiveGridEventHandlers
} from './types';
import { DeviceDetection, EditContext } from '../CommonEdit/types';
import { detectDevice, setupDeviceChangeListener } from '../CommonEdit/deviceDetection';

/**
 * ResponsiveGridManager用のカスタムフック
 * デバイス検出、レイアウト管理、パフォーマンス監視を統合
 */
export const useResponsiveGridManager = (
  customBreakpoints?: ResponsiveBreakpoints,
  forceLayout?: 'desktop' | 'tablet' | 'mobile',
  eventHandlers?: ResponsiveGridEventHandlers
) => {
  // State management
  const [gridState, setGridState] = useState<ResponsiveGridState>({
    currentLayout: 'desktop',
    editingCell: null,
    editDialog: {
      type: null,
      open: false,
      data: null,
    },
    touchCapabilities: {
      hasTouch: false,
      hasHover: true,
      hasPointerEvents: false,
      maxTouchPoints: 0,
    },
    deviceDetection: {
      type: 'desktop',
      screenSize: { width: 1920, height: 1080 },
      orientation: 'landscape',
      touchCapabilities: {
        hasTouch: false,
        hasHover: true,
        hasPointerEvents: false,
        maxTouchPoints: 0,
      },
      userAgent: navigator.userAgent,
    },
  });

  // Performance metrics tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<GridPerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    touchResponseTime: 0,
    scrollPerformance: 0,
    dataProcessingTime: 0,
    virtualScrollingEfficiency: 0,
  });

  // Event emission helper
  const emitEvent = useCallback((event: ResponsiveGridEvent, data?: any) => {
    switch (event) {
      case 'deviceChange':
        eventHandlers?.onDeviceChange?.(data);
        break;
      case 'orientationChange':
        eventHandlers?.onOrientationChange?.(data);
        break;
      case 'layoutSwitch':
        eventHandlers?.onLayoutSwitch?.(data);
        break;
      case 'editStart':
        eventHandlers?.onEditStart?.(data);
        break;
      case 'editEnd':
        eventHandlers?.onEditEnd?.(data.context, data.success);
        break;
      case 'touchGesture':
        eventHandlers?.onTouchGesture?.(data.gesture, data.data);
        break;
      case 'keyboardNavigation':
        eventHandlers?.onKeyboardNavigation?.(data.key, data.context);
        break;
      case 'performanceWarning':
        eventHandlers?.onPerformanceWarning?.(data);
        break;
      case 'errorOccurred':
        eventHandlers?.onErrorOccurred?.(data.error, data.context);
        break;
      case 'syncStatusChange':
        eventHandlers?.onSyncStatusChange?.(data);
        break;
    }
  }, [eventHandlers]);

  // Device detection and layout selection
  const updateDeviceDetection = useCallback((detection: DeviceDetection) => {
    const previousLayout = gridState.currentLayout;
    const newLayout = forceLayout || detection.type;

    setGridState(prev => ({
      ...prev,
      currentLayout: newLayout,
      touchCapabilities: detection.touchCapabilities,
      deviceDetection: detection,
    }));

    // Emit events
    emitEvent('deviceChange', detection);
    if (detection.orientation !== gridState.deviceDetection.orientation) {
      emitEvent('orientationChange', detection.orientation);
    }
    if (newLayout !== previousLayout) {
      emitEvent('layoutSwitch', newLayout);
    }
  }, [forceLayout, gridState.currentLayout, gridState.deviceDetection.orientation, emitEvent]);

  // Initialize device detection
  useEffect(() => {
    const initialDetection = detectDevice();
    updateDeviceDetection(initialDetection);

    // Set up device change listener
    const cleanup = setupDeviceChangeListener(updateDeviceDetection);

    return cleanup;
  }, [updateDeviceDetection]);

  // Generate responsive layout configuration
  const responsiveLayout = useMemo((): ResponsiveLayout => {
    const { deviceDetection } = gridState;
    
    return {
      isMobile: deviceDetection.type === 'mobile',
      isTablet: deviceDetection.type === 'tablet',
      isDesktop: deviceDetection.type === 'desktop',
      screenSize: deviceDetection.screenSize,
      orientation: deviceDetection.orientation,
      touchCapabilities: deviceDetection.touchCapabilities,
      breakpoints: customBreakpoints || {
        mobile: 768,
        tablet: 1024,
        desktop: 1200,
      },
      optimalTouchTargetSize: deviceDetection.type === 'mobile' ? 48 : 
                              deviceDetection.type === 'tablet' ? 44 : 32,
      optimalSpacing: deviceDetection.type === 'mobile' ? 16 : 
                      deviceDetection.type === 'tablet' ? 12 : 8,
    };
  }, [gridState.deviceDetection, customBreakpoints]);

  // Edit dialog management
  const openEditDialog = useCallback((
    type: 'status' | 'cost' | 'specification',
    context: EditContext
  ) => {
    setGridState(prev => ({
      ...prev,
      editDialog: {
        type,
        open: true,
        data: context,
      },
      editingCell: {
        rowId: context.cellData.rowId,
        columnId: context.cellData.columnId,
      },
    }));

    emitEvent('editStart', context);
  }, [emitEvent]);

  const closeEditDialog = useCallback((success: boolean = false, context?: EditContext) => {
    const currentContext = context || gridState.editDialog.data;
    
    setGridState(prev => ({
      ...prev,
      editDialog: {
        type: null,
        open: false,
        data: null,
      },
      editingCell: null,
    }));

    emitEvent('editEnd', { context: currentContext, success });
  }, [gridState.editDialog.data, emitEvent]);

  // Performance monitoring
  const updatePerformanceMetrics = useCallback((metrics: Partial<GridPerformanceMetrics>) => {
    setPerformanceMetrics(prev => {
      const updated = { ...prev, ...metrics };
      
      // Check for performance warnings
      const hasWarning = (
        updated.renderTime > 16 || // 60fps threshold
        updated.touchResponseTime > 100 || // Touch response threshold
        updated.memoryUsage > 100 * 1024 * 1024 // 100MB threshold
      );

      if (hasWarning) {
        emitEvent('performanceWarning', updated);
      }

      return updated;
    });
  }, [emitEvent]);

  // Touch gesture handling
  const handleTouchGesture = useCallback((gesture: string, data: any) => {
    emitEvent('touchGesture', { gesture, data });
  }, [emitEvent]);

  // Keyboard navigation handling
  const handleKeyboardNavigation = useCallback((key: string, context: any) => {
    emitEvent('keyboardNavigation', { key, context });
  }, [emitEvent]);

  // Error handling
  const handleError = useCallback((error: Error, context?: any) => {
    console.error('ResponsiveGridManager Error:', error, context);
    emitEvent('errorOccurred', { error, context });
  }, [emitEvent]);

  // Sync status management
  const updateSyncStatus = useCallback((status: 'syncing' | 'synced' | 'error') => {
    emitEvent('syncStatusChange', status);
  }, [emitEvent]);

  // Device-specific optimizations
  const getDeviceOptimizations = useCallback(() => {
    const { currentLayout, touchCapabilities } = gridState;
    
    return {
      // Touch optimizations
      touchTargetSize: responsiveLayout.optimalTouchTargetSize,
      spacing: responsiveLayout.optimalSpacing,
      enableTouchGestures: touchCapabilities.hasTouch,
      enableHover: touchCapabilities.hasHover,
      
      // Layout optimizations
      enableVirtualScrolling: currentLayout === 'mobile' || currentLayout === 'tablet',
      enableInlineEditing: currentLayout === 'desktop' && !touchCapabilities.hasTouch,
      enableFullScreenDialogs: currentLayout === 'mobile',
      
      // Performance optimizations
      enableDebouncing: currentLayout !== 'desktop',
      debounceDelay: currentLayout === 'mobile' ? 300 : 150,
      enableBatching: true,
      batchSize: currentLayout === 'mobile' ? 25 : 50,
    };
  }, [gridState, responsiveLayout]);

  // Accessibility helpers
  const getAccessibilityProps = useCallback(() => {
    const { currentLayout, touchCapabilities } = gridState;
    
    return {
      role: 'grid',
      'aria-label': 'レスポンシブメンテナンスグリッド',
      'aria-multiselectable': currentLayout === 'desktop',
      'aria-readonly': false,
      tabIndex: 0,
      // Touch-specific accessibility
      ...(touchCapabilities.hasTouch && {
        'aria-describedby': 'touch-instructions',
        'data-touch-enabled': 'true',
      }),
      // Mobile-specific accessibility
      ...(currentLayout === 'mobile' && {
        'aria-orientation': responsiveLayout.orientation,
        'data-mobile-optimized': 'true',
      }),
    };
  }, [gridState, responsiveLayout]);

  return {
    // State
    gridState,
    responsiveLayout,
    performanceMetrics,
    
    // Actions
    updateDeviceDetection,
    openEditDialog,
    closeEditDialog,
    updatePerformanceMetrics,
    handleTouchGesture,
    handleKeyboardNavigation,
    handleError,
    updateSyncStatus,
    
    // Helpers
    getDeviceOptimizations,
    getAccessibilityProps,
    
    // Computed values
    isEditDialogOpen: gridState.editDialog.open,
    currentEditType: gridState.editDialog.type,
    editContext: gridState.editDialog.data,
    isTouchDevice: gridState.touchCapabilities.hasTouch,
    isLowPowerDevice: gridState.currentLayout === 'mobile',
  };
};