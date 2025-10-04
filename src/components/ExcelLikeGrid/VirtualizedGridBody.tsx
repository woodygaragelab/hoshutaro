import React, { useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { List } from 'react-window';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridRow } from './GridRow';

interface ListChildComponentProps {
  index: number;
  style: React.CSSProperties;
}

interface VirtualizedGridBodyProps {
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

interface VirtualizedGridBodyRef {
  scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  scrollToTop: () => void;
}

// Memoized row component for better performance
const MemoizedGridRow = React.memo(GridRow);

export const VirtualizedGridBody = forwardRef<VirtualizedGridBodyRef, VirtualizedGridBodyProps>(({
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

  // Expose scroll methods through ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
      listRef.current?.scrollToItem(index, align);
    },
    scrollToTop: () => {
      listRef.current?.scrollToItem(0, 'start');
    }
  }), []);

  // Calculate item height based on row heights in grid state
  const getItemHeight = useCallback((index: number): number => {
    const item = data[index];
    if (!item) return 40; // Default height
    return gridState.rowHeights[item.id] || 40;
  }, [data, gridState.rowHeights]);

  // Memoized row renderer component for virtual list
  const RowRenderer = useCallback((props: ListChildComponentProps) => {
    const { index, style } = props;
    const item = data[index];
    if (!item) return null;

    return (
      <div style={style}>
        <MemoizedGridRow
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

  // Calculate average item height for better scrolling performance
  const averageItemHeight = useMemo(() => {
    if (data.length === 0) return 40;
    
    const totalHeight = data.reduce((sum, item) => {
      return sum + (gridState.rowHeights[item.id] || 40);
    }, 0);
    
    return Math.round(totalHeight / data.length);
  }, [data, gridState.rowHeights]);

  // Use List for consistent performance
  // We'll use the average height and handle dynamic heights through CSS
  return (
    <Box 
      className="virtualized-grid-body"
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
        itemSize={averageItemHeight}
        overscanCount={5} // Render 5 extra items above and below visible area
      >
        {RowRenderer}
      </List>
    </Box>
  );
});

VirtualizedGridBody.displayName = 'VirtualizedGridBody';

export default VirtualizedGridBody;