import { useState, useEffect, useCallback } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import { detectTouchCapabilities } from './deviceOptimization';

// レスポンシブレイアウトの状態
export interface ResponsiveLayoutState {
  deviceType: 'desktop' | 'tablet' | 'mobile';
  screenSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  touchCapabilities: {
    hasTouch: boolean;
    hasHover: boolean;
    hasPointerEvents: boolean;
    maxTouchPoints: number;
    supportsHaptics: boolean;
  };
  isKeyboardVisible: boolean;
  preferredDialogMode: 'popover' | 'modal' | 'fullscreen';
}

// レスポンシブレイアウト設定
export interface ResponsiveLayoutConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  touchThreshold: number; // タッチデバイス判定の閾値
  keyboardDetection: boolean; // キーボード表示検出を有効にするか
}

// デフォルト設定
const DEFAULT_CONFIG: ResponsiveLayoutConfig = {
  breakpoints: {
    mobile: 600,
    tablet: 960,
    desktop: 1280,
  },
  touchThreshold: 1, // 1つ以上のタッチポイントがあればタッチデバイス
  keyboardDetection: true,
};

/**
 * レスポンシブレイアウト管理フック
 */
export const useResponsiveLayout = (config: Partial<ResponsiveLayoutConfig> = {}) => {
  const theme = useTheme();
  const effectiveConfig = { ...DEFAULT_CONFIG, ...config };
  
  // メディアクエリ
  const isMobile = useMediaQuery(`(max-width:${effectiveConfig.breakpoints.mobile}px)`);
  const isTablet = useMediaQuery(
    `(min-width:${effectiveConfig.breakpoints.mobile + 1}px) and (max-width:${effectiveConfig.breakpoints.tablet}px)`
  );
  const isDesktop = useMediaQuery(`(min-width:${effectiveConfig.breakpoints.tablet + 1}px)`);
  const isPortrait = useMediaQuery('(orientation: portrait)');
  
  // レスポンシブ状態
  const [layoutState, setLayoutState] = useState<ResponsiveLayoutState>(() => {
    const touchCapabilities = detectTouchCapabilities();
    const screenSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    
    // デバイスタイプの決定
    let deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop';
    if (isMobile || (touchCapabilities.hasTouch && screenSize.width <= effectiveConfig.breakpoints.mobile)) {
      deviceType = 'mobile';
    } else if (isTablet || (touchCapabilities.hasTouch && screenSize.width <= effectiveConfig.breakpoints.tablet)) {
      deviceType = 'tablet';
    }
    
    // ダイアログモードの決定
    let preferredDialogMode: 'popover' | 'modal' | 'fullscreen' = 'modal';
    if (deviceType === 'desktop' && !touchCapabilities.hasTouch) {
      preferredDialogMode = 'popover';
    } else if (deviceType === 'mobile') {
      preferredDialogMode = 'fullscreen';
    }
    
    return {
      deviceType,
      screenSize,
      orientation: isPortrait ? 'portrait' : 'landscape',
      touchCapabilities,
      isKeyboardVisible: false,
      preferredDialogMode,
    };
  });

  // 画面サイズ変更の監視
  const handleResize = useCallback(() => {
    const newScreenSize = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    
    // キーボード表示検出（モバイル・タブレットのみ）
    let isKeyboardVisible = false;
    if (effectiveConfig.keyboardDetection && (layoutState.deviceType === 'mobile' || layoutState.deviceType === 'tablet')) {
      const heightDiff = screen.height - newScreenSize.height;
      const threshold = newScreenSize.height * 0.25; // 画面の25%以上縮小したらキーボード表示と判定
      isKeyboardVisible = heightDiff > threshold;
    }
    
    setLayoutState(prev => ({
      ...prev,
      screenSize: newScreenSize,
      orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
      isKeyboardVisible,
    }));
  }, [effectiveConfig.keyboardDetection, layoutState.deviceType]);

  // デバイスタイプの更新
  useEffect(() => {
    const touchCapabilities = detectTouchCapabilities();
    
    let deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop';
    if (isMobile || (touchCapabilities.hasTouch && layoutState.screenSize.width <= effectiveConfig.breakpoints.mobile)) {
      deviceType = 'mobile';
    } else if (isTablet || (touchCapabilities.hasTouch && layoutState.screenSize.width <= effectiveConfig.breakpoints.tablet)) {
      deviceType = 'tablet';
    }
    
    let preferredDialogMode: 'popover' | 'modal' | 'fullscreen' = 'modal';
    if (deviceType === 'desktop' && !touchCapabilities.hasTouch) {
      preferredDialogMode = 'popover';
    } else if (deviceType === 'mobile') {
      preferredDialogMode = 'fullscreen';
    }
    
    setLayoutState(prev => ({
      ...prev,
      deviceType,
      touchCapabilities,
      preferredDialogMode,
    }));
  }, [isMobile, isTablet, isDesktop, effectiveConfig.breakpoints, layoutState.screenSize.width]);

  // イベントリスナーの設定
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  // デバイス固有のスタイル設定を取得
  const getDeviceStyles = useCallback(() => {
    const baseStyles = {
      dialog: {
        borderRadius: theme.shape.borderRadius,
        maxWidth: '90vw',
        maxHeight: '90vh',
      },
      listItem: {
        padding: theme.spacing(1, 2),
        minHeight: 48,
      },
      button: {
        minHeight: 36,
        fontSize: '0.875rem',
      },
      textField: {
        size: 'small' as const,
      },
    };

    switch (layoutState.deviceType) {
      case 'mobile':
        return {
          dialog: {
            ...baseStyles.dialog,
            borderRadius: 0,
            maxWidth: '100vw',
            maxHeight: '100vh',
            margin: 0,
          },
          listItem: {
            ...baseStyles.listItem,
            padding: theme.spacing(2, 3),
            minHeight: 64,
          },
          button: {
            ...baseStyles.button,
            minHeight: 48,
            fontSize: '1rem',
          },
          textField: {
            size: 'medium' as const,
          },
        };

      case 'tablet':
        return {
          dialog: {
            ...baseStyles.dialog,
            borderRadius: (theme.shape.borderRadius as number) * 1.5,
            maxWidth: '80vw',
            maxHeight: '80vh',
          },
          listItem: {
            ...baseStyles.listItem,
            padding: theme.spacing(1.5, 2.5),
            minHeight: 56,
          },
          button: {
            ...baseStyles.button,
            minHeight: 44,
            fontSize: '0.9375rem',
          },
          textField: {
            size: 'medium' as const,
          },
        };

      default: // desktop
        return baseStyles;
    }
  }, [layoutState.deviceType, theme]);

  // デバイス固有の動作設定を取得
  const getDeviceBehavior = useCallback(() => {
    return {
      enableDragAndDrop: layoutState.deviceType === 'desktop' && !layoutState.touchCapabilities.hasTouch,
      enableTouchReorder: layoutState.deviceType !== 'desktop' && layoutState.touchCapabilities.hasTouch,
      enableKeyboardShortcuts: layoutState.deviceType === 'desktop',
      enableHapticFeedback: layoutState.touchCapabilities.supportsHaptics && layoutState.deviceType === 'mobile',
      enableAutoScroll: layoutState.deviceType === 'mobile',
      enableInlineEdit: layoutState.deviceType === 'desktop',
      showDetailedValidation: layoutState.deviceType === 'desktop',
      adaptToKeyboard: layoutState.deviceType !== 'desktop' && layoutState.isKeyboardVisible,
      preferredAnimationDuration: {
        desktop: 200,
        tablet: 300,
        mobile: 400,
      }[layoutState.deviceType],
    };
  }, [layoutState]);

  // アクセシビリティ設定を取得
  const getAccessibilityConfig = useCallback(() => {
    return {
      announceChanges: true,
      enableAriaLiveRegions: true,
      enableKeyboardNavigation: true,
      enableScreenReaderSupport: true,
      minTouchTargetSize: {
        desktop: 32,
        tablet: 44,
        mobile: 48,
      }[layoutState.deviceType],
      focusManagement: {
        trapFocus: layoutState.preferredDialogMode === 'fullscreen',
        restoreFocus: true,
        autoFocus: layoutState.deviceType === 'desktop',
      },
    };
  }, [layoutState]);

  return {
    layoutState,
    getDeviceStyles,
    getDeviceBehavior,
    getAccessibilityConfig,
    // ユーティリティ関数
    isMobile: layoutState.deviceType === 'mobile',
    isTablet: layoutState.deviceType === 'tablet',
    isDesktop: layoutState.deviceType === 'desktop',
    hasTouch: layoutState.touchCapabilities.hasTouch,
    isKeyboardVisible: layoutState.isKeyboardVisible,
    isPortrait: layoutState.orientation === 'portrait',
    isLandscape: layoutState.orientation === 'landscape',
  };
};