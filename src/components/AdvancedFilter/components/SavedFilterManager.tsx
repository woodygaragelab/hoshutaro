import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Divider,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  FileCopy as CopyIcon,
} from '@mui/icons-material';
import { SavedFilter, FilterCondition, FilterField } from '../types';
import FilterVisualization from './FilterVisualization';

interface SavedFilterManagerProps {
  savedFilters: SavedFilter[];
  currentFilters: FilterCondition[];
  availableFields: FilterField[];
  onLoadFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  onSaveFilter: (name: string, description: string, filters: FilterCondition[]) => void;
  onUpdateFilter?: (filterId: string, name: string, description: string, filters: FilterCondition[]) => void;
  onDuplicateFilter?: (filterId: string) => void;
}

const SavedFilterManager: React.FC<SavedFilterManagerProps> = ({
  savedFilters,
  currentFilters,
  availableFields,
  onLoadFilter,
  onDeleteFilter,
  onSaveFilter,
  onUpdateFilter,
  onDuplicateFilter,
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);

  const handleSaveClick = () => {
    setSaveDialogOpen(true);
    setFilterName('');
    setFilterDescription('');
    setNameError('');
  };

  const handleSaveConfirm = () => {
    if (!filterName.trim()) {
      setNameError('フィルター名を入力してください');
      return;
    }

    if (savedFilters.some(f => f.name === filterName.trim() && f.id !== editingFilter?.id)) {
      setNameError('この名前は既に使用されています');
      return;
    }

    if (editingFilter && onUpdateFilter) {
      onUpdateFilter(editingFilter.id, filterName.trim(), filterDescription.trim(), currentFilters);
      setEditDialogOpen(false);
    } else {
      onSaveFilter(filterName.trim(), filterDescription.trim(), currentFilters);
      setSaveDialogOpen(false);
    }
    
    setEditingFilter(null);
  };

  const handleEditFilter = (filter: SavedFilter) => {
    setEditingFilter(filter);
    setFilterName(filter.name);
    setFilterDescription(filter.description || '');
    setNameError('');
    setEditDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleDuplicateFilter = (filterId: string) => {
    if (onDuplicateFilter) {
      onDuplicateFilter(filterId);
    }
    setMenuAnchor(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, filterId: string) => {
    setMenuAnchor(event.currentTarget);
    setSelectedFilterId(filterId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedFilterId(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getFilterSummary = (conditions: FilterCondition[]) => {
    if (conditions.length === 0) return '条件なし';
    if (conditions.length === 1) return '1つの条件';
    return `${conditions.length}つの条件`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">保存済みフィルター</Typography>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSaveClick}
          disabled={currentFilters.length === 0}
          size="small"
        >
          現在の条件を保存
        </Button>
      </Box>

      {savedFilters.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          保存されたフィルターはありません
        </Typography>
      ) : (
        <List dense>
          {savedFilters.map((filter, index) => (
            <React.Fragment key={filter.id}>
              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2">{filter.name}</Typography>
                        <Chip
                          label={getFilterSummary(filter.conditions)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      {filter.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {filter.description}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="フィルターを適用">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadFilter(filter.id);
                          }}
                          color="primary"
                        >
                          <RestoreIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, filter.id);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      フィルター条件:
                    </Typography>
                    <FilterVisualization
                      filters={filter.conditions}
                      availableFields={availableFields}
                      onRemoveFilter={() => {}} // Read-only in saved filter view
                      onClearAllFilters={() => {}} // Read-only in saved filter view
                      showDetails={true}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      <ScheduleIcon sx={{ fontSize: 14 }} color="action" />
                      <Typography variant="caption" color="text.secondary">
                        作成: {formatDate(filter.createdAt)}
                      </Typography>
                      {filter.lastUsed && (
                        <Typography variant="caption" color="text.secondary">
                          • 最終使用: {formatDate(filter.lastUsed)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const filter = savedFilters.find(f => f.id === selectedFilterId);
          if (filter) handleEditFilter(filter);
        }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          編集
        </MenuItem>
        {onDuplicateFilter && (
          <MenuItem onClick={() => {
            if (selectedFilterId) handleDuplicateFilter(selectedFilterId);
          }}>
            <CopyIcon sx={{ mr: 1 }} fontSize="small" />
            複製
          </MenuItem>
        )}
        <Divider />
        <MenuItem 
          onClick={() => {
            if (selectedFilterId) onDeleteFilter(selectedFilterId);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          削除
        </MenuItem>
      </Menu>

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>フィルターを保存</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="フィルター名"
            fullWidth
            variant="outlined"
            value={filterName}
            onChange={(e) => {
              setFilterName(e.target.value);
              setNameError('');
            }}
            error={!!nameError}
            helperText={nameError}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="説明（任意）"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={filterDescription}
            onChange={(e) => setFilterDescription(e.target.value)}
            placeholder="このフィルターの用途や内容を説明してください"
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              保存される条件: {getFilterSummary(currentFilters)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveConfirm} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Filter Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>フィルターを編集</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            現在設定されているフィルター条件で既存のフィルターを更新します。
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="フィルター名"
            fullWidth
            variant="outlined"
            value={filterName}
            onChange={(e) => {
              setFilterName(e.target.value);
              setNameError('');
            }}
            error={!!nameError}
            helperText={nameError}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="説明（任意）"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={filterDescription}
            onChange={(e) => setFilterDescription(e.target.value)}
            placeholder="このフィルターの用途や内容を説明してください"
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              更新される条件: {getFilterSummary(currentFilters)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveConfirm} variant="contained">更新</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SavedFilterManager;