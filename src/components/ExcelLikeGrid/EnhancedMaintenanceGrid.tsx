import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Paper } from '@mui/material';
import { HierarchicalData } from '../../types';
import { DisplayAreaControl } from './DisplayAreaControl';
import { DisplayAreaConfig } from './types';
import { useGridState } from './hooks/useGridState';
import { MaintenanceGridLayout } from './MaintenanceGridLayout';
import './ExcelLikeGrid.css';

export interface EnhancedMaintenanceGridProps {
  data: HierarchicalData[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  displayMode: 'specifications' | 'maintenance' | 'both';
  showBomCode: boolean;
  showCycle: boolean;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onRowResize?: (rowId: string, height: number) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  virtualScrolling?: boolean;
  readOnly?: boolean;
  className?: string;
  groupedData?: { [key: string]: HierarchicalData[] };
}

export const EnhancedMaintenanceGrid: React.FC<EnhancedMaintenanceGridProps> = ({
  data,
  timeHeaders,
  viewMode,
  displayMode,
  showBomCode,
  showCycle,
  onCellEdit,
  onSpecificationEdit,
  onColumnResize,
  onRowResize,
  onUpdateItem,
  virtualScrolling = false,
  readOnly = false,
  className = '',
  groupedData
}) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate columns based on the current display mode and settings
  const columns = useMemo(() => {
    const cols = [];
    
    // Always include task column
    cols.push({
      id: 'task',
      header: '機器名',
      width: 250,
      minWidth: 150,
      maxWidth: 400,
      resizable: true,
      sortable: false,
      type: 'text' as const,
      editable: true,
      accessor: 'task'
    });

    // Add BOM code column if enabled
    if (showBomCode) {
      cols.push({
        id: 'bomCode',
        header: 'TAG No.',
        width: 150,
        minWidth: 100,
        maxWidth: 200,
        resizable: true,
        sortable: false,
        type: 'text' as const,
        editable: false,
        accessor: 'bomCode'
      });
    }

    // Add cycle column if enabled
    if (showCycle) {
      cols.push({
        id: 'cycle',
        header: '周期',
        width: 80,
        minWidth: 60,
        maxWidth: 120,
        resizable: true,
        sortable: false,
        type: 'number' as const,
        editable: true,
        accessor: 'cycle'
      });
    }

    // Add specification columns if in specifications or both mode
    if (displayMode === 'specifications' || displayMode === 'both') {
      // Add dynamic specification columns based on data
      const specKeys = new Set<string>();
      data.forEach(item => {
        item.specifications?.forEach(spec => {
          specKeys.add(spec.key);
        });
      });

      Array.from(specKeys).sort().forEach(key => {
        cols.push({
          id: `spec_${key}`,
          header: key,
          width: 120,
          minWidth: 80,
          maxWidth: 200,
          resizable: true,
          sortable: false,
          type: 'text' as const,
          editable: true,
          accessor: `specifications.${key}`
        });
      });
    }

    // Add time header columns if in maintenance or both mode
    if (displayMode === 'maintenance' || displayMode === 'both') {
      timeHeaders.forEach(timeHeader => {
        cols.push({
          id: `time_${timeHeader}`,
          header: timeHeader,
          width: viewMode === 'cost' ? 120 : 80,
          minWidth: 60,
          maxWidth: 150,
          resizable: true,
          sortable: false,
          type: viewMode === 'cost' ? 'cost' as const : 'status' as const,
          editable: true,
          accessor: `results.${timeHeader}`
        });
      });
    }

    return cols;
  }, [data, timeHeaders, viewMode, displayMode, showBomCode, showCycle]);

  // Create display area configuration based on display mode
  const displayAreaConfig: DisplayAreaConfig = useMemo(() => {
    const fixedColumns = ['task'];
    if (showBomCode) fixedColumns.push('bomCode');
    if (showCycle) fixedColumns.push('cycle');

    const specColumns = columns
      .filter(col => col.id.startsWith('spec_'))
      .map(col => col.id);
    
    const maintenanceColumns = columns
      .filter(col => col.id.startsWith('time_'))
      .map(col => col.id);

    return {
      mode: displayMode,
      fixedColumns,
      scrollableAreas: {
        specifications: {
          visible: displayMode === 'specifications' || displayMode === 'both',
          width: specColumns.length * 120,
          columns: specColumns
        },
        maintenance: {
          visible: displayMode === 'maintenance' || displayMode === 'both',
          width: maintenanceColumns.length * (viewMode === 'cost' ? 120 : 80),
          columns: maintenanceColumns
        }
      }
    };
  }, [columns, displayMode, showBomCode, showCycle, viewMode]);

