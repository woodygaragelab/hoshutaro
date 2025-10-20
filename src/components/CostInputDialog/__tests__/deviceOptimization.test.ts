import {
  getDeviceSpecificStyles,
  getDeviceInputAttributes,
  createDeviceKeyboardHandler,
  createDeviceFocusHandler,
  createDeviceBlurHandler,
  getDeviceButtonStyles,
  getDeviceAnimationConfig,
  DEFAULT_DEVICE_OPTIMIZATION,
  type DeviceOptimizationConfig,
} from '../deviceOptimization';

// モックのNavigator Vibrate API
const mockVibrate = jest.fn();
Object.defineProperty(navigator, 'vibrate', {
  value: mockVibrate,
  writable: true,
});

describe('deviceOptimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceSpecificStyles', () => {
    it('モバイル用のスタイルを返す', () => {
      const styles = getDeviceSpecificStyles('mobile');
      
      expect(styles.minHeight).toBe(56);
      expect(styles.fontSize).toBe('1.1rem');
      expect(styles.padding).toBe('16px');
      expect(styles.marginBottom).toBe('16px');
      expect(styles.fontFamily).toBe('system-ui, -apple-system, sans-serif');
    });

    it('タブレット用のスタイルを返す', () => {
      const styles = getDeviceSpecificStyles('tablet');
      
      expect(styles.minHeight).toBe(48);
      expect(styles.fontSize).toBe('1rem');
      expect(styles.padding).toBe('12px');
      expect(styles.marginBottom).toBe('12px');
      expect(styles.fontFamily).toBe('system-ui, -apple-system, sans-serif');
    });

    it('デスクトップ用のスタイルを返す', () => {
      const styles = getDeviceSpecificStyles('desktop');
      
      expect(styles.minHeight).toBe(40);
      expect(styles.fontSize).toBe('0.875rem');
      expect(styles.padding).toBe('8px');
      expect(styles.marginBottom).toBe('8px');
      expect(styles.fontFamily).toBe('monospace');
    });

    it('共通のスタイルが含まれる', () => {
      const styles = getDeviceSpecificStyles('desktop');
      
      expect(styles.transition).toBe('all 0.2s ease-in-out');
      expect(styles.borderRadius).toBe(1);
    });

    it('不正なデバイスタイプでは基本スタイルのみ返す', () => {
      const styles = getDeviceSpecificStyles('unknown' as any);
      
      expect(styles.transition).toBe('all 0.2s ease-in-out');
      expect(styles.borderRadius).toBe(1);
      expect(styles.minHeight).toBeUndefined();
    });
  });

  describe('getDeviceInputAttributes', () => {
    it('モバイル用の入力属性を返す', () => {
      const attributes = getDeviceInputAttributes('mobile');
      
      expect(attributes.inputMode).toBe('numeric');
      expect(attributes.pattern).toBe('[0-9]*');
      expect(attributes.autoCapitalize).toBe('none');
      expect(attributes.autoCorrect).toBe('off');
      expect(attributes.enterKeyHint).toBe('done');
    });

    it('タブレット用の入力属性を返す', () => {
      const attributes = getDeviceInputAttributes('tablet');
      
      expect(attributes.inputMode).toBe('numeric');
      expect(attributes.pattern).toBe('[0-9]*');
      expect(attributes.autoCapitalize).toBe('none');
      expect(attributes.autoCorrect).toBe('off');
      expect(attributes.enterKeyHint).toBe('next');
    });

    it('デスクトップ用の入力属性を返す', () => {
      const attributes = getDeviceInputAttributes('desktop');
      
      expect(attributes.inputMode).toBe('text');
      expect(attributes.title).toBe('Ctrl+Enter: 保存, Esc: キャンセル, Tab: 次のフィールド');
    });

    it('共通の属性が含まれる', () => {
      const attributes = getDeviceInputAttributes('mobile');
      
      expect(attributes.autoComplete).toBe('off');
      expect(attributes.spellCheck).toBe(false);
    });

    it('カスタム設定でモバイルの数値キーパッドを無効にできる', () => {
      const config: DeviceOptimizationConfig = {
        ...DEFAULT_DEVICE_OPTIMIZATION,
        mobile: {
          ...DEFAULT_DEVICE_OPTIMIZATION.mobile,
          useNumericKeypad: false,
        },
      };
      
      const attributes = getDeviceInputAttributes('mobile', config);
      
      expect(attributes.inputMode).toBe('text');
      expect(attributes.pattern).toBeUndefined();
    });

    it('カスタム設定でデスクトップのキーボードショートカットを無効にできる', () => {
      const config: DeviceOptimizationConfig = {
        ...DEFAULT_DEVICE_OPTIMIZATION,
        desktop: {
          ...DEFAULT_DEVICE_OPTIMIZATION.desktop,
          enableKeyboardShortcuts: false,
        },
      };
      
      const attributes = getDeviceInputAttributes('desktop', config);
      
      expect(attributes.title).toBeUndefined();
    });
  });

  describe('createDeviceKeyboardHandler', () => {
    const mockHandlers = {
      onSave: jest.fn(),
      onCancel: jest.fn(),
      onNext: jest.fn(),
      onPrevious: jest.fn(),
    };

    beforeEach(() => {
      Object.values(mockHandlers).forEach(mock => mock.mockClear());
    });

    it('デスクトップでCtrl+Enterで保存が呼ばれる', () => {
      const handler = createDeviceKeyboardHandler('desktop', mockHandlers);
      const mockEvent = {
        key: 'Enter',
        ctrlKey: true,
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHandlers.onSave).toHaveBeenCalled();
    });

    it('デスクトップでEscapeでキャンセルが呼ばれる', () => {
      const handler = createDeviceKeyboardHandler('desktop', mockHandlers);
      const mockEvent = {
        key: 'Escape',
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHandlers.onCancel).toHaveBeenCalled();
    });

    it('デスクトップでTabキーは標準動作に任せる', () => {
      const handler = createDeviceKeyboardHandler('desktop', mockHandlers);
      const mockEvent = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockHandlers.onNext).not.toHaveBeenCalled();
    });

    it('モバイルでEnterキーで次のフィールドに移動', () => {
      const handler = createDeviceKeyboardHandler('mobile', mockHandlers);
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHandlers.onNext).toHaveBeenCalled();
    });

    it('タブレットでEnterキーで次のフィールドに移動', () => {
      const handler = createDeviceKeyboardHandler('tablet', mockHandlers);
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockHandlers.onNext).toHaveBeenCalled();
    });

    it('キーボードショートカットが無効な場合は動作しない', () => {
      const config: DeviceOptimizationConfig = {
        ...DEFAULT_DEVICE_OPTIMIZATION,
        desktop: {
          ...DEFAULT_DEVICE_OPTIMIZATION.desktop,
          enableKeyboardShortcuts: false,
        },
      };

      const handler = createDeviceKeyboardHandler('desktop', mockHandlers, config);
      const mockEvent = {
        key: 'Enter',
        ctrlKey: true,
        preventDefault: jest.fn(),
      } as any;

      handler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockHandlers.onSave).not.toHaveBeenCalled();
    });
  });

  describe('createDeviceFocusHandler', () => {
    let mockInput: HTMLInputElement;

    beforeEach(() => {
      mockInput = {
        setAttribute: jest.fn(),
        select: jest.fn(),
      } as any;
    });

    it('モバイルで数値キーパッド属性を設定する', () => {
      const handler = createDeviceFocusHandler('mobile');
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockInput.setAttribute).toHaveBeenCalledWith('inputmode', 'numeric');
      expect(mockInput.setAttribute).toHaveBeenCalledWith('pattern', '[0-9]*');
    });

    it('タブレットで数値キーパッド属性を設定する', () => {
      const handler = createDeviceFocusHandler('tablet');
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockInput.setAttribute).toHaveBeenCalledWith('inputmode', 'numeric');
      expect(mockInput.setAttribute).toHaveBeenCalledWith('pattern', '[0-9]*');
    });

    it('デスクトップで全選択を実行する', (done) => {
      const handler = createDeviceFocusHandler('desktop');
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      // setTimeoutで遅延実行されるため、少し待つ
      setTimeout(() => {
        expect(mockInput.select).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('モバイルでハプティックフィードバックが動作する', () => {
      const handler = createDeviceFocusHandler('mobile');
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockVibrate).toHaveBeenCalledWith(10);
    });

    it('ハプティックフィードバックが無効な場合は振動しない', () => {
      const config: DeviceOptimizationConfig = {
        ...DEFAULT_DEVICE_OPTIMIZATION,
        mobile: {
          ...DEFAULT_DEVICE_OPTIMIZATION.mobile,
          enableHapticFeedback: false,
        },
      };

      const handler = createDeviceFocusHandler('mobile', config);
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockVibrate).not.toHaveBeenCalled();
    });
  });

  describe('createDeviceBlurHandler', () => {
    let mockInput: HTMLInputElement;
    const mockOnFormat = jest.fn();

    beforeEach(() => {
      mockInput = {
        value: '1000',
        dispatchEvent: jest.fn(),
      } as any;
      mockOnFormat.mockClear();
    });

    it('モバイルで自動フォーマットが実行される', () => {
      mockOnFormat.mockReturnValue('1,000');
      
      const handler = createDeviceBlurHandler('mobile', mockOnFormat);
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockOnFormat).toHaveBeenCalledWith('1000');
      expect(mockInput.value).toBe('1,000');
      expect(mockInput.dispatchEvent).toHaveBeenCalled();
    });

    it('フォーマット結果が同じ場合は変更しない', () => {
      mockOnFormat.mockReturnValue('1000');
      
      const handler = createDeviceBlurHandler('mobile', mockOnFormat);
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockOnFormat).toHaveBeenCalledWith('1000');
      expect(mockInput.dispatchEvent).not.toHaveBeenCalled();
    });

    it('自動フォーマットが無効な場合は実行されない', () => {
      const config: DeviceOptimizationConfig = {
        ...DEFAULT_DEVICE_OPTIMIZATION,
        mobile: {
          ...DEFAULT_DEVICE_OPTIMIZATION.mobile,
          autoFormatOnBlur: false,
        },
      };

      const handler = createDeviceBlurHandler('mobile', mockOnFormat, config);
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockOnFormat).not.toHaveBeenCalled();
    });

    it('デスクトップでは自動フォーマットが実行されない', () => {
      const handler = createDeviceBlurHandler('desktop', mockOnFormat);
      const mockEvent = { target: mockInput } as any;

      handler(mockEvent);

      expect(mockOnFormat).not.toHaveBeenCalled();
    });
  });

  describe('getDeviceButtonStyles', () => {
    it('モバイル用のボタンスタイルを返す', () => {
      const styles = getDeviceButtonStyles('mobile');
      
      expect(styles.minHeight).toBe(48);
      expect(styles.minWidth).toBe(140);
      expect(styles.fontSize).toBe('1rem');
      expect(styles.padding).toBe('12px 24px');
    });

    it('タブレット用のボタンスタイルを返す', () => {
      const styles = getDeviceButtonStyles('tablet');
      
      expect(styles.minHeight).toBe(44);
      expect(styles.minWidth).toBe(120);
      expect(styles.fontSize).toBe('0.875rem');
      expect(styles.padding).toBe('10px 20px');
    });

    it('デスクトップ用のボタンスタイルを返す', () => {
      const styles = getDeviceButtonStyles('desktop');
      
      expect(styles.minHeight).toBe(36);
      expect(styles.minWidth).toBe(100);
      expect(styles.fontSize).toBe('0.875rem');
      expect(styles.padding).toBe('8px 16px');
    });

    it('プライマリボタンにはホバー効果が含まれる', () => {
      const styles = getDeviceButtonStyles('mobile', 'primary');
      
      expect(styles['&:hover']).toBeDefined();
      expect(styles['&:hover'].transform).toBe('scale(1.02)');
    });

    it('セカンダリボタンにはホバー効果が含まれない', () => {
      const styles = getDeviceButtonStyles('mobile', 'secondary');
      
      expect(styles['&:hover']).toBeUndefined();
    });

    it('共通のスタイルが含まれる', () => {
      const styles = getDeviceButtonStyles('desktop');
      
      expect(styles.borderRadius).toBe(1);
      expect(styles.fontWeight).toBe('bold');
      expect(styles.transition).toBe('all 0.2s ease-in-out');
    });
  });

  describe('getDeviceAnimationConfig', () => {
    it('モバイル用のアニメーション設定を返す', () => {
      const config = getDeviceAnimationConfig('mobile');
      
      expect(config.duration).toBe(300);
      expect(config.easing).toBe('ease-out');
      expect(config.spring.tension).toBe(280);
      expect(config.spring.friction).toBe(60);
    });

    it('タブレット用のアニメーション設定を返す', () => {
      const config = getDeviceAnimationConfig('tablet');
      
      expect(config.duration).toBe(250);
      expect(config.easing).toBe('ease-in-out');
      expect(config.spring.tension).toBe(300);
      expect(config.spring.friction).toBe(50);
    });

    it('デスクトップ用のアニメーション設定を返す', () => {
      const config = getDeviceAnimationConfig('desktop');
      
      expect(config.duration).toBe(200);
      expect(config.easing).toBe('ease-in-out');
      expect(config.spring.tension).toBe(350);
      expect(config.spring.friction).toBe(40);
    });

    it('不正なデバイスタイプではデフォルト設定を返す', () => {
      const config = getDeviceAnimationConfig('unknown' as any);
      
      expect(config.duration).toBe(250);
      expect(config.easing).toBe('ease-in-out');
      expect(config.spring.tension).toBe(300);
      expect(config.spring.friction).toBe(50);
    });
  });

  describe('DEFAULT_DEVICE_OPTIMIZATION', () => {
    it('デフォルト設定が正しく定義されている', () => {
      expect(DEFAULT_DEVICE_OPTIMIZATION.mobile.useNumericKeypad).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.mobile.enableHapticFeedback).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.mobile.autoFormatOnBlur).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.mobile.showLargeButtons).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.mobile.enableSwipeGestures).toBe(false);

      expect(DEFAULT_DEVICE_OPTIMIZATION.tablet.optimizeForTouch).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.tablet.showToolbar).toBe(false);
      expect(DEFAULT_DEVICE_OPTIMIZATION.tablet.enableDragAndDrop).toBe(false);
      expect(DEFAULT_DEVICE_OPTIMIZATION.tablet.adaptiveLayout).toBe(true);

      expect(DEFAULT_DEVICE_OPTIMIZATION.desktop.enableKeyboardShortcuts).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.desktop.showTooltips).toBe(true);
      expect(DEFAULT_DEVICE_OPTIMIZATION.desktop.enableContextMenu).toBe(false);
      expect(DEFAULT_DEVICE_OPTIMIZATION.desktop.precisionInput).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('Vibrate APIが利用できない場合でもエラーにならない', () => {
      // Vibrate APIを一時的に無効化
      const originalVibrate = navigator.vibrate;
      (navigator as any).vibrate = undefined;
      
      const handler = createDeviceFocusHandler('mobile');
      const mockEvent = { target: { setAttribute: jest.fn() } } as any;

      expect(() => handler(mockEvent)).not.toThrow();
      
      // 元に戻す
      (navigator as any).vibrate = originalVibrate;
    });

    it('onFormatが提供されない場合でもエラーにならない', () => {
      const handler = createDeviceBlurHandler('mobile');
      const mockEvent = { target: { value: '1000' } } as any;

      expect(() => handler(mockEvent)).not.toThrow();
    });

    it('ハンドラーが提供されない場合でもエラーにならない', () => {
      const handler = createDeviceKeyboardHandler('desktop', {});
      const mockEvent = {
        key: 'Enter',
        ctrlKey: true,
        preventDefault: jest.fn(),
      } as any;

      expect(() => handler(mockEvent)).not.toThrow();
    });

    it('不正なイベントオブジェクトでもエラーにならない', () => {
      const handler = createDeviceFocusHandler('mobile');
      const mockEvent = { target: null } as any;

      expect(() => handler(mockEvent)).not.toThrow();
    });
  });
});