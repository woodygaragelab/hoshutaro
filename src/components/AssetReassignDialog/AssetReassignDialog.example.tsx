import React, { useState } from 'react';
import { Box, Button, Typography, Paper, List, ListItem, ListItemText, Chip } from '@mui/material';
import { SwapHoriz as SwapIcon } from '@mui/icons-material';
import { AssetReassignDialog } from './AssetReassignDialog';
import { Asset, HierarchyDefinition, HierarchyPath } from '../../types/maintenanceTask';

/**
 * Example usage of AssetReassignDialog component
 * 
 * This example demonstrates:
 * 1. Single asset reassignment
 * 2. Bulk asset reassignment
 * 3. Integration with hierarchy and asset managers
 */

// Mock data
const mockHierarchy: HierarchyDefinition = {
  levels: [
    {
      key: '製油所',
      order: 1,
      values: ['第一製油所', '第二製油所'],
    },
    {
      key: 'エリア',
      order: 2,
      values: ['Aエリア', 'Bエリア', 'Cエリア'],
    },
    {
      key: 'ユニット',
      order: 3,
      values: ['原油蒸留ユニット', '接触改質ユニット', '製品貯蔵エリア'],
    },
  ],
};

const mockAssets: Asset[] = [
  {
    id: 'P-101',
    name: '原油供給ポンプ',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    },
    specifications: [
      { key: '型式', value: '遠心式', order: 1 },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'P-102',
    name: '原油供給ポンプ（予備）',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    },
    specifications: [
      { key: '型式', value: '遠心式', order: 1 },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'E-201',
    name: '熱交換器',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Bエリア',
      'ユニット': '接触改質ユニット',
    },
    specifications: [
      { key: '型式', value: 'シェル&チューブ式', order: 1 },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'T-4220',
    name: '貯蔵タンク',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Cエリア',
      'ユニット': '製品貯蔵エリア',
    },
    specifications: [
      { key: '型式', value: '浮き屋根式', order: 1 },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

export const AssetReassignDialogExample: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>(mockAssets);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // Format hierarchy path for display
  const formatPath = (path: HierarchyPath): string => {
    return mockHierarchy.levels
      .sort((a, b) => a.order - b.order)
      .map(level => path[level.key] || '(未設定)')
      .join(' > ');
  };

  // Handle asset selection
  const handleSelectAsset = (asset: Asset) => {
    const isSelected = selectedAssets.some(a => a.id === asset.id);
    if (isSelected) {
      setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
    } else {
      setSelectedAssets([...selectedAssets, asset]);
    }
  };

  // Handle reassignment
  const handleReassign = (assetIds: string[], newPath: HierarchyPath) => {
    // Update assets with new hierarchy path
    const updatedAssets = assets.map(asset => {
      if (assetIds.includes(asset.id)) {
        return {
          ...asset,
          hierarchyPath: { ...newPath },
          updatedAt: new Date(),
        };
      }
      return asset;
    });

    setAssets(updatedAssets);
    
    // Update selected assets
    const updatedSelectedAssets = selectedAssets.map(asset => {
      if (assetIds.includes(asset.id)) {
        return {
          ...asset,
          hierarchyPath: { ...newPath },
          updatedAt: new Date(),
        };
      }
      return asset;
    });
    setSelectedAssets(updatedSelectedAssets);

    // Log action
    const pathStr = formatPath(newPath);
    setLastAction(
      `${assetIds.length}件の機器を「${pathStr}」に付け替えました: ${assetIds.join(', ')}`
    );
  };

  // Handle opening dialog
  const handleOpenDialog = () => {
    if (selectedAssets.length === 0) {
      alert('機器を選択してください');
      return;
    }
    setDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        AssetReassignDialog Example
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        機器を選択して「付け替え」ボタンをクリックすると、階層パスを変更できます。
      </Typography>

      {/* Last action display */}
      {lastAction && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.lighter' }}>
          <Typography variant="body2" color="success.dark">
            ✓ {lastAction}
          </Typography>
        </Paper>
      )}

      {/* Action buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<SwapIcon />}
          onClick={handleOpenDialog}
          disabled={selectedAssets.length === 0}
        >
          付け替え ({selectedAssets.length}件選択中)
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => setSelectedAssets([])}
          disabled={selectedAssets.length === 0}
        >
          選択解除
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => setSelectedAssets([...assets])}
        >
          全選択
        </Button>
      </Box>

      {/* Asset list */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            機器一覧 ({assets.length}件)
          </Typography>
        </Box>
        
        <List>
          {assets.map((asset, index) => {
            const isSelected = selectedAssets.some(a => a.id === asset.id);
            
            return (
              <React.Fragment key={asset.id}>
                <ListItem
                  onClick={() => handleSelectAsset(asset)}
                  sx={{
                    bgcolor: isSelected ? 'primary.lighter' : 'transparent',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: isSelected ? 'primary.light' : 'action.hover',
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {asset.id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {asset.name}
                        </Typography>
                        {isSelected && (
                          <Chip label="選択中" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {formatPath(asset.hierarchyPath)}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < assets.length - 1 && <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}
              </React.Fragment>
            );
          })}
        </List>
      </Paper>

      {/* Dialog */}
      <AssetReassignDialog
        open={dialogOpen}
        assets={selectedAssets}
        hierarchy={mockHierarchy}
        onReassign={handleReassign}
        onClose={() => setDialogOpen(false)}
      />

      {/* Usage examples */}
      <Paper sx={{ p: 3, mt: 4, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          使用例
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          1. 単一機器の付け替え
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          1件の機器を選択して「付け替え」ボタンをクリックします。
          現在の階層パスが初期値として表示され、変更できます。
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom>
          2. 複数機器の一括付け替え
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          複数の機器を選択して「付け替え」ボタンをクリックします。
          すべての機器が同じ階層パスに移動されます。
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom>
          3. バリデーション
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          すべての階層レベルの値を選択する必要があります。
          単一機器の場合、現在のパスと異なるパスを選択する必要があります。
        </Typography>
      </Paper>
    </Box>
  );
};

export default AssetReassignDialogExample;
