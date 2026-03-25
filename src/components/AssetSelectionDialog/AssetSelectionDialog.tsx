import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Autocomplete,
  TextField,
  Chip
} from '@mui/material';
import { Close as CloseIcon, AccountTree as TreeIcon } from '@mui/icons-material';
import { Asset } from '../../types/maintenanceTask';

export interface AssetSelectionDialogProps {
  open: boolean;
  assets: Asset[];
  currentAssetId?: string;
  onSelect: (assetId: string) => void;
  onClose: () => void;
}

export const AssetSelectionDialog: React.FC<AssetSelectionDialogProps> = ({
  open,
  assets,
  currentAssetId,
  onSelect,
  onClose,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (open) {
      if (currentAssetId) {
        setSelectedAsset(assets.find(a => a.id === currentAssetId) || null);
      } else {
        setSelectedAsset(null);
      }
    }
  }, [open, currentAssetId, assets]);

  const handleSave = () => {
    if (selectedAsset) {
      onSelect(selectedAsset.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TreeIcon color="primary" />
            対象機器の選択
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ mr: -1 }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
          展開または検索して、明細に割り当てる機器を選んでください。
        </Typography>

        <Autocomplete
          fullWidth
          openOnFocus
          options={assets}
          groupBy={(option) => Object.values(option.hierarchyPath).filter(Boolean).join(' > ') || '未分類'}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selectedAsset}
          onChange={(_, newValue) => setSelectedAsset(newValue)}
          renderInput={(params) => (
            <TextField 
              {...params} 
              label="機器を検索または選択" 
              variant="outlined"
              placeholder="機器名や階層で検索..."
            />
          )}
          renderOption={(props, option) => (
            <li {...props}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body1">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {option.id}</Typography>
              </Box>
            </li>
          )}
          renderGroup={(params) => (
            <li key={params.key}>
              <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1, sticky: 'top', zIndex: 1 }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">
                  {params.group}
                </Typography>
              </Box>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          )}
        />

        {selectedAsset && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              選択中の機器情報:
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold">
              {selectedAsset.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`ID: ${selectedAsset.id}`} variant="outlined" />
              {Object.entries(selectedAsset.hierarchyPath).map(([key, value]) => (
                value && <Chip key={key} size="small" label={`${key}: ${value}`} />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>キャンセル</Button>
        <Button 
          variant="contained" 
          onClick={handleSave} 
          disabled={!selectedAsset || selectedAsset.id === currentAssetId}
        >
          この機器に決定
        </Button>
      </DialogActions>
    </Dialog>
  );
};
