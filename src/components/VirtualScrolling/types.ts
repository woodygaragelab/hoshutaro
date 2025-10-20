import React from 'react';

// Virtual Scroll Manager Props
export interface VirtualScrollManagerProps {
  // Data
  items: any[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  
  // Rendering
  renderItem: (item: any, index: number) => React.ReactNode;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  className?: string;
  
  // Performance options
  enablePerformanceMonitoring?: boolean;
  targetFPS?: number;
  memoryThreshold?: number;
  
  // Optimization options
  enableMemoization?: boolean;
  enableBatching?: boolean;
  batchSize?: number;
  enableLazyLoading?: boolean;
  
  // Accessibility options
  enableAccessibility?: boolean;
  ariaLabel?: string;
}

// Virtual Scroll State
export interface VirtualScrollState {
  scrollTop: number;
  startIndex: number;
  endIndex: number;
  visibleItems: VirtualItem[];
  totalHeight: number;
}

// Virtual Item
export interface VirtualItem {
  index: number;
  top: number;
  height: number;
  data: any;
}

// Virtual Scrolling Hook Props
export interface UseVirtualScrollingProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  enableMemoization?: boolean;
}

// Performance Monitoring Props
export interface UsePerformanceMonitoringProps {
  enabled?: boolean;
  targetFPS?: number;
  memoryThreshold?: number;
}

// Performance Metrics
export interface PerformanceMetrics {
  currentFPS: number;
  averageFPS: number;
  renderTime: number;
  scrollTime: number;
  memoryUsage: number;
  frameDrops: number;
  lastMeasurement: number;
}

// Render Optimization Configuration
export interface RenderOptimizationConfig {
  enableVirtualScrolling: boolean;
  virtualScrollThreshold: number;
  itemHeight: number;
  overscan: number;
  enableMemoization: boolean;
  enableBatching: boolean;
  batchSize: number;
  enableLazyLoading: boolean;
  lazyLoadingBuffer: number;
}

// Memory Management Configuration
export interface MemoryManagementConfig {
  enableGarbageCollection: boolean;
  gcInterval: number;
  maxCacheSize: number;
  enableWeakReferences: boolean;
  enableObjectPooling: boolean;
  poolSize: number;
}

// Scroll Performance Configuration
export interface ScrollPerformanceConfig {
  enablePassiveListeners: boolean;
  enableRafThrottling: boolean;
  enableDebouncing: boolean;
  debounceDelay: number;
  enableMomentumScrolling: boolean;
  scrollSensitivity: number;
}

// Virtual Grid Configuration (for 2D virtualization)
export interface VirtualGridConfig {
  rowHeight: number;
  columnWidth: number;
  totalRows: number;
  totalColumns: number;
  overscanRows: number;
  overscanColumns: number;
  enableStickyHeaders: boolean;
  enableStickyColumns: boolean;
}

// Virtual Grid Item
export interface VirtualGridItem {
  rowIndex: number;
  columnIndex: number;
  top: number;
  left: number;
  width: number;
  height: number;
  data: any;
}

// Scroll Direction
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

// Scroll Event Data
export interface ScrollEventData {
  scrollTop: number;
  scrollLeft: number;
  direction: ScrollDirection;
  velocity: number;
  isScrolling: boolean;
  timestamp: number;
}

// Virtual Scroll Cache
export interface VirtualScrollCache {
  items: Map<number, VirtualItem>;
  renderedElements: Map<number, React.ReactElement>;
  measurements: Map<number, { width: number; height: number }>;
  lastAccessTime: Map<number, number>;
}

// Intersection Observer Configuration
export interface IntersectionObserverConfig {
  enabled: boolean;
  rootMargin: string;
  threshold: number[];
  enableLazyLoading: boolean;
  enableVisibilityTracking: boolean;
}

// Resize Observer Configuration
export interface ResizeObserverConfig {
  enabled: boolean;
  enableDynamicSizing: boolean;
  enableResponsiveLayout: boolean;
  debounceDelay: number;
}

// Virtual Scroll Event Handlers
export interface VirtualScrollEventHandlers {
  onScroll?: (data: ScrollEventData) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
  onItemVisible?: (index: number, item: any) => void;
  onItemHidden?: (index: number, item: any) => void;
  onPerformanceWarning?: (metrics: PerformanceMetrics) => void;
  onMemoryWarning?: (usage: number) => void;
}

// Virtual Scroll Manager Configuration
export interface VirtualScrollManagerConfig {
  rendering: RenderOptimizationConfig;
  memory: MemoryManagementConfig;
  scroll: ScrollPerformanceConfig;
  intersection: IntersectionObserverConfig;
  resize: ResizeObserverConfig;
  eventHandlers: VirtualScrollEventHandlers;
}

// Dynamic Item Height Configuration
export interface DynamicItemHeightConfig {
  enabled: boolean;
  estimatedHeight: number;
  measurementCache: boolean;
  remeasureOnResize: boolean;
  heightCalculator?: (item: any, index: number) => number;
}

// Virtual Scroll Analytics
export interface VirtualScrollAnalytics {
  totalScrollDistance: number;
  averageScrollVelocity: number;
  scrollSessions: number;
  itemsViewed: Set<number>;
  timeSpentScrolling: number;
  performanceIssues: number;
  memoryPeaks: number[];
}

// Virtual Scroll Accessibility
export interface VirtualScrollAccessibility {
  enableKeyboardNavigation: boolean;
  enableScreenReaderSupport: boolean;
  enableFocusManagement: boolean;
  announceChanges: boolean;
  customAriaLabels: { [key: string]: string };
  keyboardShortcuts: { [key: string]: () => void };
}