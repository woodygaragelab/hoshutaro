import React, { useState, useCallback, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { GridColumn } from './types';

interface GridHeaderProps {
  columns: GridColumn[];
  columnWidths: { [columnId: string]: number };
  onColumnResize: (columnId: string, width: number) => void;
  onColumnAutoResize: (columnId: string) => void;
  totalWidth: number;
  showBorder?: boolean;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  columns,
  columnWidths,
  onColumnResize,
  onColumnAutoResize,
  totalWidth,
  showBorder = true
}) => {
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[columnId] || columns.find(col => col.id === columnId)?.width || 100;
    
    setResizing({ columnId, startX, startWidth });

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const column = columns.find(col => col.id === columnId);
      const minWidth = column?.minWidth || 50;
      const maxWidth = column?.maxWidth;
      
      let newWidth = Math.max(startWidth + deltaX, minWidth);
      if (maxWidth) {
        newWidth = Math.min(newWidth, maxWidth);
      }
      
      onColumnResize(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, onColumnResize, columns]);

  const handleDoubleClick = useCallback((columnId: string) => {
    // Clear any existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    // Auto-resize column to fit content
    onColumnAutoResize(columnId);
  }, [onColumnAutoResize]);

  return (
    <Box 
      className="grid-header"
      sx={{ 
        display: 'flex',
        borderBottom: showBorder ? '2px solid #e0e0e0' : 'none',
        backgroundColor: '#f5f5f5',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        minWidth: totalWidth
      }}
    >
      {columns.map((column, index) => (
        <Box
          key={column.id}
          className="grid-header-cell"
          sx={{
            width: columnWidths[column.id] || column.width,
            minWidth: column.minWidth,
            maxWidth: column.maxWidth,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            borderRight: index < columns.length - 1 ? '1px solid #e0e0e0' : 'none',
            position: 'relative',
            userSelect: 'none'
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}
          >
            {column.header}
          </Typography>
          
          {column.resizable && (
            <Box
              className="resize-handle"
              onMouseDown={(e) => handleMouseDown(e, column.id)}
              onDoubleClick={() => handleDoubleClick(column.id)}
              sx={{
                position: 'absolute',
                right: -2,
                top: 0,
                bottom: 0,
                width: 4,
                cursor: 'col-resize',
                backgroundColor: 'transparent',
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: '#2196f3',
                  opacity: 0.7
                }
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
};