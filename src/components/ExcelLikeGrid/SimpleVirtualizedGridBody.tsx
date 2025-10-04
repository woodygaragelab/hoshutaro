import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridRow } from './GridRow';

interface SimpleVirtualizedGridBodyProps {
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

interface SimpleVirtualizedGridBodyRef {
  scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => void;
  scrollToTop: () => void;
}

// Simple virtual scrolling implementation without react-window for now
export const SimpleVirtualizedGridBody = forwardRef<SimpleVirtualizedGridBodyRef, SimpleVirtualizedGridBodyProps>(({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40; // Fixed item height for simplicity

  // Expose scroll methods through ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
      if (containerRef.current) {
        const scrollTop = index * itemHeight;
        containerRef.current.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      }
    },
    scrollToTop: () => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  }), []);

  // Calculate visible range based on scroll position
  const [visibleStart, setVisibleStart] = React.useState(0);
  const [visibleEnd, setVisibleEnd] = React.useState(Math.ceil(height / itemHeight));

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(data.length, start + Math.ceil(height / itemHeight) + 5); // +5 for overscan
    
    setVisibleStart(Math.max(0, start - 5)); // -5 for overscan
    setVisibleEnd(end);
  }, [data.length, height]);

  // Memoized row component
  const MemoizedGridRow = React.memo(GridRow);

  // Render visible items
  const visibleItems = data.slice(visibleStart, visibleEnd).map((item, index) => {
    const actualIndex = visibleStart + index;
    return (
      <Box
        key={item.id}
        sx={{
          position: 'absolute',
          top: actualIndex * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight
        }}
      >
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
          isEven={actualIndex % 2 === 0}
        />
      </Box>
    );
  });

  const totalHeight = data.length * itemHeight;

  return (
    <Box 
      ref={containerRef}
      className="simple-virtualized-grid-body"
      onScroll={handleScroll}
      sx={{ 
        flex: 1,
        minWidth: totalWidth,
        height: height,
        overflow: 'auto',
        position: 'relative',
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
      }}
    >
      {/* Spacer to create scrollable area */}
      <Box sx={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </Box>
    </Box>
  );
});

SimpleVirtualizedGridBody.displayName = 'SimpleVirtualizedGridBody';

export default SimpleVirtualizedGridBody;