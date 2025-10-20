import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  useTheme,
  alpha,
  Slide,
  Fade,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { Close as CloseIcon } from '@mui/icons-material';
import { getOptimalTouchTargetSize, getOptimalSpacing } from '../CommonEdit/deviceDetection';

export interface TabletOptimizedDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullScreen?: boolean;
  disableBackdropClick?: boolean;
  showCloseButton?: boolean;
  keyboardAdjustment?: boolean; // キーボード表示時の調整
}

// タブレット用のスライドアップトランジション
const TabletSlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * タブレット最適化されたダイアログコンポーネント
 */
export const TabletOptimizedDialog: React.FC<TabletOptimizedDialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullScreen = false,
  disableBackdropClick = false,
  showCloseButton = true,
  keyboardAdjustment = true,
}) => {
  const theme = useTheme();
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [dialogHeight, setDialogHeight] = useState<string>('auto');

  const touchTargetSize = getOptimalTouchTargetSize('tablet');
  const spacing = getOptimalSpacing('tablet');

  // キーボード表示の検出
  useEffect(() => {
    if (!keyboardAdjustment) return;

    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDifference = windowHeight - viewportHeight;
      
      // キーボードが表示されている場合（高さの差が150px以上）
      const isKeyboardShown = heightDifference > 150;
      setKeyboardVisible(isKeyboardShown);
      
      if (isKeyboardShown) {
        // キーボード表示時はダイアログの高さを調整
        setDialogHeight(`${viewportHeight * 0.8}px`);
      } else {
        setDialogHeight('auto');
      }
    };

    // Visual Viewport API対応
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [keyboardAdjustment]);

  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (disableBackdropClick) {
      event.stopPropagation();
      return;
    }
    onClose();
  }, [disableBackdropClick, onClose]);

  const getDialogStyles = () => {
    const baseStyles = {
      '& .MuiDialog-paper': {
        borderRadius: 3,
        maxHeight: keyboardVisible ? dialogHeight : '90vh',
        margin: spacing / 8,
        // タッチ操作の改善
        WebkitTapHighlightColor: 'transparent',
        // スムーズなアニメーション
        transition: 'all 0.3s ease-in-out',
      },
      '& .MuiBackdrop-root': {
        backgroundColor: alpha(theme.palette.common.black, 0.6),
      },
    };

    if (isLandscape) {
      return {
        ...baseStyles,
        '& .MuiDialog-paper': {
          ...baseStyles['& .MuiDialog-paper'],
          maxWidth: fullScreen ? '100vw' : '80vw',
          width: fullScreen ? '100vw' : 'auto',
          height: fullScreen ? '100vh' : dialogHeight,
        },
      };
    } else {
      return {
        ...baseStyles,
        '& .MuiDialog-paper': {
          ...baseStyles['& .MuiDialog-paper'],
          maxWidth: fullScreen ? '100vw' : '95vw',
          width: fullScreen ? '100vw' : 'auto',
          height: fullScreen ? '100vh' : dialogHeight,
        },
      };
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullScreen={fullScreen}
      TransitionComponent={TabletSlideTransition}
      transitionDuration={300}
      sx={getDialogStyles()}
      onBackdropClick={handleBackdropClick as any}
      // タッチ操作の改善
      disableRestoreFocus
      keepMounted={false}
    >
      {/* タイトルバー */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: touchTargetSize,
          padding: spacing / 8,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontSize: isLandscape ? '1.1rem' : '1rem',
            fontWeight: 600,
            color: theme.palette.primary.dark,
            flexGrow: 1,
          }}
        >
          {title}
        </Typography>
        {showCloseButton && (
          <IconButton
            onClick={onClose}
            size="medium"
            sx={{
              minWidth: touchTargetSize,
              minHeight: touchTargetSize,
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      {/* コンテンツ */}
      <DialogContent
        sx={{
          padding: spacing / 8,
          overflowY: 'auto',
          // スムーズなスクロール
          WebkitOverflowScrolling: 'touch',
          // キーボード表示時の調整
          paddingBottom: keyboardVisible ? spacing / 4 : spacing / 8,
        }}
      >
        {children}
      </DialogContent>

      {/* アクション */}
      {actions && (
        <DialogActions
          sx={{
            padding: spacing / 8,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.grey[50], 0.8),
            minHeight: touchTargetSize,
            gap: spacing / 16,
            // キーボード表示時は下部に固定
            position: keyboardVisible ? 'sticky' : 'relative',
            bottom: keyboardVisible ? 0 : 'auto',
            zIndex: keyboardVisible ? 1 : 'auto',
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default TabletOptimizedDialog;