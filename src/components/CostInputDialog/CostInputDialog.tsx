import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Popover,
  Paper,
  useTheme,
  alpha,
  Slide,
  Fade,
  InputAdornment,
} from '@mui/material';
import { TabletOptimizedDialog } from '../EnhancedMaintenanceGrid/TabletOptimizedDialog';
import { TabletOptimizedButton } from '../EnhancedMaintenanceGrid/TabletOptimizedButton';
import { TransitionProps } from '@mui/material/transitions';
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
  formatCostInputRealtime,
  DEFAULT_COST_VALIDATION_RULES,
  type CostValidationOptions,
} from './costValidation';
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
} from './deviceOptimization';

export interface CostInputDialogProps {
  open: boolean;
  currentCost: CostValue;
  onSave: (cost: CostValue) => void;
  onClose: () => void;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  // position?: { x: number; y: number }; // Desktop用のポップオーバー位置（未使用）
  anchorEl?: HTMLElement | null; // Desktop用のアンカー要素
  animationDuration?: number; // アニメーション時間
  validationOptions?: CostValidationOptions;
  deviceOptimization?: DeviceOptimizationConfig; // デバイス最適化設定
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
 * コスト入力ダイアログ
 */
export const CostInputDialog: React.FC<CostInputDialogProps> = ({
  open,
  currentCost,
  onSave,
  onClose,
  deviceType,
  // position, // 未使用
  anchorEl,
  animationDuration,
  validationOptions = DEFAULT_COST_VALIDATION_RULES,
  deviceOptimization = DEFAULT_DEVICE_OPTIMIZATION,
  onValidationError,
  onValidationWarning,
  userName = 'unknown',
  readOnly = false,
  showWarnings = true,
  enableAutoFormat = true,
}) => {
  const theme = useTheme();
  
  // デバイス固有のアニメーション設定
  const deviceAnimationConfig = getDeviceAnimationConfig(deviceType);
  const effectiveAnimationDuration = animationDuration ?? deviceAnimationConfig.duration;
  
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
    
    // デバイス固有の自動フォーマット（リアルタイム）
    if (enableAutoFormat && deviceType === 'desktop' && deviceOptimization.desktop.precisionInput) {
      // デスクトップでは精密入力のため、フォーマットは控えめに
      cleanValue = cleanValue;
    } else if (enableAutoFormat && (deviceType === 'mobile' || deviceType === 'tablet')) {
      // モバイル・タブレットでは入力しやすさを重視してリアルタイムフォーマット
      if (cleanValue && !cleanValue.includes('.') && cleanValue.length > 3) {
        cleanValue = formatCostInputRealtime(cleanValue);
      }
    }
    
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
  }, [inputState, validateInputs, showWarnings, onValidationWarning, enableAutoFormat, deviceType, deviceOptimization]);

  // デバイス最適化されたフォーカスハンドラー
  const handleInputFocus = useCallback(
    createDeviceFocusHandler(deviceType, deviceOptimization),
    [deviceType, deviceOptimization]
  );

  // デバイス最適化されたブラーハンドラー
  const handleInputBlur = useCallback(
    createDeviceBlurHandler(
      deviceType,
      enableAutoFormat ? formatCostInputRealtime : undefined,
      deviceOptimization
    ),
    [deviceType, enableAutoFormat, deviceOptimization]
  );

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

  // デバイス最適化されたキーボードハンドラー
  const handleKeyDown = useCallback(
    createDeviceKeyboardHandler(
      deviceType,
      {
        onSave: handleSave,
        onCancel: onClose,
        onNext: () => {
          // 次のフィールドにフォーカスを移動（実装は標準のTab動作に任せる）
        },
      },
      deviceOptimization
    ),
    [deviceType, handleSave, onClose, deviceOptimization]
  );

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
    
    // デバイス固有のスタイルと属性を取得
    const deviceStyles = getDeviceSpecificStyles(deviceType) as any;
    const inputAttributes = getDeviceInputAttributes(deviceType, deviceOptimization) as any;
    
    return (
      <Box>
        <TextField
          fullWidth
          label={label}
          value={fieldValue}
          onChange={(e) => handleInputChange(field, e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          error={isError}
          helperText={helperText}
          disabled={readOnly}
          variant="outlined"
          size={deviceType === 'mobile' ? 'medium' : 'small'}
          // デバイス固有の入力属性を適用
          inputProps={{
            ...inputAttributes,
            style: {
              textAlign: 'right',
              fontFamily: deviceType === 'desktop' ? 'monospace' : 'system-ui',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <YenIcon sx={{ 
                  color: isError ? 'error.main' : hasWarnings ? 'warning.main' : 'text.secondary',
                  fontSize: deviceType === 'mobile' ? '1.5rem' : '1.25rem',
                }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: deviceType === 'mobile' ? '1rem' : '0.875rem',
                    fontWeight: 'medium',
                  }}
                >
                  円
                </Typography>
              </InputAdornment>
            ),
            sx: {
              ...deviceStyles,
              '& input': {
                textAlign: 'right',
                fontFamily: deviceType === 'desktop' ? 'monospace' : 'system-ui',
                fontSize: deviceStyles.fontSize,
              },
            },
          }}
          FormHelperTextProps={{
            sx: {
              color: isError ? 'error.main' : hasWarnings ? 'warning.main' : 'text.secondary',
              fontSize: deviceType === 'mobile' ? '0.875rem' : '0.75rem',
            },
          }}
          InputLabelProps={{
            sx: {
              fontSize: deviceType === 'mobile' ? '1rem' : '0.875rem',
              fontWeight: deviceType === 'mobile' ? 'medium' : 'normal',
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              minHeight: deviceStyles.minHeight,
              borderColor: hasWarnings && !isError ? 'warning.main' : undefined,
              '&:hover': {
                borderColor: hasWarnings && !isError ? 'warning.dark' : undefined,
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: deviceType === 'mobile' ? '2px' : '1px',
                },
              },
            },
            mb: deviceStyles.marginBottom,
          }}
        />
        
        {/* 追加の警告表示（デスクトップでは詳細表示） */}
        {hasWarnings && showWarnings && warnings.length > 1 && deviceType === 'desktop' && (
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
        
        {/* デスクトップでのキーボードショートカットヒント */}
        {deviceType === 'desktop' && deviceOptimization.desktop.enableKeyboardShortcuts && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ 
              display: 'block', 
              mt: 0.5, 
              fontSize: '0.7rem',
              fontStyle: 'italic',
            }}
          >
            {inputAttributes.title}
          </Typography>
        )}
      </Box>
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
        transitionDuration={effectiveAnimationDuration}
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
              sx={getDeviceButtonStyles(deviceType, 'secondary')}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              size="small"
              disabled={!inputState.isValid || readOnly}
              sx={getDeviceButtonStyles(deviceType, 'primary')}
            >
              保存
            </Button>
          </Box>
          
          {deviceType === 'desktop' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Ctrl+Enter: 保存, Esc: キャンセル
            </Typography>
          )}
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
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalculateIcon sx={{ color: 'primary.main' }} />
            コスト入力
          </Box>
        }
        maxWidth="sm"
        keyboardAdjustment={true}
        actions={
          <Box sx={{ display: 'flex', gap: 2, width: '100%', justifyContent: 'center' }}>
            <TabletOptimizedButton 
              onClick={onClose}
              variant="outlined"
              touchOptimized
              hapticFeedback
            >
              キャンセル
            </TabletOptimizedButton>
            <TabletOptimizedButton
              onClick={handleSave}
              variant="contained"
              disabled={!inputState.isValid || readOnly}
              touchOptimized
              hapticFeedback
            >
              保存
            </TabletOptimizedButton>
          </Box>
        }
      >
        <Box onKeyDown={handleKeyDown}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              mb: 3, 
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: 500,
              backgroundColor: alpha(theme.palette.info.main, 0.1),
              padding: 2,
              borderRadius: 2,
            }}
          >
            現在の値: 計画 <strong>{formatCurrency(currentCost.planCost)}円</strong> / 実績 <strong>{formatCurrency(currentCost.actualCost)}円</strong>
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {renderCostInput('planCost', '計画コスト', inputState.planCostError, inputState.planCostWarnings)}
            {renderCostInput('actualCost', '実績コスト', inputState.actualCostError, inputState.actualCostWarnings)}
          </Box>
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
      transitionDuration={effectiveAnimationDuration}
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
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}>
        <CalculateIcon sx={{ color: 'primary.main', fontSize: '1.75rem' }} />
        コスト入力
      </DialogTitle>
      
      <DialogContent sx={{ px: 2, py: 3, flex: 1 }}>
        <Typography 
          variant="body1" 
          color="text.secondary" 
          sx={{ 
            mb: 4, 
            textAlign: 'center',
            fontSize: '1rem'
          }}
        >
          現在の値
        </Typography>
        
        <Box sx={{ 
          mb: 4, 
          p: 2, 
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                計画コスト
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                ¥{formatCurrency(currentCost.planCost)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                実績コスト
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                ¥{formatCurrency(currentCost.actualCost)}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {renderCostInput('planCost', '計画コスト', inputState.planCostError, inputState.planCostWarnings)}
          {renderCostInput('actualCost', '実績コスト', inputState.actualCostError, inputState.actualCostWarnings)}
        </Box>
        
        {/* エラー表示 */}
        {!inputState.isValid && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.palette.error.main, 0.1), borderRadius: 1 }}>
            <Typography variant="body2" color="error.main">
              入力内容を確認してください
            </Typography>
          </Box>
        )}
        
        {/* 相互バリデーション警告表示 */}
        {inputState.crossValidationWarnings.length > 0 && showWarnings && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
            <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold', mb: 1 }}>
              注意事項
            </Typography>
            {inputState.crossValidationWarnings.map((warning, index) => (
              <Typography key={index} variant="body2" color="warning.main" sx={{ mb: 0.5 }}>
                • {warning}
              </Typography>
            ))}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ 
        justifyContent: 'center', 
        px: 2,
        pb: 3,
        borderTop: `1px solid ${theme.palette.divider}`,
        gap: 2,
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          size="large"
          sx={getDeviceButtonStyles(deviceType, 'secondary')}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="large"
          disabled={!inputState.isValid || readOnly}
          sx={getDeviceButtonStyles(deviceType, 'primary')}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CostInputDialog;