import { HierarchicalData } from '../../types';
import { GridColumn, DisplayMode, ViewMode } from '../ExcelLikeGrid/types';
import { DeviceDetection, TouchCapabilities } from '../CommonEdit/types';

// ResponsiveGridManager Props
export interface ResponsiveGridManagerProps {
  // Data props
  data: HierarchicalData[];
  columns: GridColumn[];
  timeHeaders: string[];
  viewMode: ViewMode;
  displayMode: DisplayMode;
  showBomCode: boolean;
  showCycle: boolean;
  groupedData?: any;

  // Event handlers
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit?: (rowId: string, specIndex: number, key: string, value: string) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  onUpdateItem?: (item: HierarchicalData) => void;

  // Configuration
  virtualScrolling?: boolean;
  readOnly?: boolean;
  className?: string;

  // Performance options
  enablePerformanceOptimization?: boolean;
  performanceThreshold?: number;

  // Accessibility options
  enableAccessibility?: boolean;

  // Custom responsive configuration
  customBreakpoints?: ResponsiveBreakpoints;
  forceLayout?: 'desktop' | 'tablet' | 'mobile';
}

// Responsive Grid State
export interface ResponsiveGridState {
  currentLayout: 'desktop' | 'tablet' | 'mobile';
  editingCell: { rowId: string; columnId: string } | null;
  editDialog: {
    type: 'status' | 'cost' | 'specification' | null;
    open: boolean;
    data: any;
  };
  touchCapabilities: TouchCapabilities;
  deviceDetection: DeviceDetection;
}

// Responsive Layout Configuration
export interface ResponsiveLayout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  touchCapabilities: TouchCapabilities;
  breakpoints: ResponsiveBreakpoints;
  optimalTouchTargetSize: number;
  optimalSpacing: number;
}

// Responsive Breakpoints
export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
}

// Touch Optimization Configuration
export interface TouchOptimization {
  minTouchTarget: number;
  touchDelay: number;
  scrollThreshold: number;
  gestureTimeout: number;
  enableHapticFeedback: boolean;
}

// Performance Optimization Configuration
export interface PerformanceOptimization {
  enableVirtualScrolling: boolean;
  virtualScrollThreshold: number;
  enableMemoization: boolean;
  enableDebouncing: boolean;
  debounceDelay: number;
  enableBatching: boolean;
  batchSize: number;
  enableLazyLoading: boolean;
}

// Accessibility Configuration
export interface AccessibilityConfiguration {
  enableKeyboardNavigation: boolean;
  enableScreenReaderSupport: boolean;
  enableHighContrast: boolean;
  enableLargeText: boolean;
  enableReducedMotion: boolean;
  customAriaLabels?: { [key: string]: string };
}

// Device-specific Layout Configuration
export interface DeviceLayoutConfiguration {
  desktop: DesktopLayoutConfig;
  tablet: TabletLayoutConfig;
  mobile: MobileLayoutConfig;
}

export interface DesktopLayoutConfig {
  enableInlineEditing: boolean;
  enableKeyboardShortcuts: boolean;
  enableContextMenu: boolean;
  enableColumnReordering: boolean;
  enableMultiSelect: boolean;
}

export interface TabletLayoutConfig {
  enableTouchGestures: boolean;
  enableScreenRotation: boolean;
  dialogSize: 'small' | 'medium' | 'large';
  enableSwipeNavigation: boolean;
  touchTargetSize: number;
}

export interface MobileLayoutConfig {
  enableFullScreenDialogs: boolean;
  enableCardView: boolean;
  enablePullToRefresh: boolean;
  enableBottomSheet: boolean;
  compactMode: boolean;
}

// Grid Performance Metrics
export interface GridPerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  touchResponseTime: number;
  scrollPerformance: number;
  dataProcessingTime: number;
  virtualScrollingEfficiency: number;
}

// Error Handling Configuration
export interface ErrorHandlingConfiguration {
  enableAutoRecovery: boolean;
  enableOfflineMode: boolean;
  enableErrorReporting: boolean;
  retryAttempts: number;
  retryDelay: number;
  fallbackBehavior: 'graceful' | 'strict';
}

// Data Synchronization Configuration
export interface DataSyncConfiguration {
  enableRealTimeSync: boolean;
  syncInterval: number;
  enableConflictResolution: boolean;
  enableOptimisticUpdates: boolean;
  enableDataValidation: boolean;
  maxRetries: number;
}

// Responsive Grid Manager Configuration
export interface ResponsiveGridManagerConfiguration {
  responsive: ResponsiveLayout;
  touchOptimization: TouchOptimization;
  performance: PerformanceOptimization;
  accessibility: AccessibilityConfiguration;
  deviceLayouts: DeviceLayoutConfiguration;
  errorHandling: ErrorHandlingConfiguration;
  dataSync: DataSyncConfiguration;
}

// Event Types for Responsive Grid Manager
export type ResponsiveGridEvent = 
  | 'deviceChange'
  | 'orientationChange'
  | 'layoutSwitch'
  | 'editStart'
  | 'editEnd'
  | 'touchGesture'
  | 'keyboardNavigation'
  | 'performanceWarning'
  | 'errorOccurred'
  | 'syncStatusChange';

// Event Handler Types
export interface ResponsiveGridEventHandlers {
  onDeviceChange?: (detection: DeviceDetection) => void;
  onOrientationChange?: (orientation: 'portrait' | 'landscape') => void;
  onLayoutSwitch?: (layout: 'desktop' | 'tablet' | 'mobile') => void;
  onEditStart?: (context: any) => void;
  onEditEnd?: (context: any, success: boolean) => void;
  onTouchGesture?: (gesture: string, data: any) => void;
  onKeyboardNavigation?: (key: string, context: any) => void;
  onPerformanceWarning?: (metrics: GridPerformanceMetrics) => void;
  onErrorOccurred?: (error: Error, context: any) => void;
  onSyncStatusChange?: (status: 'syncing' | 'synced' | 'error') => void;
}