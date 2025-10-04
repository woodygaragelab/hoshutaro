import React, { useCallback, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridRow } from './GridRow';

interface ListChildComponentProps {
  index: number;
  style: React.CSSProperties;
}

interface AdvancedVirtualizedGridBodyProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onRowResize: (rowId: string, height: number) => void;
  onRowAutoResize: (rowId: string) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange?: (startRow: string, startColumn: string, endRow: string, endColumn: string) => void;
  readOnly: boolean;
  totalWidth: number;
  height: number;
  showBorder?: boolean;
}

interface AdvancedVirtualizedGridBodyRef {
  scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  scrollToTop: () => void;
  resetAfterIndex: (index: number, shouldForceUpdate?: boolean) => void;
}

// Memoized row component with performance optimizations
const OptimizedGridRow = React.memo(GridRow, (prevProps, nextProps) => {
  // Custom comparison for better performance
  const prevItem = prevProps.item;
  const nextItem = nextProps.item;
  
  // Check if the item data has changed
  if (prevItem.id !== nextItem.id) return false;
  if (prevItem.task !== nextItem.task) return false;
  if (prevItem.bomCode !== nextItem.bomCode) return false;
  
  // Check if specifications have changed
  if (prevItem.specifications?.length !== nextItem.specifications?.length) return false;
  if (prevItem.specifications && nextItem.specifications) {
    for (let i = 0; i < prevItem.specifications.length; i++) {
      const prevSpec = prevItem.specifications[i];
      const nextSpec = nextItem.specifications[i];
      if (prevSpec.key !== nextSpec.key || prevSpec.value !== nextSpec.value) return false;
    }
  }
  
  // Check if maintenance data has changed
  const prevMaintenanceKeys = Object.keys(prevItem.results || {});
  const nextMaintenanceKeys = Object.keys(nextItem.results || {});
  if (prevMaintenanceKeys.length !== nextMaintenanceKeys.length) return false;
  
  for (const key of prevMaintenanceKeys) {
    const prevResult = prevItem.results?.[key];
    const nextResult = nextItem.results?.[key];
    if (prevResult?.planned !== nextResult?.planned || 
        prevResult?.actual !== nextResult?.actual ||
        prevResult?.planCost !== nextResult?.planCost ||
        prevResult?.actualCost !== nextResult?.actualCost) return false;
  }
  
  // Check if grid state affecting this row has changed
  const prevRowHeight = prevProps.gridState.rowHeights[prevItem.id];
  const nextRowHeight = nextProps.gridState.rowHeights[nextItem.id];
  if (prevRowHeight !== nextRowHeight) return false;
  
  // Check if selection state has changed
  const prevSelected = prevProps.gridState.selectedCell?.rowId === prevItem.id;
  const nextSelected = nextProps.gridState.selectedCell?.rowId === nextItem.id;
  if (prevSelected !== nextSelected) return false;
  
  // Check if editing state has changed
  const prevEditing = prevProps.gridState.editingCell?.rowId === prevItem.id;
  const nextEditing = nextProps.gridState.editingCell?.rowId === nextItem.id;
  if (prevEditing !== nextEditing) return false;
  
  // Check if columns have changed
  if (prevProps.columns.length !== nextProps.columns.length) return false;
  
  return true;
});

export const AdvancedVirtualizedGridBody = forwardRef<AdvancedVirtualizedGridBodyRef, AdvancedVirtualizedGridBodyProps>(({
  data,
  columns,
  gridState,
  onCellEdit,
  onRowResize,
  onRowAutoResize,
  onSelectedCellChange,
  onEditingCellChange,
  onSelectedRangeChange,
  readOnly,
  totalWidth,
  height,
  showBorder = true
}, ref) => {
  const listRef = useRef<any>(null);
  
  // For now, we'll use a simpler approach without dynamic row heights

  // Expose scroll methods through ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
      // For now, we'll use a simple scroll implementation
      if (listRef.current) {
        const itemHeight = gridState.rowHeights[data[index]?.id] || 40;
        const scrollTop = index * itemHeight;
        listRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    },
    scrollToTop: () => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    resetAfterIndex: (index: number, shouldForceUpdate?: boolean) => {
      // Reset height cache if needed
      if (shouldForceUpdate && listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollTop });
      }
    }
  }), [data, gridState.rowHeights]);

  // Calculate item height with dynamic support
  const getItemHeight = useCallback((index: number): number => {
    const item = data[index];
    if (!item) return 40;
    
    // Get height from grid state or use default
    return gridState.rowHeights[item.id] || 40;
  }, [data, gridState.rowHeights]);

  // Optimized row renderer component with error boundaries
  const RowRenderer = useCallback((props: ListChildComponentProps) => {
    const { index, style } = props;
    const item = data[index];
    if (!item) {
      return (
        <div style={style}>
          <Box sx={{ height: 40, display: 'flex', alignItems: 'center', px: 2 }}>
            Loading...
          </Box>
        </div>
      );
    }

    try {
      return (
        <div style={style}>
          <OptimizedGridRow
            item={item}
            columns={columns}
            gridState={gridState}
            onCellEdit={onCellEdit}
            onRowResize={onRowResize}
            onRowAutoResize={onRowAutoResize}
            onSelectedCellChange={onSelectedCellChange}
            onEditingCellChange={onEditingCellChange}
            onSelectedRangeChange={onSelectedRangeChange}
            readOnly={readOnly}
            isEven={index % 2 === 0}
          />
        </div>
      );
    } catch (error) {
      console.error('Error rendering row:', error);
      return (
        <div style={style}>
          <Box sx={{ height: 40, display: 'flex', alignItems: 'center', px: 2, color: 'error.main' }}>
            Error rendering row {index}
          </Box>
        </div>
      );
    }
  }, [
    data,
    columns,
    gridState,
    onCellEdit,
    onRowResize,
    onRowAutoResize,
    onSelectedCellChange,
    onEditingCellChange,
    onSelectedRangeChange,
    readOnly
  ]);

  // Scroll to selected cell when it changes
  useEffect(() => {
    if (gridState.selectedCell && listRef.current) {
      const selectedIndex = data.findIndex(item => item.id === gridState.selectedCell?.rowId);
      if (selectedIndex >= 0) {
        listRef.current.scrollToItem(selectedIndex, 'smart');
      }
    }
  }, [gridState.selectedCell, data]);

  return (
    <Box 
      className="advanced-virtualized-grid-body"
      sx={{ 
        flex: 1,
        minWidth: totalWidth,
        height: height,
        '& .react-window-list': {
          // Ensure proper scrollbar styling
          '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f1f1'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#c1c1c1',
            borderRadius: '6px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#a8a8a8'
          }
        }
      }}
    >
      <List
        className="react-window-list"
        style={{ height, width: '100%' }}
        itemCount={data.length}
        itemSize={40} // Use fixed size for now, can be enhanced later
        overscanCount={10} // Render more extra items for smoother scrolling
      >
        {RowRenderer}
      </List>
    </Box>
  );
});

AdvancedVirtualizedGridBody.displayName = 'AdvancedVirtualizedGridBody';

export default AdvancedVirtualizedGridBody;