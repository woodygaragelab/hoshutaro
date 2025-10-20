/**
 * デバイス別最適化機能
 */

export interface DeviceOptimizationConfig {
  // モバイル最適化
  mobile: {
    useNumericKeypad: boolean;
    enableHapticFeedback: boolean;
    autoFormatOnBlur: boolean;
    showLargeButtons: boolean;
    enableSwipeGestures: boolean;
  };
  
  // タブレット最適化
  tablet: {
    optimizeForTouch: boolean;
    showToolbar: boolean;
    enableDragAndDrop: boolean;
    adaptiveLayout: boolean;
  };
  
  // デスクトップ最適化
  desktop: {
    enableKeyboardShortcuts: boolean;
    showTooltips: boolean;
    enableContextMenu: boolean;
    precisionInput: boolean;
  };
}

export const DEFAULT_DEVICE_OPTIMIZATION: DeviceOptimizationConfig = {
  mobile: {
    useNumericKeypad: true,
    enableHapticFeedback: true,
    autoFormatOnBlur: true,
    showLargeButtons: true,
    enableSwipeGestures: false, // コスト入力では不要
  },
  tablet: {
    optimizeForTouch: true,
    showToolbar: false, // シンプルに保つ
    enableDragAndDrop: false, // コスト入力では不要
    adaptiveLayout: true,
  },
  desktop: {
    enableKeyboardShortcuts: true,
    showTooltips: true,
    enableContextMenu: false, // シンプルに保つ
    precisionInput: true,
  },
};

/**
 * デバイス固有のスタイル設定を取得
 */
export const getDeviceSpecificStyles = (deviceType: 'desktop' | 'tablet' | 'mobile') => {
  const baseStyles = {
    // 共通スタイル
    transition: 'all 0.2s ease-in-out',
    borderRadius: 1,
  };

  switch (deviceType) {
    case 'mobile':
      return {
        ...baseStyles,
        // モバイル用の大きなタッチターゲット
        minHeight: 56,
        fontSize: '1.1rem',
        padding: '16px',
        // タッチフレンドリーなスペーシング
        marginBottom: '16px',
        // 読みやすいフォント
        fontFamily: 'system-ui, -apple-system, sans-serif',
      };
      
    case 'tablet':
      return {
        ...baseStyles,
        // タブレット用の中間サイズ
        minHeight: 48,
        fontSize: '1rem',
        padding: '12px',
        marginBottom: '12px',
        // バランスの取れたフォント
        fontFamily: 'system-ui, -apple-system, sans-serif',
      };
      
    case 'desktop':
      return {
        ...baseStyles,
        // デスクトップ用のコンパクトサイズ
        minHeight: 40,
        fontSize: '0.875rem',
        padding: '8px',
        marginBottom: '8px',
        // 精密な入力に適したフォント
        fontFamily: 'monospace',
      };
      
    default:
      return baseStyles;
  }
};

/**
 * デバイス固有の入力属性を取得
 */
export const getDeviceInputAttributes = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  config: DeviceOptimizationConfig = DEFAULT_DEVICE_OPTIMIZATION
) => {
  const baseAttributes = {
    autoComplete: 'off',
    spellCheck: false,
  };

  switch (deviceType) {
    case 'mobile':
      return {
        ...baseAttributes,
        // 数値キーパッドの表示
        inputMode: config.mobile.useNumericKeypad ? 'numeric' as const : 'text' as const,
        pattern: config.mobile.useNumericKeypad ? '[0-9]*' : undefined,
        // モバイル固有の属性
        autoCapitalize: 'none',
        autoCorrect: 'off',
        // タッチ最適化
        enterKeyHint: 'done' as const,
      };
      
    case 'tablet':
      return {
        ...baseAttributes,
        // タブレットでも数値キーパッドを使用
        inputMode: 'numeric' as const,
        pattern: '[0-9]*',
        autoCapitalize: 'none',
        autoCorrect: 'off',
        enterKeyHint: 'next' as const,
      };
      
    case 'desktop':
      return {
        ...baseAttributes,
        // デスクトップでは標準的な入力
        inputMode: 'text' as const,
        // キーボードショートカットのヒント
        title: config.desktop.enableKeyboardShortcuts 
          ? 'Ctrl+Enter: 保存, Esc: キャンセル, Tab: 次のフィールド' 
          : undefined,
      };
      
    default:
      return baseAttributes;
  }
};

/**
 * デバイス固有のキーボードイベントハンドラー
 */
