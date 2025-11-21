import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { DragIndicator as DragIcon } from '@mui/icons-material';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import { useHorizontalVirtualScrolling } from '../VirtualScrolling/useHorizontalVirtualScrolling';

interface MaintenanceTableHeaderProps {
  columns: GridColumn[];
  gridState: GridState;
  onColumnResize: (columnId: string, width: number) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onDragStateChange?: (draggedIndex: number | null, dragOverIndex: number | null) => void;
  enableVirtualScrolling?: boolean;
  containerWidth?: number;
  scrollLeft?: number;
}

const MaintenanceTableHeaderComponent: React.FC<MaintenanceTableHeaderProps> = ({
  columns,
  gridState,
  onColumnResize,
  onColumnReorder,
  onDragStateChange,
  enableVirtualScrolling = false,
  containerWidth = 1920,
  scrollLeft = 0
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
  
  // Calculate total width of all columns
  const totalColumnsWidth = columns.reduce((sum, col) => {
    return sum + (gridState.columnWidths[col.id] || col.width);
  }, 0);

  // Horizontal virtual scrolling
  const shouldUseVirtualScrolling = enableVirtualScrolling && columns.length > 50;
  
  const virtualScrolling = useHorizontalVirtualScrolling({
    columns,
    columnWidth: (index) => gridState.columnWidths[columns[index].id] || columns[index].width,
    containerWidth,
    overscan: 5,
    enableMemoization: true,
  });

  // Update virtual scrolling when scrollLeft changes
  useEffect(() => {
    if (shouldUseVirtualScrolling) {
      virtualScrolling.handleScroll(scrollLeft);
    }
  }, [scrollLeft, shouldUseVirtualScrolling]);

  // Use virtual columns if enabled, otherwise use all columns
  const displayColumns = shouldUseVirtualScrolling ? 
    virtualScrolling.visibleColumns.map(vc => vc.data) : 
    columns;

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
    
    // 機器仕様列のみドラッグ可能
    if (!column?.id.startsWith('spec_')) return;
    
    // リサイズハンドルをクリックした場合はドラッグしない
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      const newDragState = {
        draggedIndex: index,
        dragOverIndex: null,
        isDragging: true,
      };
      setDragState(newDragState);
      if (onDragStateChange) {
        onDragStateChange(index, null);
      }
    }, 500);
  }, [columns, onDragStateChange]);

  // マウス移動（ドラッグ中）
  const handleHeaderMouseMove = useCallback((e: React.MouseEvent, index: number) => {
    if (!dragState.isDragging) {
      // 長押し判定中に移動したらキャンセル
      if (longPressTimerRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 10) {
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
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (dragState.isDragging && dragState.draggedIndex !== null && dragState.dragOverIndex !== null) {
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

  // Calculate offset for virtual scrolling
  const virtualOffset = shouldUseVirtualScrolling && virtualScrolling.visibleColumns.length > 0 ?
    virtualScrolling.visibleColumns[0].left : 0;

  return (
    <Box
      sx={{
        display: 'flex !important',
        backgroundColor: '#2a2a2a',
        height: '40px !important',
        minHeight: '40px !important',
        alignItems: 'center',
        width: shouldUseVirtualScrolling ? `${virtualScrolling.totalWidth}px` : `${totalColumnsWidth}px`,
        minWidth: shouldUseVirtualScrolling ? `${virtualScrolling.totalWidth}px` : `${totalColumnsWidth}px`,
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
      {shouldUseVirtualScrolling && virtualOffset > 0 && (
        <Box sx={{ width: virtualOffset, flexShrink: 0 }} />
      )}
      {displayColumns.map((column, displayIndex) => {
        const actualIndex = shouldUseVirtualScrolling ? 
          columns.findIndex(c => c.id === column.id) : 
          displayIndex;
        const width = gridState.columnWidths[column.id] || column.width;
        const isLastColumn = actualIndex === columns.length - 1;
        const isSpecColumn = column.id.startsWith('spec_');
        const isDragged = dragState.isDragging && dragState.draggedIndex === actualIndex;
        const isDragOver = dragState.isDragging && dragState.dragOverIndex === actualIndex;
        
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
            onMouseDown={(e) => handleHeaderMouseDown(e, actualIndex)}
            onMouseMove={(e) => handleHeaderMouseMove(e, actualIndex)}
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

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceTableHeader = React.memo(MaintenanceTableHeaderComponent);

export default MaintenanceTableHeader;