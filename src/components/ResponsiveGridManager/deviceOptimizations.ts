import { 
  TouchOptimization, 
  PerformanceOptimization, 
  DeviceLayoutConfiguration,
  ResponsiveLayout 
} from './types';
import { DeviceDetection } from '../CommonEdit/types';

/**
 * デバイス別最適化設定を生成
 */
export const generateDeviceOptimizations = (
  deviceDetection: DeviceDetection,
  dataSize: number = 0
): {
  touch: TouchOptimization;
  performance: PerformanceOptimization;
  layout: DeviceLayoutConfiguration;
} => {
  const { type, touchCapabilities, screenSize } = deviceDetection;
  
  // Touch optimizations
  const touch: TouchOptimization = {
    minTouchTarget: type === 'mobile' ? 48 : type === 'tablet' ? 44 : 32,
    touchDelay: type === 'mobile' ? 300 : 150,
    scrollThreshold: type === 'mobile' ? 10 : 5,
    gestureTimeout: 500,
    enableHapticFeedback: touchCapabilities.hasTouch && type === 'mobile',
  };

  // Performance optimizations
  const performance: PerformanceOptimization = {
    enableVirtualScrolling: dataSize > (type === 'mobile' ? 50 : type === 'tablet' ? 100 : 200),
    virtualScrollThreshold: type === 'mobile' ? 50 : type === 'tablet' ? 100 : 200,
    enableMemoization: true,
    enableDebouncing: type !== 'desktop',
    debounceDelay: type === 'mobile' ? 300 : type === 'tablet' ? 200 : 100,
    enableBatching: true,
    batchSize: type === 'mobile' ? 25 : type === 'tablet' ? 50 : 100,
    enableLazyLoading: type === 'mobile' || dataSize > 500,
  };

  // Layout configurations
  const layout: DeviceLayoutConfiguration = {
    desktop: {
      enableInlineEditing: true,
      enableKeyboardShortcuts: true,
      enableContextMenu: true,
      enableColumnReordering: true,
      enableMultiSelect: true,
    },
    tablet: {
      enableTouchGestures: true,
      enableScreenRotation: true,
      dialogSize: 'medium',
      enableSwipeNavigation: true,
      touchTargetSize: 44,
    },
    mobile: {
      enableFullScreenDialogs: true,
      enableCardView: true,
      enablePullToRefresh: false, // Disabled for grid context
      enableBottomSheet: true,
      compactMode: screenSize.width < 375, // iPhone SE and smaller
    },
  };

  return { touch, performance, layout };
};

/**
 * デバイス別CSS変数を生成
 */
export const generateDeviceCSSVariables = (
  responsiveLayout: ResponsiveLayout
): Record<string, string> => {
  const { 
    isMobile, 
    isTablet, 
    isDesktop, 
    optimalTouchTargetSize, 
    optimalSpacing,
    screenSize,
    orientation 
  } = responsiveLayout;

  return {
    // Device type flags
    '--is-mobile': isMobile ? '1' : '0',
    '--is-tablet': isTablet ? '1' : '0',
    '--is-desktop': isDesktop ? '1' : '0',
    
    // Touch target sizes
    '--touch-target-size': `${optimalTouchTargetSize}px`,
    '--touch-target-size-small': `${Math.max(32, optimalTouchTargetSize - 8)}px`,
    '--touch-target-size-large': `${optimalTouchTargetSize + 8}px`,
    
    // Spacing
    '--spacing-xs': `${Math.round(optimalSpacing * 0.25)}px`,
    '--spacing-sm': `${Math.round(optimalSpacing * 0.5)}px`,
    '--spacing-md': `${optimalSpacing}px`,
    '--spacing-lg': `${Math.round(optimalSpacing * 1.5)}px`,
    '--spacing-xl': `${Math.round(optimalSpacing * 2)}px`,
    
    // Screen dimensions
    '--screen-width': `${screenSize.width}px`,
    '--screen-height': `${screenSize.height}px`,
    '--orientation': orientation,
    
    // Device-specific values
    '--dialog-max-width': isMobile ? '100vw' : isTablet ? '80vw' : '600px',
    '--dialog-max-height': isMobile ? '100vh' : isTablet ? '80vh' : '400px',
    '--grid-row-height': isMobile ? '56px' : isTablet ? '48px' : '40px',
    '--grid-header-height': isMobile ? '64px' : isTablet ? '56px' : '48px',
    
    // Font sizes
    '--font-size-xs': isMobile ? '12px' : '11px',
    '--font-size-sm': isMobile ? '14px' : '13px',
    '--font-size-md': isMobile ? '16px' : '14px',
    '--font-size-lg': isMobile ? '18px' : '16px',
    '--font-size-xl': isMobile ? '20px' : '18px',
    
    // Animation durations
    '--animation-duration-fast': isMobile ? '200ms' : '150ms',
    '--animation-duration-normal': isMobile ? '300ms' : '250ms',
    '--animation-duration-slow': isMobile ? '500ms' : '400ms',
    
    // Z-index layers
    '--z-index-dropdown': '1000',
    '--z-index-sticky': '1020',
    '--z-index-fixed': '1030',
    '--z-index-modal-backdrop': '1040',
    '--z-index-modal': '1050',
    '--z-index-popover': '1060',
    '--z-index-tooltip': '1070',
  };
};

/**
 * デバイス別パフォーマンス閾値を取得
 */
