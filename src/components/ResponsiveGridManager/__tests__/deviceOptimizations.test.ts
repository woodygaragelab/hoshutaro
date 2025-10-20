import {
  generateDeviceOptimizations,
  generateDeviceCSSVariables,
  getPerformanceThresholds,
  generateAccessibilitySettings,
  generateDeviceErrorMessages,
  checkDeviceCompatibility,
} from '../deviceOptimizations';
import { DeviceDetection } from '../../CommonEdit/types';
import { ResponsiveLayout } from '../types';

describe('deviceOptimizations', () => {
  const mockMobileDetection: DeviceDetection = {
    type: 'mobile',
    screenSize: { width: 375, height: 667 },
    orientation: 'portrait',
    touchCapabilities: {
      hasTouch: true,
      hasHover: false,
      hasPointerEvents: true,
      maxTouchPoints: 5,
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
  };

  const mockTabletDetection: DeviceDetection = {
    type: 'tablet',
    screenSize: { width: 768, height: 1024 },
    orientation: 'portrait',
    touchCapabilities: {
      hasTouch: true,
      hasHover: false,
      hasPointerEvents: true,
      maxTouchPoints: 10,
    },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
  };

  const mockDesktopDetection: DeviceDetection = {
    type: 'desktop',
    screenSize: { width: 1920, height: 1080 },
    orientation: 'landscape',
    touchCapabilities: {
      hasTouch: false,
      hasHover: true,
      hasPointerEvents: true,
      maxTouchPoints: 0,
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  const mockResponsiveLayout: ResponsiveLayout = {
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    screenSize: { width: 375, height: 667 },
    orientation: 'portrait',
    touchCapabilities: mockMobileDetection.touchCapabilities,
    breakpoints: { mobile: 768, tablet: 1024, desktop: 1200 },
    optimalTouchTargetSize: 48,
    optimalSpacing: 16,
  };

  describe('generateDeviceOptimizations', () => {
    it('should generate mobile optimizations', () => {
      const optimizations = generateDeviceOptimizations(mockMobileDetection, 100);

      expect(optimizations.touch.minTouchTarget).toBe(48);
      expect(optimizations.touch.touchDelay).toBe(300);
      expect(optimizations.touch.enableHapticFeedback).toBe(true);

      expect(optimizations.performance.enableVirtualScrolling).toBe(true);
      expect(optimizations.performance.virtualScrollThreshold).toBe(50);
      expect(optimizations.performance.enableDebouncing).toBe(true);
      expect(optimizations.performance.debounceDelay).toBe(300);

      expect(optimizations.layout.mobile.enableFullScreenDialogs).toBe(true);
      expect(optimizations.layout.mobile.enableCardView).toBe(true);
    });

    it('should generate tablet optimizations', () => {
      const optimizations = generateDeviceOptimizations(mockTabletDetection, 100);

      expect(optimizations.touch.minTouchTarget).toBe(44);
      expect(optimizations.touch.touchDelay).toBe(150);
      expect(optimizations.touch.enableHapticFeedback).toBe(false);

      expect(optimizations.performance.virtualScrollThreshold).toBe(100);
      expect(optimizations.performance.debounceDelay).toBe(200);

      expect(optimizations.layout.tablet.enableTouchGestures).toBe(true);
      expect(optimizations.layout.tablet.enableScreenRotation).toBe(true);
      expect(optimizations.layout.tablet.dialogSize).toBe('medium');
    });

    it('should generate desktop optimizations', () => {
      const optimizations = generateDeviceOptimizations(mockDesktopDetection, 100);

      expect(optimizations.touch.minTouchTarget).toBe(32);
      expect(optimizations.touch.touchDelay).toBe(150);
      expect(optimizations.touch.enableHapticFeedback).toBe(false);

      expect(optimizations.performance.virtualScrollThreshold).toBe(200);
      expect(optimizations.performance.enableDebouncing).toBe(false);
      expect(optimizations.performance.debounceDelay).toBe(100);

      expect(optimizations.layout.desktop.enableInlineEditing).toBe(true);
      expect(optimizations.layout.desktop.enableKeyboardShortcuts).toBe(true);
      expect(optimizations.layout.desktop.enableMultiSelect).toBe(true);
    });

    it('should enable virtual scrolling for large datasets', () => {
      const optimizations = generateDeviceOptimizations(mockMobileDetection, 1000);
      expect(optimizations.performance.enableVirtualScrolling).toBe(true);

      const smallDataOptimizations = generateDeviceOptimizations(mockMobileDetection, 10);
      expect(smallDataOptimizations.performance.enableVirtualScrolling).toBe(false);
    });
  });

  describe('generateDeviceCSSVariables', () => {
    it('should generate CSS variables for mobile layout', () => {
      const cssVars = generateDeviceCSSVariables(mockResponsiveLayout);

      expect(cssVars['--is-mobile']).toBe('1');
      expect(cssVars['--is-tablet']).toBe('0');
      expect(cssVars['--is-desktop']).toBe('0');
      expect(cssVars['--touch-target-size']).toBe('48px');
      expect(cssVars['--spacing-md']).toBe('16px');
      expect(cssVars['--dialog-max-width']).toBe('100vw');
      expect(cssVars['--dialog-max-height']).toBe('100vh');
    });

    it('should generate appropriate font sizes for mobile', () => {
      const cssVars = generateDeviceCSSVariables(mockResponsiveLayout);

      expect(cssVars['--font-size-xs']).toBe('12px');
      expect(cssVars['--font-size-sm']).toBe('14px');
      expect(cssVars['--font-size-md']).toBe('16px');
      expect(cssVars['--font-size-lg']).toBe('18px');
    });

    it('should generate appropriate animation durations for mobile', () => {
      const cssVars = generateDeviceCSSVariables(mockResponsiveLayout);

      expect(cssVars['--animation-duration-fast']).toBe('200ms');
      expect(cssVars['--animation-duration-normal']).toBe('300ms');
      expect(cssVars['--animation-duration-slow']).toBe('500ms');
    });
  });

  describe('getPerformanceThresholds', () => {
    it('should return mobile performance thresholds', () => {
      const thresholds = getPerformanceThresholds('mobile');

      expect(thresholds.maxRenderTime).toBe(20);
      expect(thresholds.maxMemoryUsage).toBe(50 * 1024 * 1024);
      expect(thresholds.maxTouchResponseTime).toBe(100);
      expect(thresholds.virtualScrollThreshold).toBe(50);
      expect(thresholds.debounceDelay).toBe(300);
    });

    it('should return tablet performance thresholds', () => {
      const thresholds = getPerformanceThresholds('tablet');

      expect(thresholds.maxRenderTime).toBe(18);
      expect(thresholds.maxMemoryUsage).toBe(75 * 1024 * 1024);
      expect(thresholds.maxTouchResponseTime).toBe(80);
      expect(thresholds.virtualScrollThreshold).toBe(100);
      expect(thresholds.debounceDelay).toBe(200);
    });

    it('should return desktop performance thresholds', () => {
      const thresholds = getPerformanceThresholds('desktop');

      expect(thresholds.maxRenderTime).toBe(16);
      expect(thresholds.maxMemoryUsage).toBe(100 * 1024 * 1024);
      expect(thresholds.maxTouchResponseTime).toBe(50);
      expect(thresholds.virtualScrollThreshold).toBe(200);
      expect(thresholds.debounceDelay).toBe(100);
    });
  });

  describe('generateAccessibilitySettings', () => {
    it('should generate accessibility settings for mobile', () => {
      const settings = generateAccessibilitySettings(mockMobileDetection);

      expect(settings.enableKeyboardNavigation).toBe(true);
      expect(settings.enableScreenReaderSupport).toBe(true);
      expect(settings.enableLargeText).toBe(true);
      expect(settings.customAriaLabels.expandButton).toBe('展開');
      expect(settings.customAriaLabels.touchHint).toBe('タップして編集');
    });

    it('should generate accessibility settings for desktop', () => {
      const settings = generateAccessibilitySettings(mockDesktopDetection);

      expect(settings.enableKeyboardNavigation).toBe(true);
      expect(settings.enableScreenReaderSupport).toBe(true);
      expect(settings.enableLargeText).toBe(false);
      expect(settings.customAriaLabels.expandButton).toBeUndefined();
      expect(settings.customAriaLabels.touchHint).toBeUndefined();
    });
  });

  describe('generateDeviceErrorMessages', () => {
    it('should generate mobile-specific error messages', () => {
      const messages = generateDeviceErrorMessages('mobile');

      expect(messages.networkError).toBe('ネットワークエラーが発生しました');
      expect(messages.touchError).toBe('タッチ操作でエラーが発生しました');
      expect(messages.orientationError).toBe('画面回転中にエラーが発生しました');
      expect(messages.memoryError).toBe('メモリ不足のため処理を中断しました');
    });

    it('should generate tablet-specific error messages', () => {
      const messages = generateDeviceErrorMessages('tablet');

      expect(messages.touchError).toBe('タッチ操作でエラーが発生しました');
      expect(messages.gestureError).toBe('ジェスチャー操作でエラーが発生しました');
    });

    it('should generate desktop-specific error messages', () => {
      const messages = generateDeviceErrorMessages('desktop');

      expect(messages.keyboardError).toBe('キーボード操作でエラーが発生しました');
      expect(messages.mouseError).toBe('マウス操作でエラーが発生しました');
      expect(messages.shortcutError).toBe('ショートカットキーでエラーが発生しました');
    });
  });

  describe('checkDeviceCompatibility', () => {
    it('should pass compatibility check for modern mobile device', () => {
      const result = checkDeviceCompatibility(mockMobileDetection);

      expect(result.isSupported).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should warn about small screen size', () => {
      const smallScreenDetection: DeviceDetection = {
        ...mockMobileDetection,
        screenSize: { width: 300, height: 400 },
      };

      const result = checkDeviceCompatibility(smallScreenDetection);

      expect(result.isSupported).toBe(false);
      expect(result.warnings).toContain('画面幅が狭すぎます（最小320px推奨）');
      expect(result.warnings).toContain('画面高さが低すぎます（最小480px推奨）');
      expect(result.recommendations).toContain('より大きな画面での使用を推奨します');
      expect(result.recommendations).toContain('画面を縦向きにしてください');
    });

    it('should warn about missing touch capability on mobile', () => {
      const noTouchMobileDetection: DeviceDetection = {
        ...mockMobileDetection,
        touchCapabilities: {
          ...mockMobileDetection.touchCapabilities,
          hasTouch: false,
        },
      };

      const result = checkDeviceCompatibility(noTouchMobileDetection);

      expect(result.isSupported).toBe(false);
      expect(result.warnings).toContain('タッチ機能が検出されませんでした');
      expect(result.recommendations).toContain('タッチ対応デバイスでの使用を推奨します');
    });

    it('should warn about old browser', () => {
      const oldBrowserDetection: DeviceDetection = {
        ...mockDesktopDetection,
        userAgent: 'Mozilla/5.0 (compatible; MSIE 11.0; Windows NT 10.0)',
      };

      const result = checkDeviceCompatibility(oldBrowserDetection);

      expect(result.isSupported).toBe(false);
      expect(result.warnings).toContain('古いブラウザが検出されました');
      expect(result.recommendations).toContain('最新のブラウザにアップデートしてください');
    });

    it('should recommend tablet mode for large mobile screens', () => {
      const largeMobileDetection: DeviceDetection = {
        ...mockMobileDetection,
        screenSize: { width: 1200, height: 800 },
      };

      const result = checkDeviceCompatibility(largeMobileDetection);

      expect(result.recommendations).toContain(
        '大画面モバイルデバイスではタブレットモードの使用を検討してください'
      );
    });
  });
});