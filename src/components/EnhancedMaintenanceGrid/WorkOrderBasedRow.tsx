import React, { useCallback, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { WorkOrderBasedRow as WorkOrderBasedRowData, AggregatedStatus } from '../../types/maintenanceTask';
import { GridColumn, GridState } from './types';
import { HierarchicalData } from '../../types';
import MaintenanceCell from './MaintenanceCell';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import IconButton from '@mui/material/IconButton';

interface WorkOrderBasedRowProps {
  row: WorkOrderBasedRowData;
  columns: GridColumn[];
  viewMode: 'status' | 'cost';
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onCellClick?: (rowId: string, columnId: string) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: React.MouseEvent<HTMLElement>) => void;
  readOnly: boolean;
  draggedColumnIndex?: number | null;
  dragOverColumnIndex?: number | null;
  enableVirtualScrolling?: boolean;
  virtualOffset?: number;
  displayColumns?: GridColumn[];
  isFixedArea?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (workOrderId: string) => void;
}

const WorkOrderBasedRowComponent: React.FC<WorkOrderBasedRowProps> = ({
  row,
  columns,
  viewMode,
  gridState,
  onCellEdit,
  onCellClick,
  onSelectedCellChange,
  onEditingCellChange,
  onCellDoubleClick,
  readOnly,
  draggedColumnIndex,
  dragOverColumnIndex,
  enableVirtualScrolling = false,
  virtualOffset = 0,
  displayColumns,
  isFixedArea = false,
  isExpanded = false,
  onToggleExpand
}) => {
  // Use explicit ID matching ('task') instead of positional index (columns[0]?.id)
  // because in the scrollable area, columns[0] is the first time column, not 'task'
  const columnsToRender = displayColumns || columns;
  // Always render all columns as we want the parent row to show aggregated schedules natively
  const effectiveColumnsToRender = columnsToRender;
  const rowRef = useRef<HTMLDivElement>(null);

  // Force border style on mount and update
  useEffect(() => {
    if (rowRef.current) {
      rowRef.current.style.borderBottom = '1px solid #333333';
    }
  }, []);

  // Calculate total row width based on columns
  const totalRowWidth = columns.reduce((sum, col) => {
    return sum + (gridState.columnWidths[col.id] || col.width);
  }, 0);

  // Generate unique row ID based on row type and data
  // Use same format as ViewModeManager to ensure consistency
  const getRowId = useCallback(() => {
    // If the row already has an ID assigned by the ViewModeManager or App.tsx, USE IT EXACTLY.
    // Overwriting it causes complete lookup failures in copyPasteManager because it retains the original ID.
    if ((row as any).id) {
      return (row as any).id;
    }
    return 'unknown';
  }, [row.type, row.assetId, row.workOrderId, (row as any).id]);

  const rowId = getRowId();

  // Handle cell click for selection
  const handleCellClick = useCallback((columnId: string) => {
    onSelectedCellChange(rowId, columnId);
    if (onCellClick) {
      onCellClick(rowId, columnId);
    }
  }, [rowId, onSelectedCellChange, onCellClick]);

  // Handle cell double click for editing
  const handleCellDoubleClick = useCallback((columnId: string, event: React.MouseEvent<HTMLElement>) => {
    if (readOnly) {
      return;
    }

    const column = columns.find(col => col.id === columnId);

    // Always call onCellDoubleClick if provided (for dialog-based editing)
    // The editable flag is for inline editing, not for dialog-based editing
    if (onCellDoubleClick) {
      onCellDoubleClick(rowId, columnId, event);
    } else if (column?.editable) {
      // Fallback to inline editing if no dialog handler is provided
      onEditingCellChange(rowId, columnId);
    }
  }, [rowId, columns, readOnly, onCellDoubleClick, onEditingCellChange]);

  // Get cell value based on column and row type
  const getCellValue = useCallback((column: GridColumn) => {
    const { id } = column;

    // For first column ('task')
    if (id === 'task') {
      let finalVal = '';
      if (row.type === 'workOrder') {
        finalVal = `${row.workOrderName || row.task || ''}`;
      } else {
        finalVal = row.assetName || row.task || '';
      }
            return finalVal;
    }

    // Handle time columns - show schedule or results information
    if (id.startsWith('time_')) {
      const timeHeader = id.replace('time_', '');
      const scheduleEntry = (row.aggregatedSchedule && row.aggregatedSchedule[timeHeader]) || undefined;

      if (!scheduleEntry) {
        if (viewMode === 'cost') return { planCost: 0, actualCost: 0 };
        return { planned: false, actual: false };
      }

      if (viewMode === 'cost') {
        return {
          planCost: scheduleEntry.totalPlanCost || 0,
          actualCost: scheduleEntry.totalActualCost || 0
        };
      } else {
        return {
          planned: scheduleEntry.planned || false,
          actual: scheduleEntry.actual || false
        };
      }
    }

    return '';
  }, [row, columns, viewMode]);

  // Calculate indentation based on level
  const indentWidth = row.type === 'assetChild' ? 32 : 0; 
  
  const getRowStyle = () => {
    if (row.type === 'workOrder') {
      return {
        backgroundColor: '#262626', // slightly darker than regular rows, lighter than deep band
        fontWeight: 600,
        color: '#ffffff',
        isBand: true
      };
    } else {
      return {
        backgroundColor: 'transparent',
        fontWeight: 500,
        color: '#e0e0e0',
        isBand: false
      };
    }
  };

  const rowStyle = getRowStyle();

  // For task rows, render normal cells
  return (
    <Box
      ref={rowRef}
      sx={{
        display: 'flex',
        height: 40,
        width: `${totalRowWidth}px`,
        minWidth: `${totalRowWidth}px`,
        alignItems: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
        backgroundColor: rowStyle.backgroundColor,
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      style={{
        borderBottom: '1px solid #333333'
      }}
      data-row-id={rowId}
      data-row-type={row.type}
    >
      {enableVirtualScrolling && virtualOffset > 0 && (
        <Box sx={{ width: virtualOffset, flexShrink: 0 }} />
      )}
      {effectiveColumnsToRender.map((column, displayIndex) => {
        const columnIndex = enableVirtualScrolling ?
          columns.findIndex(c => c.id === column.id) :
          displayIndex;
        const width = gridState.columnWidths[column.id] || column.width;
        const isSelected = gridState.selectedCell?.rowId === rowId && gridState.selectedCell?.columnId === column.id;
        const isEditing = gridState.editingCell?.rowId === rowId && gridState.editingCell?.columnId === column.id;
        const isDragged = draggedColumnIndex !== null && draggedColumnIndex === columnIndex;
        const isDragOver = dragOverColumnIndex !== null && dragOverColumnIndex === columnIndex;
        const isLastColumn = columns.indexOf(column) === columns.length - 1;
        const isFirstColumn = column.id === 'task';

        const cellValue = getCellValue(column);

        // For task rows, render with indentation in first column
        // Only show task name in fixed area, hide in scrollable area
        if (isFirstColumn) {
          return (
            <Box
              key={column.id}
              className={isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'}
              sx={{
                width: isFixedArea ? width : 0,  // Hide task column heavily in scrollable area
                minWidth: isFixedArea ? width : 0, 
                maxWidth: isFixedArea ? width : 0,
                display: isFixedArea ? 'flex' : 'none',
                alignItems: 'center',
                padding: '4px 8px',
                paddingLeft: `${8 + indentWidth}px`, // Add indentation
                backgroundColor: isSelected ? '#ffffff' : 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0,
                opacity: isDragged ? 0.5 : 1,
                transform: isDragged ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isDragged ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333'),
              }}
              style={{
                borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333')
              }}
              onClick={() => handleCellClick(column.id)}
              onDoubleClick={(e) => {
                // For parent rows, clicking should ONLY edit the WorkOrder if explicitly targeted, else it acts like expand
                // Let's pass the event up to handleCellDoubleClick as normal, which opens WorkOrder dialog for type === 'workOrder' cell!
                handleCellDoubleClick(column.id, e);
              }}
            >
              {row.type === 'workOrder' && (
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleExpand && row.workOrderId) {
                      onToggleExpand(row.workOrderId);
                    }
                  }} 
                  sx={{ color: '#fff', p: 0, mr: 1 }}
                >
                  {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                </IconButton>
              )}
              {row.type === 'assetChild' && row.bomCode && (
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#999', mr: 1, border: '1px solid #555', borderRadius: '4px', px: 0.5 }}>
                  {row.bomCode}
                </Typography>
              )}
              {row.type === 'assetChild' && !row.bomCode && (
                <Box sx={{ width: '16px', height: '16px', mr: 1 }} />
              )}
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {typeof cellValue === 'string' ? cellValue : ''}
              </Typography>
            </Box>
          );
        }

        // For other columns in task rows, use MaintenanceCell for schedule display
        // Create a mock item for MaintenanceCell compatibility
        const mockItem: HierarchicalData = {
          id: rowId,
          task: row.workOrderName || '',
          bomCode: row.assetId || '',
          specifications: [],
          results: (row.aggregatedSchedule || {}) as any,
          level: row.level,
          children: [],
          rolledUpResults: (row.aggregatedSchedule || {}) as any
        };

        return (
          <MaintenanceCell
            key={column.id}
            item={mockItem}
            column={column}
            value={cellValue}
            viewMode={viewMode}
            isSelected={isSelected}
            isEditing={isEditing}
            onCellEdit={onCellEdit}
            onCellClick={() => handleCellClick(column.id)}
            onCellDoubleClick={(event) => handleCellDoubleClick(column.id, event)}
            readOnly={readOnly}
            width={width}
            showRightBorder={!isLastColumn}
            isDragged={isDragged}
            isDragOver={isDragOver}
            isEquipmentBasedMode={false}
          />
        );
      })}
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const WorkOrderBasedRow = React.memo(WorkOrderBasedRowComponent);

export default WorkOrderBasedRow;
