import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import MaintenanceTableRow from './MaintenanceTableRow';
import GroupHeaderRow from './GroupHeaderRow';
import { TaskBasedRow } from './TaskBasedRow';
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
  // Asset selection props
  selectedAssets?: string[];
  onAssetSelectionToggle?: (assetId: string, event: React.MouseEvent) => void;
  showSelectionCheckbox?: boolean;
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
  // Asset selection props
  selectedAssets = [],
  onAssetSelectionToggle,
  showSelectionCheckbox = false,
}) => {
  console.log('[MaintenanceTableBody] Component rendered with data:', {
    dataLength: data.length,
    isTaskBasedMode,
    isEquipmentBasedMode,
    sampleData: data.slice(0, 3),
    columnsLength: columns.length
  });

  // Horizontal virtual scrolling
  const shouldUseHorizontalVirtualScrolling = enableHorizontalVirtualScrolling && columns.length > 50;

  const horizontalVirtualScrolling = useHorizontalVirtualScrolling({
    columns,
    columnWidth: (index) => gridState.columnWidths[columns[index].id] || columns[index].width,
    containerWidth,
    scrollLeft,
    overscan: 5,
    enableMemoization: true,
  });

  // Use virtual columns if enabled, otherwise use all columns
  const displayColumns = shouldUseHorizontalVirtualScrolling ?
    horizontalVirtualScrolling.visibleColumns.map(vc => vc.data) :
    columns;

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

  // Memoize TaskBasedRow data conversion to prevent infinite re-renders
  const taskBasedRows = useMemo(() => {
    if (!isTaskBasedMode) return [];

    return data.map((item: any) => {
      // Convert HierarchicalData to TaskBasedRow format
      return {
        id: item.id,
        type: (item.isGroupHeader ? 'hierarchy' : (item.taskId ? 'workOrderLine' : 'asset')) as 'hierarchy' | 'workOrderLine' | 'asset',
        hierarchyKey: item.isGroupHeader ? 'hierarchy' : undefined,
        hierarchyValue: item.isGroupHeader ? item.task : undefined,
        assetId: item.assetId,
        assetName: !item.isGroupHeader && !item.taskId ? item.task : undefined,
        hierarchyPath: item.hierarchyPath,
        taskId: item.taskId,
        taskName: item.taskId ? item.task : undefined,
        classification: item.classification,
        schedule: item.schedule,
        results: item.results,
        level: item.level || 0
      };
    });
  }, [data, isTaskBasedMode]);

  const renderRows = () => {
    // In task-based mode, use TaskBasedRow component
    if (isTaskBasedMode) {
      return taskBasedRows.map((taskBasedRow) => {
        return (
          <TaskBasedRow
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
            // Asset selection props
            isAssetSelected={selectedAssets.includes(item.id)}
            onAssetSelectionToggle={onAssetSelectionToggle}
            showSelectionCheckbox={showSelectionCheckbox}
          />
        ))}
      </React.Fragment>
    ));
  };

  if (virtualScrolling && data.length > 100) {
    // TODO: Implement virtual scrolling for large datasets
    // For now, fall back to regular rendering
    console.warn('Virtual scrolling not yet implemented for MaintenanceTableBody');
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