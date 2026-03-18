import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Alert,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  SwapHoriz as SwapIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { HierarchyDefinition, HierarchyPath, Asset } from '../../types/maintenanceTask';

export interface AssetReassignDialogProps {
  open: boolean;
  assets: Asset[]; // Selected assets to reassign
  hierarchy: HierarchyDefinition;
  onReassign: (assetIds: string[], newHierarchyPath: HierarchyPath) => void;
  onClose: () => void;
}

/**
 * AssetReassignDialog - Dialog for reassigning assets to a new hierarchy path
 * 
 * Features:
 * - Display current hierarchy path of selected assets
 * - Allow selection of new hierarchy path
 * - Validate new hierarchy path
 * - Support bulk reassignment of multiple assets
 * 
 * Requirements: 3.2, 3.6
 */
export const AssetReassignDialog: React.FC<AssetReassignDialogProps> = ({
  open,
  assets,
  hierarchy,
  onReassign,
  onClose,
}) => {
  const [newHierarchyPath, setNewHierarchyPath] = useState<HierarchyPath>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize new hierarchy path when dialog opens
  useEffect(() => {
    if (open && assets.length > 0) {
      // If single asset, use its current path as default
      if (assets.length === 1) {
        setNewHierarchyPath({ ...assets[0].hierarchyPath });
      } else {
        // For multiple assets, start with empty path
        const initialPath: HierarchyPath = {};
        hierarchy.levels.forEach(level => {
          initialPath[level.key] = '';
        });
        setNewHierarchyPath(initialPath);
      }
      setValidationError(null);
    }
  }, [open, assets, hierarchy]);

  // Get sorted hierarchy levels
  const sortedLevels = useMemo(() => {
    return [...hierarchy.levels].sort((a, b) => a.order - b.order);
  }, [hierarchy]);

  // Validate the new hierarchy path
  const validatePath = useCallback((path: HierarchyPath): string | null => {
    // Check if all required levels are filled
    for (const level of hierarchy.levels) {
      if (!path[level.key] || path[level.key].trim() === '') {
        return `階層レベル「${level.key}」の値を選択してください`;
      }

      // Check if value exists in level's allowed values
      if (level.values.length > 0 && !level.values.includes(path[level.key])) {
        return `階層レベル「${level.key}」の値「${path[level.key]}」は無効です`;
      }
    }

    return null;
  }, [hierarchy]);

  // Handle hierarchy level value change
  const handleLevelChange = useCallback((levelKey: string, value: string) => {
    setNewHierarchyPath(prev => ({
      ...prev,
      [levelKey]: value,
    }));
    setValidationError(null);
  }, []);

  // Handle reassign
  const handleReassign = useCallback(() => {
    // Validate path
    const error = validatePath(newHierarchyPath);
    if (error) {
      setValidationError(error);
      return;
    }

    // Check if path is different from current (for single asset)
    if (assets.length === 1) {
      const currentPath = assets[0].hierarchyPath;
      const isSame = sortedLevels.every(
        level => currentPath[level.key] === newHierarchyPath[level.key]
      );
      if (isSame) {
        setValidationError('新しい階層パスは現在のパスと同じです');
        return;
      }
    }

    // Perform reassignment
    const assetIds = assets.map(asset => asset.id);
    onReassign(assetIds, newHierarchyPath);
    onClose();
  }, [assets, newHierarchyPath, validatePath, sortedLevels, onReassign, onClose]);

  // Get current hierarchy paths (unique)
  const currentPaths = useMemo(() => {
    const pathMap = new Map<string, Asset[]>();
    
    assets.forEach(asset => {
      const pathKey = sortedLevels
        .map(level => asset.hierarchyPath[level.key] || '')
        .join(' > ');
      
      const existing = pathMap.get(pathKey) || [];
      existing.push(asset);
      pathMap.set(pathKey, existing);
    });
    
    return Array.from(pathMap.entries()).map(([pathKey, assetsInPath]) => ({
      pathKey,
      path: assetsInPath[0].hierarchyPath,
      assets: assetsInPath,
    }));
  }, [assets, sortedLevels]);

  // Format hierarchy path for display
  const formatPath = useCallback((path: HierarchyPath): string => {
    return sortedLevels
      .map(level => path[level.key] || '(未設定)')
      .join(' > ');
  }, [sortedLevels]);

  // Check if reassign button should be enabled
  const canReassign = useMemo(() => {
    return sortedLevels.every(level => 
      newHierarchyPath[level.key] && newHierarchyPath[level.key].trim() !== ''
    );
  }, [newHierarchyPath, sortedLevels]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '50vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">
              機器の階層付け替え
            </Typography>
            <Typography variant="body2" color="text.secondary">
              選択された機器: {assets.length}件
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
        
        {/* Current hierarchy paths */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="現在" size="small" color="default" />
            現在の階層パス
          </Typography>
          
          {currentPaths.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              機器が選択されていません
            </Typography>
          ) : (
            <List dense>
              {currentPaths.map(({ pathKey, path, assets: assetsInPath }, index) => (
                <React.Fragment key={pathKey}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={formatPath(path)}
                      secondary={`${assetsInPath.length}件の機器: ${assetsInPath.map(a => a.id).join(', ')}`}
                      primaryTypographyProps={{
                        fontWeight: 'medium',
                        color: 'text.primary',
                      }}
                    />
                  </ListItem>
                  {index < currentPaths.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>

        {/* Arrow indicator */}
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <SwapIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        </Box>

        {/* New hierarchy path selection */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="新規" size="small" color="primary" />
            新しい階層パス
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {sortedLevels.map((level) => (
              <FormControl key={level.key} fullWidth size="small">
                <InputLabel>{level.key}</InputLabel>
                <Select
                  value={newHierarchyPath[level.key] || ''}
                  onChange={(e) => handleLevelChange(level.key, e.target.value)}
                  label={level.key}
                >
                  {level.values.length === 0 ? (
                    <MenuItem value="" disabled>
                      <em>値が定義されていません</em>
                    </MenuItem>
                  ) : (
                    level.values.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            ))}
          </Box>

          {/* Preview of new path */}
          {canReassign && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'success.lighter', borderRadius: 1 }}>
              <Typography variant="body2" color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckIcon fontSize="small" />
                新しいパス: {formatPath(newHierarchyPath)}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Warning for bulk reassignment */}
        {assets.length > 1 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {assets.length}件の機器を一括で付け替えます。
            すべての機器が同じ階層パスに移動されます。
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleReassign}
          variant="contained"
          disabled={!canReassign}
          startIcon={<SwapIcon />}
        >
          付け替え実行
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetReassignDialog;
