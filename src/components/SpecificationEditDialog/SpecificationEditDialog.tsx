import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Tooltip,
  Collapse,
  ButtonGroup,
} from '@mui/material';
import { TabletOptimizedDialog } from '../EnhancedMaintenanceGrid/TabletOptimizedDialog';
import { TabletOptimizedButton, TabletOptimizedIconButton } from '../EnhancedMaintenanceGrid/TabletOptimizedButton';
import { TransitionProps } from '@mui/material/transitions';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  SwapVert as ReorderIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  FirstPage as FirstIcon,
  LastPage as LastIcon,
} from '@mui/icons-material';
import { SpecificationValue } from '../CommonEdit/types';
import {
  DesktopDragHandler,
  TouchReorderHandler,
  moveItem,
  updateSpecificationOrder,
  getActiveItemIndices,
  handleKeyboardReorder,

  getReorderAriaAttributes,
  getReorderInstructions,
} from './reorderingUtils';
import { useResponsiveLayout } from './useResponsiveLayout';
import {
  MobileFloatingActions,
  DeviceErrorDisplay,
  KeyboardAdjustment,
} from './DeviceSpecificComponents';

export interface SpecificationEditDialogProps {
  open: boolean;
  specifications: SpecificationValue[];
  onSave: (specifications: SpecificationValue[]) => void;
  onClose: () => void;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  anchorEl?: HTMLElement | null; // Desktop用のアンカー要素
  animationDuration?: number; // アニメーション時間
  maxItems?: number; // 最大項目数
  onValidationError?: (errors: string[]) => void; // バリデーションエラーハンドラー
  userName?: string; // 変更履歴用のユーザー名
  readOnly?: boolean; // 読み取り専用モード
  allowReorder?: boolean; // 順序変更を許可するか
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
 * 機器仕様編集ダイアログ
 */
export const SpecificationEditDialog: React.FC<SpecificationEditDialogProps> = ({
  open,
  specifications,
  onSave,
  onClose,
  deviceType: propDeviceType,
  anchorEl,
  animationDuration = 300,
  maxItems = 20,
  onValidationError,
  userName = 'unknown',
  readOnly = false,
  allowReorder = true,
}) => {
  const theme = useTheme();
  
  // レスポンシブレイアウトの管理
  const {
    layoutState,
    getDeviceStyles,
    getDeviceBehavior,
    isKeyboardVisible,
  } = useResponsiveLayout();
  
  // プロパティで指定されたデバイスタイプを優先、なければ自動検出
  const deviceType = propDeviceType || layoutState.deviceType;
  const deviceStyles = getDeviceStyles();
  const deviceBehavior = getDeviceBehavior();
  
  // 編集状態の管理
  const [editState, setEditState] = useState<SpecificationEditState>({
    items: [],
    hasChanges: false,
    validationErrors: {},
    editingIndex: null,
  });

  // ドラッグ&ドロップとタッチ順序変更の管理
  const dragHandlerRef = useRef<DesktopDragHandler | null>(null);
  const touchHandlerRef = useRef<TouchReorderHandler | null>(null);
  const [dragState, setDragState] = useState<{ isDragging: boolean; draggedIndex: number | null; dropTargetIndex: number | null }>({ 
    isDragging: false, 
    draggedIndex: null, 
    dropTargetIndex: null 
  });
  const [touchReorderState, setTouchReorderState] = useState<{ isReordering: boolean; selectedIndex: number | null }>({ 
    isReordering: false, 
    selectedIndex: null 
  });

  // アニメーション設定（将来の拡張用）
  // const reorderAnimationConfig = getReorderAnimationConfig(deviceType);

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

  // 初期化
  useEffect(() => {
    if (open) {
      const editItems = convertToEditItems(specifications);
      setEditState({
        items: editItems,
        hasChanges: false,
        validationErrors: {},
        editingIndex: null,
      });
      
      // ドラッグ&ドロップハンドラーの初期化
      if (deviceType === 'desktop' && allowReorder) {
        dragHandlerRef.current = new DesktopDragHandler({
          onDragStart: (index) => {
            setDragState(prev => ({ ...prev, isDragging: true, draggedIndex: index }));
          },
          onDragOver: (targetIndex) => {
            setDragState(prev => ({ ...prev, dropTargetIndex: targetIndex }));
          },
          onDragEnd: (fromIndex, toIndex) => {
            handleReorderItems(fromIndex, toIndex);
            setDragState({ isDragging: false, draggedIndex: null, dropTargetIndex: null });
          },
        });
      }
      
      // タッチ順序変更ハンドラーの初期化
      if ((deviceType === 'tablet' || deviceType === 'mobile') && allowReorder) {
        touchHandlerRef.current = new TouchReorderHandler({
          onReorderStart: (index) => {
            setTouchReorderState({ isReordering: true, selectedIndex: index });
          },
          onReorderEnd: (fromIndex, toIndex) => {
            handleReorderItems(fromIndex, toIndex);
            setTouchReorderState({ isReordering: false, selectedIndex: null });
          },
          onReorderCancel: () => {
            setTouchReorderState({ isReordering: false, selectedIndex: null });
          },
        });
      }
    }
  }, [specifications, open, convertToEditItems, deviceType, allowReorder]);

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

  // 編集モードの切り替え
  const handleToggleEdit = useCallback((index: number | null) => {
    setEditState({
      ...editState,
      editingIndex: index,
    });
  }, [editState]);

  // 順序変更の統一ハンドラー
  const handleReorderItems = useCallback((fromIndex: number, toIndex: number) => {
    if (!allowReorder || fromIndex === toIndex) return;
    
    const newItems = moveItem(editState.items, fromIndex, toIndex);
    const updatedItems = updateSpecificationOrder(newItems);
    
    setEditState({
      ...editState,
      items: updatedItems,
      hasChanges: true,
    });
  }, [editState, allowReorder]);

  // 順序変更（簡易版 - 上下移動）
  const handleMoveItem = useCallback((index: number, direction: 'up' | 'down' | 'first' | 'last') => {
    if (!allowReorder) return;
    
    const activeIndices = getActiveItemIndices(editState.items);
    const currentActiveIndex = activeIndices.indexOf(index);
    
    if (currentActiveIndex === -1) return;
    
    let targetActiveIndex = currentActiveIndex;
    
    switch (direction) {
      case 'up':
        if (currentActiveIndex > 0) {
          targetActiveIndex = currentActiveIndex - 1;
        } else {
          return;
        }
        break;
      case 'down':
        if (currentActiveIndex < activeIndices.length - 1) {
          targetActiveIndex = currentActiveIndex + 1;
        } else {
          return;
        }
        break;
      case 'first':
        if (currentActiveIndex > 0) {
          targetActiveIndex = 0;
        } else {
          return;
        }
        break;
      case 'last':
        if (currentActiveIndex < activeIndices.length - 1) {
          targetActiveIndex = activeIndices.length - 1;
        } else {
          return;
        }
        break;
    }
    
    const targetIndex = activeIndices[targetActiveIndex];
    handleReorderItems(index, targetIndex);
  }, [editState, allowReorder, handleReorderItems]);

  // タッチ順序変更の開始
  const handleStartTouchReorder = useCallback((index: number) => {
    if (!allowReorder || !touchHandlerRef.current) return;
    
    const item = editState.items[index];
    touchHandlerRef.current.startReordering(index, item, editState.items);
  }, [editState.items, allowReorder]);

  // タッチ順序変更の位置選択
  const handleSelectTouchPosition = useCallback((targetIndex: number) => {
    if (!touchHandlerRef.current) return;
    
    touchHandlerRef.current.moveToPosition(targetIndex);
  }, []);

  // タッチ順序変更のキャンセル
  const handleCancelTouchReorder = useCallback(() => {
    if (!touchHandlerRef.current) return;
    
    touchHandlerRef.current.cancelReordering();
  }, []);

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
    
    console.log('Specification change:', {
      from: specifications,
      to: newSpecifications,
      user: userName,
      device: deviceType,
      timestamp: new Date(),
    });
    
    onSave(newSpecifications);
    onClose();
  }, [editState, validateAllItems, validateItem, convertToSpecifications, specifications, userName, deviceType, onSave, onClose, onValidationError]);

  // キーボードハンドラー
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

  // 項目レベルのキーボードハンドラー
  const handleItemKeyDown = useCallback((event: React.KeyboardEvent, index: number) => {
    if (allowReorder && deviceType === 'desktop') {
      handleKeyboardReorder(event, index, editState.items, handleReorderItems);
    }
  }, [allowReorder, deviceType, editState.items, handleReorderItems]);

  // 編集項目のレンダリング
  const renderEditItem = (item: SpecificationEditItem, index: number) => {
    if (item.isDeleted) return null;
    
    const isEditing = editState.editingIndex === index;
    const hasError = item.keyError || item.valueError || editState.validationErrors[index];
    const isDragging = dragState.isDragging && dragState.draggedIndex === index;
    const isDropTarget = dragState.dropTargetIndex === index;
    const isSelected = touchReorderState.selectedIndex === index;
    const activeIndices = getActiveItemIndices(editState.items);
    const currentActiveIndex = activeIndices.indexOf(index);
    const isFirst = currentActiveIndex === 0;
    const isLast = currentActiveIndex === activeIndices.length - 1;
    
    // アニメーション用のスタイル
    const itemStyle = {
      border: hasError ? `1px solid ${theme.palette.error.main}` : 
              isDropTarget ? `2px solid ${theme.palette.primary.main}` :
              isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
      borderRadius: (hasError || isDropTarget || isSelected) ? 1 : 0,
      mb: (hasError || isDropTarget || isSelected) ? 1 : 0,
      backgroundColor: isDropTarget ? alpha(theme.palette.primary.main, 0.08) :
                      isSelected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      opacity: isDragging ? 0.8 : 1,
      transition: 'all 0.2s ease-in-out',
      cursor: allowReorder && deviceType === 'desktop' ? 'grab' : 'default',
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
              size={deviceType === 'mobile' ? 'medium' : 'small'}
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
              size={deviceType === 'mobile' ? 'medium' : 'small'}
              disabled={readOnly}
              multiline={deviceType !== 'desktop'}
              rows={deviceType === 'mobile' ? 3 : 2}
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
    
    // デスクトップ用ドラッグ&ドロップ対応
    const dragProps = allowReorder && deviceType === 'desktop' && dragHandlerRef.current ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => dragHandlerRef.current!.handleDragStart(e, index, item),
      onDragOver: (e: React.DragEvent) => dragHandlerRef.current!.handleDragOver(e, index),
      onDragEnter: (e: React.DragEvent) => dragHandlerRef.current!.handleDragEnter(e),
      onDragLeave: (e: React.DragEvent) => dragHandlerRef.current!.handleDragLeave(e),
      onDrop: (e: React.DragEvent) => dragHandlerRef.current!.handleDrop(e, index),
      onDragEnd: () => dragHandlerRef.current!.handleDragEnd(),
    } : {};
    
    // アクセシビリティ属性
    const ariaAttributes = getReorderAriaAttributes(
      currentActiveIndex,
      activeIndices.length,
      isSelected,
      isDropTarget
    );
    
    return (
      <ListItem
        key={item.id}
        sx={itemStyle}
        onKeyDown={(e: React.KeyboardEvent) => handleItemKeyDown(e, index)}
        {...dragProps}
        {...ariaAttributes}
      >
        {/* ドラッグハンドル（デスクトップ） */}
        {allowReorder && deviceType === 'desktop' && (
          <Tooltip title="ドラッグして順序を変更">
            <DragIcon 
              sx={{ 
                mr: 1, 
                color: 'text.secondary', 
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' }
              }} 
            />
          </Tooltip>
        )}
        
        {/* 順序番号 */}
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
              {isSelected && (
                <Chip label="選択中" size="small" color="secondary" variant="filled" />
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
                WebkitLineClamp: deviceType === 'mobile' ? 3 : 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {item.value || '（未入力）'}
            </Typography>
          }
        />
        
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* 順序変更コントロール */}
            {allowReorder && !touchReorderState.isReordering && (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {deviceType === 'desktop' ? (
                  // デスクトップ用の詳細な順序変更ボタン
                  <ButtonGroup orientation="vertical" size="small" variant="outlined">
                    <Tooltip title="最初に移動 (Ctrl+Home)">
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'first')}
                        disabled={isFirst}
                      >
                        <FirstIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="上に移動 (Ctrl+↑)">
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={isFirst}
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="下に移動 (Ctrl+↓)">
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={isLast}
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="最後に移動 (Ctrl+End)">
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'last')}
                        disabled={isLast}
                      >
                        <LastIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ButtonGroup>
                ) : (
                  // タブレット・モバイル用の簡単な順序変更
                  <>
                    <Tooltip title="順序を変更">
                      <IconButton
                        size="small"
                        onClick={() => handleStartTouchReorder(index)}
                        color={isSelected ? 'primary' : 'default'}
                      >
                        <ReorderIcon />
                      </IconButton>
                    </Tooltip>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={isFirst}
                      >
                        <ArrowUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={isLast}
                      >
                        <ArrowDownIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </>
                )}
              </Box>
            )}
            
            {/* タッチ順序変更中の位置選択ボタン */}
            {touchReorderState.isReordering && touchReorderState.selectedIndex !== index && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleSelectTouchPosition(index)}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                ここに移動
              </Button>
            )}
            
            {/* 編集・削除ボタン */}
            {!touchReorderState.isReordering && (
              <>
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
              </>
            )}
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  const activeItemsCount = editState.items.filter(item => !item.isDeleted).length;
  const hasErrors = Object.keys(editState.validationErrors).length > 0 || 
                   editState.items.some(item => item.keyError || item.valueError);

  // デスクトップ用ポップオーバー（インライン編集対応）
  if (deviceType === 'desktop' && anchorEl && deviceBehavior.enableInlineEdit) {
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
            ...deviceStyles.dialog,
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
            {/* 順序変更の説明 */}
            {allowReorder && (
              <Typography 
                id="reorder-instructions"
                variant="caption" 
                color="text.secondary" 
                sx={{ display: 'block', mb: 1, px: 1 }}
              >
                {getReorderInstructions(deviceType)}
              </Typography>
            )}
            
            {/* タッチ順序変更中のキャンセルボタン */}
            {touchReorderState.isReordering && (
              <Box sx={{ mb: 2, px: 1 }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCancelTouchReorder}
                  fullWidth
                >
                  順序変更をキャンセル
                </Button>
              </Box>
            )}
            
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

  // タブレット・モバイル用ダイアログ（デバイス最適化対応）
  const isFullScreen = deviceType === 'mobile' || layoutState.preferredDialogMode === 'fullscreen';
  
  // タブレット用の最適化されたダイアログ
  if (deviceType === 'tablet') {
    return (
      <TabletOptimizedDialog
        open={open}
        onClose={onClose}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon sx={{ color: 'primary.main' }} />
              機器仕様編集
            </Box>
            <Typography variant="caption" color="text.secondary">
              {activeItemsCount}/{maxItems}
            </Typography>
          </Box>
        }
        maxWidth="md"
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
              disabled={hasErrors || !editState.hasChanges || readOnly}
              touchOptimized
              hapticFeedback
            >
              保存
            </TabletOptimizedButton>
          </Box>
        }
      >
        <Box onKeyDown={handleKeyDown}>
          <Box sx={{ mb: 2 }}>
            <TabletOptimizedButton
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              disabled={activeItemsCount >= maxItems || readOnly}
              variant="outlined"
              fullWidth
              touchOptimized
              hapticFeedback
            >
              新しい項目を追加
            </TabletOptimizedButton>
          </Box>
          
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* 順序変更の説明 */}
            {allowReorder && (
              <Typography 
                id="reorder-instructions"
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  mb: 2, 
                  display: 'block',
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  padding: 1,
                  borderRadius: 1,
                }}
              >
                タッチして項目を選択し、上下ボタンで順序を変更できます
              </Typography>
            )}
            
            {/* 仕様項目リスト */}
            <List sx={{ width: '100%' }}>
              {editState.items.map((item, index) => renderSpecificationItem(item, index))}
            </List>
          </Box>
        </Box>
      </TabletOptimizedDialog>
    );
  }
  
  const dialogContent = (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={isFullScreen ? false : 'md'}
      fullWidth={!isFullScreen}
      fullScreen={isFullScreen}
      TransitionComponent={SlideUpTransition}
      transitionDuration={deviceBehavior.preferredAnimationDuration}
      PaperProps={{
        sx: {
          ...deviceStyles.dialog,
          minHeight: isFullScreen ? '100vh' : '60vh',
          maxHeight: isFullScreen ? '100vh' : '80vh',
        },
      }}
      onKeyDown={handleKeyDown}
    >
      <DialogTitle sx={{ 
        textAlign: 'center',
        pb: 1,
        fontSize: isFullScreen ? '1.5rem' : '1.25rem',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: isFullScreen ? `1px solid ${theme.palette.divider}` : 'none',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon sx={{ color: 'primary.main' }} />
          機器仕様編集
        </Box>
        <Typography variant="caption" color="text.secondary">
          {activeItemsCount}/{maxItems}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ px: isFullScreen ? 2 : 3, py: 2, flex: 1 }}>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddItem}
            disabled={activeItemsCount >= maxItems || readOnly}
            variant="outlined"
            fullWidth={isFullScreen}
            size={isFullScreen ? 'large' : 'medium'}
          >
            新しい項目を追加
          </Button>
        </Box>
        
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* 順序変更の説明 */}
          {allowReorder && (
            <Typography 
              id="reorder-instructions"
              variant="caption" 
              color="text.secondary" 
              sx={{ display: 'block', mb: 2, px: 1 }}
            >
              {getReorderInstructions(deviceType)}
            </Typography>
          )}
          
          {/* タッチ順序変更中のキャンセルボタン */}
          <Collapse in={touchReorderState.isReordering}>
            <Box sx={{ mb: 2, px: 1 }}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleCancelTouchReorder}
                fullWidth
                size={isFullScreen ? 'large' : 'medium'}
              >
                順序変更をキャンセル
              </Button>
            </Box>
          </Collapse>
          
          <List>
            {editState.items.map((item, index) => renderEditItem(item, index))}
          </List>
        </Box>
        
        <DeviceErrorDisplay
          errors={hasErrors ? ['入力内容を確認してください'] : []}
          warnings={[]}
          deviceType={deviceType}
        />
      </DialogContent>
      
      <DialogActions sx={{ 
        justifyContent: 'center', 
        px: isFullScreen ? 2 : 3,
        pb: isFullScreen ? 3 : 2,
        borderTop: isFullScreen ? `1px solid ${theme.palette.divider}` : 'none',
        gap: 2,
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          size={isFullScreen ? 'large' : 'medium'}
          sx={{ minWidth: isFullScreen ? 120 : 80 }}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size={isFullScreen ? 'large' : 'medium'}
          disabled={hasErrors || !editState.hasChanges || readOnly}
          sx={{ minWidth: isFullScreen ? 120 : 80 }}
        >
          保存
        </Button>
      </DialogActions>
      
      {/* モバイル用フローティングアクション */}
      {deviceType === 'mobile' && (
        <MobileFloatingActions
          onAddItem={handleAddItem}
          onSave={handleSave}
          onCancel={onClose}
          hasChanges={editState.hasChanges}
          isValid={!hasErrors}
          readOnly={readOnly}
        />
      )}
    </Dialog>
  );

  // モバイルでキーボード表示時の調整
  if (deviceType === 'mobile' && deviceBehavior.adaptToKeyboard) {
    return (
      <KeyboardAdjustment isKeyboardVisible={isKeyboardVisible}>
        {dialogContent}
      </KeyboardAdjustment>
    );
  }

  return dialogContent;
};

export default SpecificationEditDialog;