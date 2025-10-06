import { useState, useEffect, useCallback } from 'react';

export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ResponsiveState {
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  isTouch: boolean;
}

export interface ResponsiveLayoutConfig {
  priorityColumns: {
    high: string[];
    medium: string[];
    low: string[];
  };
  mobileLayout: {
    stackElements: boolean;
    hideSecondaryActions: boolean;
    compactSpacing: boolean;
  };
  tabletLayout: {
    showSidebar: boolean;
    adaptiveColumns: boolean;
  };
}

const defaultBreakpoints: BreakpointConfig = {
  xs: 480,
  sm: 768,
  md: 1024,
  lg: 1200,
  xl: 1440,
};

const defaultLayoutConfig: ResponsiveLayoutConfig = {
  priorityColumns: {
    high: ['task', 'cycle'],
    medium: ['bomCode', 'specifications'],
    low: ['actions', 'metadata'],
  },
  mobileLayout: {
    stackElements: true,
    hideSecondaryActions: true,
    compactSpacing: true,
  },
  tabletLayout: {
    showSidebar: false,
    adaptiveColumns: true,
  },
};

export const useResponsiveLayout = (
  breakpoints: BreakpointConfig = defaultBreakpoints,
  layoutConfig: ResponsiveLayoutConfig = defaultLayoutConfig
) => {
  const [responsiveState, setResponsiveState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        screenSize: 'lg',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1024,
        height: 768,
        orientation: 'landscape',
        isTouch: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return {
      screenSize: getScreenSize(width, breakpoints),
      isMobile: width < breakpoints.sm,
      isTablet: width >= breakpoints.sm && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      width,
      height,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch,
    };
  });

  const updateResponsiveState = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    setResponsiveState({
      screenSize: getScreenSize(width, breakpoints),
      isMobile: width < breakpoints.sm,
      isTablet: width >= breakpoints.sm && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      width,
      height,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch,
    });
  }, [breakpoints]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      updateResponsiveState();
    };

    const handleOrientationChange = () => {
      // Delay to ensure dimensions are updated after orientation change
      setTimeout(updateResponsiveState, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateResponsiveState]);

  // Layout utilities
  const getVisibleColumns = useCallback((allColumns: string[]) => {
    const { high, medium, low } = layoutConfig.priorityColumns;
    
    if (responsiveState.isMobile) {
      return allColumns.filter(col => high.includes(col));
    } else if (responsiveState.isTablet) {
      return allColumns.filter(col => high.includes(col) || medium.includes(col));
    } else {
      return allColumns; // Show all columns on desktop
    }
  }, [responsiveState.isMobile, responsiveState.isTablet, layoutConfig.priorityColumns]);

  const getColumnWidth = useCallback((columnId: string, baseWidth: number) => {
    const { high, medium } = layoutConfig.priorityColumns;
    
    if (responsiveState.isMobile) {
      if (high.includes(columnId)) {
        return Math.max(baseWidth * 0.8, 100); // Minimum 100px on mobile
      }
      return 0; // Hidden columns
    } else if (responsiveState.isTablet) {
      if (high.includes(columnId)) {
        return Math.max(baseWidth * 0.9, 120);
      } else if (medium.includes(columnId)) {
        return Math.max(baseWidth * 0.8, 100);
      }
      return 0; // Hidden columns
    } else {
      return baseWidth; // Full width on desktop
    }
  }, [responsiveState.isMobile, responsiveState.isTablet, layoutConfig.priorityColumns]);

  const getCellHeight = useCallback(() => {
    if (responsiveState.isMobile) {
      return responsiveState.isTouch ? 48 : 40;
    } else if (responsiveState.isTablet) {
      return responsiveState.isTouch ? 44 : 40;
    } else {
      return 40;
    }
  }, [responsiveState.isMobile, responsiveState.isTablet, responsiveState.isTouch]);

  const getSpacing = useCallback((size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md') => {
    const spacingMap = {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    };

    const baseSpacing = spacingMap[size];

    if (responsiveState.isMobile) {
      return Math.max(baseSpacing * 0.75, 4);
    } else if (responsiveState.isTablet) {
      return Math.max(baseSpacing * 0.875, 6);
    } else {
      return baseSpacing;
    }
  }, [responsiveState.isMobile, responsiveState.isTablet]);

  const shouldStackElements = useCallback(() => {
    return responsiveState.isMobile && layoutConfig.mobileLayout.stackElements;
  }, [responsiveState.isMobile, layoutConfig.mobileLayout.stackElements]);

  const shouldHideSecondaryActions = useCallback(() => {
    return responsiveState.isMobile && layoutConfig.mobileLayout.hideSecondaryActions;
  }, [responsiveState.isMobile, layoutConfig.mobileLayout.hideSecondaryActions]);

  const shouldUseCompactSpacing = useCallback(() => {
    return responsiveState.isMobile && layoutConfig.mobileLayout.compactSpacing;
  }, [responsiveState.isMobile, layoutConfig.mobileLayout.compactSpacing]);

  const getGridTemplateColumns = useCallback((columns: Array<{ id: string; width: number }>) => {
    const visibleColumns = columns.filter(col => {
      const adjustedWidth = getColumnWidth(col.id, col.width);
      return adjustedWidth > 0;
    });

    return visibleColumns.map(col => `${getColumnWidth(col.id, col.width)}px`).join(' ');
  }, [getColumnWidth]);

  return {
    ...responsiveState,
    layoutConfig,
    breakpoints,
    
    // Layout utilities
    getVisibleColumns,
    getColumnWidth,
    getCellHeight,
    getSpacing,
    shouldStackElements,
    shouldHideSecondaryActions,
    shouldUseCompactSpacing,
    getGridTemplateColumns,
    
    // Update function for manual refresh
    updateLayout: updateResponsiveState,
  };
};

function getScreenSize(width: number, breakpoints: BreakpointConfig): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
  if (width < breakpoints.xs) return 'xs';
  if (width < breakpoints.sm) return 'sm';
  if (width < breakpoints.md) return 'md';
  if (width < breakpoints.lg) return 'lg';
  return 'xl';
}

// Hook for detecting device capabilities
export const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        hasTouch: false,
        hasHover: true,
        hasPointer: true,
        supportsVibration: false,
        supportsOrientation: false,
        supportsDeviceMotion: false,
      };
    }

    return {
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasHover: window.matchMedia('(hover: hover)').matches,
      hasPointer: window.matchMedia('(pointer: fine)').matches,
      supportsVibration: 'vibrate' in navigator,
      supportsOrientation: 'orientation' in screen,
      supportsDeviceMotion: 'DeviceMotionEvent' in window,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCapabilities = () => {
      setCapabilities({
        hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        hasHover: window.matchMedia('(hover: hover)').matches,
        hasPointer: window.matchMedia('(pointer: fine)').matches,
        supportsVibration: 'vibrate' in navigator,
        supportsOrientation: 'orientation' in screen,
        supportsDeviceMotion: 'DeviceMotionEvent' in window,
      });
    };

    // Listen for media query changes
    const hoverQuery = window.matchMedia('(hover: hover)');
    const pointerQuery = window.matchMedia('(pointer: fine)');

    const handleHoverChange = () => updateCapabilities();
    const handlePointerChange = () => updateCapabilities();

    hoverQuery.addEventListener('change', handleHoverChange);
    pointerQuery.addEventListener('change', handlePointerChange);

    return () => {
      hoverQuery.removeEventListener('change', handleHoverChange);
      pointerQuery.removeEventListener('change', handlePointerChange);
    };
  }, []);

  return capabilities;
};