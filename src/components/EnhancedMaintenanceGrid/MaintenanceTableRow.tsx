import React, { useCallback, useState } from 'react';
import { Box, TextField } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';

interface MaintenanceTableRowProps {
  item: HierarchicalData;
  columns: GridColumn[];
  viewMode: 'status' | 'cost';
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  readOnly: boolean;
}
import MaintenanceCell from './MaintenanceCell';

export const MaintenanceTableRow: React.FC<MaintenanceTableRowProps> = ({
  item,
  columns,
  viewMode,
  gridState,
  onCellEdit,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  readOnly
}) => {
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInputValue, setTaskInputValue] = useState(item.task);
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleInputValue, setCycleInputValue] = useState(item.cycle || '');

  // Handle task editing (similar to existing TableRow logic)
  const handleTaskClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    setIsEditingTask(true);
    e.stopPropagation();
  }, [readOnly]);

  const handleTaskBlur = useCallback(() => {
    if (taskInputValue.trim() !== item.task) {
      onUpdateItem({ ...item, task: taskInputValue.trim() });
    }
    setIsEditingTask(false);
  }, [taskInputValue, item, onUpdateItem]);

  const handleTaskKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setTaskInputValue(item.task);
      setIsEditingTask(false);
    }
  }, [item.task]);

  // Handle cycle editing (similar to existing TableRow logic)
  const handleCycleClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    setIsEditingCycle(true);
    e.stopPropagation();
  }, [readOnly]);

  const handleCycleBlur = useCallback(() => {
    const newCycle = parseInt(cycleInputValue as string, 10);
    if (newCycle !== item.cycle) {
      onUpdateItem({ ...item, cycle: isNaN(newCycle) ? undefined : newCycle });
    }
    setIsEditingCycle(false);
  }, [cycleInputValue, item, onUpdateItem]);

  const handleCycleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setCycleInputValue(item.cycle || '');
      setIsEditingCycle(false);
    }
  }, [item.cycle]);

  // Get cell value based on column accessor
  const getCellValue = useCallback((column: any) => {
    const { id } = column;
    
    if (id === 'task') return item.task;
    if (id === 'bomCode') return item.bomCode;
    if (id === 'cycle') return item.cycle;
    
    // Handle specification columns
    if (id.startsWith('spec_')) {
      const specKey = id.replace('spec_', '');
      const spec = item.specifications?.find(s => s.key === specKey);
      return spec?.value || '';
    }
    
    // Handle time columns
    if (id.startsWith('time_')) {
      const timeHeader = id.replace('time_', '');
      const result = item.results?.[timeHeader];
      
      if (viewMode === 'cost') {
        return result ? { planCost: result.planCost, actualCost: result.actualCost } : { planCost: 0, actualCost: 0 };
      } else {
        return result ? { planned: result.planned, actual: result.actual } : { planned: false, actual: false };
      }
    }
    
    return '';
  }, [item, viewMode]);

  // Handle cell click for selection
  const handleCellClick = useCallback((columnId: string) => {
    onSelectedCellChange(item.id, columnId);
  }, [item.id, onSelectedCellChange]);

  // Handle cell double click for editing
  const handleCellDoubleClick = useCallback((columnId: string) => {
    if (readOnly) return;
    
    const column = columns.find(col => col.id === columnId);
    if (column?.editable) {
      onEditingCellChange(item.id, columnId);
    }
  }, [item.id, columns, readOnly, onEditingCellChange]);



  return (
    <Box
      sx={{
        display: 'flex',
        height: 40, // Fixed height instead of minHeight
        borderBottom: '1px solid',
        borderColor: 'divider',
        alignItems: 'center', // Ensure vertical alignment
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      data-row-id={item.id}
    >
      {columns.map((column) => {
        const width = gridState.columnWidths[column.id] || column.width;
        const isSelected = gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === column.id;
        const isEditing = gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === column.id;
        
        // Special handling for task and cycle columns to maintain existing behavior
        if (column.id === 'task') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          return (
            <Box
              key={column.id}
              sx={{
                width,
                minWidth: width,
                maxWidth: width,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRight: isLastColumn ? 'none' : '1px solid',
                borderColor: 'divider',
                backgroundColor: isSelected ? 'primary.light' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer'
              }}
              onClick={() => handleCellClick(column.id)}
            >
              <Box sx={{ width: '100%' }} onClick={handleTaskClick}>
                {isEditingTask ? (
                  <TextField
                    value={taskInputValue}
                    onChange={(e) => setTaskInputValue(e.target.value)}
                    onBlur={handleTaskBlur}
                    onKeyDown={handleTaskKeyDown}
                    autoFocus
                    fullWidth
                    variant="standard"
                    size="small"
                    sx={{ '& .MuiInput-root': { fontSize: '0.875rem' } }}
                  />
                ) : (
                  <Box sx={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', color: '#333333 !important' }}>
                    {item.task}
                  </Box>
                )}
              </Box>
            </Box>
          );
        }
        
        if (column.id === 'cycle') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          return (
            <Box
              key={column.id}
              sx={{
                width,
                minWidth: width,
                maxWidth: width,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
                borderRight: isLastColumn ? 'none' : '1px solid',
                borderColor: 'divider',
                backgroundColor: isSelected ? 'primary.light' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer'
              }}
              onClick={() => handleCellClick(column.id)}
            >
              <Box sx={{ width: '100%', textAlign: 'center' }} onClick={handleCycleClick}>
                {isEditingCycle ? (
                  <TextField
                    value={cycleInputValue}
                    onChange={(e) => setCycleInputValue(e.target.value)}
                    onBlur={handleCycleBlur}
                    onKeyDown={handleCycleKeyDown}
                    autoFocus
                    fullWidth
                    variant="standard"
                    size="small"
                    type="number"
                    sx={{ '& .MuiInput-root': { fontSize: '0.875rem', textAlign: 'center' } }}
                  />
                ) : (
                  <Box sx={{ fontSize: '0.875rem', color: '#333333 !important' }}>
                    {item.cycle || ''}
                  </Box>
                )}
              </Box>
            </Box>
          );
        }
        
        // For all other columns, use the MaintenanceCell component
        const cellValue = getCellValue(column);
        const isLastColumn = columns.indexOf(column) === columns.length - 1;
        
        return (
          <MaintenanceCell
            key={column.id}
            item={item}
            column={column}
            value={cellValue}
            viewMode={viewMode}
            isSelected={isSelected}
            isEditing={isEditing}
            onCellEdit={onCellEdit}
            onCellClick={() => handleCellClick(column.id)}
            onCellDoubleClick={() => handleCellDoubleClick(column.id)}
            readOnly={readOnly}
            width={width}
            showRightBorder={!isLastColumn}
          />
        );
      })}
    </Box>
  );
};

export default MaintenanceTableRow;