export const getPerformanceThresholds = (
  deviceType: 'desktop' | 'tablet' | 'mobile'
): {
  maxRenderTime: number;
  maxMemoryUsage: number;
  maxTouchResponseTime: number;
  virtualScrollThreshold: number;
  debounceDelay: number;
} => {
  switch (deviceType) {
    case 'mobile':
      return {
        maxRenderTime: 20, // 50fps for mobile
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        maxTouchResponseTime: 100,
        virtualScrollThreshold: 50,
        debounceDelay: 300,
      };
    
    case 'tablet':
      return {
        maxRenderTime: 18, // ~55fps for tablet
        maxMemoryUsage: 75 * 1024 * 1024, // 75MB
        maxTouchResponseTime: 80,
        virtualScrollThreshold: 100,
        debounceDelay: 200,
      };
    
    case 'desktop':
    default:
      return {
        maxRenderTime: 16, // 60fps for desktop
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        maxTouchResponseTime: 50,
        virtualScrollThreshold: 200,
        debounceDelay: 100,
      };
  }
};

/**
 * デバイス別アクセシビリティ設定を生成
 */
export const generateAccessibilitySettings = (
  deviceDetection: DeviceDetection
): {
  enableKeyboardNavigation: boolean;
  enableScreenReaderSupport: boolean;
  enableHighContrast: boolean;
  enableLargeText: boolean;
  enableReducedMotion: boolean;
  customAriaLabels: { [key: string]: string };
} => {
  const { type, touchCapabilities } = deviceDetection;
  
  return {
    enableKeyboardNavigation: true, // Always enabled
    enableScreenReaderSupport: true, // Always enabled
    enableHighContrast: false, // User preference
    enableLargeText: type === 'mobile', // Default for mobile
    enableReducedMotion: false, // User preference
    customAriaLabels: {
      grid: 'レスポンシブメンテナンスグリッド',
      cell: 'グリッドセル',
      editButton: '編集',
      saveButton: '保存',
      cancelButton: 'キャンセル',
      statusCell: '星取表セル',
      costCell: 'コストセル',
      specificationCell: '機器仕様セル',
      // Device-specific labels
      ...(type === 'mobile' && {
        expandButton: '展開',
        collapseButton: '折りたたみ',
        swipeHint: 'スワイプして操作',
      }),
      ...(touchCapabilities.hasTouch && {
        touchHint: 'タップして編集',
        longPressHint: '長押しでメニュー',
      }),
    },
  };
};

/**
 * デバイス別エラーメッセージを生成
 */
export const generateDeviceErrorMessages = (
  deviceType: 'desktop' | 'tablet' | 'mobile'
): { [key: string]: string } => {
  const baseMessages = {
    networkError: 'ネットワークエラーが発生しました',
    validationError: '入力値が正しくありません',
    saveError: '保存に失敗しました',
    loadError: 'データの読み込みに失敗しました',
  };

  const deviceSpecificMessages = {
    mobile: {
      touchError: 'タッチ操作でエラーが発生しました',
      orientationError: '画面回転中にエラーが発生しました',
      memoryError: 'メモリ不足のため処理を中断しました',
    },
    tablet: {
      touchError: 'タッチ操作でエラーが発生しました',
      orientationError: '画面回転中にエラーが発生しました',
      gestureError: 'ジェスチャー操作でエラーが発生しました',
    },
    desktop: {
      keyboardError: 'キーボード操作でエラーが発生しました',
      mouseError: 'マウス操作でエラーが発生しました',
      shortcutError: 'ショートカットキーでエラーが発生しました',
    },
  };

  return {
    ...baseMessages,
    ...deviceSpecificMessages[deviceType],
  };
};

/**
 * デバイス互換性チェック
 */
export const checkDeviceCompatibility = (
  deviceDetection: DeviceDetection
): {
  isSupported: boolean;
  warnings: string[];
  recommendations: string[];
} => {
  const { type, touchCapabilities, screenSize, userAgent } = deviceDetection;
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Screen size checks
  if (screenSize.width < 320) {
    warnings.push('画面幅が狭すぎます（最小320px推奨）');
    recommendations.push('より大きな画面での使用を推奨します');
  }

  if (screenSize.height < 480) {
    warnings.push('画面高さが低すぎます（最小480px推奨）');
    recommendations.push('画面を縦向きにしてください');
  }

  // Touch capability checks
  if (type === 'mobile' && !touchCapabilities.hasTouch) {
    warnings.push('タッチ機能が検出されませんでした');
    recommendations.push('タッチ対応デバイスでの使用を推奨します');
  }

  // Browser compatibility checks
  const isOldBrowser = (
    userAgent.includes('MSIE') ||
    (userAgent.includes('Chrome') && parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0') < 80) ||
    (userAgent.includes('Firefox') && parseInt(userAgent.match(/Firefox\/(\d+)/)?.[1] || '0') < 75) ||
    (userAgent.includes('Safari') && !userAgent.includes('Chrome') && parseInt(userAgent.match(/Version\/(\d+)/)?.[1] || '0') < 13)
  );

  if (isOldBrowser) {
    warnings.push('古いブラウザが検出されました');
    recommendations.push('最新のブラウザにアップデートしてください');
  }

  // Performance checks
  if (type === 'mobile' && screenSize.width > 1024) {
    recommendations.push('大画面モバイルデバイスではタブレットモードの使用を検討してください');
  }

  const isSupported = warnings.length === 0;

  return {
    isSupported,
    warnings,
    recommendations,
  };
};