export const createDeviceKeyboardHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  handlers: {
    onSave?: () => void;
    onCancel?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
  },
  config: DeviceOptimizationConfig = DEFAULT_DEVICE_OPTIMIZATION
) => {
  return (event: React.KeyboardEvent) => {
    // デスクトップでのキーボードショートカット
    if (deviceType === 'desktop' && config.desktop.enableKeyboardShortcuts) {
      if (event.key === 'Enter' && event.ctrlKey && handlers.onSave) {
        event.preventDefault();
        handlers.onSave();
        return;
      }
      
      if (event.key === 'Escape' && handlers.onCancel) {
        event.preventDefault();
        handlers.onCancel();
        return;
      }
      
      if (event.key === 'Tab' && !event.shiftKey && handlers.onNext) {
        // Tabキーでの次のフィールドへの移動は標準動作に任せる
        return;
      }
      
      if (event.key === 'Tab' && event.shiftKey && handlers.onPrevious) {
        // Shift+Tabキーでの前のフィールドへの移動は標準動作に任せる
        return;
      }
    }
    
    // モバイル・タブレットでのEnterキー処理
    if ((deviceType === 'mobile' || deviceType === 'tablet') && event.key === 'Enter') {
      if (handlers.onNext) {
        event.preventDefault();
        handlers.onNext();
      }
    }
  };
};

/**
 * デバイス固有のフォーカス処理
 */
export const createDeviceFocusHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  config: DeviceOptimizationConfig = DEFAULT_DEVICE_OPTIMIZATION
) => {
  return (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.target;
    
    // 入力要素が存在しない場合は何もしない
    if (!input) return;
    
    // モバイルでの数値キーパッド表示
    if (deviceType === 'mobile' && config.mobile.useNumericKeypad) {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9]*');
    }
    
    // タブレットでの数値キーパッド表示
    if (deviceType === 'tablet' && config.tablet.optimizeForTouch) {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9]*');
    }
    
    // デスクトップでの精密入力モード
    if (deviceType === 'desktop' && config.desktop.precisionInput) {
      // 全選択で入力しやすくする
      setTimeout(() => {
        input.select();
      }, 0);
    }
    
    // ハプティックフィードバック（モバイル）
    if (deviceType === 'mobile' && config.mobile.enableHapticFeedback) {
      // Vibration APIが利用可能な場合
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10); // 軽い振動
      }
    }
  };
};

/**
 * デバイス固有のブラー処理
 */
export const createDeviceBlurHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  onFormat?: (value: string) => string,
  config: DeviceOptimizationConfig = DEFAULT_DEVICE_OPTIMIZATION
) => {
  return (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.target;
    
    // モバイルでの自動フォーマット
    if (deviceType === 'mobile' && config.mobile.autoFormatOnBlur && onFormat) {
      const formattedValue = onFormat(input.value);
      if (formattedValue !== input.value) {
        input.value = formattedValue;
        // 変更イベントを発火
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    }
  };
};

/**
 * デバイス固有のボタンスタイルを取得
 */
export const getDeviceButtonStyles = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  variant: 'primary' | 'secondary' = 'primary'
) => {
  const baseStyles = {
    borderRadius: 1,
    fontWeight: 'bold',
    transition: 'all 0.2s ease-in-out',
  };

  const sizeStyles = {
    mobile: {
      minHeight: 48,
      minWidth: 140,
      fontSize: '1rem',
      padding: '12px 24px',
    },
    tablet: {
      minHeight: 44,
      minWidth: 120,
      fontSize: '0.875rem',
      padding: '10px 20px',
    },
    desktop: {
      minHeight: 36,
      minWidth: 100,
      fontSize: '0.875rem',
      padding: '8px 16px',
    },
  };

  return {
    ...baseStyles,
    ...sizeStyles[deviceType],
    // バリアント固有のスタイル
    ...(variant === 'primary' ? {
      '&:hover': {
        transform: deviceType === 'mobile' ? 'scale(1.02)' : 'scale(1.01)',
      },
    } : {}),
  };
};

/**
 * デバイス固有のアニメーション設定
 */
export const getDeviceAnimationConfig = (deviceType: 'desktop' | 'tablet' | 'mobile') => {
  switch (deviceType) {
    case 'mobile':
      return {
        duration: 300,
        easing: 'ease-out',
        // モバイルではよりスムーズなアニメーション
        spring: {
          tension: 280,
          friction: 60,
        },
      };
      
    case 'tablet':
      return {
        duration: 250,
        easing: 'ease-in-out',
        spring: {
          tension: 300,
          friction: 50,
        },
      };
      
    case 'desktop':
      return {
        duration: 200,
        easing: 'ease-in-out',
        // デスクトップでは高速なアニメーション
        spring: {
          tension: 350,
          friction: 40,
        },
      };
      
    default:
      return {
        duration: 250,
        easing: 'ease-in-out',
        spring: {
          tension: 300,
          friction: 50,
        },
      };
  }
};