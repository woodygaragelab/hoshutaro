import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box
} from '@mui/material';

interface SimpleStatusDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (value: { planned: boolean; actual: boolean }) => void;
  itemName: string;
  timeHeader: string;
  currentValue?: {
    planned?: boolean;
    actual?: boolean;
  };
}

export const SimpleStatusDialog: React.FC<SimpleStatusDialogProps> = ({
  open,
  onClose,
  onSave,
  itemName,
  timeHeader,
  currentValue = { planned: false, actual: false }
}) => {
  const [selectedStatus, setSelectedStatus] = useState(() => {
    if (currentValue.planned && currentValue.actual) return 'both';
    if (currentValue.planned) return 'planned';
    if (currentValue.actual) return 'actual';
    return 'none';
  });

  const handleSave = () => {
    let result = { planned: false, actual: false };
    
    switch (selectedStatus) {
      case 'planned':
        result = { planned: true, actual: false };
        break;
      case 'actual':
        result = { planned: false, actual: true };
        break;
      case 'both':
        result = { planned: true, actual: true };
        break;
      case 'none':
      default:
        result = { planned: false, actual: false };
        break;
    }
    
    onSave(result);
    onClose();
  };

  const getSymbol = (status: string) => {
    switch (status) {
      case 'planned': return '○';
      case 'actual': return '●';
      case 'both': return '◎';
      case 'none': return '';
      default: return '';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#2a2a2a',
          color: 'white'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white' }}>
        保全ステータス編集
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="grey.300">
            機器: {itemName}
          </Typography>
          <Typography variant="body2" color="grey.300">
            期間: {timeHeader}
          </Typography>
        </Box>

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <FormLabel component="legend" sx={{ color: 'white', mb: 2 }}>
            保全ステータスを選択してください
          </FormLabel>
          
          <RadioGroup
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <FormControlLabel
              value="none"
              control={<Radio sx={{ color: 'grey.400', '&.Mui-checked': { color: 'grey.300' } }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>未計画</Typography>
                  <Typography variant="body2" color="grey.400">(記号なし)</Typography>
                </Box>
              }
              sx={{ color: 'white' }}
            />
            
            <FormControlLabel
              value="planned"
              control={<Radio sx={{ color: 'primary.main', '&.Mui-checked': { color: 'primary.main' } }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>計画のみ</Typography>
                  <Typography variant="h6" color="primary.main">○</Typography>
                </Box>
              }
              sx={{ color: 'white' }}
            />
            
            <FormControlLabel
              value="actual"
              control={<Radio sx={{ color: 'secondary.main', '&.Mui-checked': { color: 'secondary.main' } }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>実績のみ</Typography>
                  <Typography variant="h6" color="secondary.main">●</Typography>
                </Box>
              }
              sx={{ color: 'white' }}
            />
            
            <FormControlLabel
              value="both"
              control={<Radio sx={{ color: 'success.main', '&.Mui-checked': { color: 'success.main' } }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>計画・実績両方</Typography>
                  <Typography variant="h6" color="success.main">◎</Typography>
                </Box>
              }
              sx={{ color: 'white' }}
            />
          </RadioGroup>
        </FormControl>

        <Box sx={{ mt: 3, p: 2, backgroundColor: '#3a3a3a', borderRadius: 1 }}>
          <Typography variant="body2" color="grey.300">
            プレビュー: 
            <Typography component="span" variant="h6" sx={{ ml: 1, color: 'white' }}>
              {getSymbol(selectedStatus) || '(記号なし)'}
            </Typography>
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'grey.400' }}>
          キャンセル
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SimpleStatusDialog;