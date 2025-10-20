import { Theme } from '@mui/material/styles';

// デバイス最適化設定
export interface SpecificationDeviceOptimization {
  desktop: {
    enableInlineEdit: boolean;
    enableDragAndDrop: boolean;
    enableKeyboardShortcuts: boolean;
    showDetailedValidation: boolean;
    compactMode: boolean;
  };
  tablet: {
    enableTouchReorder: boolean;
    largeTargets: boolean;
    adaptiveKeyboard: boolean;
    swipeGestures: boolean;
    orientationAdaptive: boolean;
  };
  mobile: {
    fullScreenMode: boolean;
    oneHandedMode: boolean;
    hapticFeedback: boolean;
    voiceInput: boolean;
    simplifiedUI: boolean;
  };
}

// デフォルトのデバイス最適化設定
export const DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION: SpecificationDeviceOptimization = {
  desktop: {
    enableInlineEdit: true,
    enableDragAndDrop: true,
    enableKeyboardShortcuts: true,
    showDetailedValidation: true,
    compactMode: false,
  },
  tablet: {
    enableTouchReorder: true,
    largeTargets: true,
    adaptiveKeyboard: true,
    swipeGestures: false, // 実装が複雑なため初期は無効
    orientationAdaptive: true,
  },
  mobile: {
    fullScreenMode: true,
    oneHandedMode: true,
    hapticFeedback: false, // ブラウザサポートが限定的
    voiceInput: false, // 実装が複雑なため初期は無効
    simplifiedUI: true,
  },
};

/**
 * デバイス固有のスタイルを取得
 */
export const getSpecificationDeviceStyles = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  theme: Theme
) => {
  const baseStyles = {
    desktop: {
      listItemPadding: '8px 16px',
      textFieldSize: 'small' as const,
      buttonSize: 'small' as const,
      iconSize: '1.25rem',
      fontSize: '0.875rem',
      minTouchTarget: '32px',
      borderRadius: theme.shape.borderRadius,
      elevation: 2,
    },
    tablet: {
      listItemPadding: '12px 20px',
      textFieldSize: 'medium' as const,
      buttonSize: 'medium' as const,
      iconSize: '1.5rem',
      fontSize: '1rem',
      minTouchTarget: '44px',
      borderRadius: (theme.shape.borderRadius as number) * 1.5,
      elevation: 4,
    },
    mobile: {
      listItemPadding: '16px 24px',
      textFieldSize: 'medium' as const,
      buttonSize: 'large' as const,
      iconSize: '1.75rem',
      fontSize: '1.125rem',
      minTouchTarget: '48px',
      borderRadius: (theme.shape.borderRadius as number) * 2,
      elevation: 6,
    },
  };

  return baseStyles[deviceType];
};

/**
 * デバイス固有の入力属性を取得
 */
export const getSpecificationInputAttributes = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  fieldType: 'key' | 'value',
  optimization: SpecificationDeviceOptimization = DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION
) => {
  const baseAttributes = {
    autoComplete: 'off',
    spellCheck: false,
  };

  switch (deviceType) {
    case 'desktop':
      return {
        ...baseAttributes,
        title: optimization.desktop.enableKeyboardShortcuts 
          ? 'Tab: 次のフィールド, Shift+Tab: 前のフィールド, Enter: 保存'
          : undefined,
      };

    case 'tablet':
      return {
        ...baseAttributes,
        inputMode: fieldType === 'key' ? 'text' as const : 'text' as const,
        enterKeyHint: 'next' as const,
      };

    case 'mobile':
      return {
        ...baseAttributes,
        inputMode: fieldType === 'key' ? 'text' as const : 'text' as const,
        enterKeyHint: fieldType === 'value' ? 'done' as const : 'next' as const,
        autoCapitalize: 'sentences' as const,
      };

    default:
      return baseAttributes;
  }
};

/**
 * デバイス固有のボタンスタイルを取得
 */
export const getSpecificationButtonStyles = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  variant: 'primary' | 'secondary' | 'danger' = 'primary',
  theme: Theme
) => {
  const deviceStyles = getSpecificationDeviceStyles(deviceType, theme);
  
  const baseStyles = {
    minHeight: deviceStyles.minTouchTarget,
    fontSize: deviceStyles.fontSize,
    borderRadius: deviceStyles.borderRadius,
  };

  const variantStyles = {
    primary: {
      fontWeight: 'bold',
    },
    secondary: {
      fontWeight: 'normal',
    },
    danger: {
      fontWeight: 'bold',
      color: theme.palette.error.main,
      borderColor: theme.palette.error.main,
      '&:hover': {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.error.contrastText,
      },
    },
  };

  return {
    ...baseStyles,
    ...variantStyles[variant],
  };
};

/**
 * デバイス固有のキーボードハンドラーを作成
 */
