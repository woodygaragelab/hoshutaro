import React, { useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridCell } from './GridCell';

interface GridRowProps {
  item: HierarchicalData;
  columns: GridColumn[];
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onRowResize: (rowId: string, height: number) => void;
  onRowAutoResize: (rowId: string) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange?: (startRow: string, startColumn: string, endRow: string, endColumn: string) => void;
  readOnly: boolean;
  isEven: boolean;
}

export const GridRow: React.FC<GridRowProps> = ({
  item,
  columns,
  gridState,
  onCellEdit,
  onRowResize,
  onRowAutoResize,
  onSelectedCellChange,
  onEditingCellChange,
  onSelectedRangeChange,
  readOnly,
  isEven
}) => {
  const rowHeight = gridState.rowHeights[item.id] || 40;
  const [isResizing, setIsResizing] = useState(false);

  const handleRowResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const startHeight = rowHeight;
    
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(startHeight + deltaY, 30); // Minimum height of 30px
      onRowResize(item.id, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowHeight, onRowResize, item.id]);

  const handleRowDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger on the resize handle area
    if (e.target === e.currentTarget) {
      onRowAutoResize(item.id);
    }
  }, [onRowAutoResize, item.id]);

  return (
    <Box 
      className={`grid-row ${isEven ? 'even' : 'odd'}`}
      sx={{ 
        display: 'flex',
        height: rowHeight,
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: isEven ? '#fafafa' : '#ffffff',
        position: 'relative',
        '&:hover': {
          backgroundColor: '#f0f0f0'
        },
        '&:hover .row-resize-handle': {
          opacity: 1
        }
      }}
    >
      {columns.map((column, index) => (
        <GridCell
          key={`${item.id}-${column.id}`}
          item={item}
          column={column}
          gridState={gridState}
          onCellEdit={onCellEdit}
          onSelectedCellChange={onSelectedCellChange}
          onEditingCellChange={onEditingCellChange}
          onSelectedRangeChange={onSelectedRangeChange}
          readOnly={readOnly}
          isLastColumn={index === columns.length - 1}
        />
      ))}
      
      {/* Row resize handle */}
      <Box
        className="row-resize-handle"
        onMouseDown={handleRowResizeMouseDown}
        onDoubleClick={handleRowDoubleClick}
        sx={{
          position: 'absolute',
          bottom: -2,
          left: 0,
          right: 0,
          height: 4,
          cursor: 'row-resize',
          backgroundColor: 'transparent',
          opacity: 0,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: '#2196f3',
            opacity: 0.7
          },
          ...(isResizing && {
            backgroundColor: '#2196f3',
            opacity: 0.7
          })
        }}
      />
    </Box>
  );
};