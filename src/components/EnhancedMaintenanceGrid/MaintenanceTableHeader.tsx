import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { DragIndicator as DragIcon } from '@mui/icons-material';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';

interface MaintenanceTableHeaderProps {
  columns: GridColumn[];
  gridState: GridState;
  onColumnResize: (columnId: string, width: number) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onDragStateChange?: (draggedIndex: number | null, dragOverIndex: number | null) => void;
}

export const MaintenanceTableHeader: React.FC<MaintenanceTableHeaderProps> = ({
  columns,
  gridState,
  onColumnResize,
  onColumnReorder,
  onDragStateChange
}) => {
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  
  // ドラッグ&ドロップの状態管理
  const [dragState, setDragState] = useState<{
    draggedIndex: number | null;
    dragOverIndex: number | null;
    isDragging: boolean;
  }>({
    draggedIndex: null,
    dragOverIndex: null,
    isDragging: false,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  
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

  // 列の並び替え処理
  const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !onColumnReorder) return;
    
    // 機器仕様列のみ並び替え可能
    const specColumns = columns.filter(col => col.id.startsWith('spec_'));
    const fromCol = columns[fromIndex];
    const toCol = columns[toIndex];
    
    if (!fromCol?.id.startsWith('spec_') || !toCol?.id.startsWith('spec_')) {
      return; // 機器仕様列以外は並び替え不可
    }
    
    // 機器仕様列内でのインデックスを計算
    const specFromIndex = specColumns.findIndex(col => col.id === fromCol.id);
    const specToIndex = specColumns.findIndex(col => col.id === toCol.id);
    
    if (specFromIndex !== -1 && specToIndex !== -1) {
      onColumnReorder(specFromIndex, specToIndex);
    }
  }, [columns, onColumnReorder]);

  // 長押し開始
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    const column = columns[index];
    
    console.log('[Header] Mouse down on column:', column?.id, 'index:', index);
    
    // 機器仕様列のみドラッグ可能
    if (!column?.id.startsWith('spec_')) {
      console.log('[Header] Not a spec column, ignoring');
      return;
    }
    
    // リサイズハンドルをクリックした場合はドラッグしない
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) {
      console.log('[Header] Clicked on resize handle, ignoring');
      return;
    }

    console.log('[Header] Starting long press timer');
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      console.log('[Header] Long press triggered, starting drag for index:', index);
      const newDragState = {
        draggedIndex: index,
        dragOverIndex: null,
        isDragging: true,
      };
      setDragState(newDragState);
      if (onDragStateChange) {
        onDragStateChange(index, null);
      }
    }, 500); // 500ms長押しでドラッグ開始
  }, [columns, onDragStateChange]);

  // マウス移動（ドラッグ中）
  const handleHeaderMouseMove = useCallback((e: React.MouseEvent, index: number) => {
    if (!dragState.isDragging) {
      // 長押し判定中に移動したらキャンセル
      if (longPressTimerRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 10) { // 10px以上動いたらキャンセル
          console.log('[Header] Movement detected during long press, canceling');
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    const column = columns[index];
    // 機器仕様列のみドロップ可能
    if (!column?.id.startsWith('spec_')) return;

    if (dragState.draggedIndex !== null && index !== dragState.dragOverIndex) {
      console.log('[Header] Drag over index:', index);
      setDragState(prev => ({
        ...prev,
        dragOverIndex: index,
      }));
      if (onDragStateChange) {
        onDragStateChange(dragState.draggedIndex, index);
      }
    }
  }, [dragState, columns, onDragStateChange]);

  // マウスアップ（ドロップ）
  const handleHeaderMouseUp = useCallback(() => {
    console.log('[Header] Mouse up', { isDragging: dragState.isDragging, draggedIndex: dragState.draggedIndex, dragOverIndex: dragState.dragOverIndex });
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (dragState.isDragging && dragState.draggedIndex !== null && dragState.dragOverIndex !== null) {
      console.log('[Header] Calling handleColumnReorder', dragState.draggedIndex, dragState.dragOverIndex);
      handleColumnReorder(dragState.draggedIndex, dragState.dragOverIndex);
    }

    setDragState({
      draggedIndex: null,
      dragOverIndex: null,
      isDragging: false,
    });
    dragStartPosRef.current = null;
    
    if (onDragStateChange) {
      onDragStateChange(null, null);
    }
  }, [dragState, handleColumnReorder, onDragStateChange]);

  // マウスリーブ（ドラッグキャンセル）
  const handleHeaderMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // グローバルマウスイベントリスナー（ドラッグ中）
  useEffect(() => {
    if (dragState.isDragging) {
      const handleGlobalMouseUp = () => {
        handleHeaderMouseUp();
      };
      
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragState.isDragging, handleHeaderMouseUp]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
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
      style={{
        borderBottom: '1px solid #333333'
      }}
    >
      {columns.map((column, index) => {
        const width = gridState.columnWidths[column.id] || column.width;
        const isLastColumn = index === columns.length - 1;
        const isSpecColumn = column.id.startsWith('spec_');
        const isDragged = dragState.isDragging && dragState.draggedIndex === index;
        const isDragOver = dragState.isDragging && dragState.dragOverIndex === index;
        
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
              position: 'relative',
              backgroundColor: '#2a2a2a',
              userSelect: 'none',
              overflow: 'hidden',
              height: '100%',
              boxSizing: 'border-box',
              cursor: isSpecColumn && !resizing ? 'grab' : 'default',
              transform: isDragged ? 'translateY(-4px)' : 'translateY(0)',
              opacity: isDragged ? 0.5 : 1,
              transition: 'all 0.2s ease-in-out',
              boxShadow: isDragged ? '0 4px 8px rgba(0,0,0,0.3)' : 'none',
              borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
              borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
              outline: 'none',
              '&:focus': {
                outline: 'none',
              },
              '&:active': {
                cursor: isSpecColumn && dragState.isDragging ? 'grabbing' : 'default',
                outline: 'none',
              },
            }}
            style={{
              borderRight: isLastColumn ? 'none' : '1px solid #333333'
            }}
            onMouseDown={(e) => handleHeaderMouseDown(e, index)}
            onMouseMove={(e) => handleHeaderMouseMove(e, index)}
            onMouseUp={handleHeaderMouseUp}
            onMouseLeave={handleHeaderMouseLeave}
          >
            {isSpecColumn && (
              <DragIcon 
                sx={{ 
                  mr: 0.5,
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.3)',
                }} 
              />
            )}
            
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
              title={`Header: ${column.header} (${column.id})${isSpecColumn ? ' - 長押しで並び替え' : ''}`}
            >
              {column.header}
            </Typography>
            
            {/* Resize handle */}
            {column.resizable && (
              <Box
                data-resize-handle
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