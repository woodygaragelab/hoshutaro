import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  Divider,
  Chip,
  Alert,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { HierarchyDefinition } from '../../types/maintenanceTask';

export interface HierarchyEditDialogProps {
  open: boolean;
  hierarchy: HierarchyDefinition;
  assetCount: number; // Number of assets using this hierarchy
  onSave: (hierarchy: HierarchyDefinition) => void;
  onClose: () => void;
  readOnly?: boolean;
}

interface LevelEditState {
  key: string;
  order: number;
  values: string[];
  isNew: boolean;
  isModified: boolean;
  isDeleted: boolean;
  originalKey?: string;
}



/**
 * HierarchyEditDialog - Dialog for editing equipment hierarchy structure
 * 
 * Features:
 * - Add new hierarchy levels (up to 10 levels)
 * - Delete hierarchy levels (minimum 1 level)
 * - Reorder hierarchy levels
 * - Rename hierarchy level keys
 * - Add/edit/delete hierarchy values
 * - Validation for level count (1-10)
 * 
 * Requirements: 3.3, 3.4, 3.5, 3.8
 */
export const HierarchyEditDialog: React.FC<HierarchyEditDialogProps> = ({
  open,
  hierarchy,
  assetCount,
  onSave,
  onClose,
  readOnly = false,
}) => {
  const [levels, setLevels] = useState<LevelEditState[]>([]);
  const [editingLevelKey, setEditingLevelKey] = useState<string | null>(null);
  const [editingLevelNewKey, setEditingLevelNewKey] = useState('');
  const [newLevelKey, setNewLevelKey] = useState('');
  const [editingValueState, setEditingValueState] = useState<{
    levelKey: string;
    oldValue: string;
    newValue: string;
  } | null>(null);
  const [newValueInputs, setNewValueInputs] = useState<{ [levelKey: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize levels from hierarchy
  useEffect(() => {
    if (open) {
      const initialLevels: LevelEditState[] = hierarchy.levels.map(level => ({
        key: level.key,
        order: level.order,
        values: [...level.values],
        isNew: false,
        isModified: false,
        isDeleted: false,
        originalKey: level.key,
      }));
      setLevels(initialLevels);
      setHasChanges(false);
      setValidationError(null);
      setEditingLevelKey(null);
      setEditingLevelNewKey('');
      setNewLevelKey('');
      setEditingValueState(null);
      setNewValueInputs({});
    }
  }, [open, hierarchy]);

  // Validate hierarchy
  const validateHierarchy = useCallback((currentLevels: LevelEditState[]): string | null => {
    const activeLevels = currentLevels.filter(l => !l.isDeleted);
    
    // Check level count (1-10)
    if (activeLevels.length < 1) {
      return '階層レベルは最低1つ必要です';
    }
    if (activeLevels.length > 10) {
      return '階層レベルは最大10個までです';
    }
    
    // Check for duplicate keys
    const keys = activeLevels.map(l => l.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      return '階層レベルのキーが重複しています';
    }
    
    // Check for empty keys
    if (activeLevels.some(l => !l.key || l.key.trim() === '')) {
      return '階層レベルのキーは必須です';
    }
    
    return null;
  }, []);

  // Handle adding a new level
  const handleAddLevel = useCallback(() => {
    if (!newLevelKey || newLevelKey.trim() === '') {
      setValidationError('階層レベルのキーを入力してください');
      return;
    }
    
    // Check if key already exists
    if (levels.some(l => l.key === newLevelKey && !l.isDeleted)) {
      setValidationError(`階層レベル「${newLevelKey}」は既に存在します`);
      return;
    }
    
    // Check max levels
    const activeLevels = levels.filter(l => !l.isDeleted);
    if (activeLevels.length >= 10) {
      setValidationError('階層レベルは最大10個までです');
      return;
    }
    
    const newOrder = Math.max(...levels.map(l => l.order), 0) + 1;
    const newLevel: LevelEditState = {
      key: newLevelKey,
      order: newOrder,
      values: [],
      isNew: true,
      isModified: false,
      isDeleted: false,
    };
    
    setLevels([...levels, newLevel]);
    setNewLevelKey('');
    setHasChanges(true);
    setValidationError(null);
  }, [newLevelKey, levels]);

  // Handle deleting a level
  const handleDeleteLevel = useCallback((levelKey: string) => {
    const level = levels.find(l => l.key === levelKey);
    if (!level) return;
    
    // Check minimum levels
    const activeLevels = levels.filter(l => !l.isDeleted);
    if (activeLevels.length <= 1) {
      setValidationError('階層レベルは最低1つ必要です');
      return;
    }
    
    // Warn if level has values and assets exist
    if (level.values.length > 0 && assetCount > 0) {
      const confirmed = window.confirm(
        `階層レベル「${levelKey}」を削除すると、${assetCount}件の機器からこのレベルが削除されます。\n続行しますか？`
      );
      if (!confirmed) return;
    }
    
    const newLevels = levels.map(l =>
      l.key === levelKey ? { ...l, isDeleted: true } : l
    );
    setLevels(newLevels);
    setHasChanges(true);
    setValidationError(null);
  }, [levels, assetCount]);

  // Handle reordering levels
  const handleReorderLevel = useCallback((levelKey: string, direction: 'up' | 'down') => {
    const activeLevels = levels.filter(l => !l.isDeleted).sort((a, b) => a.order - b.order);
    const currentIndex = activeLevels.findIndex(l => l.key === levelKey);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === activeLevels.length - 1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap orders
    const newLevels = [...levels];
    const currentLevel = newLevels.find(l => l.key === levelKey);
    const targetLevel = newLevels.find(l => l.key === activeLevels[targetIndex].key);
    
    if (currentLevel && targetLevel) {
      const tempOrder = currentLevel.order;
      currentLevel.order = targetLevel.order;
      targetLevel.order = tempOrder;
      currentLevel.isModified = true;
      targetLevel.isModified = true;
    }
    
    setLevels(newLevels);
    setHasChanges(true);
  }, [levels]);

  // Handle starting level key edit
  const handleStartEditLevelKey = useCallback((levelKey: string) => {
    setEditingLevelKey(levelKey);
    setEditingLevelNewKey(levelKey);
  }, []);

  // Handle saving level key edit
  const handleSaveLevelKeyEdit = useCallback(() => {
    if (!editingLevelKey || !editingLevelNewKey) return;
    
    if (editingLevelNewKey.trim() === '') {
      setValidationError('階層レベルのキーは必須です');
      return;
    }
    
    // Check if new key already exists (excluding current level)
    if (editingLevelKey !== editingLevelNewKey &&
        levels.some(l => l.key === editingLevelNewKey && !l.isDeleted)) {
      setValidationError(`階層レベル「${editingLevelNewKey}」は既に存在します`);
      return;
    }
    
    // Warn if renaming and assets exist
    if (editingLevelKey !== editingLevelNewKey && assetCount > 0) {
      const confirmed = window.confirm(
        `階層レベル「${editingLevelKey}」を「${editingLevelNewKey}」に変更すると、` +
        `${assetCount}件の機器の階層パスが更新されます。\n続行しますか？`
      );
      if (!confirmed) {
        setEditingLevelKey(null);
        setEditingLevelNewKey('');
        return;
      }
    }
    
    const newLevels = levels.map(l =>
      l.key === editingLevelKey
        ? { ...l, key: editingLevelNewKey, isModified: true }
        : l
    );
    setLevels(newLevels);
    setEditingLevelKey(null);
    setEditingLevelNewKey('');
    setHasChanges(true);
    setValidationError(null);
  }, [editingLevelKey, editingLevelNewKey, levels, assetCount]);

  // Handle canceling level key edit
  const handleCancelLevelKeyEdit = useCallback(() => {
    setEditingLevelKey(null);
    setEditingLevelNewKey('');
  }, []);

  // Handle adding a value to a level
  const handleAddValue = useCallback((levelKey: string) => {
    const newValue = newValueInputs[levelKey];
    if (!newValue || newValue.trim() === '') {
      setValidationError('値を入力してください');
      return;
    }
    
    const level = levels.find(l => l.key === levelKey);
    if (!level) return;
    
    if (level.values.includes(newValue)) {
      setValidationError(`値「${newValue}」は既に存在します`);
      return;
    }
    
    const newLevels = levels.map(l =>
      l.key === levelKey
        ? { ...l, values: [...l.values, newValue].sort(), isModified: true }
        : l
    );
    setLevels(newLevels);
    setNewValueInputs({ ...newValueInputs, [levelKey]: '' });
    setHasChanges(true);
    setValidationError(null);
  }, [newValueInputs, levels]);

  // Handle starting value edit
  const handleStartEditValue = useCallback((levelKey: string, value: string) => {
    setEditingValueState({ levelKey, oldValue: value, newValue: value });
  }, []);

  // Handle saving value edit
  const handleSaveValueEdit = useCallback(() => {
    if (!editingValueState) return;
    
    const { levelKey, oldValue, newValue } = editingValueState;
    
    if (newValue.trim() === '') {
      setValidationError('値は必須です');
      return;
    }
    
    const level = levels.find(l => l.key === levelKey);
    if (!level) return;
    
    // Check if new value already exists (excluding current value)
    if (oldValue !== newValue && level.values.includes(newValue)) {
      setValidationError(`値「${newValue}」は既に存在します`);
      return;
    }
    
    // Warn if changing and assets might be using this value
    if (oldValue !== newValue && assetCount > 0) {
      const confirmed = window.confirm(
        `階層値「${oldValue}」を「${newValue}」に変更すると、` +
        `この値を使用している機器の階層パスが更新されます。\n続行しますか？`
      );
      if (!confirmed) {
        setEditingValueState(null);
        return;
      }
    }
    
    const newLevels = levels.map(l =>
      l.key === levelKey
        ? {
            ...l,
            values: l.values.map(v => v === oldValue ? newValue : v).sort(),
            isModified: true,
          }
        : l
    );
    setLevels(newLevels);
    setEditingValueState(null);
    setHasChanges(true);
    setValidationError(null);
  }, [editingValueState, levels, assetCount]);

  // Handle canceling value edit
  const handleCancelValueEdit = useCallback(() => {
    setEditingValueState(null);
  }, []);

  // Handle deleting a value
  const handleDeleteValue = useCallback((levelKey: string, value: string) => {
    // Warn if assets might be using this value
    if (assetCount > 0) {
      const confirmed = window.confirm(
        `階層値「${value}」を削除しようとしています。\n` +
        `この値を使用している機器がある場合、削除は失敗します。\n続行しますか？`
      );
      if (!confirmed) return;
    }
    
    const newLevels = levels.map(l =>
      l.key === levelKey
        ? {
            ...l,
            values: l.values.filter(v => v !== value),
            isModified: true,
          }
        : l
    );
    setLevels(newLevels);
    setHasChanges(true);
  }, [levels, assetCount]);

  // Handle save
  const handleSave = useCallback(() => {
    // Validate before saving
    const error = validateHierarchy(levels);
    if (error) {
      setValidationError(error);
      return;
    }
    
    // Build new hierarchy definition
    const activeLevels = levels.filter(l => !l.isDeleted);
    const newHierarchy: HierarchyDefinition = {
      levels: activeLevels.map(l => ({
        key: l.key,
        order: l.order,
        values: [...l.values],
      })),
    };
    
    onSave(newHierarchy);
    onClose();
  }, [levels, validateHierarchy, onSave, onClose]);

  // Get active levels sorted by order
  const activeLevels = useMemo(() => {
    return levels.filter(l => !l.isDeleted).sort((a, b) => a.order - b.order);
  }, [levels]);

  // Render level list
  const renderLevelList = () => {
    if (activeLevels.length === 0) {
      return (
        <Alert severity="warning" sx={{ my: 2 }}>
          階層レベルがありません。少なくとも1つの階層レベルが必要です。
        </Alert>
      );
    }
    
    return (
      <List>
        {activeLevels.map((level, index) => (
          <React.Fragment key={level.key}>
            <ListItem
              sx={{
                flexDirection: 'column',
                alignItems: 'stretch',
                py: 2,
                bgcolor: level.isNew ? 'action.hover' : 'transparent',
              }}
            >
              {/* Level header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`順序: ${level.order}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {editingLevelKey === level.key ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        value={editingLevelNewKey}
                        onChange={(e) => setEditingLevelNewKey(e.target.value)}
                        autoFocus
                        sx={{ width: 200 }}
                      />
                      <IconButton size="small" onClick={handleSaveLevelKeyEdit} color="primary">
                        <SaveIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={handleCancelLevelKeyEdit}>
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {level.key}
                      </Typography>
                      {!readOnly && (
                        <IconButton
                          size="small"
                          onClick={() => handleStartEditLevelKey(level.key)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  )}
                  {level.isNew && (
                    <Chip label="新規" size="small" color="success" />
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!readOnly && (
                    <>
                      <Tooltip title="上に移動">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleReorderLevel(level.key, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="下に移動">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleReorderLevel(level.key, 'down')}
                            disabled={index === activeLevels.length - 1}
                          >
                            <ArrowDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="削除">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteLevel(level.key)}
                            color="error"
                            disabled={activeLevels.length <= 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>

              {/* Level values */}
              <Box sx={{ pl: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  値 ({level.values.length}件)
                </Typography>
                
                {!readOnly && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      size="small"
                      placeholder="新しい値を追加..."
                      value={newValueInputs[level.key] || ''}
                      onChange={(e) =>
                        setNewValueInputs({ ...newValueInputs, [level.key]: e.target.value })
                      }
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddValue(level.key);
                        }
                      }}
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleAddValue(level.key)}
                    >
                      追加
                    </Button>
                  </Box>
                )}
                
                {level.values.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    値がありません
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {level.values.map((value) => (
                      <Box key={value} sx={{ display: 'flex', alignItems: 'center' }}>
                        {editingValueState?.levelKey === level.key &&
                         editingValueState?.oldValue === value ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <TextField
                              size="small"
                              value={editingValueState.newValue}
                              onChange={(e) =>
                                setEditingValueState({
                                  ...editingValueState,
                                  newValue: e.target.value,
                                })
                              }
                              autoFocus
                              sx={{ width: 150 }}
                            />
                            <IconButton
                              size="small"
                              onClick={handleSaveValueEdit}
                              color="primary"
                            >
                              <SaveIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={handleCancelValueEdit}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Chip
                            label={value}
                            size="small"
                            onDelete={readOnly ? undefined : () => handleDeleteValue(level.key, value)}
                            onClick={readOnly ? undefined : () => handleStartEditValue(level.key, value)}
                            deleteIcon={<DeleteIcon />}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </ListItem>
            {index < activeLevels.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '60vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">
              階層構造の編集
            </Typography>
            <Typography variant="body2" color="text.secondary">
              階層レベル数: {activeLevels.length}/10 | 機器数: {assetCount}件
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setValidationError(null)}>
            {validationError}
          </Alert>
        )}
        
        {assetCount > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            現在{assetCount}件の機器がこの階層構造を使用しています。
            階層の変更は既存の機器に影響を与える可能性があります。
          </Alert>
        )}
        
        {!readOnly && activeLevels.length < 10 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              新しい階層レベルを追加
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="階層レベルのキー（例: 製油所、エリア）"
                value={newLevelKey}
                onChange={(e) => setNewLevelKey(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLevel();
                  }
                }}
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddLevel}
              >
                追加
              </Button>
            </Box>
          </Paper>
        )}
        
        {renderLevelList()}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!hasChanges || readOnly}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HierarchyEditDialog;
