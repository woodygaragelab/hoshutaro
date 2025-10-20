import React from 'react';
import {
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
  useTheme,
  alpha,
} from '@mui/material';
import { getOptimalTouchTargetSize, getOptimalSpacing } from '../CommonEdit/deviceDetection';

export interface TabletOptimizedButtonProps extends Omit<ButtonProps, 'size'> {
  touchOptimized?: boolean;
  hapticFeedback?: boolean;
  preventDoubleClick?: boolean;
}

export interface TabletOptimizedIconButtonProps extends Omit<IconButtonProps, 'size'> {
  touchOptimized?: boolean;
  hapticFeedback?: boolean;
  preventDoubleClick?: boolean;
}

/**
 * タブレット最適化されたボタンコンポーネント
 */
export const TabletOptimizedButton: React.FC<TabletOptimizedButtonProps> = ({
  touchOptimized = true,
  hapticFeedback = false,
  preventDoubleClick = true,
  onClick,
  children,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const touchTargetSize = getOptimalTouchTargetSize('tablet');
  const spacing = getOptimalSpacing('tablet');

  const [isClicking, setIsClicking] = React.useState(false);
  const lastClickTime = React.useRef(0);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (preventDoubleClick) {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        return; // 300ms以内の連続クリックを防ぐ
      }
      lastClickTime.current = now;
    }

    // ハプティックフィードバック（対応デバイスのみ）
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // クリック状態の管理
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 150);

    onClick?.(event);
  }, [onClick, preventDoubleClick, hapticFeedback]);

  const optimizedStyles = touchOptimized ? {
    minHeight: touchTargetSize,
    minWidth: touchTargetSize * 1.5,
    padding: `${spacing / 16}px ${spacing / 8}px`,
    borderRadius: 2,
    fontSize: '0.9rem',
    fontWeight: 600,
    textTransform: 'none' as const,
    transition: 'all 0.2s ease-in-out',
    // タッチフィードバックの改善
    WebkitTapHighlightColor: 'transparent',
    '&:hover': {
      transform: 'scale(1.02)',
      boxShadow: theme.shadows[4],
    },
    '&:active': {
      transform: 'scale(0.98)',
      boxShadow: theme.shadows[2],
    },
    // クリック中の視覚的フィードバック
    ...(isClicking && {
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      transform: 'scale(0.98)',
    }),
  } : {};

  return (
    <Button
      {...props}
      onClick={handleClick}
      sx={{
        ...optimizedStyles,
        ...sx,
      }}
    >
      {children}
    </Button>
  );
};

/**
 * タブレット最適化されたアイコンボタンコンポーネント
 */
export const TabletOptimizedIconButton: React.FC<TabletOptimizedIconButtonProps> = ({
  touchOptimized = true,
  hapticFeedback = false,
  preventDoubleClick = true,
  onClick,
  children,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const touchTargetSize = getOptimalTouchTargetSize('tablet');

  const [isClicking, setIsClicking] = React.useState(false);
  const lastClickTime = React.useRef(0);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (preventDoubleClick) {
      const now = Date.now();
      if (now - lastClickTime.current < 300) {
        return;
      }
      lastClickTime.current = now;
    }

    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }

    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 150);

    onClick?.(event);
  }, [onClick, preventDoubleClick, hapticFeedback]);

  const optimizedStyles = touchOptimized ? {
    minWidth: touchTargetSize,
    minHeight: touchTargetSize,
    borderRadius: 2,
    transition: 'all 0.2s ease-in-out',
    WebkitTapHighlightColor: 'transparent',
    '&:hover': {
      transform: 'scale(1.05)',
      backgroundColor: alpha(theme.palette.action.hover, 0.1),
    },
    '&:active': {
      transform: 'scale(0.95)',
    },
    ...(isClicking && {
      backgroundColor: alpha(theme.palette.primary.main, 0.15),
      transform: 'scale(0.95)',
    }),
  } : {};

  return (
    <IconButton
      {...props}
      onClick={handleClick}
      sx={{
        ...optimizedStyles,
        ...sx,
      }}
    >
      {children}
    </IconButton>
  );
};

export default TabletOptimizedButton;