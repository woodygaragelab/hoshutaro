import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import MaintenanceTableRow from './MaintenanceTableRow';
import GroupHeaderRow from './GroupHeaderRow';
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
  scrollLeft = 0
}) => {
  // Horizontal virtual scrolling
  const shouldUseHorizontalVirtualScrolling = enableHorizontalVirtualScrolling && columns.length > 50;
  
  const horizontalVirtualScrolling = useHorizontalVirtualScrolling({
    columns,
    columnWidth: (index) => gridState.columnWidths[columns[index].id] || columns[index].width,
    containerWidth,
    overscan: 5,
    enableMemoization: true,
  });

  // Update virtual scrolling when scrollLeft changes
  React.useEffect(() => {
    if (shouldUseHorizontalVirtualScrolling) {
      horizontalVirtualScrolling.handleScroll(scrollLeft);
    }
  }, [scrollLeft, shouldUseHorizontalVirtualScrolling]);

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

  const renderRows = () => {
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