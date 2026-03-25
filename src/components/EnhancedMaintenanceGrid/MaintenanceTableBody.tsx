import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import MaintenanceTableRow from './MaintenanceTableRow';
import GroupHeaderRow from './GroupHeaderRow';
import { WorkOrderBasedRow } from './WorkOrderBasedRow';
import { useHorizontalVirtualScrolling } from '../VirtualScrolling/useHorizontalVirtualScrolling';

interface MaintenanceTableBodyProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  gridState: GridState;
  viewMode: 'status' | 'cost';
  groupedData?: { [key: string]: HierarchicalData[] };
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: React.MouseEvent<HTMLElement>) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
  isFixedArea?: boolean;
  isScrollableArea?: boolean;
  syncScrollTop?: number;
  onScrollSync?: (scrollTop: number) => void;
  draggedColumnIndex?: number | null;
  dragOverColumnIndex?: number | null;
  enableHorizontalVirtualScrolling?: boolean;
  containerWidth?: number;
  scrollLeft?: number;
  isEquipmentBasedMode?: boolean;
  isTaskBasedMode?: boolean;
  expandedWorkOrders?: Set<string>;
  onToggleWorkOrderExpanded?: (workOrderId: string) => void;
}

const MaintenanceTableBodyComponent: React.FC<MaintenanceTableBodyProps> = ({
  data,
  columns,
  gridState,
  viewMode,
  groupedData,
  onCellEdit,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onCellDoubleClick,
  virtualScrolling,
  readOnly,
  isFixedArea = false,
  isScrollableArea = false,
  syncScrollTop,
  onScrollSync,
  draggedColumnIndex,
  dragOverColumnIndex,
  enableHorizontalVirtualScrolling = false,
  containerWidth = 1920,
  scrollLeft = 0,
  isEquipmentBasedMode = false,
  isTaskBasedMode = false,
  expandedWorkOrders,
  onToggleWorkOrderExpanded,
}) => {
  // Horizontal virtual scrolling
  // DISABLED based on user feedback: The caching mechanism was causing severe display breakage
  // (blank grids/out of bounds) when switching time scales or resizing.
  const shouldUseHorizontalVirtualScrolling = false;

  const horizontalVirtualScrolling = useHorizontalVirtualScrolling({
    columns,
    columnWidth: (index) => gridState.columnWidths[columns[index].id] || columns[index].width,
    containerWidth,
    scrollLeft,
    overscan: 5,
    enableMemoization: false, // Disabled cache
  });

  // Always use all columns for stability
  const displayColumns = columns;

  const virtualOffset = shouldUseHorizontalVirtualScrolling && horizontalVirtualScrolling.visibleColumns.length > 0 ?
    horizontalVirtualScrolling.visibleColumns[0].left : 0;
  // Use grouped data if provided, otherwise create simple list
  const renderData = useMemo((): [string, HierarchicalData[]][] => {
    if (groupedData) {
      return Object.entries(groupedData);
    }

    // If no grouping, create a single group
    return [['', data]];
  }, [data, groupedData]);

  // Memoize WorkOrderBasedRow data conversion to prevent infinite re-renders
  const taskBasedRows = useMemo(() => {
    if (!isTaskBasedMode) return [];

    return data.map((item: any) => {
      // Use predefined type from ViewModeManager if available
      const rowType = item.type || (item.isGroupHeader ? 'hierarchy' : (item.taskId ? 'workOrderLine' : 'asset'));
      
      return {
        id: item.id,
        type: rowType,
        hierarchyKey: item.isGroupHeader ? 'hierarchy' : undefined,
        hierarchyValue: item.isGroupHeader ? item.task : undefined,
        assetId: item.assetId,
        assetName: item.assetName || (!item.isGroupHeader && !item.taskId ? item.task : undefined),
        hierarchyPath: item.hierarchyPath,
        taskId: item.taskId || item.workOrderId,
        workOrderId: item.workOrderId || item.taskId,
        workOrderName: item.workOrderName || (item.taskId ? item.task : undefined),
        ClassificationId: (item as any).ClassificationId,
        schedule: item.schedule,
        aggregatedSchedule: item.aggregatedSchedule || item.results,
        results: item.results,
        level: item.level || 0,
        bomCode: item.bomCode
      };
    });
  }, [data, isTaskBasedMode]);

  const renderRows = () => {
    // In task-based mode, use WorkOrderBasedRow component
    if (isTaskBasedMode) {
      const visibleRows = taskBasedRows.filter(row => {
        if (row.type === 'workOrder') return true; // Always show parent
        if (row.type === 'assetChild' && row.workOrderId) {
          return expandedWorkOrders?.has(row.workOrderId);
        }
        return true; 
      });

      
      return visibleRows.map((taskBasedRow) => {
        return (
          <WorkOrderBasedRow
            key={taskBasedRow.id}
            row={taskBasedRow}
            columns={displayColumns}
            viewMode={viewMode}
            gridState={gridState}
            onCellEdit={onCellEdit}
            onSelectedCellChange={onSelectedCellChange}
            onEditingCellChange={onEditingCellChange}
            onCellDoubleClick={onCellDoubleClick}
            readOnly={readOnly}
            draggedColumnIndex={draggedColumnIndex}
            dragOverColumnIndex={dragOverColumnIndex}
            enableVirtualScrolling={shouldUseHorizontalVirtualScrolling}
            virtualOffset={virtualOffset}
            displayColumns={displayColumns}
            isFixedArea={isFixedArea}
            isExpanded={expandedWorkOrders?.has(taskBasedRow.workOrderId || '')}
            onToggleExpand={() => onToggleWorkOrderExpanded?.(taskBasedRow.workOrderId || '')}
          />
        );
      });
    }

    // In equipment-based mode or normal mode, use MaintenanceTableRow
    return renderData.map(([hierarchyPath, items]) => (
      <React.Fragment key={hierarchyPath || 'ungrouped'}>
        {/* Group header row (always show to maintain row alignment) */}
        {hierarchyPath && (
          <GroupHeaderRow
            hierarchyPath={hierarchyPath}
            columns={columns}
            isFixedArea={isFixedArea}
          />
        )}

        {/* Data rows */}
        {items.map((item: HierarchicalData) => (
          <MaintenanceTableRow
            key={item.id}
            item={item}
            columns={columns}
            viewMode={viewMode}
            gridState={gridState}
            onCellEdit={onCellEdit}
            onSelectedCellChange={onSelectedCellChange}
            onEditingCellChange={onEditingCellChange}
            onUpdateItem={onUpdateItem}
            onCellDoubleClick={onCellDoubleClick}
            readOnly={readOnly}
            draggedColumnIndex={draggedColumnIndex}
            dragOverColumnIndex={dragOverColumnIndex}
            enableVirtualScrolling={shouldUseHorizontalVirtualScrolling}
            virtualOffset={virtualOffset}
            displayColumns={displayColumns}
            isEquipmentBasedMode={isEquipmentBasedMode}
            isTaskBasedMode={isTaskBasedMode}

          />
        ))}
      </React.Fragment>
    ));
  };

  if (virtualScrolling && data.length > 100) {
    // TODO: Implement virtual scrolling for large datasets
    // For now, fall back to regular rendering
      }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onScrollSync && isScrollableArea) {
      onScrollSync(e.currentTarget.scrollTop);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: isScrollableArea ? 'auto' : 'visible',
        backgroundColor: 'transparent'
      }}
      onScroll={handleScroll}
      style={syncScrollTop !== undefined ? { scrollBehavior: 'auto' } : undefined}
    >
      {renderRows()}
    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceTableBody = React.memo(MaintenanceTableBodyComponent);

export default MaintenanceTableBody;