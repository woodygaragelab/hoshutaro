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
import { WorkOrderClassification, WorkOrder } from '../../types/maintenanceTask';

export interface WorkOrderClassificationEditDialogProps {
  open: boolean;
  classifications: WorkOrderClassification[];
  workOrders: WorkOrder[];
  onSave: (classifications: WorkOrderClassification[]) => void;
  onClose: () => void;
  readOnly?: boolean;
}

interface ClassificationEditState {
  id: string;
  name: string;
  order: number;
  isNew: boolean;
  isModified: boolean;
  isDeleted: boolean;
  originalId?: string;
  usageCount: number;
}

/**
 * WorkOrderClassificationEditDialog - Dialog for editing work order classifications
 * 
 * Manages a flat list of WorkOrderClassification (max 20, IDs 01-20).
 * Follows the same design pattern as HierarchyEditDialog.
 */
export const WorkOrderClassificationEditDialog: React.FC<WorkOrderClassificationEditDialogProps> = ({
  open,
  classifications,
  workOrders,
  onSave,
  onClose,
  readOnly = false,
}) => {
  const [items, setItems] = useState<ClassificationEditState[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNewName, setEditingNewName] = useState('');
  const [newName, setNewName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calculate usage counts
  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    workOrders.forEach(wo => {
      const cid = wo.ClassificationId;
      if (cid) counts[cid] = (counts[cid] || 0) + 1;
    });
    return counts;
  }, [workOrders]);

  // Initialize items
  useEffect(() => {
    if (open) {
      const initialItems: ClassificationEditState[] = classifications.map(cls => ({
        id: cls.id,
        name: cls.name,
        order: cls.order,
        isNew: false,
        isModified: false,
        isDeleted: false,
        originalId: cls.id,
        usageCount: usageCounts[cls.id] || 0,
      }));
      setItems(initialItems);
      setHasChanges(false);
      setValidationError(null);
      setEditingId(null);
      setEditingNewName('');
      setNewName('');
    }
  }, [open, classifications, usageCounts]);

  // Get next available ID (01-20)
  const getNextId = useCallback((): string | null => {
    const usedIds = new Set(items.filter(i => !i.isDeleted).map(i => i.id));
    for (let i = 1; i <= 20; i++) {
      const id = i.toString().padStart(2, '0');
      if (!usedIds.has(id)) return id;
    }
    return null;
  }, [items]);

  const handleAdd = useCallback(() => {
    if (!newName || newName.trim() === '') {
      setValidationError('作業分類名を入力してください');
      return;
    }
    const activeItems = items.filter(i => !i.isDeleted);
    if (activeItems.length >= 20) {
      setValidationError('作業分類は最大20件までです');
      return;
    }
    if (activeItems.some(i => i.name === newName.trim())) {
      setValidationError(`作業分類「${newName}」は既に存在します`);
      return;
    }
    const nextId = getNextId();
    if (!nextId) {
      setValidationError('使用可能なIDがありません（最大20件）');
      return;
    }
    const newOrder = Math.max(...items.map(i => i.order), 0) + 1;
    setItems([...items, {
      id: nextId,
      name: newName.trim(),
      order: newOrder,
      isNew: true,
      isModified: false,
      isDeleted: false,
      usageCount: 0,
    }]);
    setNewName('');
    setHasChanges(true);
    setValidationError(null);
  }, [newName, items, getNextId]);

  const handleDelete = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.usageCount > 0) {
      const confirmed = window.confirm(
        `作業分類「${item.name}」(ID: ${id})は${item.usageCount}件の作業で使用されています。\n削除すると、これらの作業の分類が無効になります。\n続行しますか？`
      );
      if (!confirmed) return;
    }
    setItems(items.map(i => i.id === id ? { ...i, isDeleted: true } : i));
    setHasChanges(true);
    setValidationError(null);
  }, [items]);

  const handleReorder = useCallback((id: string, direction: 'up' | 'down') => {
    const activeItems = items.filter(i => !i.isDeleted).sort((a, b) => a.order - b.order);
    const currentIndex = activeItems.findIndex(i => i.id === id);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === activeItems.length - 1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newItems = [...items];
    const currentItem = newItems.find(i => i.id === id);
    const targetItem = newItems.find(i => i.id === activeItems[targetIndex].id);
    if (currentItem && targetItem) {
      const tempOrder = currentItem.order;
      currentItem.order = targetItem.order;
      targetItem.order = tempOrder;
      currentItem.isModified = true;
      targetItem.isModified = true;
    }
    setItems(newItems);
    setHasChanges(true);
  }, [items]);

  const handleStartEdit = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setEditingId(id);
      setEditingNewName(item.name);
    }
  }, [items]);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    if (!editingNewName || editingNewName.trim() === '') {
      setValidationError('作業分類名は必須です');
      return;
    }
    const activeItems = items.filter(i => !i.isDeleted);
    if (activeItems.some(i => i.id !== editingId && i.name === editingNewName.trim())) {
      setValidationError(`作業分類「${editingNewName}」は既に存在します`);
      return;
    }
    setItems(items.map(i => i.id === editingId ? { ...i, name: editingNewName.trim(), isModified: true } : i));
    setEditingId(null);
    setEditingNewName('');
    setHasChanges(true);
    setValidationError(null);
  }, [editingId, editingNewName, items]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingNewName('');
  }, []);

  const handleSave = useCallback(() => {
    const activeItems = items.filter(i => !i.isDeleted);
    if (activeItems.length === 0) {
      setValidationError('作業分類は最低1つ必要です');
      return;
    }
    if (activeItems.some(i => !i.name || i.name.trim() === '')) {
      setValidationError('空の名前の分類があります');
      return;
    }
    const result: WorkOrderClassification[] = activeItems.map(i => ({
      id: i.id,
      name: i.name,
      order: i.order,
    }));
    onSave(result);
    onClose();
  }, [items, onSave, onClose]);

  const activeItems = useMemo(() => {
    return items.filter(i => !i.isDeleted).sort((a, b) => a.order - b.order);
  }, [items]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { minHeight: '60vh', maxHeight: '90vh' } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">作業分類の編集</Typography>
            <Typography variant="body2" color="text.secondary">
              分類数: {activeItems.length}/20
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setValidationError(null)}>{validationError}</Alert>
        )}
        {!readOnly && activeItems.length < 20 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>新しい作業分類を追加</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="作業分類名（例: 年次点検、オーバーホール）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                sx={{ flexGrow: 1 }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>追加</Button>
            </Box>
          </Paper>
        )}
        {activeItems.length === 0 ? (
          <Alert severity="warning" sx={{ my: 2 }}>作業分類がありません。少なくとも1つの作業分類が必要です。</Alert>
        ) : (
          <List>
            {activeItems.map((item, index) => (
              <React.Fragment key={item.id}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1.5, bgcolor: item.isNew ? 'action.hover' : 'transparent' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`ID: ${item.id}`} size="small" color="primary" variant="outlined" />
                      {editingId === item.id ? (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <TextField size="small" value={editingNewName} onChange={(e) => setEditingNewName(e.target.value)} autoFocus sx={{ width: 250 }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                          />
                          <IconButton size="small" onClick={handleSaveEdit} color="primary"><SaveIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={handleCancelEdit}><CancelIcon fontSize="small" /></IconButton>
                        </Box>
                      ) : (
                        <>
                          <Typography variant="subtitle1" fontWeight="bold">{item.name}</Typography>
                          {!readOnly && (
                            <IconButton size="small" onClick={() => handleStartEdit(item.id)}><EditIcon fontSize="small" /></IconButton>
                          )}
                        </>
                      )}
                      {item.isNew && <Chip label="新規" size="small" color="success" />}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {!readOnly && (
                        <>
                          <Tooltip title="上に移動"><span><IconButton size="small" onClick={() => handleReorder(item.id, 'up')} disabled={index === 0}><ArrowUpIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="下に移動"><span><IconButton size="small" onClick={() => handleReorder(item.id, 'down')} disabled={index === activeItems.length - 1}><ArrowDownIcon fontSize="small" /></IconButton></span></Tooltip>
                          <Tooltip title="削除"><span><IconButton size="small" onClick={() => handleDelete(item.id)} color="error"><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
                        </>
                      )}
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1, mt: 0.5 }}>
                    使用中の作業: {item.usageCount}件
                  </Typography>
                </ListItem>
                {index < activeItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={!hasChanges || readOnly}>保存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkOrderClassificationEditDialog;
