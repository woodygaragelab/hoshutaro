import React, { useCallback, useState, useRef, useEffect } from 'react';
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
  onCellDoubleClick?: (rowId: string, columnId: string, event: React.MouseEvent<HTMLElement>) => void;
  readOnly: boolean;
  draggedColumnIndex?: number | null;
  dragOverColumnIndex?: number | null;
  enableVirtualScrolling?: boolean;
  virtualOffset?: number;
  displayColumns?: GridColumn[];
}
import MaintenanceCell from './MaintenanceCell';

const MaintenanceTableRowComponent: React.FC<MaintenanceTableRowProps> = ({
  item,
  columns,
  viewMode,
  gridState,
  onCellEdit,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onCellDoubleClick,
  readOnly,
  draggedColumnIndex,
  dragOverColumnIndex,
  enableVirtualScrolling = false,
  virtualOffset = 0,
  displayColumns
}) => {
  // Use displayColumns if provided (for virtual scrolling), otherwise use all columns
  const columnsToRender = displayColumns || columns;
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInputValue, setTaskInputValue] = useState(item.task);

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



  // Handle bomCode click (no inline editing, use dialog instead)
  const handleBomCodeClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    // Don't start inline editing, let double-click handle it
    e.stopPropagation();
  }, [readOnly]);

  // Get cell value based on column accessor
  const getCellValue = useCallback((column: any) => {
    const { id } = column;
    
    if (id === 'task') return item.task;
    if (id === 'bomCode') return item.bomCode;
    
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
  const handleCellDoubleClick = useCallback((columnId: string, event: React.MouseEvent<HTMLElement>) => {
    if (readOnly) return;
    
    const column = columns.find(col => col.id === columnId);
    if (column?.editable) {
      // Use the enhanced double-click handler if provided
      if (onCellDoubleClick) {
        onCellDoubleClick(item.id, columnId, event);
      } else {
        // Fallback to the original behavior
        onEditingCellChange(item.id, columnId);
      }
    }
  }, [item.id, columns, readOnly, onCellDoubleClick, onEditingCellChange]);

  // Ref for the row element
  const rowRef = useRef<HTMLDivElement>(null);

  // Force border style on mount and update
  useEffect(() => {
    if (rowRef.current) {
      rowRef.current.style.borderBottom = '1px solid #333333';
    }
  }, []);

  // Calculate total row width based on columns
  const totalRowWidth = columns.reduce((sum, col) => {
    return sum + (gridState.columnWidths[col.id] || col.width);
  }, 0);

  return (
    <Box
      ref={rowRef}
      sx={{
        display: 'flex',
        height: 40,
        width: `${totalRowWidth}px`,
        minWidth: `${totalRowWidth}px`,
        alignItems: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
        backgroundColor: 'transparent',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      style={{
        borderBottom: '1px solid #333333'
      }}
      data-row-id={item.id}
    >
      {enableVirtualScrolling && virtualOffset > 0 && (
        <Box sx={{ width: virtualOffset, flexShrink: 0 }} />
      )}
      {columnsToRender.map((column, displayIndex) => {
        const columnIndex = enableVirtualScrolling ? 
          columns.findIndex(c => c.id === column.id) : 
          displayIndex;
        const width = gridState.columnWidths[column.id] || column.width;
        const isSelected = gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === column.id;
        const isEditing = gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === column.id;
        const isDragged = draggedColumnIndex !== null && draggedColumnIndex === columnIndex;
        const isDragOver = dragOverColumnIndex !== null && dragOverColumnIndex === columnIndex;
        
        // Special handling for task, bomCode, and cycle columns to maintain existing behavior
        if (column.id === 'task') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          return (
            <Box
              key={column.id}
              className={isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'}
              sx={{
                width,
                minWidth: width,
                maxWidth: width,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: isSelected ? '#ffffff' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0,
                opacity: isDragged ? 0.5 : 1,
                transform: isDragged ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isDragged ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333'),
              }}
              style={{
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333')
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
                  <Box className="cell-content" sx={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.task}
                  </Box>
                )}
              </Box>
            </Box>
          );
        }
        
        if (column.id === 'bomCode') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          return (
            <Box
              key={column.id}
              className={isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'}
              sx={{
                width,
                minWidth: width,
                maxWidth: width,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: isSelected ? '#ffffff' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0,
                opacity: isDragged ? 0.5 : 1,
                transform: isDragged ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isDragged ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333'),
              }}
              style={{
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333')
              }}
              onClick={() => handleCellClick(column.id)}
              onDoubleClick={(e) => handleCellDoubleClick(column.id, e)}
            >
              <Box sx={{ width: '100%' }} onClick={handleBomCodeClick}>
                <Box className="cell-content" sx={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.bomCode || ''}
                </Box>
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
            onCellDoubleClick={(event) => handleCellDoubleClick(column.id, event)}
            readOnly={readOnly}
            width={width}
            showRightBorder={!isLastColumn}
            isDragged={isDragged}
            isDragOver={isDragOver}
          />
        );
      })}
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceTableRow = React.memo(MaintenanceTableRowComponent);

export default MaintenanceTableRow;
