import React, { useState } from 'react';
import { Button, Box, Typography } from '@mui/material';
import { HierarchyEditDialog } from './HierarchyEditDialog';
import { HierarchyDefinition } from '../../types/maintenanceTask';

/**
 * Example usage of HierarchyEditDialog
 * 
 * This example demonstrates:
 * - Opening the hierarchy edit dialog
 * - Editing hierarchy levels and values
 * - Saving changes
 */
export const HierarchyEditDialogExample: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyDefinition>({
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
  });

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = (newHierarchy: HierarchyDefinition) => {
    setHierarchy(newHierarchy);
    console.log('Hierarchy saved:', newHierarchy);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        HierarchyEditDialog Example
      </Typography>
      
      <Typography variant="body1" paragraph>
        Current hierarchy structure:
      </Typography>
      
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        {hierarchy.levels.map((level) => (
          <Box key={level.key} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {level.key} (順序: {level.order})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              値: {level.values.join(', ') || '(なし)'}
            </Typography>
          </Box>
        ))}
      </Box>
      
      <Button variant="contained" onClick={handleOpen}>
        階層構造を編集
      </Button>
      
      <HierarchyEditDialog
        open={open}
        hierarchy={hierarchy}
        assetCount={150}
        onSave={handleSave}
        onClose={handleClose}
      />
    </Box>
  );
};

export default HierarchyEditDialogExample;
