import React, { useState, useCallback, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Popover,
  Paper,
  useTheme,
  alpha,
  Fade,
} from '@mui/material';
import { StatusValue, StatusOption } from '../CommonEdit/types';
import { STATUS_OPTIONS } from '../CommonEdit/statusLogic';
import { 
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
  anchorEl?: HTMLElement | null; // Desktop用のアンカー要素
  animationDuration?: number; // アニメーション時間
  showDescription?: boolean; // 説明文の表示制御
  conversionOptions?: StatusConversionOptions; // 状態変換オプション
  onValidationError?: (errors: string[]) => void; // バリデーションエラーハンドラー
  onValidationWarning?: (warnings: string[]) => void; // バリデーション警告ハンドラー
  userName?: string; // 変更履歴用のユーザー名
}



/**
 * 星取表の状態選択ダイアログ
 */
export const StatusSelectionDialog: React.FC<StatusSelectionDialogProps> = ({
  open,
  currentStatus,
  onSelect,
  onClose,
  anchorEl,
  animationDuration = 300,
  showDescription = true,
  conversionOptions = {},
  onValidationError,
  onValidationWarning,
  userName = 'unknown',
}) => {
  const theme = useTheme();
  const deviceType = 'desktop';
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

  // リストアイテムのレンダリング
  const renderStatusOption = (option: StatusOption, index: number) => {
    const isSelected = selectedOption?.value.planned === option.value.planned && 
                     selectedOption?.value.actual === option.value.actual;

    return (
      <ListItem key={index} disablePadding>
        <ListItemButton
          onClick={() => handleStatusSelect(option)}
          selected={isSelected}
          sx={{
            minHeight: 56,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                color: option.color,
                fontWeight: 'bold',
                minWidth: '2rem',
                textAlign: 'center',
              }}
            >
              {option.symbol || '　'}
            </Typography>
            
            <Box sx={{ flex: 1 }}>
              <ListItemText
                primary={option.label}
                secondary={showDescription ? option.description : undefined}
                primaryTypographyProps={{
                  variant: 'subtitle1',
                  fontWeight: 'medium',
                }}
                secondaryTypographyProps={{
                  variant: 'caption',
                  color: 'text.secondary',
                }}
              />
            </Box>
          </Box>
        </ListItemButton>
      </ListItem>
    );
  };

  // Desktop-only popover
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
};

export default StatusSelectionDialog;