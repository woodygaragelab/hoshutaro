// Design System Configuration
export const DESIGN_SYSTEM_CONFIG = {
  // Animation settings
  animations: {
    // Duration in milliseconds
    fast: 150,
    normal: 200,
    slow: 300,
    
    // Easing functions
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
  
  // Breakpoints (matches MUI but with semantic names)
  breakpoints: {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
  
  // Component sizes
  components: {
    header: {
      height: 64,
      mobileHeight: 56,
    },
    sidebar: {
      width: 280,
      collapsedWidth: 64,
    },
    button: {
      heights: {
        small: 32,
        medium: 40,
        large: 48,
      },
    },
    input: {
      heights: {
        small: 32,
        medium: 40,
        large: 48,
      },
    },
  },
  
  // Grid system
  grid: {
    columns: 12,
    gutters: {
      xs: 8,
      sm: 16,
      md: 24,
      lg: 32,
    },
  },
  
  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
    notification: 1070,
  },
  
  // Content constraints
  content: {
    maxWidth: 1200,
    padding: {
      mobile: 16,
      tablet: 24,
      desktop: 32,
    },
  },
  
  // Excel-like grid specific settings
  excelGrid: {
    cellHeight: 32,
    headerHeight: 40,
    minColumnWidth: 60,
    defaultColumnWidth: 120,
    maxColumnWidth: 400,
    scrollbarSize: 8,
    virtualScrollThreshold: 100, // Start virtualization after 100 rows
  },
  
  // Modern header settings
  modernHeader: {
    height: 64,
    mobileHeight: 56,
    logoMaxWidth: 180,
    actionButtonSize: 40,
    searchMinWidth: 200,
    searchMaxWidth: 400,
  },
  
  // AI Assistant panel settings
  aiAssistant: {
    width: 400,
    minWidth: 320,
    maxWidth: 600,
    messageMaxWidth: 280,
    avatarSize: 32,
  },
  
  // Filter panel settings
  filterPanel: {
    width: 320,
    minWidth: 280,
    maxWidth: 400,
    itemHeight: 48,
  },
} as const;

// Type definitions for better TypeScript support
export type DesignSystemConfig = typeof DESIGN_SYSTEM_CONFIG;
export type Breakpoint = keyof typeof DESIGN_SYSTEM_CONFIG.breakpoints;
export type AnimationDuration = keyof typeof DESIGN_SYSTEM_CONFIG.animations;
export type ZIndexLevel = keyof typeof DESIGN_SYSTEM_CONFIG.zIndex;

// Utility functions
export const getBreakpointValue = (breakpoint: Breakpoint): number => {
  return DESIGN_SYSTEM_CONFIG.breakpoints[breakpoint];
};

export const getZIndex = (level: ZIndexLevel): number => {
  return DESIGN_SYSTEM_CONFIG.zIndex[level];
};

export const getAnimationDuration = (duration: AnimationDuration): number => {
  const durations = DESIGN_SYSTEM_CONFIG.animations;
  if (typeof durations[duration] === 'number') {
    return durations[duration] as number;
  }
  return durations.normal; // fallback
};

// Media query helpers
export const mediaQueries = {
  mobile: `@media (max-width: ${DESIGN_SYSTEM_CONFIG.breakpoints.tablet - 1}px)`,
  tablet: `@media (min-width: ${DESIGN_SYSTEM_CONFIG.breakpoints.tablet}px)`,
  desktop: `@media (min-width: ${DESIGN_SYSTEM_CONFIG.breakpoints.desktop}px)`,
  wide: `@media (min-width: ${DESIGN_SYSTEM_CONFIG.breakpoints.wide}px)`,
  
  // Utility queries
  hover: '@media (hover: hover)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
  darkMode: '@media (prefers-color-scheme: dark)',
  lightMode: '@media (prefers-color-scheme: light)',
} as const;