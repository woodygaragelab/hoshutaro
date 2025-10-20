import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Slide,
  useTheme,
  alpha,
  useMediaQuery,
  Backdrop,
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

// 最小タッチターゲットサイズ
const MIN_TOUCH_TARGET = 44;

// フルスクリーンスライドアップトランジション
const SlideUpTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface MobileOptimizedDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  fullScreen?: boolean;
  showPullIndicator?: boolean;
  maxHeight?: string | number;
  onKeyboardShow?: () => void;
  onKeyboardHide?: () => void;
}

/**
 * モバイル最適化ダイアログ
 * 要件3.8, 3.5: フルスクリーンまたは適切なサイズでの表示、片手操作対応
 */
export const MobileOptimizedDialog: React.FC<MobileOptimizedDialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  fullScreen = false,
  showPullIndicator = true,
  maxHeight = '90vh',
  onKeyboardShow,
  onKeyboardHide,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [initialViewportHeight, setInitialViewportHeight] = useState(window.innerHeight);

  // キーボード表示の検出
  useEffect(() => {
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      const isKeyboardShowing = heightDifference > 150; // 150px以上の差でキーボード表示と判定

      if (isKeyboardShowing !== keyboardVisible) {
        setKeyboardVisible(isKeyboardShowing);
        
        if (isKeyboardShowing && onKeyboardShow) {
          onKeyboardShow();
        } else if (!isKeyboardShowing && onKeyboardHide) {
          onKeyboardHide();
        }
      }
    };

    if (open) {
      setInitialViewportHeight(window.innerHeight);
      window.addEventListener('resize', handleResize);
      // iOS Safari対応
      window.addEventListener('orientationchange', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [open, keyboardVisible, initialViewportHeight, onKeyboardShow, onKeyboardHide]);

  // スワイプダウンでの閉じる機能
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    
    const deltaY = currentY - startY;
    if (deltaY > 100) { // 100px以上下にスワイプで閉じる
      onClose();
    }
    
    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  }, [isDragging, currentY, startY, onClose]);

  const dialogTransform = isDragging && currentY > startY ? 
    `translateY(${Math.max(0, currentY - startY)}px)` : 
    'translateY(0)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen || isSmallScreen}
      TransitionComponent={SlideUpTransition}
      transitionDuration={300}
      BackdropComponent={Backdrop}
      BackdropProps={{
        sx: {
          backgroundColor: alpha(theme.palette.common.black, 0.7),
        },
      }}
      PaperProps={{
        sx: {
          ...(fullScreen || isSmallScreen ? {
            margin: 0,
            width: '100%',
            height: '100%',
            maxHeight: 'none',
            borderRadius: 0,
          } : {
            margin: 1,
            width: 'calc(100% - 16px)',
            maxWidth: 'none',
            maxHeight: keyboardVisible ? '50vh' : maxHeight,
            borderRadius: 3,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }),
          transform: dialogTransform,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          // キーボード表示時の自動スクロール対応
          ...(keyboardVisible && {
            position: 'fixed',
            bottom: 0,
            top: 'auto',
          }),
        },
      }}
    >
      {/* プルインジケーター */}
      {showPullIndicator && !fullScreen && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            pt: 1,
            pb: 0.5,
            cursor: 'grab',
            '&:active': {
              cursor: 'grabbing',
            },
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Box
            sx={{
              width: 40,
              height: 4,
              backgroundColor: theme.palette.grey[400],
              borderRadius: 2,
            }}
          />
        </Box>
      )}

      {/* ヘッダー */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          pt: showPullIndicator && !fullScreen ? 1 : 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            fontSize: isSmallScreen ? '1.1rem' : '1.25rem',
            flexGrow: 1,
            pr: 1,
          }}
        >
          {title}
        </Typography>
        
        <IconButton
          onClick={onClose}
          sx={{
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.grey[500], 0.1),
            '&:hover': {
              backgroundColor: alpha(theme.palette.grey[500], 0.2),
            },
          }}
        >
          {fullScreen || isSmallScreen ? (
            <KeyboardArrowDownIcon />
          ) : (
            <CloseIcon />
          )}
        </IconButton>
      </DialogTitle>

      {/* コンテンツ */}
      <DialogContent
        sx={{
          px: 2,
          py: 1,
          flexGrow: 1,
          overflow: 'auto',
          // スムーズなスクロール
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          // キーボード表示時の調整
          ...(keyboardVisible && {
            maxHeight: 'calc(50vh - 120px)',
          }),
        }}
      >
        {children}
      </DialogContent>

      {/* アクション */}
      {actions && (
        <DialogActions
          sx={{
            p: 2,
            gap: 1,
            // キーボード表示時は下部に固定
            ...(keyboardVisible && {
              position: 'sticky',
              bottom: 0,
              backgroundColor: theme.palette.background.paper,
              borderTop: `1px solid ${theme.palette.divider}`,
            }),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

/**
 * モバイル最適化ボタン
 */
interface MobileOptimizedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  fullWidth?: boolean;
  disabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const MobileOptimizedButton: React.FC<MobileOptimizedButtonProps> = ({
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  fullWidth = false,
  disabled = false,
  startIcon,
  endIcon,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Button
      onClick={onClick}
      variant={variant}
      color={color}
      fullWidth={fullWidth}
      disabled={disabled}
      startIcon={startIcon}
      endIcon={endIcon}
      sx={{
        minHeight: MIN_TOUCH_TARGET,
        fontSize: isSmallScreen ? '0.9rem' : '1rem',
        fontWeight: 'bold',
        borderRadius: 3,
        px: 3,
        py: 1.5,
        textTransform: 'none',
        boxShadow: variant === 'contained' ? theme.shadows[2] : 'none',
        '&:hover': {
          boxShadow: variant === 'contained' ? theme.shadows[4] : 'none',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {children}
    </Button>
  );
};

/**
 * 片手操作対応のアクションエリア
 */
interface OneHandedActionAreaProps {
  children: React.ReactNode;
  position?: 'bottom' | 'floating';
}

export const OneHandedActionArea: React.FC<OneHandedActionAreaProps> = ({
  children,
  position = 'bottom',
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (position === 'floating') {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: theme.zIndex.fab,
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isSmallScreen ? 'column' : 'row',
        gap: 1,
        width: '100%',
        // 片手操作しやすい位置に配置
        alignItems: 'stretch',
      }}
    >
      {children}
    </Box>
  );
};