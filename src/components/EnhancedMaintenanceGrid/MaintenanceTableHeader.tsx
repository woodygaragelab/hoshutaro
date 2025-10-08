import React, { useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';

interface MaintenanceTableHeaderProps {
  columns: GridColumn[];
  gridState: GridState;
  onColumnResize: (columnId: string, width: number) => void;
}

export const MaintenanceTableHeader: React.FC<MaintenanceTableHeaderProps> = ({
  columns,
  gridState,
  onColumnResize
}) => {
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  
  // Calculate total width of all columns
  const totalColumnsWidth = columns.reduce((sum, col) => {
    return sum + (gridState.columnWidths[col.id] || col.width);
  }, 0);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.resizable) return;

    e.preventDefault();
    setResizing({
      columnId,
      startX: e.clientX,
      startWidth: gridState.columnWidths[columnId] || column.width
    });
  }, [columns, gridState.columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;

    const deltaX = e.clientX - resizing.startX;
    const newWidth = Math.max(
      columns.find(col => col.id === resizing.columnId)?.minWidth || 50,
      resizing.startWidth + deltaX
    );

    onColumnResize(resizing.columnId, newWidth);
  }, [resizing, columns, onColumnResize]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  // Add global mouse event listeners for resizing
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  return (
    <Box
      sx={{
        display: 'flex',
        borderBottom: '1px solid',
        borderColor: '#333333',
        backgroundColor: '#2a2a2a',
        height: 40,
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}
    >
      {columns.map((column, index) => {
        const width = gridState.columnWidths[column.id] || column.width;
        const isLastColumn = index === columns.length - 1;
        
        return (
          <Box
            key={column.id}
            sx={{
              width,
              minWidth: width,
              maxWidth: width,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              borderRight: isLastColumn ? 'none' : '1px solid',
              borderColor: '#333333',
              position: 'relative',
              backgroundColor: '#2a2a2a',
              userSelect: 'none',
              overflow: 'hidden'
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.875rem',
                color: '#ffffff !important',
                textShadow: 'none'
              }}
            >
              {column.header}
            </Typography>
            
            {/* Resize handle */}
            {column.resizable && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  cursor: 'col-resize',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    opacity: 0.3
                  }
                }}
                onMouseDown={(e) => handleMouseDown(e, column.id)}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default MaintenanceTableHeader;