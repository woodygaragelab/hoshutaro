import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Popover,
  Paper,
  useTheme,
  alpha,
  Slide,
  Fade,
  Grid,
  Card,
  CardActionArea,
} from '@mui/material';
import { TabletOptimizedDialog } from '../EnhancedMaintenanceGrid/TabletOptimizedDialog';
import { TabletOptimizedButton } from '../EnhancedMaintenanceGrid/TabletOptimizedButton';
import { TransitionProps } from '@mui/material/transitions';
import {
  RadioButtonUnchecked as UnplannedIcon,
  RadioButtonChecked as PlannedIcon,
  CheckCircle as ActualIcon,
  CheckCircleOutline as BothIcon,
} from '@mui/icons-material';
import { StatusValue, StatusOption } from '../CommonEdit/types';
import { STATUS_OPTIONS, getColorFromStatus } from '../CommonEdit/statusLogic';
import { 
  validateStatusTransition, 
  executeStatusChange, 
  createStatusChangeHistory,
  checkStatusDataIntegrity,
  StatusConversionOptions 
} from './statusConversion';

export interface StatusSelectionDialogProps {
  open: boolean;
  currentStatus: StatusValue;
  onSelect: (status: StatusValue) => void;
  onClose: () => void;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  position?: { x: number; y: number }; // Desktop用のポップオーバー位置
  anchorEl?: HTMLElement | null; // Desktop用のアンカー要素
  animationDuration?: number; // アニメーション時間
  showDescription?: boolean; // 説明文の表示制御
  conversionOptions?: StatusConversionOptions; // 状態変換オプション
  onValidationError?: (errors: string[]) => void; // バリデーションエラーハンドラー
  onValidationWarning?: (warnings: string[]) => void; // バリデーション警告ハンドラー
  userName?: string; // 変更履歴用のユーザー名
}

// アニメーション用のトランジション
const SlideUpTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * 星取表の状態選択ダイアログ
 */
