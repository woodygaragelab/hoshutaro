import React, { useState, useCallback, useEffect } from 'react';
import { Box, TextField } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn } from '../ExcelLikeGrid/types';

interface MaintenanceCellProps {
  item: HierarchicalData;
  column: GridColumn;
  value: any;
  viewMode: 'status' | 'cost';
  isSelected: boolean;
  isEditing: boolean;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onCellClick: () => void;
  onCellDoubleClick: () => void;
  readOnly: boolean;
  width: number;
}

export const MaintenanceCell: React.FC<MaintenanceCellProps> = ({
  item,
  column,
  value,
  isSelected,
  isEditing,
  onCellEdit,
  onCellClick,
  onCellDoubleClick,
  readOnly,
  width
}) => {
  const [editValue, setEditValue] = useState(value);

  // Update edit value when value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleEditComplete = useCallback(() => {
    if (editValue !== value) {
      onCellEdit(item.id, column.id, editValue);
    }
  }, [editValue, value, onCellEdit, item.id, column.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditComplete();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value);
    }
  }, [handleEditComplete, value]);

  // Render different cell types
  const renderCellContent = () => {
    if (isEditing && column.editable && !readOnly) {
      // Editing mode
      if (column.type === 'status') {
        // Status editing - toggle between planned/actual
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '1px solid',
                borderColor: 'primary.main',
                backgroundColor: editValue?.planned ? 'primary.main' : 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => setEditValue({ ...editValue, planned: !editValue?.planned })}
            />
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '1px solid',
                borderColor: 'secondary.main',
                backgroundColor: editValue?.actual ? 'secondary.main' : 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => setEditValue({ ...editValue, actual: !editValue?.actual })}
            />
          </Box>
        );
      } else if (column.type === 'cost') {
        // Cost editing
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <TextField
              value={editValue?.planCost || ''}
              onChange={(e) => setEditValue({ ...editValue, planCost: parseFloat(e.target.value) || 0 })}
              onBlur={handleEditComplete}
              onKeyDown={handleKeyDown}
              placeholder="計画"
              size="small"
              variant="standard"
              type="number"
              sx={{ '& .MuiInput-root': { fontSize: '0.75rem' } }}
            />
            <TextField
              value={editValue?.actualCost || ''}
              onChange={(e) => setEditValue({ ...editValue, actualCost: parseFloat(e.target.value) || 0 })}
              onBlur={handleEditComplete}
              onKeyDown={handleKeyDown}
              placeholder="実績"
              size="small"
              variant="standard"
              type="number"
              sx={{ '& .MuiInput-root': { fontSize: '0.75rem' } }}
            />
          </Box>
        );
      } else {
        // Text/number editing
        return (
          <TextField
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditComplete}
            onKeyDown={handleKeyDown}
            autoFocus
            fullWidth
            variant="standard"
            size="small"
            type={column.type === 'number' ? 'number' : 'text'}
            sx={{ '& .MuiInput-root': { fontSize: '0.875rem' } }}
          />
        );
      }
    } else {
      // Display mode
      if (column.type === 'status') {
        const planned = value?.planned || false;
        const actual = value?.actual || false;
        
        let symbol = '';
        if (planned && actual) symbol = '◎';
        else if (planned) symbol = '○';
        else if (actual) symbol = '●';
        
        return (
          <Box sx={{ textAlign: 'center', fontSize: '1rem', fontWeight: 'bold', color: '#333333 !important' }}>
            {symbol}
          </Box>
        );
      } else if (column.type === 'cost') {
        const planCost = value?.planCost || 0;
        const actualCost = value?.actualCost || 0;
        
        return (
          <Box sx={{ fontSize: '0.75rem', textAlign: 'center', color: '#333333 !important' }}>
            {planCost > 0 && (
              <Box sx={{ color: '#2196f3 !important' }}>({planCost})</Box>
            )}
            {actualCost > 0 && (
              <Box sx={{ color: '#4caf50 !important' }}>({actualCost})</Box>
            )}
          </Box>
        );
      } else {
        // Text/number display
        return (
          <Box sx={{ 
            fontSize: '0.875rem', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            textAlign: column.type === 'number' ? 'center' : 'left',
            color: '#333333 !important'
          }}>
            {value || ''}
          </Box>
        );
      }
    }
  };

  return (
    <Box
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        height: 40, // Fixed height to match row height
        display: 'flex',
        alignItems: 'center',
        justifyContent: column.type === 'status' || column.type === 'cost' ? 'center' : 'flex-start',
        padding: '4px 8px',
        borderRight: '1px solid',
        borderColor: 'divider',
        backgroundColor: isSelected ? 'primary.light' : 'transparent',
        cursor: readOnly ? 'default' : 'pointer',
        color: '#333333', // Ensure text is visible
        '&:hover': {
          backgroundColor: isSelected ? 'primary.light' : 'action.hover'
        }
      }}
      onClick={onCellClick}
      onDoubleClick={onCellDoubleClick}
    >
      {renderCellContent()}
    </Box>
  );
};

export default MaintenanceCell;