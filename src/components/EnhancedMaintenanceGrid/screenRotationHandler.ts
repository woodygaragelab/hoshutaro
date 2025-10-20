import { useEffect, useState, useCallback } from 'react';

export interface ScreenRotationState {
  orientation: 'portrait' | 'landscape';
  angle: number;
  isRotating: boolean;
  dimensions: {
    width: number;
    height: number;
  };
  safeArea: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface ScreenRotationOptions {
  onRotationStart?: (newOrientation: 'portrait' | 'landscape') => void;
  onRotationEnd?: (newOrientation: 'portrait' | 'landscape') => void;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  debounceMs?: number;
}

/**
 * 画面回転を検出し、レイアウトの自動調整を行うフック
 */
export const useScreenRotation = (options: ScreenRotationOptions = {}) => {
  const {
    onRotationStart,
    onRotationEnd,
    onDimensionsChange,
    debounceMs = 100,
  } = options;

  const [rotationState, setRotationState] = useState<ScreenRotationState>(() => {
    const isLandscape = window.innerWidth > window.innerHeight;
    return {
      orientation: isLandscape ? 'landscape' : 'portrait',
      angle: (screen.orientation?.angle) || 0,
      isRotating: false,
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      safeArea: getSafeAreaInsets(),
    };
  });

  const [debounceTimer, setDebounceTimer] = useState<number | null>(null);

  // セーフエリアの取得（iOS対応）
  function getSafeAreaInsets() {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--sat') || '0', 10),
      right: parseInt(style.getPropertyValue('--sar') || '0', 10),
      bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
      left: parseInt(style.getPropertyValue('--sal') || '0', 10),
    };
  }

  // 回転状態の更新
  const updateRotationState = useCallback(() => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    const newOrientation = newWidth > newHeight ? 'landscape' : 'portrait';
    const newAngle = (screen.orientation?.angle) || 0;
    const newSafeArea = getSafeAreaInsets();

    const prevOrientation = rotationState.orientation;

    setRotationState(prev => ({
      ...prev,
      orientation: newOrientation,
      angle: newAngle,
      dimensions: { width: newWidth, height: newHeight },
      safeArea: newSafeArea,
      isRotating: false,
    }));

    // コールバック実行
    if (newOrientation !== prevOrientation) {
      onRotationEnd?.(newOrientation);
    }
    
    onDimensionsChange?.({ width: newWidth, height: newHeight });
  }, [rotationState.orientation, onRotationEnd, onDimensionsChange]);

  // 回転開始の検出
  const handleRotationStart = useCallback(() => {
    const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    const newOrientation = currentOrientation === 'landscape' ? 'portrait' : 'landscape';

    setRotationState(prev => ({
      ...prev,
      isRotating: true,
    }));

    onRotationStart?.(newOrientation);
  }, [onRotationStart]);

  // デバウンス付きの更新処理
  const debouncedUpdate = useCallback(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = window.setTimeout(updateRotationState, debounceMs);
    setDebounceTimer(timer);
  }, [debounceTimer, updateRotationState, debounceMs]);

  useEffect(() => {
    // 画面回転イベントリスナー
    const handleOrientationChange = () => {
      handleRotationStart();
      debouncedUpdate();
    };

    const handleResize = () => {
      debouncedUpdate();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // アプリが再表示された時に状態を更新
        updateRotationState();
      }
    };

    // イベントリスナーの登録
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Screen Orientation API対応（モダンブラウザ）
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // クリーンアップ
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [handleRotationStart, debouncedUpdate, updateRotationState, debounceTimer]);

  return rotationState;
};

/**
 * 画面回転時のレイアウト調整ユーティリティ
 */
export const getRotationAdjustedLayout = (
  orientation: 'portrait' | 'landscape',
  baseLayout: {
    columnCount: number;
    rowHeight: number;
    spacing: number;
  }
) => {
  if (orientation === 'landscape') {
    return {
      columnCount: Math.min(baseLayout.columnCount * 1.5, 12), // 横向きでは列数を増やす
      rowHeight: baseLayout.rowHeight * 0.9, // 行の高さを少し小さく
      spacing: baseLayout.spacing * 0.8, // スペーシングを少し小さく
    };
  } else {
    return {
      columnCount: Math.max(baseLayout.columnCount * 0.7, 3), // 縦向きでは列数を減らす
      rowHeight: baseLayout.rowHeight * 1.1, // 行の高さを少し大きく
      spacing: baseLayout.spacing, // スペーシングは標準
    };
  }
};

/**
 * 画面回転時の状態保持ユーティリティ
 */
export class RotationStateManager {
  private static instance: RotationStateManager;
  private stateStorage: Map<string, any> = new Map();

  static getInstance(): RotationStateManager {
    if (!RotationStateManager.instance) {
      RotationStateManager.instance = new RotationStateManager();
    }
    return RotationStateManager.instance;
  }

  // 状態を保存
  saveState(key: string, state: any): void {
    this.stateStorage.set(key, JSON.parse(JSON.stringify(state)));
  }

  // 状態を復元
  restoreState<T>(key: string, defaultState: T): T {
    const saved = this.stateStorage.get(key);
    return saved ? { ...defaultState, ...saved } : defaultState;
  }

  // 状態をクリア
  clearState(key: string): void {
    this.stateStorage.delete(key);
  }

  // 全状態をクリア
  clearAllStates(): void {
    this.stateStorage.clear();
  }
}

/**
 * 画面回転時のスクロール位置保持
 */
export const preserveScrollPosition = (
  element: HTMLElement | null,
  orientation: 'portrait' | 'landscape'
): (() => void) => {
  if (!element) return () => {};

  const stateManager = RotationStateManager.getInstance();
  const scrollKey = `scroll_${element.id || 'default'}`;

  // 現在のスクロール位置を保存
  stateManager.saveState(scrollKey, {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    orientation,
  });

  // 復元関数を返す
  return () => {
    const savedState = stateManager.restoreState(scrollKey, {
      scrollLeft: 0,
      scrollTop: 0,
      orientation: 'portrait',
    });

    // 向きが変わった場合は位置を調整
    if (savedState.orientation !== orientation) {
      // 横向きから縦向き、または縦向きから横向きの場合の調整
      const adjustmentFactor = orientation === 'landscape' ? 1.2 : 0.8;
      element.scrollLeft = savedState.scrollLeft * adjustmentFactor;
      element.scrollTop = savedState.scrollTop;
    } else {
      element.scrollLeft = savedState.scrollLeft;
      element.scrollTop = savedState.scrollTop;
    }
  };
};

/**
 * 画面回転アニメーション用のCSS変数を設定
 */
export const setRotationCSSVariables = (orientation: 'portrait' | 'landscape') => {
  const root = document.documentElement;
  
  if (orientation === 'landscape') {
    root.style.setProperty('--rotation-scale', '1.1');
    root.style.setProperty('--rotation-spacing', '0.8');
    root.style.setProperty('--rotation-font-scale', '0.95');
  } else {
    root.style.setProperty('--rotation-scale', '1.0');
    root.style.setProperty('--rotation-spacing', '1.0');
    root.style.setProperty('--rotation-font-scale', '1.0');
  }
};