export const createSpecificationKeyboardHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  handlers: {
    onSave: () => void;
    onCancel: () => void;
    onAddItem: () => void;
    onDeleteItem?: (index: number) => void;
    onMoveUp?: (index: number) => void;
    onMoveDown?: (index: number) => void;
  },
  optimization: SpecificationDeviceOptimization = DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION
) => {
  return (event: React.KeyboardEvent) => {
    // デスクトップでのキーボードショートカット
    if (deviceType === 'desktop' && optimization.desktop.enableKeyboardShortcuts) {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            handlers.onSave();
            break;
          case 's':
            event.preventDefault();
            handlers.onSave();
            break;
          case 'n':
            event.preventDefault();
            handlers.onAddItem();
            break;
        }
      } else {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            handlers.onCancel();
            break;
        }
      }
    }

    // タブレット・モバイルでの基本的なキーボード操作
    if (deviceType === 'tablet' || deviceType === 'mobile') {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          handlers.onCancel();
          break;
      }
    }
  };
};

/**
 * デバイス固有のフォーカスハンドラーを作成
 */
export const createSpecificationFocusHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  optimization: SpecificationDeviceOptimization = DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION
) => {
  return (event: React.FocusEvent<HTMLInputElement>) => {
    // モバイルでの自動スクロール
    if (deviceType === 'mobile' && optimization.mobile.oneHandedMode) {
      setTimeout(() => {
        event.target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }

    // タブレットでの適応的キーボード
    if (deviceType === 'tablet' && optimization.tablet.adaptiveKeyboard) {
      // ソフトキーボードの表示を考慮した画面調整
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
      }
    }
  };
};

/**
 * デバイス固有のブラーハンドラーを作成
 */
export const createSpecificationBlurHandler = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  optimization: SpecificationDeviceOptimization = DEFAULT_SPECIFICATION_DEVICE_OPTIMIZATION
) => {
  return (_event: React.FocusEvent<HTMLInputElement>) => {
    // タブレットでのビューポート復元
    if (deviceType === 'tablet' && optimization.tablet.adaptiveKeyboard) {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, user-scalable=yes'
        );
      }
    }
  };
};

/**
 * デバイス固有のアニメーション設定を取得
 */
export const getSpecificationAnimationConfig = (
  deviceType: 'desktop' | 'tablet' | 'mobile'
) => {
  return {
    desktop: {
      duration: 200,
      easing: 'ease-out',
      stagger: 50,
    },
    tablet: {
      duration: 300,
      easing: 'ease-in-out',
      stagger: 75,
    },
    mobile: {
      duration: 400,
      easing: 'ease-in-out',
      stagger: 100,
    },
  }[deviceType];
};

/**
 * デバイス固有のレイアウト設定を取得
 */
export const getSpecificationLayoutConfig = (
  deviceType: 'desktop' | 'tablet' | 'mobile',
  orientation?: 'portrait' | 'landscape'
) => {
  const baseConfig = {
    desktop: {
      maxWidth: 600,
      maxHeight: '70vh',
      columns: 1,
      itemsPerPage: 10,
      showReorderControls: true,
      showInlineEdit: true,
    },
    tablet: {
      maxWidth: '90vw',
      maxHeight: '80vh',
      columns: 1,
      itemsPerPage: 8,
      showReorderControls: true,
      showInlineEdit: false,
    },
    mobile: {
      maxWidth: '100vw',
      maxHeight: '100vh',
      columns: 1,
      itemsPerPage: 6,
      showReorderControls: false,
      showInlineEdit: false,
    },
  }[deviceType];

  // タブレットの画面回転対応
  if (deviceType === 'tablet' && orientation === 'landscape') {
    return {
      ...baseConfig,
      maxHeight: '90vh',
      itemsPerPage: 6,
    };
  }

  return baseConfig;
};

/**
 * タッチジェスチャーのサポート検出
 */
export const detectTouchCapabilities = () => {
  return {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasHover: window.matchMedia('(hover: hover)').matches,
    hasPointerEvents: 'PointerEvent' in window,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    supportsHaptics: 'vibrate' in navigator,
  };
};

/**
 * デバイス固有のエラー表示設定を取得
 */
export const getSpecificationErrorDisplayConfig = (
  deviceType: 'desktop' | 'tablet' | 'mobile'
) => {
  return {
    desktop: {
      showInlineErrors: true,
      showTooltipErrors: true,
      showSummaryErrors: false,
      maxErrorsShown: 5,
    },
    tablet: {
      showInlineErrors: true,
      showTooltipErrors: false,
      showSummaryErrors: true,
      maxErrorsShown: 3,
    },
    mobile: {
      showInlineErrors: false,
      showTooltipErrors: false,
      showSummaryErrors: true,
      maxErrorsShown: 2,
    },
  }[deviceType];
};