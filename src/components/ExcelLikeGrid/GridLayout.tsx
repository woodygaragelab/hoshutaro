import React, { useMemo } from 'react';
import { Box, Divider } from '@mui/material';
import { GridColumn, DisplayAreaConfig, GridState } from './types';
import { HierarchicalData } from '../../types';
import { GridHeader } from './GridHeader';
import { GridBody } from './GridBody';

interface GridLayoutProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  displayAreaConfig: DisplayAreaConfig;
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onRowResize: (rowId: string, height: number) => void;
  onColumnAutoResize: (columnId: string) => void;
  onRowAutoResize: (rowId: string) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange?: (startRow: string, startColumn: string, endRow: string, endColumn: string) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  data,
  columns,
  displayAreaConfig,
  gridState,
  onCellEdit,
  onColumnResize,
  onRowResize,
  onColumnAutoResize,
  onRowAutoResize,
  onSelectedCellChange,
  onEditingCellChange,
  onSelectedRangeChange,
  virtualScrolling,
  readOnly
}) => {
  // Separate columns based on display area configuration
  const { fixedColumns, specificationsColumns, maintenanceColumns } = useMemo(() => {
    const fixed = columns.filter(col => displayAreaConfig.fixedColumns.includes(col.id));
    const specifications = columns.filter(col => 
      displayAreaConfig.scrollableAreas.specifications?.columns.includes(col.id)
    );
    const maintenance = columns.filter(col => 
      displayAreaConfig.scrollableAreas.maintenance?.columns.includes(col.id)
    );
    
    return {
      fixedColumns: fixed,
      specificationsColumns: specifications,
      maintenanceColumns: maintenance
    };
  }, [columns, displayAreaConfig]);

  // Calculate widths for each area
  const fixedWidth = useMemo(() => {
    return fixedColumns.reduce((sum, col) => 
      sum + (gridState.columnWidths[col.id] || col.width), 0
    );
  }, [fixedColumns, gridState.columnWidths]);

  const specificationsWidth = displayAreaConfig.scrollableAreas.specifications?.width || 0;
  const maintenanceWidth = displayAreaConfig.scrollableAreas.maintenance?.width || 0;

  // Render single area mode
  if (displayAreaConfig.mode !== 'both') {
    const visibleColumns = displayAreaConfig.mode === 'specifications' 
      ? [...fixedColumns, ...specificationsColumns]
      : [...fixedColumns, ...maintenanceColumns];
    
    const totalWidth = visibleColumns.reduce((sum, col) => 
      sum + (gridState.columnWidths[col.id] || col.width), 0
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <GridHeader
          columns={visibleColumns}
          columnWidths={gridState.columnWidths}
          onColumnResize={onColumnResize}
          onColumnAutoResize={onColumnAutoResize}
          totalWidth={totalWidth}
        />
        <GridBody
          data={data}
          columns={visibleColumns}
          gridState={gridState}
          onCellEdit={onCellEdit}
          onRowResize={onRowResize}
          onRowAutoResize={onRowAutoResize}
          onSelectedCellChange={onSelectedCellChange}
          onEditingCellChange={onEditingCellChange}
          onSelectedRangeChange={onSelectedRangeChange}
          virtualScrolling={virtualScrolling}
          readOnly={readOnly}
          totalWidth={totalWidth}
        />
      </Box>
    );
  }

  // Render split layout for "both" mode
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Combined Header */}
      <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider' }}>
        {/* Fixed columns header */}
        <Box sx={{ width: fixedWidth, flexShrink: 0 }}>
          <GridHeader
            columns={fixedColumns}
            columnWidths={gridState.columnWidths}
            onColumnResize={onColumnResize}
            onColumnAutoResize={onColumnAutoResize}
            totalWidth={fixedWidth}
            showBorder={false}
          />
        </Box>
        
        {/* Specifications header */}
        {displayAreaConfig.scrollableAreas.specifications?.visible && (
          <>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ width: specificationsWidth, flexShrink: 0, overflow: 'hidden' }}>
              <GridHeader
                columns={specificationsColumns}
                columnWidths={gridState.columnWidths}
                onColumnResize={onColumnResize}
                onColumnAutoResize={onColumnAutoResize}
                totalWidth={specificationsColumns.reduce((sum, col) => 
                  sum + (gridState.columnWidths[col.id] || col.width), 0
                )}
                showBorder={false}
              />
            </Box>
          </>
        )}
        
        {/* Maintenance header */}
        {displayAreaConfig.scrollableAreas.maintenance?.visible && (
          <>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ width: maintenanceWidth, flexShrink: 0, overflow: 'hidden' }}>
              <GridHeader
                columns={maintenanceColumns}
                columnWidths={gridState.columnWidths}
                onColumnResize={onColumnResize}
                onColumnAutoResize={onColumnAutoResize}
                totalWidth={maintenanceColumns.reduce((sum, col) => 
                  sum + (gridState.columnWidths[col.id] || col.width), 0
                )}
                showBorder={false}
              />
            </Box>
          </>
        )}
      </Box>

      {/* Combined Body */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Fixed columns body */}
        <Box sx={{ width: fixedWidth, flexShrink: 0 }}>
          <GridBody
            data={data}
            columns={fixedColumns}
            gridState={gridState}
            onCellEdit={onCellEdit}
            onRowResize={onRowResize}
            onRowAutoResize={onRowAutoResize}
            onSelectedCellChange={onSelectedCellChange}
            onEditingCellChange={onEditingCellChange}
            onSelectedRangeChange={onSelectedRangeChange}
            virtualScrolling={virtualScrolling}
            readOnly={readOnly}
            totalWidth={fixedWidth}
            showBorder={false}
          />
        </Box>
        
        {/* Specifications body */}
        {displayAreaConfig.scrollableAreas.specifications?.visible && (
          <>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ width: specificationsWidth, flexShrink: 0, overflow: 'auto' }}>
              <GridBody
                data={data}
                columns={specificationsColumns}
                gridState={gridState}
                onCellEdit={onCellEdit}
                onRowResize={onRowResize}
                onRowAutoResize={onRowAutoResize}
                onSelectedCellChange={onSelectedCellChange}
                onEditingCellChange={onEditingCellChange}
                onSelectedRangeChange={onSelectedRangeChange}
                virtualScrolling={virtualScrolling}
                readOnly={readOnly}
                totalWidth={specificationsColumns.reduce((sum, col) => 
                  sum + (gridState.columnWidths[col.id] || col.width), 0
                )}
                showBorder={false}
              />
            </Box>
          </>
        )}
        
        {/* Maintenance body */}
        {displayAreaConfig.scrollableAreas.maintenance?.visible && (
          <>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ width: maintenanceWidth, flexShrink: 0, overflow: 'auto' }}>
              <GridBody
                data={data}
                columns={maintenanceColumns}
                gridState={gridState}
                onCellEdit={onCellEdit}
                onRowResize={onRowResize}
                onRowAutoResize={onRowAutoResize}
                onSelectedCellChange={onSelectedCellChange}
                onEditingCellChange={onEditingCellChange}
                onSelectedRangeChange={onSelectedRangeChange}
                virtualScrolling={virtualScrolling}
                readOnly={readOnly}
                totalWidth={maintenanceColumns.reduce((sum, col) => 
                  sum + (gridState.columnWidths[col.id] || col.width), 0
                )}
                showBorder={false}
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default GridLayout;