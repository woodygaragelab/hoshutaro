import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Card,
  CardActionArea,
  Grid,
  InputAdornment,
  Chip,
  useTheme,
  alpha,
  useMediaQuery,
} from '@mui/material';
import {
  CurrencyYen as YenIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { StatusValue, CostValue, SpecificationValue } from '../CommonEdit/types';
import { STATUS_OPTIONS } from '../CommonEdit/statusLogic';
import { MobileOptimizedDialog, MobileOptimizedButton, OneHandedActionArea } from './MobileDialogOptimization';

// 最小タッチターゲットサイズ
const MIN_TOUCH_TARGET = 44;

/**
 * モバイル最適化された状態選択ダイアログ
 * 要件3.3: 状態選択リスト（未計画、計画、実績、両方）を表示
 */
interface MobileStatusSelectionProps {
  open: boolean;
  currentStatus: StatusValue;
  onSelect: (status: StatusValue) => void;
  onClose: () => void;
}

export const MobileStatusSelection: React.FC<MobileStatusSelectionProps> = ({
  open,
  currentStatus,
  onSelect,
  onClose,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleStatusSelect = (status: StatusValue) => {
    onSelect(status);
    onClose();
  };

  const renderStatusOption = (option: typeof STATUS_OPTIONS[0]) => {
    const isSelected = 
      option.value.planned === currentStatus.planned && 
      option.value.actual === currentStatus.actual;

    return (
      <Card
        key={option.label}
        sx={{
          mb: 2,
          border: isSelected ? 
            `2px solid ${theme.palette.primary.main}` : 
            `1px solid ${alpha(theme.palette.divider, 0.2)}`,
          backgroundColor: isSelected ? 
            alpha(theme.palette.primary.main, 0.05) : 
            theme.palette.background.paper,
        }}
      >
        <CardActionArea
          onClick={() => handleStatusSelect(option.value)}
          sx={{
            minHeight: MIN_TOUCH_TARGET + 20,
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* 状態記号 */}
            <Box
              sx={{
                minWidth: 48,
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                backgroundColor: alpha(option.color, 0.1),
                border: `2px solid ${option.color}`,
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  color: option.color,
                  fontWeight: 'bold',
                  fontSize: isSmallScreen ? '1.5rem' : '1.8rem',
                }}
              >
                {option.symbol || '－'}
              </Typography>
            </Box>

            {/* 状態情報 */}
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  fontSize: isSmallScreen ? '1rem' : '1.1rem',
                  mb: 0.5,
                }}
              >
                {option.label}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{
                  fontSize: isSmallScreen ? '0.8rem' : '0.85rem',
                  lineHeight: 1.4,
                }}
              >
                {option.description}
              </Typography>
            </Box>

            {/* 選択インジケーター */}
            {isSelected && (
              <Chip
                label="選択中"
                color="primary"
                size="small"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '0.75rem',
                }}
              />
            )}
          </Box>
        </CardActionArea>
      </Card>
    );
  };

  return (
    <MobileOptimizedDialog
      open={open}
      onClose={onClose}
      title="実施状況の選択"
      fullScreen={isSmallScreen}
    >
      <Box sx={{ py: 1 }}>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{
            mb: 3,
            fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
            lineHeight: 1.5,
          }}
        >
          実施状況を選択してください。記号の意味：○計画済み、●実施済み、◎両方完了
        </Typography>

        {STATUS_OPTIONS.map(renderStatusOption)}

        <OneHandedActionArea>
          <MobileOptimizedButton
            onClick={onClose}
            variant="outlined"
            fullWidth
          >
            キャンセル
          </MobileOptimizedButton>
        </OneHandedActionArea>
      </Box>
    </MobileOptimizedDialog>
  );
};

/**
 * モバイル最適化されたコスト入力ダイアログ
 * 要件3.4: 数値入力に適したフルスクリーンダイアログを表示
 */
interface MobileCostInputProps {
  open: boolean;
  currentCost: CostValue;
  onSave: (cost: CostValue) => void;
  onClose: () => void;
}

export const MobileCostInput: React.FC<MobileCostInputProps> = ({
  open,
  currentCost,
  onSave,
  onClose,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [planCost, setPlanCost] = useState(currentCost.planCost.toString());
  const [actualCost, setActualCost] = useState(currentCost.actualCost.toString());
  const [planCostError, setPlanCostError] = useState<string>('');
  const [actualCostError, setActualCostError] = useState<string>('');

  // キーボード表示時の自動スクロール
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    setPlanCost(currentCost.planCost.toString());
    setActualCost(currentCost.actualCost.toString());
  }, [currentCost]);

  // 数値フォーマット（3桁区切り）
  const formatNumber = (value: string) => {
    const num = parseInt(value.replace(/,/g, ''), 10);
    return isNaN(num) ? '' : num.toLocaleString();
  };

  // バリデーション
  const validateCost = (value: string, fieldName: string) => {
    const num = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(num)) {
      return `${fieldName}は数値で入力してください`;
    }
    if (num < 0) {
      return `${fieldName}は0以上で入力してください`;
    }
    if (num > 999999999) {
      return `${fieldName}は999,999,999以下で入力してください`;
    }
    return '';
  };

  const handlePlanCostChange = (value: string) => {
    const formatted = formatNumber(value);
    setPlanCost(formatted);
    setPlanCostError(validateCost(formatted, '計画コスト'));
  };

  const handleActualCostChange = (value: string) => {
    const formatted = formatNumber(value);
    setActualCost(formatted);
    setActualCostError(validateCost(formatted, '実績コスト'));
  };

  const handleSave = () => {
    const planNum = parseInt(planCost.replace(/,/g, ''), 10) || 0;
    const actualNum = parseInt(actualCost.replace(/,/g, ''), 10) || 0;
    
    const planError = validateCost(planCost, '計画コスト');
    const actualError = validateCost(actualCost, '実績コスト');
    
    if (planError || actualError) {
      setPlanCostError(planError);
      setActualCostError(actualError);
      return;
    }

    onSave({
      planCost: planNum,
      actualCost: actualNum,
    });
  };

  const isValid = !planCostError && !actualCostError;

  return (
    <MobileOptimizedDialog
      open={open}
      onClose={onClose}
      title="コスト情報の入力"
      fullScreen={isSmallScreen}
      onKeyboardShow={() => setKeyboardVisible(true)}
      onKeyboardHide={() => setKeyboardVisible(false)}
      actions={
        <OneHandedActionArea>
          <MobileOptimizedButton
            onClick={onClose}
            variant="outlined"
            fullWidth
          >
            キャンセル
          </MobileOptimizedButton>
          <MobileOptimizedButton
            onClick={handleSave}
            variant="contained"
            fullWidth
            disabled={!isValid}
          >
            保存
          </MobileOptimizedButton>
        </OneHandedActionArea>
      }
    >
      <Box sx={{ py: 2 }}>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{
            mb: 3,
            fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
            lineHeight: 1.5,
          }}
        >
          計画コストと実績コストを入力してください。数値は自動的に3桁区切りで表示されます。
        </Typography>

        {/* 計画コスト */}
        <Box sx={{ mb: 3 }}>
          <TextField
            label="計画コスト"
            value={planCost}
            onChange={(e) => handlePlanCostChange(e.target.value)}
            fullWidth
            error={!!planCostError}
            helperText={planCostError}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <YenIcon color="primary" />
                </InputAdornment>
              ),
              sx: {
                minHeight: MIN_TOUCH_TARGET,
                fontSize: isSmallScreen ? '1.1rem' : '1.2rem',
              },
            }}
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9,]*',
              style: {
                fontSize: isSmallScreen ? '1.1rem' : '1.2rem',
                textAlign: 'right',
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>

        {/* 実績コスト */}
        <Box sx={{ mb: 3 }}>
          <TextField
            label="実績コスト"
            value={actualCost}
            onChange={(e) => handleActualCostChange(e.target.value)}
            fullWidth
            error={!!actualCostError}
            helperText={actualCostError}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalculateIcon color="secondary" />
                </InputAdornment>
              ),
              sx: {
                minHeight: MIN_TOUCH_TARGET,
                fontSize: isSmallScreen ? '1.1rem' : '1.2rem',
              },
            }}
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9,]*',
              style: {
                fontSize: isSmallScreen ? '1.1rem' : '1.2rem',
                textAlign: 'right',
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        </Box>

        {/* コスト比較表示 */}
        {planCost && actualCost && (
          <Card
            sx={{
              p: 2,
              backgroundColor: alpha(theme.palette.info.main, 0.05),
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                mb: 1,
                color: theme.palette.info.main,
              }}
            >
              コスト比較
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">計画コスト:</Typography>
              <Typography variant="body2" fontWeight="bold">
                ¥{planCost || '0'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">実績コスト:</Typography>
              <Typography variant="body2" fontWeight="bold">
                ¥{actualCost || '0'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${theme.palette.divider}`, pt: 1 }}>
              <Typography variant="body2" fontWeight="bold">差額:</Typography>
              <Typography 
                variant="body2" 
                fontWeight="bold"
                color={
                  (parseInt(actualCost.replace(/,/g, ''), 10) || 0) > (parseInt(planCost.replace(/,/g, ''), 10) || 0) ? 
                  'error' : 'success'
                }
              >
                ¥{Math.abs((parseInt(actualCost.replace(/,/g, ''), 10) || 0) - (parseInt(planCost.replace(/,/g, ''), 10) || 0)).toLocaleString()}
                {(parseInt(actualCost.replace(/,/g, ''), 10) || 0) > (parseInt(planCost.replace(/,/g, ''), 10) || 0) ? ' 超過' : ' 節約'}
              </Typography>
            </Box>
          </Card>
        )}
      </Box>
    </MobileOptimizedDialog>
  );
};

/**
 * モバイル最適化された機器仕様編集ダイアログ
 * 要件3.5: テキスト編集に適したダイアログを表示
 */
interface MobileSpecificationEditProps {
  open: boolean;
  specifications: SpecificationValue[];
  onSave: (specifications: SpecificationValue[]) => void;
  onClose: () => void;
}

export const MobileSpecificationEdit: React.FC<MobileSpecificationEditProps> = ({
  open,
  specifications,
  onSave,
  onClose,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [specs, setSpecs] = useState<SpecificationValue[]>(specifications);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    setSpecs(specifications);
  }, [specifications]);

  const handleSpecChange = (index: number, field: 'key' | 'value', value: string) => {
    const newSpecs = [...specs];
    newSpecs[index] = { ...newSpecs[index], [field]: value };
    setSpecs(newSpecs);
  };

  const handleAddSpec = () => {
    const newSpec: SpecificationValue = {
      key: '',
      value: '',
      order: specs.length,
    };
    setSpecs([...specs, newSpec]);
  };

  const handleRemoveSpec = (index: number) => {
    const newSpecs = specs.filter((_, i) => i !== index);
    // order値を再調整
    newSpecs.forEach((spec, i) => {
      spec.order = i;
    });
    setSpecs(newSpecs);
  };

  const handleSave = () => {
    // 空の仕様項目を除外
    const validSpecs = specs.filter(spec => spec.key.trim() || spec.value.trim());
    onSave(validSpecs);
  };

  return (
    <MobileOptimizedDialog
      open={open}
      onClose={onClose}
      title="機器仕様の編集"
      fullScreen={isSmallScreen}
      onKeyboardShow={() => setKeyboardVisible(true)}
      onKeyboardHide={() => setKeyboardVisible(false)}
      actions={
        <OneHandedActionArea>
          <MobileOptimizedButton
            onClick={onClose}
            variant="outlined"
            fullWidth
          >
            キャンセル
          </MobileOptimizedButton>
          <MobileOptimizedButton
            onClick={handleSave}
            variant="contained"
            fullWidth
          >
            保存
          </MobileOptimizedButton>
        </OneHandedActionArea>
      }
    >
      <Box sx={{ py: 2 }}>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{
            mb: 3,
            fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
            lineHeight: 1.5,
          }}
        >
          機器の仕様項目を編集できます。項目名と値を入力してください。
        </Typography>

        {/* 仕様項目リスト */}
        <List sx={{ mb: 2 }}>
          {specs.map((spec, index) => (
            <ListItem
              key={index}
              sx={{
                flexDirection: 'column',
                alignItems: 'stretch',
                p: 2,
                mb: 2,
                backgroundColor: alpha(theme.palette.background.default, 0.5),
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  仕様項目 {index + 1}
                </Typography>
                <MobileOptimizedButton
                  onClick={() => handleRemoveSpec(index)}
                  variant="outlined"
                  color="error"
                >
                  削除
                </MobileOptimizedButton>
              </Box>

              <TextField
                label="項目名"
                value={spec.key}
                onChange={(e) => handleSpecChange(index, 'key', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                InputProps={{
                  sx: { minHeight: MIN_TOUCH_TARGET },
                }}
              />

              <TextField
                label="値"
                value={spec.value}
                onChange={(e) => handleSpecChange(index, 'value', e.target.value)}
                fullWidth
                multiline
                rows={2}
                InputProps={{
                  sx: { minHeight: MIN_TOUCH_TARGET },
                }}
              />
            </ListItem>
          ))}
        </List>

        {/* 項目追加ボタン */}
        <MobileOptimizedButton
          onClick={handleAddSpec}
          variant="outlined"
          fullWidth
          startIcon={<Typography sx={{ fontSize: '1.2rem' }}>+</Typography>}
        >
          仕様項目を追加
        </MobileOptimizedButton>
      </Box>
    </MobileOptimizedDialog>
  );
};