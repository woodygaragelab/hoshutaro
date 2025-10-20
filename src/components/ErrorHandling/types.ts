import { ReactNode, ErrorInfo } from 'react';

// Error Boundary Props
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: (error: Error | null, retry: () => void) => ReactNode;
  enableAutoRecovery?: boolean;
  enableOfflineMode?: boolean;
  enableErrorReporting?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  fallbackBehavior?: 'graceful' | 'strict';
  userId?: string;
  sessionId?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRecovery?: () => void;
  onRetry?: () => void;
  onErrorReport?: (errorDetails: ErrorDetails) => void;
  onFeedback?: (feedbackData: any) => void;
}

// Error Boundary State
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  showDetails: boolean;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  errorMessages: { [key: string]: string };
}

// Error Details for Reporting
export interface ErrorDetails {
  message: string;
  stack: string;
  componentStack: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  userAgent: string;
  timestamp: string;
  url: string;
  userId?: string;
  sessionId?: string;
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

// Recovery Strategy
export interface RecoveryStrategy {
  name: string;
  canRecover: (error: Error) => boolean;
  recover: (error: Error, context: ErrorContext) => Promise<boolean>;
}

// Error Context
export interface ErrorContext {
  retryCount: number;
  maxRetries: number;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  timestamp?: number;
  userAgent?: string;
  sessionId?: string;
}

// Offline Data
export interface OfflineData {
  key: string;
  data: any;
  timestamp: number;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  syncStatus: 'pending' | 'synced' | 'error';
}

// Error Types
export enum GridErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  TOUCH_ERROR = 'TOUCH_ERROR',
  KEYBOARD_ERROR = 'KEYBOARD_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DEVICE_COMPATIBILITY_ERROR = 'DEVICE_COMPATIBILITY_ERROR',
  PERFORMANCE_ERROR = 'PERFORMANCE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

// Grid Error
export interface GridError extends Error {
  type: GridErrorType;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  context?: any;
  recoverable: boolean;
  userMessage: string;
  technicalDetails: any;
  timestamp: number;
}

// Error Recovery Action
export interface ErrorRecoveryAction {
  type: 'retry' | 'reset' | 'fallback' | 'manual' | 'reload';
  description: string;
  action: () => Promise<void>;
  isDestructive: boolean;
  requiresConfirmation: boolean;
}

// Error Notification
export interface ErrorNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  actions: ErrorRecoveryAction[];
  autoHide: boolean;
  duration?: number;
  persistent: boolean;
}

// Error Analytics
export interface ErrorAnalytics {
  errorCount: number;
  errorTypes: { [key in GridErrorType]: number };
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  deviceBreakdown: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  timeBreakdown: {
    hour: number[];
    day: number[];
    week: number[];
  };
}

// Error Monitoring Configuration
export interface ErrorMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  enableUserBehaviorTracking: boolean;
  sampleRate: number;
  maxErrorsPerSession: number;
  errorThreshold: {
    criticalErrors: number;
    warningErrors: number;
  };
}

// Error Report
export interface ErrorReport {
  id: string;
  timestamp: string;
  error: GridError;
  context: ErrorContext;
  userActions: string[];
  systemState: any;
  recoveryAttempts: RecoveryAttempt[];
  resolution: 'recovered' | 'unresolved' | 'user_action';
}

// Recovery Attempt
export interface RecoveryAttempt {
  strategy: string;
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}

// Error Handler Configuration
export interface ErrorHandlerConfig {
  errorBoundary: {
    enabled: boolean;
    fallbackComponent?: ReactNode;
    enableAutoRecovery: boolean;
    maxRetries: number;
  };
  errorReporting: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
    sampleRate: number;
  };
  offlineMode: {
    enabled: boolean;
    maxStorageSize: number;
    syncInterval: number;
  };
  notifications: {
    enabled: boolean;
    position: 'top' | 'bottom' | 'center';
    autoHide: boolean;
    duration: number;
  };
}

// Device-specific Error Configuration
export interface DeviceErrorConfig {
  desktop: {
    showDetailedErrors: boolean;
    enableKeyboardShortcuts: boolean;
    enableContextMenu: boolean;
  };
  tablet: {
    showSimplifiedErrors: boolean;
    enableTouchGestures: boolean;
    enableHapticFeedback: boolean;
  };
  mobile: {
    showMinimalErrors: boolean;
    enableFullScreenErrors: boolean;
    enableVibration: boolean;
  };
}

// Error Prevention Configuration
export interface ErrorPreventionConfig {
  enableInputValidation: boolean;
  enableDataSanitization: boolean;
  enableMemoryMonitoring: boolean;
  enablePerformanceMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  preventiveActions: {
    memoryThreshold: number;
    performanceThreshold: number;
    networkTimeout: number;
  };
}

// Error Recovery Statistics
export interface ErrorRecoveryStats {
  totalErrors: number;
  recoveredErrors: number;
  unrecoveredErrors: number;
  recoveryRate: number;
  averageRecoveryTime: number;
  mostCommonErrors: { type: GridErrorType; count: number }[];
  deviceStats: {
    desktop: { errors: number; recovered: number };
    tablet: { errors: number; recovered: number };
    mobile: { errors: number; recovered: number };
  };
}