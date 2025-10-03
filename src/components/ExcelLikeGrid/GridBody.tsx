import React from 'react';
import { Box } from '@mui/material';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridRow } from './GridRow';

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
  return (
    <Box 
      className="grid-body"
      sx={{ 
        flex: 1,
        overflow: 'auto',
        minWidth: totalWidth
      }}
    >
      {data.map((item, index) => (
        <GridRow
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