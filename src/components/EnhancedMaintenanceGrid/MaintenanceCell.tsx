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
  onCellDoubleClick: (event: React.MouseEvent<HTMLElement>) => void;
  readOnly: boolean;
  width: number;
  showRightBorder?: boolean;
  isDragged?: boolean;
  isDragOver?: boolean;
}

const MaintenanceCellComponent: React.FC<MaintenanceCellProps> = ({
  item,
  column,
  value,
  isSelected,
  isEditing,
  onCellEdit,
  onCellClick,
  onCellDoubleClick,
  readOnly,
  width,
  showRightBorder = true,
  isDragged = false,
  isDragOver = false
}) => {
  const [editValue, setEditValue] = useState(value);

  // Update edit value when value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleEditComplete = useCallback(() => {
    let finalValue = editValue;
    
    // コスト入力時に星取表のステータスを自動更新
    if (column.type === 'cost') {
      const planCost = editValue?.planCost || 0;
      const actualCost = editValue?.actualCost || 0;
      
      // 計画コストが入力されている場合、plannedをtrueに
      const planned = planCost > 0;
      // 実績コストが入力されている場合、actualをtrueに
      const actual = actualCost > 0;
      
      finalValue = {
        ...editValue,
        planCost,
        actualCost,
        planned,
        actual
      };
    }
    
    // 値が変更されているかチェック（コストの場合は常に更新）
    const hasChanged = column.type === 'cost' || editValue !== value;
    
    if (hasChanged) {
      onCellEdit(item.id, column.id, finalValue);
    }
  }, [editValue, value, onCellEdit, item.id, column.id, column.type]);

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
        const handlePlanCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newPlanCost = parseFloat(e.target.value) || 0;
          const currentActualCost = editValue?.actualCost || 0;
          setEditValue({ 
            ...editValue, 
            planCost: newPlanCost,
            planned: newPlanCost > 0, // 計画コストが入力されたらplannedをtrueに
            actual: currentActualCost > 0 // 実績コストの状態を保持
          });
        };
        
        const handleActualCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newActualCost = parseFloat(e.target.value) || 0;
          const currentPlanCost = editValue?.planCost || 0;
          setEditValue({ 
            ...editValue, 
            actualCost: newActualCost,
            actual: newActualCost > 0, // 実績コストが入力されたらactualをtrueに
            planned: currentPlanCost > 0 // 計画コストの状態を保持
          });
        };
        
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <TextField
              value={editValue?.planCost || ''}
              onChange={handlePlanCostChange}
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
              onChange={handleActualCostChange}
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
          <Box className="cell-content" sx={{ textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
            {symbol}
          </Box>
        );
      } else if (column.type === 'cost') {
        const planCost = value?.planCost || 0;
        const actualCost = value?.actualCost || 0;
        
        // 千円単位に変換してフォーマット
        const formatCost = (cost: number) => {
          if (cost === 0) return '';
          const costInThousands = Math.round(cost / 1000);
          return new Intl.NumberFormat('ja-JP').format(costInThousands);
        };
        
        return (
          <Box className="cell-content" sx={{ fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.4 }}>
            {planCost > 0 && (
              <Box className="cost-plan" sx={{ color: 'primary.main' }}>{formatCost(planCost)}</Box>
            )}
            {actualCost > 0 && (
              <Box className="cost-actual" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>{formatCost(actualCost)}</Box>
            )}
          </Box>
        );
      } else {
        // Text/number display
        return (
          <Box 
            className="cell-content"
            sx={{ 
              fontSize: '0.875rem', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              textAlign: column.type === 'number' ? 'center' : 'left'
            }}
          >
            {value || ''}
          </Box>
        );
      }
    }
  };

  // Handle double click - only prevent default to avoid text selection
  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    // Check if any dropdown/menu is open - if so, don't handle the double click
    const hasOpenMenu = document.querySelector('.MuiMenu-root, .MuiPopover-root, .MuiSelect-root[aria-expanded="true"]');
    if (hasOpenMenu) {
      return; // Don't handle double click when menus are open
    }

    event.preventDefault(); // Prevent text selection
    onCellDoubleClick(event);
  }, [onCellDoubleClick]);

  // Handle single click
  const handleClick = useCallback(() => {
    onCellClick();
  }, [onCellClick]);

  return (
    <Box
      className={isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'}
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        height: 40, // Fixed height to match row height
        display: 'flex',
        alignItems: 'center',
        justifyContent: column.type === 'status' || column.type === 'cost' ? 'center' : 'flex-start',
        padding: '4px 8px',
        backgroundColor: isSelected ? '#ffffff' : 'transparent',
        cursor: readOnly ? 'default' : 'pointer',
        boxSizing: 'border-box', // Ensure borders are included in width calculation
        flexShrink: 0, // Prevent shrinking during scroll
        opacity: isDragged ? 0.5 : 1,
        transform: isDragged ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s ease-in-out',
        boxShadow: isDragged ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
        borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
        borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (showRightBorder ? '1px solid #333333' : 'none'),
        '&:hover': {
          backgroundColor: isSelected ? '#ffffff' : 'action.hover'
        }
      }}
      style={{
        borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (showRightBorder ? '1px solid #333333' : 'none')
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderCellContent()}
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceCell = React.memo(MaintenanceCellComponent);

export default MaintenanceCell;