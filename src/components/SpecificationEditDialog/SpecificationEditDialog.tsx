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
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { SpecificationValue } from '../CommonEdit/types';

export interface SpecificationEditDialogProps {
  open: boolean;
  specifications: SpecificationValue[];
  onSave: (specifications: SpecificationValue[]) => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  animationDuration?: number;
  maxItems?: number;
  onValidationError?: (errors: string[]) => void;
  readOnly?: boolean;
}

// 機器仕様編集の状態管理
export interface SpecificationEditState {
  items: SpecificationEditItem[];
  hasChanges: boolean;
  validationErrors: { [index: number]: string };
  editingIndex: number | null; // 現在編集中の項目のインデックス
}

export interface SpecificationEditItem {
  id: string;
  key: string;
  value: string;
  order: number;
  isNew?: boolean;
  isDeleted?: boolean;
  keyError?: string;
  valueError?: string;
}



/**
 * 機器仕様編集ダイアログ
 */
export const SpecificationEditDialog: React.FC<SpecificationEditDialogProps> = ({
  open,
  specifications,
  onSave,
  onClose,
  anchorEl,
  animationDuration = 300,
  maxItems = 20,
  onValidationError,
  readOnly = false,
}) => {
  const theme = useTheme();
  
  const [editState, setEditState] = useState<SpecificationEditState>({
    items: [],
    hasChanges: false,
    validationErrors: {},
    editingIndex: null,
  });

  // 仕様データを編集用アイテムに変換
  const convertToEditItems = useCallback((specs: SpecificationValue[]): SpecificationEditItem[] => {
    return specs.map((spec, index) => ({
      id: `spec-${index}-${Date.now()}`,
      key: spec.key,
      value: spec.value,
      order: spec.order,
      isNew: false,
      isDeleted: false,
    }));
  }, []);

  // 編集用アイテムを仕様データに変換
  const convertToSpecifications = useCallback((items: SpecificationEditItem[]): SpecificationValue[] => {
    return items
      .filter(item => !item.isDeleted)
      .map((item, index) => ({
        key: item.key.trim(),
        value: item.value.trim(),
        order: index + 1, // 順序を再計算
      }));
  }, []);

  useEffect(() => {
    if (open) {
      const editItems = convertToEditItems(specifications);
      setEditState({
        items: editItems,
        hasChanges: false,
        validationErrors: {},
        editingIndex: null,
      });
    }
  }, [specifications, open, convertToEditItems]);

  // バリデーション
  const validateItem = useCallback((item: SpecificationEditItem): { keyError?: string; valueError?: string } => {
    const errors: { keyError?: string; valueError?: string } = {};
    
    // キーのバリデーション
    if (!item.key.trim()) {
      errors.keyError = '項目名は必須です';
    } else if (item.key.trim().length > 50) {
      errors.keyError = '項目名は50文字以内で入力してください';
    }
    
    // 値のバリデーション
    if (!item.value.trim()) {
      errors.valueError = '値は必須です';
    } else if (item.value.trim().length > 200) {
      errors.valueError = '値は200文字以内で入力してください';
    }
    
    return errors;
  }, []);

  // 全体のバリデーション
  const validateAllItems = useCallback((items: SpecificationEditItem[]): { [index: number]: string } => {
    const validationErrors: { [index: number]: string } = {};
    const activeItems = items.filter(item => !item.isDeleted);
    
    // 重複チェック
    const keyMap = new Map<string, number[]>();
    activeItems.forEach((item, index) => {
      const key = item.key.trim().toLowerCase();
      if (key) {
        if (!keyMap.has(key)) {
          keyMap.set(key, []);
        }
        keyMap.get(key)!.push(index);
      }
    });
    
    keyMap.forEach((indices, key) => {
      if (indices.length > 1) {
        indices.forEach(index => {
          validationErrors[index] = `項目名「${key}」が重複しています`;
        });
      }
    });
    
    return validationErrors;
  }, []);

  // 項目の追加
  const handleAddItem = useCallback(() => {
    if (editState.items.filter(item => !item.isDeleted).length >= maxItems) {
      if (onValidationError) {
        onValidationError([`項目数の上限（${maxItems}個）に達しています`]);
      }
      return;
    }
    
    const newItem: SpecificationEditItem = {
      id: `new-${Date.now()}`,
      key: '',
      value: '',
      order: editState.items.length + 1,
      isNew: true,
      isDeleted: false,
    };
    
    const newItems = [...editState.items, newItem];
    const validationErrors = validateAllItems(newItems);
    
    setEditState({
      ...editState,
      items: newItems,
      hasChanges: true,
      validationErrors,
      editingIndex: newItems.length - 1, // 新しい項目を編集モードに
    });
  }, [editState, maxItems, onValidationError, validateAllItems]);

  // 項目の削除
  const handleDeleteItem = useCallback((index: number) => {
    const newItems = [...editState.items];
    newItems[index] = { ...newItems[index], isDeleted: true };
    
    const validationErrors = validateAllItems(newItems);
    
    setEditState({
      ...editState,
      items: newItems,
      hasChanges: true,
      validationErrors,
      editingIndex: editState.editingIndex === index ? null : editState.editingIndex,
    });
  }, [editState, validateAllItems]);

  // 項目の編集
  const handleEditItem = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const newItems = [...editState.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // 個別バリデーション
    const itemValidation = validateItem(newItems[index]);
    newItems[index] = { ...newItems[index], ...itemValidation };
    
    // 全体バリデーション
    const validationErrors = validateAllItems(newItems);
    
    setEditState({
      ...editState,
      items: newItems,
      hasChanges: true,
      validationErrors,
    });
  }, [editState, validateItem, validateAllItems]);

  const handleToggleEdit = useCallback((index: number | null) => {
    setEditState({
      ...editState,
      editingIndex: index,
    });
  }, [editState]);



  // 保存処理
  const handleSave = useCallback(() => {
    const activeItems = editState.items.filter(item => !item.isDeleted);
    
    // 最終バリデーション
    const errors: string[] = [];
    const validationErrors = validateAllItems(editState.items);
    
    activeItems.forEach((item, index) => {
      const itemValidation = validateItem(item);
      if (itemValidation.keyError) errors.push(`${index + 1}行目: ${itemValidation.keyError}`);
      if (itemValidation.valueError) errors.push(`${index + 1}行目: ${itemValidation.valueError}`);
    });
    
    Object.values(validationErrors).forEach(error => {
      if (error) errors.push(error);
    });
    
    if (errors.length > 0) {
      if (onValidationError) {
        onValidationError(errors);
      }
      return;
    }
    
    const newSpecifications = convertToSpecifications(editState.items);
    
    onSave(newSpecifications);
    onClose();
  }, [editState, validateAllItems, validateItem, convertToSpecifications, onSave, onClose, onValidationError]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          handleSave();
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    }
  }, [handleSave, onClose]);

  const renderEditItem = (item: SpecificationEditItem, index: number) => {
    if (item.isDeleted) return null;
    
    const isEditing = editState.editingIndex === index;
    const hasError = item.keyError || item.valueError || editState.validationErrors[index];
    const activeItems = editState.items.filter(i => !i.isDeleted);
    const currentActiveIndex = activeItems.indexOf(item);
    
    const itemStyle = {
      border: hasError ? `1px solid ${theme.palette.error.main}` : 'none',
      borderRadius: hasError ? 1 : 0,
      mb: hasError ? 1 : 0,
    };
    
    if (isEditing) {
      return (
        <ListItem key={item.id} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <TextField
              fullWidth
              label="項目名"
              value={item.key}
              onChange={(e) => handleEditItem(index, 'key', e.target.value)}
              error={!!item.keyError}
              helperText={item.keyError}
              size="small"
              disabled={readOnly}
              inputProps={{
                maxLength: 50,
              }}
            />
            <TextField
              fullWidth
              label="値"
              value={item.value}
              onChange={(e) => handleEditItem(index, 'value', e.target.value)}
              error={!!item.valueError}
              helperText={item.valueError}
              size="small"
              disabled={readOnly}
              multiline={false}
              inputProps={{
                maxLength: 200,
              }}
            />
            {editState.validationErrors[index] && (
              <Typography variant="caption" color="error">
                {editState.validationErrors[index]}
              </Typography>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => handleToggleEdit(null)}
                color="primary"
              >
                <SaveIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleToggleEdit(null)}
                color="secondary"
              >
                <CancelIcon />
              </IconButton>
            </Box>
          </Box>
        </ListItem>
      );
    }
    
    return (
      <ListItem key={item.id} sx={itemStyle}>
        <Chip 
          label={currentActiveIndex + 1} 
          size="small" 
          variant="outlined" 
          sx={{ mr: 1, minWidth: 32 }}
        />
        
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {item.key || '（未入力）'}
              </Typography>
              {item.isNew && (
                <Chip label="新規" size="small" color="primary" variant="outlined" />
              )}
            </Box>
          }
          secondary={
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {item.value || '（未入力）'}
            </Typography>
          }
        />
        
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => handleToggleEdit(index)}
              disabled={readOnly}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDeleteItem(index)}
              disabled={readOnly}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  const activeItemsCount = editState.items.filter(item => !item.isDeleted).length;
  const hasErrors = Object.keys(editState.validationErrors).length > 0 || 
                   editState.items.some(item => item.keyError || item.valueError);

  // Desktop-only popover
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
            minWidth: 480,
            maxWidth: 600,
            boxShadow: theme.shadows[8],
          },
        }}
        onKeyDown={handleKeyDown}
      >
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight="bold">
                機器仕様編集
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {activeItemsCount}/{maxItems}項目
            </Typography>
          </Box>
          
          <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
            <List dense>
              {editState.items.map((item, index) => renderEditItem(item, index))}
            </List>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              disabled={activeItemsCount >= maxItems || readOnly}
              size="small"
            >
              項目追加
            </Button>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={onClose} size="small">
                キャンセル
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                size="small"
                disabled={hasErrors || !editState.hasChanges || readOnly}
              >
                保存
              </Button>
            </Box>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Ctrl+Enter: 保存, Esc: キャンセル
          </Typography>
        </Paper>
      </Popover>
    );
  }


};

export default SpecificationEditDialog;