  const {
    gridState,
    updateColumnWidth,
    updateRowHeight,
    setSelectedCell,
    setEditingCell,
    navigateToCell
  } = useGridState(columns, data);

  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    if (readOnly) return;

    const item = data.find(d => d.id === rowId);
    if (!item) return;

    if (columnId === 'task') {
      onUpdateItem({ ...item, task: value });
    } else if (columnId === 'cycle') {
      onUpdateItem({ ...item, cycle: value });
    } else if (columnId.startsWith('spec_')) {
      const specKey = columnId.replace('spec_', '');
      const updatedSpecs = [...(item.specifications || [])];
      const existingSpecIndex = updatedSpecs.findIndex(spec => spec.key === specKey);
      
      if (existingSpecIndex >= 0) {
        updatedSpecs[existingSpecIndex] = { ...updatedSpecs[existingSpecIndex], value };
      } else {
        updatedSpecs.push({ key: specKey, value, order: updatedSpecs.length });
      }
      
      onUpdateItem({ ...item, specifications: updatedSpecs });
      onSpecificationEdit(rowId, existingSpecIndex >= 0 ? existingSpecIndex : updatedSpecs.length - 1, 'value', value);
    } else if (columnId.startsWith('time_')) {
      const timeHeader = columnId.replace('time_', '');
      onCellEdit(rowId, timeHeader, value);
    }
  }, [readOnly, data, onUpdateItem, onSpecificationEdit, onCellEdit]);

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    updateColumnWidth(columnId, width);
    onColumnResize?.(columnId, width);
  }, [updateColumnWidth, onColumnResize]);

  const handleRowResize = useCallback((rowId: string, height: number) => {
    updateRowHeight(rowId, height);
    onRowResize?.(rowId, height);
  }, [updateRowHeight, onRowResize]);

  const handleDisplayAreaChange = useCallback((config: DisplayAreaConfig) => {
    // This would trigger a re-render with new display mode
    // For now, we'll just log it as the parent component should handle this
    console.log('Display area change requested:', config);
  }, []);

  // Handle keyboard navigation at grid level
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only handle navigation if we're not in editing mode
    if (gridState.editingCell) return;
    
    // Only handle navigation if a cell is selected
    if (!gridState.selectedCell) return;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        navigateToCell('tab');
        break;
      case 'Enter':
        e.preventDefault();
        // If the current cell is editable and not readonly, start editing
        const currentColumn = columns.find(col => col.id === gridState.selectedCell?.columnId);
        if (currentColumn?.editable && !readOnly) {
          setEditingCell(gridState.selectedCell.rowId, gridState.selectedCell.columnId);
        } else {
          navigateToCell('enter');
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateToCell('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateToCell('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigateToCell('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateToCell('right');
        break;
      case 'Escape':
        if (gridState.editingCell) {
          e.preventDefault();
          setEditingCell(null, null);
        }
        break;
    }
  }, [gridState.editingCell, gridState.selectedCell, navigateToCell, columns, readOnly, setEditingCell]);

  // Focus the grid when a cell is selected
  useEffect(() => {
    if (gridState.selectedCell && gridRef.current) {
      gridRef.current.focus();
    }
  }, [gridState.selectedCell]);

  return (
    <Paper 
      ref={gridRef}
      className={`excel-like-grid enhanced-maintenance-grid ${className}`}
      elevation={1}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        '&:focus': {
          outline: 'none'
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Display Area Control */}
        <DisplayAreaControl
          config={displayAreaConfig}
          onChange={handleDisplayAreaChange}
        />
        
        {/* Grid Layout with existing TableRow integration */}
        <MaintenanceGridLayout
          data={data}
          columns={columns}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          displayAreaConfig={displayAreaConfig}
          gridState={gridState}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onSelectedCellChange={setSelectedCell}
          onEditingCellChange={setEditingCell}
          onUpdateItem={onUpdateItem}
          onSpecificationEdit={onSpecificationEdit}
          virtualScrolling={virtualScrolling}
          readOnly={readOnly}
          showBomCode={showBomCode}
          showCycle={showCycle}
          groupedData={groupedData}
        />
      </Box>
    </Paper>
  );
};

export default EnhancedMaintenanceGrid;