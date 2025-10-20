import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Box,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  IconButton,
} from '@mui/material';
import {
  ScreenRotation as ScreenRotationIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// 画面の向きの型定義
export type ScreenOrientation = 'portrait' | 'landscape';

// デバイス情報の型定義
export interface DeviceInfo {
  orientation: ScreenOrientation;
  width: number;
  height: number;
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
  aspectRatio: number;
}

// 向き変更のコンテキスト
interface OrientationContextType {
  deviceInfo: DeviceInfo;
  isRotating: boolean;
  showOrientationTip: boolean;
  dismissOrientationTip: () => void;
}

const OrientationContext = React.createContext<OrientationContextType | null>(null);

/**
 * 画面回転とレスポンシブ対応のプロバイダー
 * 要件3.8: ポートレート・ランドスケープ両対応、動的レイアウト調整、状態保持機能
 */
interface MobileOrientationProviderProps {
  children: React.ReactNode;
  onOrientationChange?: (deviceInfo: DeviceInfo) => void;
  persistState?: boolean;
}

export const MobileOrientationProvider: React.FC<MobileOrientationProviderProps> = ({
  children,
  onOrientationChange,
  persistState = true,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const isMediumScreen = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md'));

  // デバイス情報の状態管理
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    
    return {
      orientation: width > height ? 'landscape' : 'portrait',
      width,
      height,
      isSmallScreen,
      isMediumScreen,
      isLargeScreen,
      aspectRatio,
    };
  });

  const [isRotating, setIsRotating] = useState(false);
  const [showOrientationTip, setShowOrientationTip] = useState(false);

  // 状態の永続化キー
  const STORAGE_KEY = 'mobile-orientation-state';

  // 状態の保存
  const saveState = useCallback((state: any) => {
    if (persistState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save orientation state:', error);
      }
    }
  }, [persistState]);

  // 状態の復元
  const loadState = useCallback(() => {
    if (persistState) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
      } catch (error) {
        console.warn('Failed to load orientation state:', error);
        return null;
      }
    }
    return null;
  }, [persistState]);

  // デバイス情報の更新
  const updateDeviceInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const newOrientation: ScreenOrientation = width > height ? 'landscape' : 'portrait';

    const newDeviceInfo: DeviceInfo = {
      orientation: newOrientation,
      width,
      height,
      isSmallScreen: width < theme.breakpoints.values.sm,
      isMediumScreen: width >= theme.breakpoints.values.sm && width < theme.breakpoints.values.md,
      isLargeScreen: width >= theme.breakpoints.values.md,
      aspectRatio,
    };

    // 向きが変わった場合の処理
    if (newOrientation !== deviceInfo.orientation) {
      setIsRotating(true);
      
      // 初回の向き変更時にヒントを表示
      const savedState = loadState();
      if (!savedState?.hasSeenOrientationTip) {
        setShowOrientationTip(true);
        saveState({ hasSeenOrientationTip: true });
      }

      // 回転アニメーション終了後にフラグをリセット
      setTimeout(() => {
        setIsRotating(false);
      }, 300);
    }

    setDeviceInfo(newDeviceInfo);
    
    if (onOrientationChange) {
      onOrientationChange(newDeviceInfo);
    }
  }, [deviceInfo.orientation, theme.breakpoints.values, onOrientationChange, loadState, saveState]);

  // リサイズイベントの監視
  useEffect(() => {
    const handleResize = () => {
      updateDeviceInfo();
    };

    const handleOrientationChange = () => {
      // orientationchangeイベントは少し遅延して発火することがあるため、
      // 少し待ってからリサイズ処理を実行
      setTimeout(updateDeviceInfo, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // 初期化時に一度実行
    updateDeviceInfo();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateDeviceInfo]);

  // 向きヒントの非表示
  const dismissOrientationTip = useCallback(() => {
    setShowOrientationTip(false);
  }, []);

  const contextValue: OrientationContextType = {
    deviceInfo,
    isRotating,
    showOrientationTip,
    dismissOrientationTip,
  };

  return (
    <OrientationContext.Provider value={contextValue}>
      {children}
      
      {/* 向き変更のヒント */}
      <Snackbar
        open={showOrientationTip}
        autoHideDuration={5000}
        onClose={dismissOrientationTip}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={dismissOrientationTip}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{ alignItems: 'center' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScreenRotationIcon fontSize="small" />
            画面を回転すると、より多くの情報を表示できます
          </Box>
        </Alert>
      </Snackbar>
    </OrientationContext.Provider>
  );
};

/**
 * 向き情報を取得するカスタムフック
 */
export const useOrientation = () => {
  const context = useContext(OrientationContext);
  if (!context) {
    throw new Error('useOrientation must be used within MobileOrientationProvider');
  }
  return context;
};

/**
 * レスポンシブレイアウトコンポーネント
 * 画面の向きに応じて子コンポーネントのレイアウトを調整
 */
interface ResponsiveLayoutProps {
  children: React.ReactNode;
  portraitProps?: any;
  landscapeProps?: any;
  className?: string;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  portraitProps = {},
  landscapeProps = {},
  className,
}) => {
  const { deviceInfo, isRotating } = useOrientation();
  const theme = useTheme();

  // 向きに応じたプロパティを選択
  const currentProps = deviceInfo.orientation === 'portrait' ? portraitProps : landscapeProps;

  return (
    <Box
      className={className}
      sx={{
        transition: isRotating ? 'all 0.3s ease-in-out' : 'none',
        opacity: isRotating ? 0.8 : 1,
        transform: isRotating ? 'scale(0.98)' : 'scale(1)',
        ...currentProps.sx,
      }}
      {...currentProps}
    >
      {children}
    </Box>
  );
};

/**
 * 向き別コンテンツ表示コンポーネント
 */
interface OrientationSpecificContentProps {
  portrait?: React.ReactNode;
  landscape?: React.ReactNode;
  both?: React.ReactNode;
}

export const OrientationSpecificContent: React.FC<OrientationSpecificContentProps> = ({
  portrait,
  landscape,
  both,
}) => {
  const { deviceInfo } = useOrientation();

  if (both) {
    return <>{both}</>;
  }

  if (deviceInfo.orientation === 'portrait' && portrait) {
    return <>{portrait}</>;
  }

  if (deviceInfo.orientation === 'landscape' && landscape) {
    return <>{landscape}</>;
  }

  return null;
};

/**
 * 画面回転対応のグリッドレイアウト
 */
interface OrientationAwareGridProps {
  children: React.ReactNode;
  portraitColumns?: number;
  landscapeColumns?: number;
  spacing?: number;
}

export const OrientationAwareGrid: React.FC<OrientationAwareGridProps> = ({
  children,
  portraitColumns = 1,
  landscapeColumns = 2,
  spacing = 2,
}) => {
  const { deviceInfo } = useOrientation();
  const theme = useTheme();

  const columns = deviceInfo.orientation === 'portrait' ? portraitColumns : landscapeColumns;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: spacing,
        transition: 'all 0.3s ease-in-out',
        // 小さな画面では常に1列
        [theme.breakpoints.down('sm')]: {
          gridTemplateColumns: '1fr',
        },
      }}
    >
      {children}
    </Box>
  );
};

/**
 * 向き変更時の状態保持フック
 */
export const useOrientationPersistence = <T,>(
  key: string,
  initialValue: T
): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`orientation-${key}`);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setPersistentValue = useCallback((newValue: T) => {
    setValue(newValue);
    try {
      localStorage.setItem(`orientation-${key}`, JSON.stringify(newValue));
    } catch (error) {
      console.warn('Failed to persist orientation state:', error);
    }
  }, [key]);

  return [value, setPersistentValue];
};