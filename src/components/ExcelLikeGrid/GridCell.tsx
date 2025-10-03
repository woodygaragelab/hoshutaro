import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { getCellValue } from './utils/clipboardUtils';

interface GridCellProps {
  item: HierarchicalData;
  column: GridColumn;
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange?: (startRow: string, startColumn: string, endRow: string, endColumn: string) => void;
  readOnly: boolean;
  isLastColumn: boolean;
}

export const GridCell: React.FC<GridCellProps> = ({
  item,
  column,
  gridState,
  onCellEdit,
  onSelectedCellChange,
  onEditingCellChange,
  onSelectedRangeChange,
  readOnly,
  isLastColumn
}) => {
  const cellWidth = gridState.columnWidths[column.id] || column.width;
  const isSelected = gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === column.id;
  const isEditing = gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === column.id;
  
  // Check if cell is in selected range
  const isInRange = gridState.selectedRange && (
    (gridState.selectedRange.startRow === item.id && gridState.selectedRange.startColumn === column.id) ||
    (gridState.selectedRange.endRow === item.id && gridState.selectedRange.endColumn === column.id) ||
    // Add logic to check if cell is within the range bounds
    // This is a simplified check - in a full implementation, you'd need to calculate row/column indices
    false
  );
  
  const [editValue, setEditValue] = useState('');
  const [originalValue, setOriginalValue] = useState(''); // Store original value for Esc cancellation
  const [isDragging, setIsDragging] = useState(false);
  const cellValue = getCellValue(item, column);

  useEffect(() => {
    if (isEditing) {
      const currentValue = String(cellValue || '');
      setEditValue(currentValue);
      setOriginalValue(currentValue); // Store original value when editing starts
    }
  }, [isEditing, cellValue]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!readOnly) {
      // If Shift is held and there's already a selected cell, create a range
      if (e.shiftKey && gridState.selectedCell && onSelectedRangeChange) {
        onSelectedRangeChange(
          gridState.selectedCell.rowId,
          gridState.selectedCell.columnId,
          item.id,
          column.id
        );
      } else {
        onSelectedCellChange(item.id, column.id);
        // Requirement 3.1: Click to enter inline editing mode (if editable)
        if (column.editable && !e.shiftKey) {
          onEditingCellChange(item.id, column.id);
        }
      }
    }
  }, [readOnly, onSelectedCellChange, onEditingCellChange, onSelectedRangeChange, item.id, column.id, column.editable, gridState.selectedCell]);

  const handleDoubleClick = useCallback(() => {
    // Keep double-click for backward compatibility, but single click now also starts editing
    if (!readOnly && column.editable) {
      onEditingCellChange(item.id, column.id);
    }
  }, [readOnly, column.editable, onEditingCellChange, item.id, column.id]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!readOnly && e.button === 0) { // Left mouse button only
      setIsDragging(true);
      onSelectedCellChange(item.id, column.id);
      
      // Prevent text selection during drag
      e.preventDefault();
    }
  }, [readOnly, onSelectedCellChange, item.id, column.id]);

  const handleMouseEnter = useCallback(() => {
    if (isDragging && onSelectedRangeChange && gridState.selectedCell) {
      onSelectedRangeChange(
        gridState.selectedCell.rowId,
        gridState.selectedCell.columnId,
        item.id,
        column.id
      );
    }
  }, [isDragging, onSelectedRangeChange, gridState.selectedCell, item.id, column.id]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Add global mouse up listener to handle drag end
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };
      
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCellEdit(item.id, column.id, editValue);
        onEditingCellChange(null, null);
      } else if (e.key === 'Escape') {
        // Requirement 3.10: Esc key cancels editing and reverts to original value
        e.preventDefault();
        setEditValue(originalValue); // Revert to original value
        onEditingCellChange(null, null);
      } else if (e.key === 'Tab') {
        // Let the grid handle Tab navigation
        e.preventDefault();
        onCellEdit(item.id, column.id, editValue);
        onEditingCellChange(null, null);
        // The grid will handle the navigation
      }
    }
    // Remove the else if block for Enter key when not editing - let the grid handle it
  }, [isEditing, editValue, originalValue, item, column, onCellEdit, onEditingCellChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    // Only save changes if the value actually changed
    if (editValue !== originalValue) {
      onCellEdit(item.id, column.id, editValue);
    }
    onEditingCellChange(null, null);
  }, [editValue, originalValue, item, column, onCellEdit, onEditingCellChange]);

  const renderCellContent = () => {
    if (isEditing) {
      return (
        <input
          type={column.type === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            padding: '4px 8px',
            fontSize: '14px',
            backgroundColor: 'transparent'
          }}
        />
      );
    }

    return (
      <Typography
        variant="body2"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%'
        }}
      >
        {String(cellValue || '')}
      </Typography>
    );
  };

  return (
    <Box
      className={`grid-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${isInRange ? 'in-range' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
      sx={{
        width: cellWidth,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRight: !isLastColumn ? '1px solid #e0e0e0' : 'none',
        cursor: column.editable && !readOnly ? 'pointer' : 'default',
        backgroundColor: isSelected ? '#e3f2fd' : 
                        isEditing ? '#f1f8e9' : 
                        isInRange ? '#e8f5e8' : 
                        'transparent',
        border: isSelected ? '2px solid #2196f3' : 
                isEditing ? '2px solid #4caf50' : 
                isInRange ? '1px solid #4caf50' : 
                '2px solid transparent',
        boxSizing: 'border-box',
        position: 'relative',
        userSelect: isDragging ? 'none' : 'auto',
        '&:focus': {
          outline: 'none'
        },
        '&:hover': {
          backgroundColor: !isSelected && !isEditing && !isInRange ? '#f5f5f5' : undefined
        }
      }}
    >
      {renderCellContent()}
    </Box>
  );
};