import React, { useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridRow } from './GridRow';
import { SimpleVirtualizedGridBody } from './SimpleVirtualizedGridBody';

interface GridBodyProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onRowResize: (rowId: string, height: number) => void;
  onRowAutoResize: (rowId: string) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange?: (startRow: string, startColumn: string, endRow: string, endColumn: string) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
  totalWidth: number;
  showBorder?: boolean;
}

// Threshold for enabling virtual scrolling (number of rows)
const VIRTUAL_SCROLLING_THRESHOLD = 100;

export const GridBody: React.FC<GridBodyProps> = ({
  data,
  columns,
  gridState,
  onCellEdit,
  onRowResize,
  onRowAutoResize,
  onSelectedCellChange,
  onEditingCellChange,
  onSelectedRangeChange,
  virtualScrolling,
  readOnly,
  totalWidth,
  showBorder = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Determine if we should use virtual scrolling
  const shouldUseVirtualScrolling = useMemo(() => {
    return virtualScrolling && data.length > VIRTUAL_SCROLLING_THRESHOLD;
  }, [virtualScrolling, data.length]);

  // Calculate container height for virtual scrolling
  const containerHeight = useMemo(() => {
    if (!containerRef.current) return 400; // Default height
    return containerRef.current.clientHeight || 400;
  }, []);

  // Memoized row components for better performance
  const MemoizedGridRow = React.memo(GridRow);

  // Use virtual scrolling for large datasets
  if (shouldUseVirtualScrolling) {
    return (
      <Box 
        ref={containerRef}
        className="grid-body virtualized"
        sx={{ 
          flex: 1,
          minWidth: totalWidth,
          height: '100%'
        }}
      >
        <SimpleVirtualizedGridBody
          data={data}
          columns={columns}
          gridState={gridState}
          onCellEdit={onCellEdit}
          onRowResize={onRowResize}
          onRowAutoResize={onRowAutoResize}
          onSelectedCellChange={onSelectedCellChange}
          onEditingCellChange={onEditingCellChange}
          onSelectedRangeChange={onSelectedRangeChange}
          readOnly={readOnly}
          totalWidth={totalWidth}
          height={containerHeight}
          showBorder={showBorder}
        />
      </Box>
    );
  }

  // Use regular rendering for smaller datasets
  return (
    <Box 
      ref={containerRef}
      className="grid-body standard"
      sx={{ 
        flex: 1,
        overflow: 'auto',
        minWidth: totalWidth
      }}
    >
      {data.map((item, index) => (
        <MemoizedGridRow
          key={item.id}
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
      ))}
    </Box>
  );
};