import { DeviceDetection, TouchCapabilities } from './types';

/**
 * デバイスのタッチ機能を検出
 */
export const detectTouchCapabilities = (): TouchCapabilities => {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasHover = window.matchMedia('(hover: hover)').matches;
  const hasPointerEvents = 'PointerEvent' in window;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return {
    hasTouch,
    hasHover,
    hasPointerEvents,
    maxTouchPoints,
  };
};

/**
 * 画面サイズとデバイスタイプを検出
 */
export const detectDeviceType = (): 'desktop' | 'tablet' | 'mobile' => {
  const width = window.innerWidth;
  const touchCapabilities = detectTouchCapabilities();

  // モバイル: 768px未満 または タッチのみでホバーなし
  if (width < 768 || (touchCapabilities.hasTouch && !touchCapabilities.hasHover)) {
    return 'mobile';
  }
  
  // タブレット: 768px以上1024px未満 かつ タッチ対応
  if (width >= 768 && width < 1024 && touchCapabilities.hasTouch) {
    return 'tablet';
  }
  
  // デスクトップ: その他
  return 'desktop';
};

/**
 * 画面の向きを検出
 */
export const detectOrientation = (): 'portrait' | 'landscape' => {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

/**
 * 包括的なデバイス検出
 */
export const detectDevice = (): DeviceDetection => {
  const type = detectDeviceType();
  const screenSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const orientation = detectOrientation();
  const touchCapabilities = detectTouchCapabilities();
  const userAgent = navigator.userAgent;

  return {
    type,
    screenSize,
    orientation,
    touchCapabilities,
    userAgent,
  };
};

/**
 * デバイス変更を監視するためのイベントリスナー設定
 */
export const setupDeviceChangeListener = (
  callback: (detection: DeviceDetection) => void
): (() => void) => {
  const handleResize = () => {
    callback(detectDevice());
  };

  const handleOrientationChange = () => {
    // 向き変更後に少し遅延してから検出（iOS対応）
    setTimeout(() => {
      callback(detectDevice());
    }, 100);
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleOrientationChange);

  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
  };
};

/**
 * デバイスタイプに応じた最適なタッチターゲットサイズを取得
 */
export const getOptimalTouchTargetSize = (deviceType: 'desktop' | 'tablet' | 'mobile'): number => {
  switch (deviceType) {
    case 'mobile':
      return 48; // モバイルは大きめ
    case 'tablet':
      return 44; // タブレットは標準
    case 'desktop':
      return 32; // デスクトップは小さめ（マウス操作）
    default:
      return 44;
  }
};

/**
 * デバイスタイプに応じた最適なスペーシングを取得
 */
export const getOptimalSpacing = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'
): number => {
  const baseSpacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };

  const multiplier = {
    mobile: 1.2,   // モバイルは少し大きめ
    tablet: 1.1,   // タブレットは少し大きめ
    desktop: 1.0,  // デスクトップは標準
  };

  return Math.round(baseSpacing[size] * multiplier[deviceType]);
};

/**
 * デバイスタイプに応じた最適なフォントサイズを取得
 */
export const getOptimalFontSize = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  variant: 'caption' | 'body2' | 'body1' | 'subtitle1' | 'h6' = 'body1'
): string => {
  const baseSizes = {
    caption: '0.75rem',
    body2: '0.875rem',
    body1: '1rem',
    subtitle1: '1.125rem',
    h6: '1.25rem',
  };

  const adjustments = {
    mobile: {
      caption: '0.8rem',
      body2: '0.9rem',
      body1: '1rem',
      subtitle1: '1.1rem',
      h6: '1.2rem',
    },
    tablet: {
      caption: '0.75rem',
      body2: '0.875rem',
      body1: '1rem',
      subtitle1: '1.125rem',
      h6: '1.25rem',
    },
    desktop: baseSizes,
  };

  return adjustments[deviceType][variant];
};