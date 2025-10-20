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
  
  // Debug logging to check if header is receiving columns
  console.log('MaintenanceTableHeader rendering with columns count:', columns.length);
  console.log('First 10 columns:', columns.slice(0, 10).map(c => ({ id: c.id, header: c.header })));
  console.log('Column types:', columns.reduce((acc, col) => {
    const type = col.id.startsWith('spec_') ? 'spec' : 
                 col.id.startsWith('time_') ? 'time' : 'fixed';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>));
  
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

  // Debug: Force visibility for troubleshooting
  if (columns.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex !important',
          borderBottom: '2px solid red',
          backgroundColor: '#ff0000',
          height: 40,
          alignItems: 'center',
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          justifyContent: 'center'
        }}
      >
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
          ヘッダー: 列がありません
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex !important',
        borderBottom: '1px solid #333333',
        backgroundColor: '#2a2a2a',
        height: '40px !important',
        minHeight: '40px !important',
        alignItems: 'center',
        width: `${totalColumnsWidth}px`,
        minWidth: `${totalColumnsWidth}px`,
        overflow: 'visible',
        flexShrink: 0,
        position: 'relative',
        top: 0,
        zIndex: 100,
        visibility: 'visible !important',
        boxSizing: 'border-box'
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
              display: 'flex !important',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              borderRight: isLastColumn ? 'none' : '1px solid #333333',
              position: 'relative',
              backgroundColor: '#2a2a2a',
              userSelect: 'none',
              overflow: 'hidden',
              height: '100%',
              boxSizing: 'border-box'
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
                color: '#ffffff'
              }}
              title={`Header: ${column.header} (${column.id})`}
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