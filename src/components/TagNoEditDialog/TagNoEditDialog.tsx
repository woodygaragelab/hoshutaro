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
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

export interface TagNoEditDialogProps {
  open: boolean;
  tagNo: string;
  onSave: (tagNo: string) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  animationDuration?: number;
  readOnly?: boolean;
}

/**
 * TAG NO.編集ダイアログ
 * 機器台帳と同じUIスタイルで実装
 */
export const TagNoEditDialog: React.FC<TagNoEditDialogProps> = ({
  open,
  tagNo,
  onSave,
  onClose,
  anchorEl,
  animationDuration = 300,
  readOnly = false,
}) => {
  const theme = useTheme();
  
  const [editValue, setEditValue] = useState(tagNo);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open) {
      setEditValue(tagNo);
      setHasChanges(false);
      setError('');
    }
  }, [tagNo, open]);

  // バリデーション
  const validateTagNo = useCallback((value: string): string => {
    if (!value.trim()) {
      return 'TAG NO.は必須です';
    }
    if (value.trim().length > 50) {
      return 'TAG NO.は50文字以内で入力してください';
    }
    // TAG NO.の形式チェック（英数字、ハイフン、アンダースコアのみ）
    const tagNoPattern = /^[A-Za-z0-9\-_]+$/;
    if (!tagNoPattern.test(value.trim())) {
      return 'TAG NO.は英数字、ハイフン、アンダースコアのみ使用できます';
    }
    return '';
  }, []);

  const handleChange = useCallback((value: string) => {
    setEditValue(value);
    setHasChanges(value !== tagNo);
    const validationError = validateTagNo(value);
    setError(validationError);
  }, [tagNo, validateTagNo]);

  const handleSave = useCallback(() => {
    const validationError = validateTagNo(editValue);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    onSave(editValue.trim());
    onClose();
  }, [editValue, validateTagNo, onSave, onClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [handleSave, onClose]);

  if (anchorEl) {
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
          },
        }}
        onKeyDown={handleKeyDown}
      >
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <EditIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight="bold">
                TAG NO.編集
              </Typography>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            label="TAG NO."
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            error={!!error}
            helperText={error || 'TAG NO.を入力してください（英数字、ハイフン、アンダースコア）'}
            size="small"
            disabled={readOnly}
            autoFocus
            inputProps={{
              maxLength: 50,
            }}
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={onClose} size="small">
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              size="small"
              disabled={!!error || !hasChanges || readOnly}
              startIcon={<SaveIcon />}
            >
              保存
            </Button>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Enter: 保存, Esc: キャンセル
          </Typography>
        </Paper>
      </Popover>
    );
  }

  return null;
};

export default TagNoEditDialog;
