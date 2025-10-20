import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState } from '../ExcelLikeGrid/types';
import MaintenanceTableRow from './MaintenanceTableRow';
import GroupHeaderRow from './GroupHeaderRow';

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
}

export const MaintenanceTableBody: React.FC<MaintenanceTableBodyProps> = ({
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
  onScrollSync
}) => {
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
        {/* Group header row (only if we have a meaningful hierarchy path) */}
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
        backgroundColor: 'background.paper'
      }}
      onScroll={handleScroll}
      style={syncScrollTop !== undefined ? { scrollBehavior: 'auto' } : undefined}
    >
      {renderRows()}
    </Box>
  );
};

export default MaintenanceTableBody;