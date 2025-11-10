import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  TextField,
  Typography,
  Box,
  Popover,
  Paper,
  useTheme,
  Fade,
  InputAdornment,
} from '@mui/material';
import {
  CurrencyYen as YenIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { CostValue } from '../CommonEdit/types';
import {
  validateCostInput,
  formatCurrency,
  parseCurrency,
  filterCostInput,
  DEFAULT_COST_VALIDATION_RULES,
  type CostValidationOptions,
} from './costValidation';

export interface CostInputDialogProps {
  open: boolean;
  currentCost: CostValue;
  onSave: (cost: CostValue) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null; // Desktop用のアンカー要素
  animationDuration?: number; // アニメーション時間
  validationOptions?: CostValidationOptions;
  onValidationError?: (errors: string[]) => void; // バリデーションエラーハンドラー
  onValidationWarning?: (warnings: string[]) => void; // バリデーション警告ハンドラー
  userName?: string; // 変更履歴用のユーザー名
  readOnly?: boolean; // 読み取り専用モード
  showWarnings?: boolean; // 警告の表示制御
  enableAutoFormat?: boolean; // 自動フォーマット機能
}

// コスト入力の状態管理
export interface CostInputState {
  planCost: string; // 入力中は文字列で管理
  actualCost: string;
  planCostError?: string;
  actualCostError?: string;
  planCostWarnings: string[];
  actualCostWarnings: string[];
  crossValidationWarnings: string[];
  isValid: boolean;
  hasWarnings: boolean;
}





/**
 * コスト入力ダイアログ
 */
export const CostInputDialog: React.FC<CostInputDialogProps> = ({
  open,
  currentCost,
  onSave,
  onClose,
  anchorEl,
  animationDuration = 300,
  validationOptions = DEFAULT_COST_VALIDATION_RULES,
  onValidationError,
  onValidationWarning,
  userName = 'unknown',
  readOnly = false,
  showWarnings = true,
  enableAutoFormat = true,
}) => {
  const theme = useTheme();
  const deviceType = 'desktop';
  
  // 入力状態の管理
  const [inputState, setInputState] = useState<CostInputState>({
    planCost: '',
    actualCost: '',
    planCostWarnings: [],
    actualCostWarnings: [],
    crossValidationWarnings: [],
    isValid: true,
    hasWarnings: false,
  });

  // 現在のコスト値を入力フィールドに反映
  useEffect(() => {
    setInputState({
      planCost: formatCurrency(currentCost.planCost),
      actualCost: formatCurrency(currentCost.actualCost),
      planCostWarnings: [],
      actualCostWarnings: [],
      crossValidationWarnings: [],
      isValid: true,
      hasWarnings: false,
    });
  }, [currentCost, open]);

  // バリデーション実行
  const validateInputs = useCallback((state: CostInputState) => {
    const validationResult = validateCostInput(
      state.planCost,
      state.actualCost,
      validationOptions
    );
    
    const newState: CostInputState = {
      ...state,
      planCostError: validationResult.planCost.errors[0], // 最初のエラーのみ表示
      actualCostError: validationResult.actualCost.errors[0], // 最初のエラーのみ表示
      planCostWarnings: validationResult.planCost.warnings,
      actualCostWarnings: validationResult.actualCost.warnings,
      crossValidationWarnings: validationResult.crossValidation.warnings,
      isValid: validationResult.isValid,
      hasWarnings: validationResult.allWarnings.length > 0,
    };

    return newState;
  }, [validationOptions]);

  // 入力値変更ハンドラー
  const handleInputChange = useCallback((field: 'planCost' | 'actualCost', value: string) => {
    // 入力値のフィルタリング
    let cleanValue = filterCostInput(value);
    
    const newState = {
      ...inputState,
      [field]: cleanValue,
    };

    // リアルタイムバリデーション
    const validatedState = validateInputs(newState);
    setInputState(validatedState);

    // 警告がある場合は警告ハンドラーを呼び出し
    if (showWarnings && validatedState.hasWarnings && onValidationWarning) {
      const allWarnings = [
        ...validatedState.planCostWarnings,
        ...validatedState.actualCostWarnings,
        ...validatedState.crossValidationWarnings,
      ];
      onValidationWarning(allWarnings);
    }
  }, [inputState, validateInputs, showWarnings, onValidationWarning, enableAutoFormat]);

  // 保存ハンドラー
  const handleSave = useCallback(() => {
    const validatedState = validateInputs(inputState);
    
    if (!validatedState.isValid) {
      const errors: string[] = [];
      if (validatedState.planCostError) errors.push(validatedState.planCostError);
      if (validatedState.actualCostError) errors.push(validatedState.actualCostError);
      
      if (onValidationError) {
        onValidationError(errors);
      }
      return;
    }

    // 警告がある場合は最終確認
    if (validatedState.hasWarnings && showWarnings) {
      const allWarnings = [
        ...validatedState.planCostWarnings,
        ...validatedState.actualCostWarnings,
        ...validatedState.crossValidationWarnings,
      ];
      
      if (onValidationWarning) {
        onValidationWarning(allWarnings);
      }
      
      // 重要な警告がある場合は確認ダイアログを表示
      const hasImportantWarnings = allWarnings.some(warning => 
        warning.includes('超過') || warning.includes('非常に大きな値')
      );
      
      if (hasImportantWarnings) {
        const confirmed = window.confirm(
          `以下の警告があります:\n${allWarnings.join('\n')}\n\n保存を続行しますか？`
        );
        if (!confirmed) {
          return;
        }
      }
    }

    const newCost: CostValue = {
      planCost: parseCurrency(validatedState.planCost),
      actualCost: parseCurrency(validatedState.actualCost),
    };

    console.log('Cost change:', {
      from: currentCost,
      to: newCost,
      user: userName,
      device: deviceType,
      timestamp: new Date(),
      warnings: validatedState.hasWarnings ? [
        ...validatedState.planCostWarnings,
        ...validatedState.actualCostWarnings,
        ...validatedState.crossValidationWarnings,
      ] : [],
    });

    onSave(newCost);
    onClose();
  }, [inputState, validateInputs, onValidationError, onValidationWarning, showWarnings, currentCost, userName, deviceType, onSave, onClose]);

  // キーボードハンドラー
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSave();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
  }, [handleSave, onClose]);

  // 入力フィールドのレンダリング
  const renderCostInput = (
    field: 'planCost' | 'actualCost',
    label: string,
    error?: string,
    warnings?: string[]
  ) => {
    const fieldValue = inputState[field];
    const isError = !!error;
    const hasWarnings = warnings && warnings.length > 0;
    
    // ヘルプテキストの構築
    let helperText = error;
    if (!error && hasWarnings && showWarnings) {
      helperText = warnings[0]; // 最初の警告のみ表示
    }
    
    return (
      <Box>
        <TextField
          fullWidth
          label={label}
          value={fieldValue}
          onChange={(e) => handleInputChange(field, e.target.value)}
          onKeyDown={handleKeyDown}
          error={isError}
          helperText={helperText}
          disabled={readOnly}
          variant="outlined"
          size="small"
          inputProps={{
            style: {
              textAlign: 'right',
              fontFamily: 'monospace',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <YenIcon sx={{ 
                  color: isError ? 'error.main' : hasWarnings ? 'warning.main' : 'text.secondary',
                }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" color="text.secondary">
                  円
                </Typography>
              </InputAdornment>
            ),
            sx: {
              '& input': {
                textAlign: 'right',
                fontFamily: 'monospace',
              },
            },
          }}
        />
        
        {/* 追加の警告表示 */}
        {hasWarnings && showWarnings && warnings.length > 1 && (
          <Box sx={{ mt: 0.5 }}>
            {warnings.slice(1).map((warning, index) => (
              <Typography
                key={index}
                variant="caption"
                color="warning.main"
                sx={{ display: 'block', fontSize: '0.75rem' }}
              >
                • {warning}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
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
          minWidth: 320,
          maxWidth: 400,
          boxShadow: theme.shadows[8],
          borderRadius: 2,
        },
      }}
      onKeyDown={handleKeyDown}
    >
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CalculateIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight="bold">
            コスト入力
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {renderCostInput('planCost', '計画コスト', inputState.planCostError, inputState.planCostWarnings)}
          {renderCostInput('actualCost', '実績コスト', inputState.actualCostError, inputState.actualCostWarnings)}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button 
            onClick={onClose} 
            size="small"
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            size="small"
            disabled={!inputState.isValid || readOnly}
          >
            保存
          </Button>
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Ctrl+Enter: 保存, Esc: キャンセル
        </Typography>
      </Paper>
    </Popover>
  );
};

export default CostInputDialog;