import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  ListItemText,
  Divider,
  Alert,
  Paper,
  Tooltip,
  Tabs,
  Tab,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Popover,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Asset, TreeLevelValue, AssetClassificationPath, HierarchyPath } from '../../types/maintenanceTask';
import { Virtuoso } from 'react-virtuoso';
import { TableVirtuoso } from 'react-virtuoso';

const FilterPopper: React.FC<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
  searchStr: string;
  setSearchStr: (s: string) => void;
  allValues: string[];
  hiddenSet: Set<string>;
  setHiddenSet: (s: Set<string>) => void;
}> = ({ anchorEl, onClose, searchStr, setSearchStr, allValues, hiddenSet, setHiddenSet }) => {
  if (!anchorEl) return null;
  const filtered = allValues.filter(v => searchStr === '' || v.includes(searchStr));
  const isAllSelected = filtered.every(v => !hiddenSet.has(v));
  const hasIndeterminate = !isAllSelected && filtered.some(v => !hiddenSet.has(v));

  const handleToggleAll = () => {
    const next = new Set(hiddenSet);
    if (isAllSelected) {
      filtered.forEach(v => next.add(v));
    } else {
      filtered.forEach(v => next.delete(v));
    }
    setHiddenSet(next);
  };
  const handleToggle = (val: string) => {
    const next = new Set(hiddenSet);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setHiddenSet(next);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { bgcolor: '#242424', color: 'white', border: '1px solid #333', zIndex: 1300 } }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'transparent',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }
        }
      }}
    >
      <Box sx={{ p: 2, minWidth: 280, maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>テキスト検索</Typography>
        <TextField
          size="small"
          placeholder="Search..."
          value={searchStr}
          onChange={(e) => setSearchStr(e.target.value)}
          autoFocus
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ '& .MuiInputBase-root': { color: 'white', bgcolor: '#1e1e1e' } }}
        />
        
        <Divider sx={{ borderColor: '#333' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>リスト選択フィルタ</Typography>
        <List
          dense
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            maxHeight: 250, 
            bgcolor: '#1e1e1e', 
            border: '1px solid #333',
            borderRadius: 1
          }}
        >
          {filtered.length === 0 && (
             <ListItem><Typography variant="body2" sx={{ color: '#888' }}>データがありません</Typography></ListItem>
          )}
          {filtered.length > 0 && (
            <ListItem sx={{ p: 0 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={isAllSelected}
                    indeterminate={hasIndeterminate}
                    onChange={handleToggleAll}
                    sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#ffffff' }, '&.MuiCheckbox-indeterminate': { color: '#ffffff' } }}
                  />
                }
                label={<Typography variant="body2" fontWeight="bold">(すべて選択)</Typography>}
                sx={{ width: '100%', m: 0, pl: 1, borderBottom: '1px solid #333', pb: 0.5, mb: 0.5 }}
              />
            </ListItem>
          )}
          {filtered.map((v) => (
            <ListItem key={v} sx={{ p: 0 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={!hiddenSet.has(v)}
                    onChange={() => handleToggle(v)}
                    sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#ffffff' } }}
                  />
                }
                label={<Typography variant="body2">{v || '(空白)'}</Typography>}
                sx={{ width: '100%', m: 0, pl: 1 }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Popover>
  );
};

export interface TreeDefinition {
  levels: {
    key: string;

    values: TreeLevelValue[];
  }[];
}

export interface TreeClassificationEditDialogProps {
  open: boolean;
  title: string;
  definition: TreeDefinition;
  assetCount: number;
  assets: Asset[];
  pathKey: 'classificationPath' | 'hierarchyPath'; // どちらのプロパティを更新対象とするか
  onSave: (definition: TreeDefinition) => void;
  onSaveLinkedAssets?: (updatedAssets: { id: string; path: any }[]) => void;
  onExportJSON?: () => void;
  onImportJSON?: (file: File) => void;
  onClose: () => void;
  readOnly?: boolean;
}

interface LevelEditState {
  key: string;

  values: TreeLevelValue[];
  isNew: boolean;
  isModified: boolean;
  isDeleted: boolean;
}

interface SelectedAssetPath {
  id: string;
  name: string;
  path: { [key: string]: string };
  isModified: boolean;
  selected: boolean;
}

export const TreeClassificationEditDialog: React.FC<TreeClassificationEditDialogProps> = ({
  open,
  title,
  definition,
  assetCount,
  assets,
  pathKey,
  onSave,
  onSaveLinkedAssets,
  onExportJSON,
  onImportJSON,
  onClose,
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  // Tab 1 (Definition) state
  const [levels, setLevels] = useState<LevelEditState[]>([]);
  const [selectedLevelKey, setSelectedLevelKey] = useState<string | null>(null);
  
  // Tab 1 Editing level key
  const [editingLevelKey, setEditingLevelKey] = useState<string | null>(null);
  const [editingLevelNewKey, setEditingLevelNewKey] = useState('');
  const [newLevelKey, setNewLevelKey] = useState('');
  
  // Tab 1 value editing state
  const [bulkInputValue, setBulkInputValue] = useState('');
  const [filterValStr, setFilterValStr] = useState('');
  const [filterParentStr, setFilterParentStr] = useState('');
  const [hiddenVals, setHiddenVals] = useState<Set<string>>(new Set());
  const [hiddenParents, setHiddenParents] = useState<Set<string>>(new Set());
  const [anchorElVal, setAnchorElVal] = useState<HTMLButtonElement | null>(null);
  const [anchorElParent, setAnchorElParent] = useState<HTMLButtonElement | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Tab 2 (Linking) state
  const [assetStates, setAssetStates] = useState<SelectedAssetPath[]>([]);
  const [hasLinkingChanges, setHasLinkingChanges] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const initialLevels = definition.levels.map(l => ({
        key: l.key,

        values: [...l.values],
        isNew: false,
        isModified: false,
        isDeleted: false,
      }));
      setLevels(initialLevels);
      if (initialLevels.length > 0) {
        setSelectedLevelKey(initialLevels[0].key);
      }
      setHasChanges(false);
      setValidationError(null);
      setBulkInputValue('');
      setFilterValStr('');
      setFilterParentStr('');
      setHiddenVals(new Set());
      setHiddenParents(new Set());
      setActiveTab(0);
      
      const states = assets.map(a => ({
        id: a.id,
        name: a.name,
        path: { ...(a[pathKey as keyof Asset] as any || {}) },
        isModified: false,
        selected: false,
      }));
      setAssetStates(states);
      setHasLinkingChanges(false);
      setFilters({});
      setBulkValues({});
    }
  }, [open, definition, assets, pathKey]);

  const activeLevels = useMemo(() => {
    return levels.filter(l => !l.isDeleted);
  }, [levels]);

  const currentLevel = useMemo(() => {
    return activeLevels.find(l => l.key === selectedLevelKey);
  }, [activeLevels, selectedLevelKey]);

  // Tab 1: Level Handlers
  const handleAddLevel = useCallback(() => {
    if (!newLevelKey.trim()) { setValidationError('階層レベルのキーを入力してください'); return; }
    if (levels.some(l => l.key === newLevelKey && !l.isDeleted)) { setValidationError(`「${newLevelKey}」は既に存在します`); return; }
    
    setLevels([...levels, { key: newLevelKey, values: [], isNew: true, isModified: true, isDeleted: false }]);
    setNewLevelKey('');
    setSelectedLevelKey(newLevelKey);
    setHasChanges(true);
    setValidationError(null);
  }, [newLevelKey, levels]);

  const handleDeleteLevel = (levelKey: string) => {
    if (activeLevels.length <= 1) { setValidationError('少なくとも1つのレベルが必要です'); return; }
    setLevels(levels.map(l => l.key === levelKey ? { ...l, isDeleted: true, isModified: true } : l));
    if (selectedLevelKey === levelKey) {
      const remaining = activeLevels.filter(l => l.key !== levelKey);
      if (remaining.length > 0) setSelectedLevelKey(remaining[0].key);
      else setSelectedLevelKey(null);
    }
    setHasChanges(true);
  };
  
  const handleRenameLevel = (oldKey: string) => {
    const newKey = editingLevelNewKey.trim();
    if (!newKey || newKey === oldKey) {
      setEditingLevelKey(null);
      return;
    }
    if (levels.some(l => l.key === newKey && !l.isDeleted)) {
      setValidationError(`「${newKey}」は既に存在します`);
      return;
    }

    // Update level key
    setLevels(levels.map(l => l.key === oldKey ? { ...l, key: newKey, isModified: true } : l));
    
    // Update asset paths
    setAssetStates(prev => prev.map(a => {
      if (a.path[oldKey] !== undefined) {
        const newPath = { ...a.path };
        newPath[newKey] = newPath[oldKey];
        delete newPath[oldKey];
        return { ...a, path: newPath, isModified: true };
      }
      return a;
    }));

    // Update filters and bulk values
    setFilters(prev => {
      if (prev[oldKey] !== undefined) {
        const nf = { ...prev, [newKey]: prev[oldKey] };
        delete nf[oldKey];
        return nf;
      }
      return prev;
    });
    setBulkValues(prev => {
      if (prev[oldKey] !== undefined) {
        const nb = { ...prev, [newKey]: prev[oldKey] };
        delete nb[oldKey];
        return nb;
      }
      return prev;
    });

    if (selectedLevelKey === oldKey) setSelectedLevelKey(newKey);
    setEditingLevelKey(null);
    setHasChanges(true);
  };
  
  // Tab 1: Value Operations
  const handlePasteValues = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!currentLevel) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    const added: TreeLevelValue[] = [];
    lines.forEach(line => {
      // Allow value with optional parent separated by tab or comma
      const parts = line.split(/[\t,]/);
      const val = parts[0]?.trim();
      const parent = parts[1]?.trim();
      if (val && !currentLevel.values.find(v => v.value === val && v.parentValue === parent)) {
        added.push({ value: val, parentValue: parent || undefined });
      }
    });

    if (added.length > 0) {
      setLevels(levels.map(l => l.key === currentLevel.key ? {
        ...l, 
        values: [...added, ...l.values],
        isModified: true
      } : l));
      setHasChanges(true);
    }
  };

  const [newValueStr, setNewValueStr] = useState('');
  const [newParentStr, setNewParentStr] = useState('');

  const handleAddSingleValue = () => {
    if (!currentLevel || !newValueStr.trim()) return;
    const val = newValueStr.trim();
    const parent = newParentStr.trim() || undefined;
    
    if (currentLevel.values.find(v => v.value === val && v.parentValue === parent)) {
      setValidationError('この値の組み合わせは既に存在します');
      return;
    }

    setLevels(levels.map(l => l.key === currentLevel.key ? {
      ...l, 
      values: [...l.values, { value: val, parentValue: parent }],
      isModified: true
    } : l));
    setHasChanges(true);
    setNewValueStr('');
    setNewParentStr('');
  };

  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editingRowVal, setEditingRowVal] = useState('');
  const [editingRowParent, setEditingRowParent] = useState('');

  const handleRenameValue = (oldVal: string, oldParent: string | undefined) => {
    if (!currentLevel) return;
    const nVal = editingRowVal.trim();
    const nParent = editingRowParent.trim() || undefined;

    if (!nVal || (nVal === oldVal && nParent === oldParent)) {
      setEditingRowKey(null);
      return;
    }

    // Check conflict
    if ((nVal !== oldVal || nParent !== oldParent) && currentLevel.values.find(v => v.value === nVal && v.parentValue === nParent)) {
      setValidationError('この値の組み合わせは既に存在します');
      return;
    }

    setLevels(levels.map(l => l.key === currentLevel.key ? {
      ...l,
      values: l.values.map(v => (v.value === oldVal && v.parentValue === oldParent) ? { value: nVal, parentValue: nParent } : v),
      isModified: true
    } : l));
    
    // Propagate to linked assets
    if (nVal !== oldVal) {
      setAssetStates(prev => prev.map(a => {
        if (a.path[currentLevel.key] === oldVal) {
          const newPath = { ...a.path };
          newPath[currentLevel.key] = nVal;
          return { ...a, path: newPath, isModified: true };
        }
        return a;
      }));
      setHasLinkingChanges(true);
    }

    setHasChanges(true);
    setEditingRowKey(null);
  };

  const handleDeleteValueRow = (v: TreeLevelValue) => {
    if (!currentLevel) return;
    setLevels(levels.map(l => l.key === currentLevel.key ? {
      ...l,
      values: l.values.filter(x => !(x.value === v.value && x.parentValue === v.parentValue)),
      isModified: true
    } : l));
    setHasChanges(true);
  };

  // Tab 2: Linking Operations
  const filteredAssets = useMemo(() => {
    return assetStates.filter(a => {
      return Object.entries(filters).every(([k, v]) => {
        if (!v) return true;
        // Special value '(未分類)'
        if (v === '__UNCLASSIFIED__') return !a.path[k];
        return a.path[k] === v;
      });
    });
  }, [assetStates, filters]);

  const handleToggleAsset = (id: string) => {
    setAssetStates(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  };
  const handleToggleSelectAll = () => {
    const allSelected = filteredAssets.every(a => a.selected);
    const setIds = new Set(filteredAssets.map(a => a.id));
    setAssetStates(prev => prev.map(a => setIds.has(a.id) ? { ...a, selected: !allSelected } : a));
  };
  const handlePathChange = (id: string, levelKey: string, value: string) => {
    setAssetStates(prev => prev.map(a => {
      if (a.id !== id) return a;
      const newPath = { ...a.path };
      if (!value) delete newPath[levelKey];
      else newPath[levelKey] = value;
      return { ...a, path: newPath, isModified: true };
    }));
    setHasLinkingChanges(true);
  };
  const handleBulkApplyPath = () => {
    const selectedIds = new Set(assetStates.filter(a => a.selected).map(a => a.id));
    if (selectedIds.size === 0) return;
    setAssetStates(prev => prev.map(a => {
      if (!selectedIds.has(a.id)) return a;
      const newPath = { ...a.path };
      let updated = false;
      Object.entries(bulkValues).forEach(([k, v]) => {
        if (v) { newPath[k] = v; updated = true; }
      });
      return updated ? { ...a, path: newPath, isModified: true } : a;
    }));
    setHasLinkingChanges(true);
  };

  const handleSave = () => {
    // Basic validation
    if (activeLevels.length < 1) { setValidationError('最低1つのレベルが必要です'); return; }
    
    const newDef: TreeDefinition = {
      levels: activeLevels.map(l => ({ key: l.key, values: [...l.values] }))
    };

    onSave(newDef);

    if (onSaveLinkedAssets && hasLinkingChanges) {
      const updates = assetStates.filter(a => a.isModified).map(a => ({ id: a.id, path: a.path }));
      if (updates.length > 0) onSaveLinkedAssets(updates);
    }
    
    // onClose(); // ユーザーの希望により、ダイアログは開いたままとする
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.levels && Array.isArray(json.levels)) {
          const importedLevels = json.levels.map((l: any, i: number) => ({
            key: l.key,
            values: Array.isArray(l.values) ? l.values : [],
            isNew: false,
            isModified: true,
            isDeleted: false,
            originalKey: l.key
          }));
          setLevels(importedLevels);
          setHasChanges(true);
        } else {
          setValidationError('無効な階層定義データです');
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
        setValidationError('JSONファイルの解析に失敗しました');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadJSON = () => {
    const dataToExport = {
      levels: activeLevels.map((l, i) => ({
        key: l.key,
        values: [...l.values]
      }))
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hierarchy_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Rendering routines
  const renderTab1 = () => (
    <Box sx={{ display: 'flex', height: '600px', p: 0, borderTop: 0 }}>
      {/* Left Pane - Levels */}
      <Box sx={{ width: 240, display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider', bgcolor: 'transparent' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight="bold">階層レベル</Typography>
        </Box>
        <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
          {activeLevels.map((l, i) => (
             <ListItem 
               key={l.key} 
               button 
               selected={selectedLevelKey === l.key} 
               onClick={() => setSelectedLevelKey(l.key)}
               sx={{ 
                 borderBottom: 1, borderColor: 'divider', 
                 borderLeft: selectedLevelKey === l.key ? '4px solid #1976d2' : '4px solid transparent',
                 px: 2, py: 1.5
               }}
             >
               {editingLevelKey === l.key ? (
                 <TextField
                   size="small"
                   autoFocus
                   fullWidth
                   variant="standard"
                   value={editingLevelNewKey}
                   onChange={e => setEditingLevelNewKey(e.target.value)}
                   onBlur={() => handleRenameLevel(l.key)}
                   onKeyDown={e => {
                     if (e.key === 'Enter') { e.preventDefault(); handleRenameLevel(l.key); }
                     if (e.key === 'Escape') setEditingLevelKey(null);
                   }}
                 />
               ) : (
                 <ListItemText 
                   primary={l.key} 
                   secondary={`${l.values.length}件`} 
                   primaryTypographyProps={{ variant: 'body2', fontWeight: selectedLevelKey === l.key ? 'bold' : 'normal' }}
                   onDoubleClick={() => {
                     setEditingLevelKey(l.key);
                     setEditingLevelNewKey(l.key);
                   }}
                 />
               )}
               {!readOnly && (
                 <Box sx={{ display: 'flex', flexDirection: 'column', opacity: 0.7, '&:hover': { opacity: 1 } }}>


                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteLevel(l.key); }} color="error" disabled={activeLevels.length<=1} sx={{ p: 0.5 }}><DeleteIcon sx={{ fontSize: 16 }}/></IconButton>
                 </Box>
               )}
             </ListItem>
          ))}
          {!readOnly && (
            <ListItem sx={{ pt: 2, pb: 2, display: 'flex', gap: 1 }}>
              <TextField 
                size="small" variant="standard" placeholder="新しいレベルを追加..." 
                value={newLevelKey} onChange={e => setNewLevelKey(e.target.value)} 
                fullWidth 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLevel(); } }}
              />
              <IconButton onClick={handleAddLevel} size="small" disabled={!newLevelKey.trim()}><AddIcon/></IconButton>
            </ListItem>
          )}
        </List>
      </Box>

      {/* Right Pane - Values */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'transparent' }}>
        {currentLevel ? (
          <Box sx={{ flexGrow: 1 }}>
            <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden', border: 0 }}>
              <TableVirtuoso
                style={{ height: '100%' }}
                data={currentLevel.values.filter(v => !hiddenVals.has(v.value) && !hiddenParents.has(v.parentValue || ''))}
                computeItemKey={(index, v) => `${v.value}__${v.parentValue || ''}`}
                fixedHeaderContent={() => {
                  const uniqueVals = Array.from(new Set(currentLevel.values.map(v => v.value))).sort();
                  const uniqueParents = Array.from(new Set(currentLevel.values.map(v => v.parentValue || ''))).sort();
                  return (
                    <TableRow sx={{ bgcolor: 'background.default' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          値
                          <IconButton size="small" onClick={(e) => setAnchorElVal(anchorElVal ? null : e.currentTarget)} sx={{ color: hiddenVals.size > 0 ? 'primary.main' : 'inherit' }}><FilterListIcon fontSize="small"/></IconButton>
                          <FilterPopper 
                            anchorEl={anchorElVal} onClose={() => setAnchorElVal(null)}
                            searchStr={filterValStr} setSearchStr={setFilterValStr}
                            allValues={uniqueVals} hiddenSet={hiddenVals} setHiddenSet={setHiddenVals}
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          上位階層の値
                          <IconButton size="small" onClick={(e) => setAnchorElParent(anchorElParent ? null : e.currentTarget)} sx={{ color: hiddenParents.size > 0 ? 'primary.main' : 'inherit' }}><FilterListIcon fontSize="small"/></IconButton>
                          <FilterPopper 
                            anchorEl={anchorElParent} onClose={() => setAnchorElParent(null)}
                            searchStr={filterParentStr} setSearchStr={setFilterParentStr}
                            allValues={uniqueParents} hiddenSet={hiddenParents} setHiddenSet={setHiddenParents}
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 80, align: 'center' }}>操作</TableCell>
                    </TableRow>
                  );
                }}
                  itemContent={(index, v) => {
                    const isEditing = editingRowKey === `${v.value}__${v.parentValue || ''}`;
                    return (
                      <>
                        <TableCell>
                          {isEditing ? (
                            <TextField 
                              autoFocus size="small" fullWidth variant="standard"
                              value={editingRowVal} onChange={e => setEditingRowVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameValue(v.value, v.parentValue); else if (e.key === 'Escape') setEditingRowKey(null); }}
                            />
                          ) : (
                            <Typography 
                              variant="body2" 
                              onDoubleClick={() => !readOnly && (setEditingRowKey(`${v.value}__${v.parentValue || ''}`), setEditingRowVal(v.value), setEditingRowParent(v.parentValue || ''))}
                              sx={{ cursor: readOnly ? 'default' : 'text' }}
                            >
                              {v.value}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField 
                              size="small" fullWidth variant="standard" placeholder="(任意)"
                              value={editingRowParent} onChange={e => setEditingRowParent(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameValue(v.value, v.parentValue); else if (e.key === 'Escape') setEditingRowKey(null); }}
                            />
                          ) : (
                            <Typography 
                              variant="body2" color="text.secondary"
                              onDoubleClick={() => !readOnly && (setEditingRowKey(`${v.value}__${v.parentValue || ''}`), setEditingRowVal(v.value), setEditingRowParent(v.parentValue || ''))}
                              sx={{ cursor: readOnly ? 'default' : 'text' }}
                            >
                              {v.parentValue || ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {isEditing ? (
                            <IconButton size="small" onClick={() => handleRenameValue(v.value, v.parentValue)} color="primary"><SaveIcon fontSize="small"/></IconButton>
                          ) : (
                            !readOnly && <IconButton size="small" onClick={() => handleDeleteValueRow(v)} color="error"><DeleteIcon fontSize="small"/></IconButton>
                          )}
                        </TableCell>
                      </>
                    );
                  }}
                  fixedFooterContent={() => readOnly ? null : (
                    <TableRow sx={{ bgcolor: '#fafafa', borderTop: '2px solid #ddd' }}>
                      <TableCell>
                         <TextField 
                           size="small" fullWidth variant="standard" 
                           placeholder="値 (ここへ複数行コピペ一括追加)" 
                           value={newValueStr} 
                           onChange={e => setNewValueStr(e.target.value)}
                           onPaste={handlePasteValues}
                           onKeyDown={e => { if (e.key === 'Enter') handleAddSingleValue(); }}
                         />
                      </TableCell>
                      <TableCell>
                         <TextField 
                           size="small" fullWidth variant="standard" 
                           placeholder="上位階層の値 (任意)" 
                           value={newParentStr} 
                           onChange={e => setNewParentStr(e.target.value)}
                           onPaste={handlePasteValues}
                           onKeyDown={e => { if (e.key === 'Enter') handleAddSingleValue(); }}
                         />
                      </TableCell>
                      <TableCell align="center">
                         <IconButton size="small" onClick={handleAddSingleValue} color="primary" disabled={!newValueStr.trim()}><AddIcon fontSize="small"/></IconButton>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </Paper>
            </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>左のリストからレベルを選択してください</Box>
        )}
      </Box>
    </Box>
  );

  const renderTab2 = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '600px', p: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', p: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ width: '100%' }}>フィルタ</Typography>
        {activeLevels.map((l, i) => {
          const parentKey = i > 0 ? activeLevels[i-1].key : null;
          const parentVal = parentKey ? filters[parentKey] : null;
          const availableValues = Array.from(new Set(l.values.filter(v => !parentVal || parentVal === '__UNCLASSIFIED__' || v.parentValue === parentVal).map(v => v.value)));
          return (
          <FormControl key={l.key} size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{l.key}</InputLabel>
            <Select value={filters[l.key] || ''} label={l.key} onChange={e => setFilters({...filters, [l.key]: e.target.value as string})}>
              <MenuItem value="">すべて</MenuItem>
              <MenuItem value="__UNCLASSIFIED__"><em>(未設定)</em></MenuItem>
              {availableValues.map(val => (
                 <MenuItem key={val} value={val}>{val}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )})}
      </Box>

      <Paper variant="outlined" sx={{ flexGrow: 1 }}>
        <TableVirtuoso
          style={{ height: '100%' }}
          data={filteredAssets}
          computeItemKey={(index, asset) => asset.id}
          fixedHeaderContent={() => (
            <TableRow sx={{ bgcolor: 'background.paper' }}>
              <TableCell padding="checkbox"><Checkbox onChange={handleToggleSelectAll} disabled={readOnly}/></TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>機器ID / 名称</TableCell>
              {activeLevels.map(l => (
                <TableCell key={l.key} sx={{ fontWeight: 'bold' }}>{l.key}</TableCell>
              ))}
            </TableRow>
          )}
          itemContent={(index, asset) => (
            <>
              <TableCell padding="checkbox"><Checkbox checked={asset.selected} onChange={() => handleToggleAsset(asset.id)} disabled={readOnly}/></TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">{asset.id}</Typography>
                <Typography variant="caption" color="text.secondary">{asset.name}</Typography>
              </TableCell>
              {activeLevels.map((l, i) => {
                const parentKey = i > 0 ? activeLevels[i-1].key : null;
                const parentVal = parentKey ? asset.path[parentKey] : null;
                const availableValues = Array.from(new Set(l.values.filter(v => !parentVal || v.parentValue === parentVal).map(v => v.value)));
                return (
                <TableCell key={l.key}>
                  <Select
                    size="small" fullWidth displayEmpty disabled={readOnly}
                    value={asset.path[l.key] || ''}
                    onChange={e => handlePathChange(asset.id, l.key, e.target.value as string)}
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <MenuItem value=""><em>(未設定)</em></MenuItem>
                    {availableValues.map(val => <MenuItem key={val} value={val}>{val}</MenuItem>)}
                  </Select>
                </TableCell>
              )})}
            </>
          )}
        />
      </Paper>

      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1, alignItems: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
           <Typography variant="subtitle2">選択中({assetStates.filter(a => a.selected).length}件)を一括変更:</Typography>
           {activeLevels.map((l, i) => {
            const parentKey = i > 0 ? activeLevels[i-1].key : null;
            const parentVal = parentKey ? bulkValues[parentKey] : null;
            const availableValues = Array.from(new Set(l.values.filter(v => !parentVal || parentVal === '__UNCLASSIFIED__' || v.parentValue === parentVal).map(v => v.value)));
            return (
            <FormControl key={`bulk_${l.key}`} size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{l.key}</InputLabel>
              <Select value={bulkValues[l.key] || ''} label={l.key} onChange={e => setBulkValues({...bulkValues, [l.key]: e.target.value as string})}>
                <MenuItem value="">-- 無変更 --</MenuItem>
                {availableValues.map(val => <MenuItem key={val} value={val}>{val}</MenuItem>)}
              </Select>
            </FormControl>
          )})}
          <Button variant="outlined" onClick={handleBulkApplyPath} disabled={assetStates.filter(a => a.selected).length === 0}>適用</Button>
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="caption" color="text.secondary">階層: {activeLevels.length} | 紐づけ対象: {assetCount}件</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} style={{display: 'none'}} />
          <Tooltip title="定義をJSONインポート"><IconButton onClick={() => fileInputRef.current?.click()}><UploadIcon /></IconButton></Tooltip>
          <Tooltip title="定義をJSONエクスポート"><IconButton onClick={handleDownloadJSON}><DownloadIcon /></IconButton></Tooltip>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
         {validationError && <Alert severity="error" onClose={() => setValidationError(null)}>{validationError}</Alert>}
         <Tabs 
           value={activeTab} 
           onChange={(e, v) => setActiveTab(v)} 
           sx={{ 
             borderBottom: 1, 
             borderColor: 'divider', 
             px: 2,
             '& .MuiTabs-indicator': { backgroundColor: 'text.primary' },
             '& .MuiTab-root.Mui-selected': { color: 'text.primary' }
           }}
         >
           <Tab label="定義編集" />
           <Tab label="機器紐づけ" />
         </Tabs>
         {activeTab === 0 && renderTab1()}
         {activeTab === 1 && renderTab2()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={readOnly || (!hasChanges && !hasLinkingChanges)}>保存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TreeClassificationEditDialog;
