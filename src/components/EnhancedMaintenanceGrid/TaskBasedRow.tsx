import React, { useCallback, useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { TaskBasedRow as TaskBasedRowData, AggregatedStatus } from '../../types/maintenanceTask';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import { HierarchicalData } from '../../types';
import MaintenanceCell from './MaintenanceCell';

interface TaskBasedRowProps {
  row: TaskBasedRowData;
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
}

const TaskBasedRowComponent: React.FC<TaskBasedRowProps> = ({
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
  isFixedArea = false
}) => {
  console.log('[TaskBasedRow] Rendering row:', {
    rowId: row.id,
    rowType: row.type,
    taskName: row.taskName,
    assetName: row.assetName,
    hierarchyValue: row.hierarchyValue,
    level: row.level
  });

  // In scrollable area, filter out the task name column for task rows
  // Use explicit ID matching ('task') instead of positional index (columns[0]?.id)
  // because in the scrollable area, columns[0] is the first time column, not 'task'
  const columnsToRender = displayColumns || columns;
  const effectiveColumnsToRender = (row.type === 'workOrderLine' && !isFixedArea)
    ? columnsToRender.filter(col => col.id !== 'task')
    : columnsToRender;
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
    if (row.type === 'asset') {
      return `asset_${row.assetId}`;
    } else if (row.type === 'workOrderLine') {
      return `task_${row.taskId}_asset_${row.assetId}`;
    } else if (row.type === 'hierarchy') {
      return `hierarchy_${row.hierarchyKey}_${row.hierarchyValue}`;
    }

    // Fallback: if row doesn't have type but has id, use the existing id
    if ((row as any).id) {
      return (row as any).id;
    }

    return 'unknown';
  }, [row.type, row.assetId, row.taskId, row.hierarchyKey, row.hierarchyValue, (row as any).id]);

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

    // For asset rows (band rows), show full hierarchy path in first column
    if (row.type === 'asset') {
      if (id === 'task') {
        return row.assetName;  // Contains full path like "第一製油所 > Aエリア > 原油蒸留ユニット > P-101（原油供給ポンプ）"
      }
      // Empty for other columns (no schedule on asset rows in task-based mode)
      return '';
    }

    // For task rows, show task name in first column and schedule in time columns
    if (row.type === 'workOrderLine') {
      if (id === 'task') {
        return `${row.taskName}${row.classification ? ` [${row.classification}]` : ''}`;
      }

      // Handle time columns - show schedule or results information
      if (id.startsWith('time_')) {
        const timeHeader = id.replace('time_', '');
        // Use schedule if available, otherwise fallback to results (commonized behavior)
        const scheduleEntry = (row.schedule && row.schedule[timeHeader]) ||
          (row.results && row.results[timeHeader]);

        console.log(`[TaskBasedRow] Getting cell value for time column:`, {
          rowId: row.id,
          timeHeader,
          scheduleEntry,
          availableScheduleKeys: Object.keys(row.schedule),
          viewMode
        });

        if (!scheduleEntry) {
          // No schedule for this time period
          if (viewMode === 'cost') {
            return { planCost: 0, actualCost: 0 };
          } else {
            return { planned: false, actual: false };
          }
        }

        // Schedule data is now always aggregated (AggregatedStatus type)
        // Check if it has the aggregated properties
        const isAggregated = 'totalPlanCost' in scheduleEntry;

        if (viewMode === 'cost') {
          if (isAggregated) {
            // AggregatedStatus type
            return {
              planCost: scheduleEntry.totalPlanCost || 0,
              actualCost: scheduleEntry.totalActualCost || 0
            };
          } else {
            // Fallback for raw schedule entry (shouldn't happen now)
            return {
              planCost: (scheduleEntry as any).planCost || 0,
              actualCost: (scheduleEntry as any).actualCost || 0
            };
          }
        } else {
          return {
            planned: scheduleEntry.planned || false,
            actual: scheduleEntry.actual || false
          };
        }
      }
    }

    return '';
  }, [row, columns, viewMode]);

  // Calculate indentation based on level
  const indentWidth = row.level * 20; // 20px per level

  // Determine row styling based on type
  const getRowStyle = () => {
    if (row.type === 'asset') {
      // Asset rows (帯部分) - band style showing full hierarchy path
      return {
        backgroundColor: '#1e1e1e',
        fontWeight: 600,
        color: '#ffffff',
        isBand: true
      };
    } else if (row.type === 'workOrderLine') {
      // Task rows - normal background
      return {
        backgroundColor: 'transparent',
        fontWeight: 400,
        color: '#e0e0e0',
        isBand: false
      };
    } else {
      return {
        backgroundColor: 'transparent',
        fontWeight: 400,
        color: '#ffffff',
        isBand: false
      };
    }
  };

  const rowStyle = getRowStyle();

  // For asset rows (band rows), render as a single full-width band exactly like GroupHeaderRow
  if (row.type === 'asset') {
    const cellValue = row.assetName;  // Full path: "第一製油所 > Aエリア > 原油蒸留ユニット > P-101（原油供給ポンプ）"
    return (
      <Box
        ref={rowRef}
        className="task-based-band-row group-header-row"
        sx={{
          display: 'flex',
          height: 32,
          backgroundColor: '#1e1e1e !important',
          position: 'relative',
          alignItems: 'center',
          width: `${totalRowWidth}px`,
          minWidth: `${totalRowWidth}px`,
          boxSizing: 'border-box',
          flexShrink: 0,
          zIndex: 1  // Ensure band row is above task rows
        }}
        style={{
          borderBottom: '1px solid #333333'
        }}
        data-row-id={rowId}
        data-row-type={row.type}
      >
        <Box
          sx={{
            width: `${totalRowWidth}px`,
            minWidth: `${totalRowWidth}px`,
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: '#1e1e1e !important',
            color: '#ffffff !important'
          }}
        >
          {/* 固定エリアでのみテキストを表示、スクロール可能エリアでは空白で行の高さのみ維持 */}
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: '#ffffff !important',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              visibility: isFixedArea ? 'visible' : 'hidden'
            }}
          >
            {isFixedArea ? cellValue : '　'}
          </Typography>
        </Box>
      </Box>
    );
  }

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
                width,
                minWidth: width,
                maxWidth: width,
                display: 'flex',
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
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  visibility: isFixedArea ? 'visible' : 'hidden'
                }}
              >
                {isFixedArea ? (typeof cellValue === 'string' ? cellValue : '') : '　'}
              </Typography>
            </Box>
          );
        }

        // For other columns in task rows, use MaintenanceCell for schedule display
        // Create a mock item for MaintenanceCell compatibility
        const mockItem: HierarchicalData = {
          id: rowId,
          task: row.taskName || '',
          bomCode: row.assetId || '',
          specifications: [],
          results: row.results || row.schedule || {},
          level: row.level,
          children: [],
          rolledUpResults: row.results || row.schedule || {}
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
export const TaskBasedRow = React.memo(TaskBasedRowComponent);

export default TaskBasedRow;
