import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Box, TextField, Checkbox } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from './types';

interface MaintenanceTableRowProps {
  item: HierarchicalData;
  columns: GridColumn[];
  viewMode: 'status' | 'cost';
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: React.MouseEvent<HTMLElement>) => void;
  readOnly: boolean;
  draggedColumnIndex?: number | null;
  dragOverColumnIndex?: number | null;
  enableVirtualScrolling?: boolean;
  virtualOffset?: number;
  displayColumns?: GridColumn[];
  isEquipmentBasedMode?: boolean;
  isTaskBasedMode?: boolean;
  isFixedArea?: boolean;
  isDragging?: boolean;
  startDragSelection?: (rowId: string, columnId: string) => void;
  updateDragSelection?: (rowId: string, columnId: string) => void;
  endDragSelection?: () => void;
  isCellInSelectedRange?: (rowId: string, columnId: string) => boolean;
}
import MaintenanceCell from './MaintenanceCell';

const MaintenanceTableRowComponent: React.FC<MaintenanceTableRowProps> = ({
  item,
  columns,
  viewMode,
  gridState,
  onCellEdit,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onCellDoubleClick,
  readOnly,
  draggedColumnIndex,
  dragOverColumnIndex,
  enableVirtualScrolling = false,
  virtualOffset = 0,
  displayColumns,
  isEquipmentBasedMode = false,
  isTaskBasedMode = false,
  isFixedArea = false,
  isDragging,
  startDragSelection,
  updateDragSelection,
  endDragSelection,
  isCellInSelectedRange
}) => {
  // Use displayColumns if provided (for virtual scrolling), otherwise use all columns
  const columnsToRender = displayColumns || columns;

  // Handle bomCode click (no inline editing, use dialog instead)
  const handleBomCodeClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    // Don't start inline editing, let double-click handle it
    e.stopPropagation();
  }, [readOnly]);

  // Get cell value based on column accessor
  const getCellValue = useCallback((column: any) => {
    const { id } = column;
    
    if (id === 'task') return item.task;
    if (id === 'bomCode') return item.bomCode;
    
    // Handle specification columns
    if (id.startsWith('spec_')) {
      const specKey = id.replace('spec_', '');
      const spec = item.specifications?.find(s => s.key === specKey);
      return spec?.value || '';
    }
    
    // Handle time columns
    if (id.startsWith('time_')) {
      const timeHeader = id.replace('time_', '');
      const result = item.results?.[timeHeader];
      
      if (viewMode === 'cost') {
        return result ? { planCost: result.planCost, actualCost: result.actualCost } : { planCost: 0, actualCost: 0 };
      } else {
        return result ? { planned: result.planned, actual: result.actual } : { planned: false, actual: false };
      }
    }
    
    return '';
  }, [item, viewMode]);

  // Determine if this is a hierarchy row up front to use in event handlers
  const isHierarchyRow = item.isGroupHeader || item.type === 'hierarchy' || (!item.bomCode && typeof item.task === 'string' && item.task.includes(' > '));

  // Handle cell click for selection only
  const handleCellClick = useCallback((columnId: string) => {
    onSelectedCellChange(item.id, columnId);
  }, [item.id, onSelectedCellChange]);

  // Handle cell double click for editing or opening dialog
  const handleCellDoubleClick = useCallback((columnId: string, event: React.MouseEvent<HTMLElement>) => {
    if (readOnly) return;
    
    // Prevent double-click actions on hierarchy rows
    if (isHierarchyRow) return;
    
    const column = columns.find(col => col.id === columnId);
    
    // Always call onCellDoubleClick if provided (for dialog-based editing)
    // The editable flag is for inline editing, not for dialog-based editing
    if (onCellDoubleClick) {
      onCellDoubleClick(item.id, columnId, event);
    } else if (column?.editable) {
      // Fallback to inline editing if no dialog handler is provided
      onEditingCellChange(item.id, columnId);
    }
  }, [item.id, columns, readOnly, isHierarchyRow, onCellDoubleClick, onEditingCellChange]);

  // Ref for the row element
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
        backgroundColor: 'transparent',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      style={{
        borderBottom: '1px solid #333333'
      }}
      data-row-id={item.id}
    >

      {enableVirtualScrolling && virtualOffset > 0 && (
        <Box sx={{ width: virtualOffset, flexShrink: 0 }} />
      )}
      {columnsToRender.map((column, displayIndex) => {
        const columnIndex = enableVirtualScrolling ? 
          columns.findIndex(c => c.id === column.id) : 
          displayIndex;
        const width = gridState.columnWidths[column.id] || column.width;
        const isSelected = gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === column.id;
        const isEditing = gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === column.id;
        const isDragged = draggedColumnIndex !== null && draggedColumnIndex === columnIndex;
        const isDragOver = dragOverColumnIndex !== null && dragOverColumnIndex === columnIndex;
        
        // Special handling for task, bomCode, and cycle columns to maintain existing behavior

        if (column.id === 'task') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          let cellWidth = width;
          
          if (isHierarchyRow && isFixedArea) {
            const combinedWidth = columns.reduce((sum, col) => sum + (gridState.columnWidths[col.id] || col.width), 0);
            cellWidth = combinedWidth;
          }

          const isInRange = isCellInSelectedRange ? isCellInSelectedRange(item.id, column.id) : false;

          return (
            <Box
              key={column.id}
              className={`${isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'} ${isInRange ? 'selected-range-cell' : ''}`}
              sx={{
                width: cellWidth,
                minWidth: cellWidth,
                maxWidth: cellWidth,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: 'transparent',
                cursor: readOnly ? 'default' : 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0,
                opacity: isDragged ? 0.5 : 1,
                transform: isDragged ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isDragged ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
                borderRight: (isHierarchyRow && isFixedArea) ? '1px solid #333333' : (isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333')),
              }}
              style={{
                borderRight: (isHierarchyRow && isFixedArea) ? '1px solid #333333' : (isDragOver ? '2px solid rgba(255,255,255,0.5)' : (isLastColumn ? 'none' : '1px solid #333333'))
              }}
              onClick={() => handleCellClick(column.id)}
              onDoubleClick={(e) => handleCellDoubleClick(column.id, e)}
            >
              <Box sx={{ width: '100%', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isHierarchyRow ? 600 : 400 }}>
                <Box className="cell-content">
                  {item.task || ''}
                </Box>
              </Box>
            </Box>
          );
        }
        
        if (isHierarchyRow && isFixedArea) {
          return null; // スキップ
        }
        
        if (column.id === 'bomCode') {
          const isLastColumn = columns.indexOf(column) === columns.length - 1;
          const isInRange = isCellInSelectedRange ? isCellInSelectedRange(item.id, column.id) : false;

          return (
            <Box
              key={column.id}
              className={`${isSelected ? 'maintenance-cell selected-cell' : 'maintenance-cell'} ${isInRange ? 'selected-range-cell' : ''}`}
              sx={{
                width,
                minWidth: width,
                maxWidth: width,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: 'transparent',
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
              onDoubleClick={(e) => handleCellDoubleClick(column.id, e)}
            >
              <Box sx={{ width: '100%' }} onClick={handleBomCodeClick}>
                <Box className="cell-content" sx={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.bomCode || ''}
                </Box>
              </Box>
            </Box>
          );
        }
        
        // For all other columns, use the MaintenanceCell component
        const cellValue = getCellValue(column);
        const isLastColumn = columns.indexOf(column) === columns.length - 1;

          return (
            <MaintenanceCell
              key={column.id}
              item={item}
              column={column}
              value={cellValue}
              viewMode={viewMode}
              isSelected={isSelected}
              isEditing={isEditing}
              isInSelectedRange={isCellInSelectedRange ? isCellInSelectedRange(item.id, column.id) : false}
              onMouseDown={(e: React.MouseEvent) => {
                // Must be left click
                if (e.button === 0 && startDragSelection) {
                  // Prevent default to stop text selection / native drag
                  e.preventDefault();
                  startDragSelection(item.id, column.id);
                }
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                if (isDragging && updateDragSelection) {
                  updateDragSelection(item.id, column.id);
                }
              }}
              onMouseUp={(e: React.MouseEvent) => {
                if (e.button === 0 && endDragSelection) {
                  endDragSelection();
                }
              }}
              onCellEdit={onCellEdit}
              onCellClick={() => handleCellClick(column.id)}
              onCellDoubleClick={(event) => handleCellDoubleClick(column.id, event)}
              readOnly={readOnly}
              width={width}
              showRightBorder={!isLastColumn}
              isDragged={isDragged}
              isDragOver={isDragOver}
              isEquipmentBasedMode={isEquipmentBasedMode}
            />
          );
        })}
        {enableVirtualScrolling && (
          <Box sx={{ flexGrow: 1, flexShrink: 0 }} />
        )}
      </Box>
    );
};

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceTableRow = React.memo(MaintenanceTableRowComponent);

export default MaintenanceTableRow;