export const StatusSelectionDialog: React.FC<StatusSelectionDialogProps> = ({
  open,
  currentStatus,
  onSelect,
  onClose,
  deviceType,
  position,
  anchorEl,
  animationDuration = 300,
  showDescription = true,
  conversionOptions = {},
  onValidationError,
  onValidationWarning,
  userName = 'unknown',
}) => {
  const theme = useTheme();
  const [selectedOption, setSelectedOption] = useState<StatusOption | null>(null);

  // 現在の状態に対応するオプションを見つける
  useEffect(() => {
    const currentOption = STATUS_OPTIONS.find(
      opt => opt.value.planned === currentStatus.planned && opt.value.actual === currentStatus.actual
    );
    setSelectedOption(currentOption || STATUS_OPTIONS[0]);
  }, [currentStatus]);

  // 状態選択ハンドラー（バリデーション付き）
  const handleStatusSelect = useCallback(async (option: StatusOption) => {
    try {
      // 状態変更の実行とバリデーション
      const result = executeStatusChange(currentStatus, option.value, conversionOptions);
      
      if (!result.success) {
        // エラーがある場合はエラーハンドラーを呼び出し
        if (onValidationError && result.errors.length > 0) {
          onValidationError(result.errors);
        }
        return;
      }

      // 警告がある場合は警告ハンドラーを呼び出し
      if (onValidationWarning && result.warnings.length > 0) {
        onValidationWarning(result.warnings);
      }

      // 確認が必要な場合
      if (result.requiresConfirmation && result.confirmationMessage) {
        const confirmed = window.confirm(result.confirmationMessage);
        if (!confirmed) {
          return;
        }
      }

      // データ整合性チェック
      const integrityCheck = checkStatusDataIntegrity(
        result.newStatus,
        result.newStatus.planned,
        result.newStatus.actual
      );

      if (!integrityCheck.isConsistent) {
        const errorMessages = integrityCheck.issues
          .filter(issue => issue.type === 'error')
          .map(issue => issue.message);
        
        if (onValidationError && errorMessages.length > 0) {
          onValidationError(errorMessages);
          return;
        }
      }

      // 変更履歴の作成（ログ用）
      const history = createStatusChangeHistory(
        currentStatus,
        result.newStatus,
        userName,
        deviceType,
        '状態選択ダイアログからの変更'
      );
      
      console.log('Status change history:', history);

      // 状態更新
      setSelectedOption(option);
      onSelect(result.newStatus);
      onClose();
      
    } catch (error) {
      console.error('状態選択エラー:', error);
      if (onValidationError) {
        onValidationError([`状態選択中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`]);
      }
    }
  }, [currentStatus, conversionOptions, onValidationError, onValidationWarning, userName, deviceType, onSelect, onClose]);

  // 状態アイコンの取得
  const getStatusIcon = (option: StatusOption) => {
    const iconProps = {
      sx: { 
        color: option.color,
        fontSize: deviceType === 'mobile' ? '2rem' : deviceType === 'tablet' ? '1.5rem' : '1.25rem'
      }
    };

    if (option.value.planned && option.value.actual) {
      return <BothIcon {...iconProps} />;
    } else if (option.value.actual) {
      return <ActualIcon {...iconProps} />;
    } else if (option.value.planned) {
      return <PlannedIcon {...iconProps} />;
    } else {
      return <UnplannedIcon {...iconProps} />;
    }
  };

  // 状態記号の表示
  const getStatusSymbol = (option: StatusOption) => {
    return (
      <Typography
        variant={deviceType === 'mobile' ? 'h4' : 'h6'}
        sx={{
          color: option.color,
          fontWeight: 'bold',
          minWidth: deviceType === 'mobile' ? '3rem' : '2rem',
          textAlign: 'center',
        }}
      >
        {option.symbol || '　'}
      </Typography>
    );
  };

  // リストアイテムのレンダリング（デスクトップ・タブレット用）
  const renderStatusOption = (option: StatusOption, index: number) => {
    const isSelected = selectedOption?.value.planned === option.value.planned && 
                     selectedOption?.value.actual === option.value.actual;
    
    const itemHeight = deviceType === 'mobile' ? 72 : deviceType === 'tablet' ? 64 : 56;

    return (
      <ListItem key={index} disablePadding>
        <ListItemButton
          onClick={() => handleStatusSelect(option)}
          selected={isSelected}
          sx={{
            minHeight: itemHeight,
            borderRadius: 1,
            mb: 0.5,
            '&.Mui-selected': {
              backgroundColor: alpha(option.color, 0.1),
              '&:hover': {
                backgroundColor: alpha(option.color, 0.2),
              },
            },
            '&:hover': {
              backgroundColor: alpha(option.color, 0.05),
            },
          }}
        >
          {deviceType === 'mobile' && (
            <ListItemIcon sx={{ minWidth: 56 }}>
              {getStatusIcon(option)}
            </ListItemIcon>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {getStatusSymbol(option)}
            
            <Box sx={{ flex: 1 }}>
              <ListItemText
                primary={option.label}
                secondary={showDescription ? option.description : undefined}
                primaryTypographyProps={{
                  variant: deviceType === 'mobile' ? 'h6' : 'subtitle1',
                  fontWeight: 'medium',
                }}
                secondaryTypographyProps={{
                  variant: deviceType === 'mobile' ? 'body2' : 'caption',
                  color: 'text.secondary',
                }}
              />
            </Box>
          </Box>
        </ListItemButton>
      </ListItem>
    );
  };

  // カードアイテムのレンダリング（モバイル用）
  const renderStatusCard = (option: StatusOption, index: number) => {
    const isSelected = selectedOption?.value.planned === option.value.planned && 
                     selectedOption?.value.actual === option.value.actual;

    return (
      <Grid item xs={6} key={index}>
        <Card
          sx={{
            height: '100%',
            minHeight: 120,
            border: isSelected ? `2px solid ${option.color}` : `1px solid ${theme.palette.divider}`,
            backgroundColor: isSelected ? alpha(option.color, 0.1) : 'background.paper',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'scale(1.02)',
              boxShadow: theme.shadows[4],
            },
          }}
        >
          <CardActionArea
            onClick={() => handleStatusSelect(option)}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
            }}
          >
            <Box sx={{ mb: 1 }}>
              {getStatusIcon(option)}
            </Box>
            
            <Box sx={{ mb: 1 }}>
              {getStatusSymbol(option)}
            </Box>
            
            <Typography
              variant="subtitle2"
              fontWeight="bold"
              textAlign="center"
              sx={{ color: option.color }}
            >
              {option.label}
            </Typography>
            
            {showDescription && (
              <Typography
                variant="caption"
                color="text.secondary"
                textAlign="center"
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
              >
                {option.description}
              </Typography>
            )}
          </CardActionArea>
        </Card>
      </Grid>
    );
  };

  // デスクトップ用ポップオーバー
  if (deviceType === 'desktop' && anchorEl) {
    return (
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        TransitionComponent={Fade}
        transitionDuration={animationDuration}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxWidth: 320,
            boxShadow: theme.shadows[8],
            borderRadius: 2,
          },
        }}
      >
        <Paper sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, color: 'text.secondary' }}>
            状態を選択
          </Typography>
          <List dense>
            {STATUS_OPTIONS.map((option, index) => renderStatusOption(option, index))}
          </List>
        </Paper>
      </Popover>
    );
  }

  // タブレット用ダイアログ
  if (deviceType === 'tablet') {
    return (
      <TabletOptimizedDialog
        open={open}
        onClose={onClose}
        title="状態を選択"
        maxWidth="sm"
        keyboardAdjustment={false}
        actions={
          <TabletOptimizedButton 
            onClick={onClose}
            variant="outlined"
            touchOptimized
            hapticFeedback
          >
            キャンセル
          </TabletOptimizedButton>
        }
      >
        <Box sx={{ py: 1 }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 3, 
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            現在の状態: <strong style={{ color: theme.palette.primary.main }}>{currentStatus.label}</strong>
          </Typography>
          
          <List sx={{ width: '100%', gap: 1 }}>
            {STATUS_OPTIONS.map((option, index) => renderStatusOption(option, index))}
          </List>
        </Box>
      </TabletOptimizedDialog>
    );
  }

  // モバイル用フルスクリーンダイアログ
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      TransitionComponent={SlideUpTransition}
      transitionDuration={animationDuration}
      PaperProps={{
        sx: {
          margin: 0,
          maxHeight: '100vh',
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center',
        pb: 2,
        fontSize: '1.5rem',
        fontWeight: 'bold',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        状態を選択
      </DialogTitle>
      
      <DialogContent sx={{ px: 2, py: 3, flex: 1 }}>
        <Typography 
          variant="body1" 
          color="text.secondary" 
          sx={{ 
            mb: 3, 
            textAlign: 'center',
            fontSize: '1rem'
          }}
        >
          現在の状態: <strong>{currentStatus.label}</strong>
        </Typography>
        
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {STATUS_OPTIONS.map((option, index) => renderStatusCard(option, index))}
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ 
        justifyContent: 'center', 
        px: 2,
        pb: 3,
        borderTop: `1px solid ${theme.palette.divider}`
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          size="large"
          sx={{ 
            minWidth: 150,
            minHeight: 48,
            fontSize: '1rem'
          }}
        >
          キャンセル
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusSelectionDialog;