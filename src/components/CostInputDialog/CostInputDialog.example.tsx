import React, { useState } from 'react';
import { Button, Box, Typography } from '@mui/material';
import { CostInputDialog } from './CostInputDialog';
import { CostValue } from '../CommonEdit/types';

/**
 * CostInputDialog使用例
 */
export const CostInputDialogExample: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [deviceType, setDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [currentCost, setCurrentCost] = useState<CostValue>({
    planCost: 1000000,
    actualCost: 850000,
  });

  const handleSave = (newCost: CostValue) => {
    setCurrentCost(newCost);
    console.log('Cost saved:', newCost);
  };

  const handleValidationError = (errors: string[]) => {
    console.error('Validation errors:', errors);
    alert('入力エラー:\n' + errors.join('\n'));
  };

  const handleValidationWarning = (warnings: string[]) => {
    console.warn('Validation warnings:', warnings);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        コスト入力ダイアログ デモ
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body1">
          現在のコスト: 計画 ¥{currentCost.planCost.toLocaleString()} / 実績 ¥{currentCost.actualCost.toLocaleString()}
        </Typography>
      </Box>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant={deviceType === 'desktop' ? 'contained' : 'outlined'}
          onClick={() => setDeviceType('desktop')}
        >
          デスクトップ
        </Button>
        <Button
          variant={deviceType === 'tablet' ? 'contained' : 'outlined'}
          onClick={() => setDeviceType('tablet')}
        >
          タブレット
        </Button>
        <Button
          variant={deviceType === 'mobile' ? 'contained' : 'outlined'}
          onClick={() => setDeviceType('mobile')}
        >
          モバイル
        </Button>
      </Box>
      
      <Button
        variant="contained"
        onClick={() => setOpen(true)}
        sx={{ mb: 2 }}
      >
        コスト入力ダイアログを開く ({deviceType})
      </Button>
      
      <CostInputDialog
        open={open}
        currentCost={currentCost}
        onSave={handleSave}
        onClose={() => setOpen(false)}
        deviceType={deviceType}
        onValidationError={handleValidationError}
        onValidationWarning={handleValidationWarning}
        userName="テストユーザー"
        showWarnings={true}
        enableAutoFormat={true}
      />
    </Box>
  );
};

export default CostInputDialogExample;