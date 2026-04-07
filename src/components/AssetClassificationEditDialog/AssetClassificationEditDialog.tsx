// HMR Touch: Force Vite rebuild - 2026-04-07
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
  Tabs,
  Tab,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import { Asset, AssetClassificationDefinition, AssetClassificationPath } from '../../types/maintenanceTask';

export interface AssetClassificationEditDialogProps {
  open: boolean;
  assetClassification: AssetClassificationDefinition;
  assetCount: number;
  assets: Asset[];
  onSave: (classification: AssetClassificationDefinition) => void;
  onSaveLinkedAssets: (updatedAssets: { id: string; classificationPath: AssetClassificationPath }[]) => void;
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

interface AssetLinkingState {
  id: string;
  name: string;
  classificationPath: AssetClassificationPath;
  isModified: boolean;
  selected: boolean;
}

/**
 * AssetClassificationEditDialog - 2-tab dialog for editing equipment classification
 * 
 * Tab 1 [分類定義]: Classification level structure management
 * Tab 2 [機器紐づけ]: Asset-to-classification linking with grid & bulk edit
 */
export const AssetClassificationEditDialog: React.FC<AssetClassificationEditDialogProps> = ({
  open,
  assetClassification,
  assetCount,
  assets,
  onSave,
  onSaveLinkedAssets,
  onClose,
  readOnly = false,
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // === Tab 1: Classification Definition State ===
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
  const [hasClassificationChanges, setHasClassificationChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // === Tab 2: Asset Linking State ===
  const [assetStates, setAssetStates] = useState<AssetLinkingState[]>([]);
  const [hasLinkingChanges, setHasLinkingChanges] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});

  const hasChanges = hasClassificationChanges || hasLinkingChanges;

  // Initialize levels from assetClassification
  useEffect(() => {
    if (open) {
      const initialLevels: LevelEditState[] = assetClassification.levels.map(level => ({
        key: level.key,
        order: level.order,
        values: [...level.values],
        isNew: false,
        isModified: false,
        isDeleted: false,
        originalKey: level.key,
      }));
      setLevels(initialLevels);
      setHasClassificationChanges(false);
      setValidationError(null);
      setEditingLevelKey(null);
      setEditingLevelNewKey('');
      setNewLevelKey('');
      setEditingValueState(null);
      setNewValueInputs({});
      setActiveTab(0);

      // Initialize asset linking state
      const states: AssetLinkingState[] = assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        classificationPath: { ...(asset.classificationPath || {}) },
        isModified: false,
        selected: false,
      }));
      setAssetStates(states);
      setHasLinkingChanges(false);
      setFilters({});
      setBulkValues({});
    }
  }, [open, assetClassification, assets]);

  // Validate
  const validateClassification = useCallback((currentLevels: LevelEditState[]): string | null => {
    const activeLevels = currentLevels.filter(l => !l.isDeleted);
    if (activeLevels.length < 1) return '分類レベルは最低1つ必要です';
    if (activeLevels.length > 10) return '分類レベルは最大10個までです';
    const keys = activeLevels.map(l => l.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) return '分類レベルのキーが重複しています';
    if (activeLevels.some(l => !l.key || l.key.trim() === '')) return '分類レベルのキーは必須です';
    return null;
  }, []);

  // === Tab 1 handlers ===
  const handleAddLevel = useCallback(() => {
    if (!newLevelKey || newLevelKey.trim() === '') {
      setValidationError('分類レベルのキーを入力してください');
      return;
    }
    if (levels.some(l => l.key === newLevelKey && !l.isDeleted)) {
      setValidationError(`分類レベル「${newLevelKey}」は既に存在します`);
      return;
    }
    const activeLevels = levels.filter(l => !l.isDeleted);
    if (activeLevels.length >= 10) {
      setValidationError('分類レベルは最大10個までです');
      return;
    }
    const newOrder = Math.max(...levels.map(l => l.order), 0) + 1;
    setLevels([...levels, {
      key: newLevelKey,
      order: newOrder,
      values: [],
      isNew: true,
      isModified: false,
      isDeleted: false,
    }]);
    setNewLevelKey('');
    setHasClassificationChanges(true);
    setValidationError(null);
  }, [newLevelKey, levels]);

  const handleDeleteLevel = useCallback((levelKey: string) => {
    const level = levels.find(l => l.key === levelKey);
    if (!level) return;
    const activeLevels = levels.filter(l => !l.isDeleted);
    if (activeLevels.length <= 1) {
      setValidationError('分類レベルは最低1つ必要です');
      return;
    }
    if (level.values.length > 0 && assetCount > 0) {
      const confirmed = window.confirm(
        `分類レベル「${levelKey}」を削除すると、${assetCount}件の機器からこのレベルが削除されます。\n続行しますか？`
      );
      if (!confirmed) return;
    }
    setLevels(levels.map(l => l.key === levelKey ? { ...l, isDeleted: true } : l));
    setHasClassificationChanges(true);
    setValidationError(null);
  }, [levels, assetCount]);

  const handleReorderLevel = useCallback((levelKey: string, direction: 'up' | 'down') => {
    const activeLevels = levels.filter(l => !l.isDeleted).sort((a, b) => a.order - b.order);
    const currentIndex = activeLevels.findIndex(l => l.key === levelKey);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === activeLevels.length - 1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
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
    setHasClassificationChanges(true);
  }, [levels]);

  const handleStartEditLevelKey = useCallback((levelKey: string) => {
    setEditingLevelKey(levelKey);
    setEditingLevelNewKey(levelKey);
  }, []);

  const handleSaveLevelKeyEdit = useCallback(() => {
    if (!editingLevelKey || !editingLevelNewKey) return;
    if (editingLevelNewKey.trim() === '') {
      setValidationError('分類レベルのキーは必須です');
      return;
    }
    if (editingLevelKey !== editingLevelNewKey && levels.some(l => l.key === editingLevelNewKey && !l.isDeleted)) {
      setValidationError(`分類レベル「${editingLevelNewKey}」は既に存在します`);
      return;
    }
    if (editingLevelKey !== editingLevelNewKey && assetCount > 0) {
      const confirmed = window.confirm(
        `分類レベル「${editingLevelKey}」を「${editingLevelNewKey}」に変更すると、` +
        `${assetCount}件の機器の分類パスが更新されます。\n続行しますか？`
      );
      if (!confirmed) {
        setEditingLevelKey(null);
        setEditingLevelNewKey('');
        return;
      }
    }
    setLevels(levels.map(l => l.key === editingLevelKey ? { ...l, key: editingLevelNewKey, isModified: true } : l));
    setEditingLevelKey(null);
    setEditingLevelNewKey('');
    setHasClassificationChanges(true);
    setValidationError(null);
  }, [editingLevelKey, editingLevelNewKey, levels, assetCount]);

  const handleCancelLevelKeyEdit = useCallback(() => {
    setEditingLevelKey(null);
    setEditingLevelNewKey('');
  }, []);

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
    setLevels(levels.map(l =>
      l.key === levelKey ? { ...l, values: [...l.values, newValue].sort(), isModified: true } : l
    ));
    setNewValueInputs({ ...newValueInputs, [levelKey]: '' });
    setHasClassificationChanges(true);
    setValidationError(null);
  }, [newValueInputs, levels]);

  const handleStartEditValue = useCallback((levelKey: string, value: string) => {
    setEditingValueState({ levelKey, oldValue: value, newValue: value });
  }, []);

  const handleSaveValueEdit = useCallback(() => {
    if (!editingValueState) return;
    const { levelKey, oldValue, newValue } = editingValueState;
    if (newValue.trim() === '') { setValidationError('値は必須です'); return; }
    const level = levels.find(l => l.key === levelKey);
    if (!level) return;
    if (oldValue !== newValue && level.values.includes(newValue)) {
      setValidationError(`値「${newValue}」は既に存在します`);
      return;
    }
    if (oldValue !== newValue && assetCount > 0) {
      const confirmed = window.confirm(
        `分類値「${oldValue}」を「${newValue}」に変更すると、この値を使用している機器の分類パスが更新されます。\n続行しますか？`
      );
      if (!confirmed) { setEditingValueState(null); return; }
    }
    setLevels(levels.map(l =>
      l.key === levelKey
        ? { ...l, values: l.values.map(v => v === oldValue ? newValue : v).sort(), isModified: true }
        : l
    ));
    setEditingValueState(null);
    setHasClassificationChanges(true);
    setValidationError(null);
  }, [editingValueState, levels, assetCount]);

  const handleCancelValueEdit = useCallback(() => { setEditingValueState(null); }, []);

  const handleDeleteValue = useCallback((levelKey: string, value: string) => {
    if (assetCount > 0) {
      const confirmed = window.confirm(
        `分類値「${value}」を削除しようとしています。\nこの値を使用している機器がある場合、削除は失敗します。\n続行しますか？`
      );
      if (!confirmed) return;
    }
    setLevels(levels.map(l =>
      l.key === levelKey ? { ...l, values: l.values.filter(v => v !== value), isModified: true } : l
    ));
    setHasClassificationChanges(true);
  }, [levels, assetCount]);

  // === Tab 2 handlers ===
  const classificationLevels = useMemo(() => {
    return [...assetClassification.levels].sort((a, b) => a.order - b.order);
  }, [assetClassification]);

  const filteredAssets = useMemo(() => {
    return assetStates.filter(asset => {
      return Object.entries(filters).every(([levelKey, filterValue]) => {
        if (!filterValue || filterValue === '') return true;
        return asset.classificationPath[levelKey] === filterValue;
      });
    });
  }, [assetStates, filters]);

  const selectedCount = useMemo(() => {
    return filteredAssets.filter(a => a.selected).length;
  }, [filteredAssets]);

  const handleToggleSelect = useCallback((assetId: string) => {
    setAssetStates(prev => prev.map(a =>
      a.id === assetId ? { ...a, selected: !a.selected } : a
    ));
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allSelected = filteredAssets.every(a => a.selected);
    const filteredIds = new Set(filteredAssets.map(a => a.id));
    setAssetStates(prev => prev.map(a =>
      filteredIds.has(a.id) ? { ...a, selected: !allSelected } : a
    ));
  }, [filteredAssets]);

  const handleChangeClassification = useCallback((assetId: string, levelKey: string, value: string) => {
    setAssetStates(prev => prev.map(a => {
      if (a.id !== assetId) return a;
      const newPath = { ...a.classificationPath };
      if (value === '') {
        delete newPath[levelKey];
      } else {
        newPath[levelKey] = value;
      }
      return { ...a, classificationPath: newPath, isModified: true };
    }));
    setHasLinkingChanges(true);
  }, []);

  const handleBulkApply = useCallback(() => {
    const hasBulkValues = Object.values(bulkValues).some(v => v && v !== '');
    if (!hasBulkValues) {
      setValidationError('一括変更する分類値を選択してください');
      return;
    }
    if (selectedCount === 0) {
      setValidationError('対象の機器を選択してください');
      return;
    }
    const confirmed = window.confirm(
      `選択した${selectedCount}件の機器の分類を一括変更します。\n続行しますか？`
    );
    if (!confirmed) return;

    const selectedIds = new Set(filteredAssets.filter(a => a.selected).map(a => a.id));
    setAssetStates(prev => prev.map(a => {
      if (!selectedIds.has(a.id)) return a;
      const newPath = { ...a.classificationPath };
      Object.entries(bulkValues).forEach(([levelKey, value]) => {
        if (value && value !== '') {
          newPath[levelKey] = value;
        }
      });
      return { ...a, classificationPath: newPath, isModified: true };
    }));
    setHasLinkingChanges(true);
    setValidationError(null);
  }, [bulkValues, selectedCount, filteredAssets]);

  const modifiedLinkingCount = useMemo(() => {
    return assetStates.filter(a => a.isModified).length;
  }, [assetStates]);

  // === Save handler (both tabs) ===
  const handleSave = useCallback(() => {
    // Save classification changes (Tab 1)
    if (hasClassificationChanges) {
      const error = validateClassification(levels);
      if (error) { setValidationError(error); setActiveTab(0); return; }
      const activeLevels = levels.filter(l => !l.isDeleted);
      const newClassification: AssetClassificationDefinition = {
        levels: activeLevels.map(l => ({
          key: l.key,
          order: l.order,
          values: [...l.values],
        })),
      };
      onSave(newClassification);
    }

    // Save linking changes (Tab 2)
    if (hasLinkingChanges) {
      const modifiedAssets = assetStates.filter(a => a.isModified);
      if (modifiedAssets.length > 0) {
        const updates = modifiedAssets.map(a => ({
          id: a.id,
          classificationPath: a.classificationPath,
        }));
        onSaveLinkedAssets(updates);
      }
    }

    onClose();
  }, [levels, assetStates, hasClassificationChanges, hasLinkingChanges, validateClassification, onSave, onSaveLinkedAssets, onClose]);

  const activeLevels = useMemo(() => {
    return levels.filter(l => !l.isDeleted).sort((a, b) => a.order - b.order);
  }, [levels]);

  // === Tab 1 Renderer ===
  const renderClassificationDefinitionTab = () => {
    return (
      <Box>
        {!readOnly && activeLevels.length < 10 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>新しい分類レベルを追加</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="分類レベルのキー（例: 機器大分類、機器種別）"
                value={newLevelKey}
                onChange={(e) => setNewLevelKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddLevel(); }}
                sx={{ flexGrow: 1 }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddLevel}>追加</Button>
            </Box>
          </Paper>
        )}
        {activeLevels.length === 0 ? (
          <Alert severity="warning" sx={{ my: 2 }}>
            分類レベルがありません。少なくとも1つの分類レベルが必要です。
          </Alert>
        ) : (
          <List>
            {activeLevels.map((level, index) => (
              <React.Fragment key={level.key}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2, bgcolor: level.isNew ? 'action.hover' : 'transparent' }}>
                  {/* Level header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`順序: ${level.order}`} size="small" color="primary" variant="outlined" />
                      {editingLevelKey === level.key ? (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <TextField size="small" value={editingLevelNewKey} onChange={(e) => setEditingLevelNewKey(e.target.value)} autoFocus sx={{ width: 200 }} />
                          <IconButton size="small" onClick={handleSaveLevelKeyEdit} color="primary"><SaveIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={handleCancelLevelKeyEdit}><CancelIcon fontSize="small" /></IconButton>
                        </Box>
                      ) : (
                        <>
                          <Typography variant="subtitle1" fontWeight="bold">{level.key}</Typography>
                          {!readOnly && (
                            <IconButton size="small" onClick={() => handleStartEditLevelKey(level.key)}><EditIcon fontSize="small" /></IconButton>
                          )}
                        </>
                      )}
                      {level.isNew && <Chip label="新規" size="small" color="success" />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {!readOnly && (
                        <>
                          <Tooltip title="上に移動"><span><IconButton size="small" onClick={() => handleReorderLevel(level.key, 'up')} disabled={index === 0}><ArrowUpIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="下に移動"><span><IconButton size="small" onClick={() => handleReorderLevel(level.key, 'down')} disabled={index === activeLevels.length - 1}><ArrowDownIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="削除"><span><IconButton size="small" onClick={() => handleDeleteLevel(level.key)} color="error" disabled={activeLevels.length <= 1}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
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
                          onChange={(e) => setNewValueInputs({ ...newValueInputs, [level.key]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddValue(level.key); }}
                          sx={{ flexGrow: 1 }}
                        />
                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddValue(level.key)}>追加</Button>
                      </Box>
                    )}
                    {level.values.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>値がありません</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {level.values.map((value) => (
                          <Box key={value} sx={{ display: 'flex', alignItems: 'center' }}>
                            {editingValueState?.levelKey === level.key && editingValueState?.oldValue === value ? (
                              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                <TextField size="small" value={editingValueState.newValue} onChange={(e) => setEditingValueState({ ...editingValueState, newValue: e.target.value })} autoFocus sx={{ width: 150 }} />
                                <IconButton size="small" onClick={handleSaveValueEdit} color="primary"><SaveIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={handleCancelValueEdit}><CancelIcon fontSize="small" /></IconButton>
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
        )}
      </Box>
    );
  };

  // === Tab 2 Renderer ===
  const renderAssetLinkingTab = () => {
    return (
      <Box>
        {/* Filter area */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>分類パスでフィルタ</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {classificationLevels.map(level => (
              <FormControl key={level.key} size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{level.key}</InputLabel>
                <Select
                  value={filters[level.key] || ''}
                  label={level.key}
                  onChange={(e) => setFilters({ ...filters, [level.key]: e.target.value as string })}
                >
                  <MenuItem value="">全て</MenuItem>
                  {level.values.map(v => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Box>
        </Paper>

        {/* Asset table */}
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '40vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={filteredAssets.length > 0 && filteredAssets.every(a => a.selected)}
                    indeterminate={filteredAssets.some(a => a.selected) && !filteredAssets.every(a => a.selected)}
                    onChange={handleToggleSelectAll}
                    disabled={readOnly}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>TAG No.</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 140 }}>機器名</TableCell>
                {classificationLevels.map(level => (
                  <TableCell key={level.key} sx={{ fontWeight: 'bold', minWidth: 140 }}>
                    {level.key}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + classificationLevels.length} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      該当する機器がありません
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map(asset => (
                  <TableRow key={asset.id} sx={{ bgcolor: asset.isModified ? 'action.hover' : 'transparent' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={asset.selected}
                        onChange={() => handleToggleSelect(asset.id)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="bold">{asset.id}</Typography>
                        {asset.isModified && <Chip label="変更" size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>{asset.name}</Typography>
                    </TableCell>
                    {classificationLevels.map(level => (
                      <TableCell key={level.key}>
                        <Select
                          value={asset.classificationPath[level.key] || ''}
                          onChange={(e) => handleChangeClassification(asset.id, level.key, e.target.value as string)}
                          size="small"
                          fullWidth
                          displayEmpty
                          disabled={readOnly}
                          sx={{ fontSize: '0.85rem' }}
                        >
                          <MenuItem value="">
                            <em>未設定</em>
                          </MenuItem>
                          {level.values.map(v => (
                            <MenuItem key={v} value={v}>{v}</MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Bulk update area */}
        {!readOnly && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              選択した機器の分類を変更 {selectedCount > 0 && `(${selectedCount}件選択中)`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {classificationLevels.map(level => (
                <FormControl key={level.key} size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>{level.key}</InputLabel>
                  <Select
                    value={bulkValues[level.key] || ''}
                    label={level.key}
                    onChange={(e) => setBulkValues({ ...bulkValues, [level.key]: e.target.value as string })}
                  >
                    <MenuItem value="">変更しない</MenuItem>
                    {level.values.map(v => (
                      <MenuItem key={v} value={v}>{v}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
              <Button
                variant="outlined"
                onClick={handleBulkApply}
                disabled={selectedCount === 0}
              >
                適用
              </Button>
            </Box>
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { minHeight: '60vh', maxHeight: '90vh' } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">機器分類の編集</Typography>
            <Typography variant="body2" color="text.secondary">
              分類レベル数: {activeLevels.length}/10 | 機器数: {assetCount}件
              {modifiedLinkingCount > 0 && ` | 紐づけ変更: ${modifiedLinkingCount}件`}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setValidationError(null)}>{validationError}</Alert>
        )}
        {assetCount > 0 && activeTab === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            現在{assetCount}件の機器がこの分類構造を使用しています。分類の変更は既存の機器に影響を与える可能性があります。
          </Alert>
        )}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="分類定義" />
          <Tab label="機器紐づけ" />
        </Tabs>
        {activeTab === 0 && renderClassificationDefinitionTab()}
        {activeTab === 1 && renderAssetLinkingTab()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={!hasChanges || readOnly}>保存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetClassificationEditDialog;
