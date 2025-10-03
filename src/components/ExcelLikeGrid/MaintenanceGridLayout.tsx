import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, DisplayAreaConfig, GridState } from './types';
import TableRow from '../TableRow';
import TableHeader from '../TableHeader';
import { MaintenanceGridCell } from './MaintenanceGridCell';
import { SpecificationTable } from './SpecificationTable';

interface MaintenanceGridLayoutProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  displayAreaConfig: DisplayAreaConfig;
  gridState: GridState;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onRowResize: (rowId: string, height: number) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
  showBomCode: boolean;
  showCycle: boolean;
  groupedData?: { [key: string]: HierarchicalData[] };
}

export const MaintenanceGridLayout: React.FC<MaintenanceGridLayoutProps> = ({
  data,
  columns,
  timeHeaders,
  viewMode,
  displayAreaConfig,
  gridState,
  onCellEdit,
  onColumnResize,
  onRowResize,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  onSpecificationEdit,
  virtualScrolling,
  readOnly,
  showBomCode,
  showCycle,
  groupedData
}) => {
  // Group data for rendering if not already grouped
  const displayGroupedData = useMemo(() => {
    if (groupedData) {
      return groupedData;
    }
    
    return data.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [data, groupedData]);

  // Calculate table styles for fixed positioning
  const tableStyles = useMemo(() => {
    const taskNameWidth = columns.find(col => col.id === 'task')?.width || 250;
    const bomCodeWidth = showBomCode ? (columns.find(col => col.id === 'bomCode')?.width || 150) : 0;

    const bomCodeLeft = taskNameWidth;
    let cycleLeft = taskNameWidth;
    if (showBomCode) {
      cycleLeft += bomCodeWidth;
    }

    return {
      '--bom-code-left': `${bomCodeLeft}px`,
      '--cycle-left': `${cycleLeft}px`,
    } as React.CSSProperties;
  }, [columns, showBomCode]);

  // Render different layouts based on display mode
  const renderMaintenanceTable = () => (
    <div className="table-container" style={tableStyles}>
      <table className="table table-bordered table-hover maintenance-table">
        <TableHeader
          timeHeaders={timeHeaders}
          timeScale="year" // This should be passed from parent
          showBomCode={showBomCode}
          showCycle={showCycle}
        />
        <tbody>
          {Object.entries(displayGroupedData).map(([hierarchyPath, items]) => (
            <React.Fragment key={hierarchyPath}>
              <tr className="group-header-row">
                <td
                  className="group-header-sticky-cell"
                  colSpan={1 + (showBomCode ? 1 : 0) + (showCycle ? 1 : 0)}
                >
                  {hierarchyPath}
                </td>
                <td
                  className="group-header-timeline-cell"
                  colSpan={timeHeaders.length}
                />
              </tr>
              {items.map(item => (
                <TableRow 
                  key={item.id} 
                  item={item} 
                  allTimeHeaders={timeHeaders} 
                  viewMode={viewMode} 
                  onUpdateItem={onUpdateItem} 
                  showBomCode={showBomCode} 
                  showCycle={showCycle} 
                />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSpecificationsTable = () => (
    <SpecificationTable
      data={data}
      gridState={gridState}
      onSelectedCellChange={onSelectedCellChange}
      onEditingCellChange={onEditingCellChange}
      onUpdateItem={onUpdateItem}
      onSpecificationEdit={onSpecificationEdit}
      readOnly={readOnly}
      showBomCode={showBomCode}
      groupedData={displayGroupedData}
    />
  );

  const renderBothTables = () => (
    <div className="split-view-container">
      <div className="fixed-columns-section">
        <table className="table table-bordered table-hover fixed-table">
          <thead>
            <tr>
              <th>機器名</th>
              {showBomCode && <th>TAG No.</th>}
              {showCycle && <th>周期</th>}
            </tr>
          </thead>
          <tbody>
            {Object.entries(displayGroupedData).map(([hierarchyPath, items]) => (
              <React.Fragment key={hierarchyPath}>
                <tr className="group-header-row">
                  <td
                    className="group-header-sticky-cell"
                    colSpan={1 + (showBomCode ? 1 : 0) + (showCycle ? 1 : 0)}
                  >
                    {hierarchyPath}
                  </td>
                </tr>
                {items.map(item => (
                  <tr key={item.id} data-id={item.id}>
                    <MaintenanceGridCell
                      item={item}
                      column={columns.find(col => col.id === 'task')!}
                      value={item.task}
                      isSelected={gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === 'task'}
                      isEditing={gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === 'task'}
                      onEdit={onCellEdit}
                      onSelect={onSelectedCellChange}
                      onEditingChange={onEditingCellChange}
                      readOnly={readOnly}
                    />
                    {showBomCode && (
                      <MaintenanceGridCell
                        item={item}
                        column={columns.find(col => col.id === 'bomCode')!}
                        value={item.bomCode}
                        isSelected={gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === 'bomCode'}
                        isEditing={gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === 'bomCode'}
                        onEdit={onCellEdit}
                        onSelect={onSelectedCellChange}
                        onEditingChange={onEditingCellChange}
                        readOnly={true}
                      />
                    )}
                    {showCycle && (
                      <MaintenanceGridCell
                        item={item}
                        column={columns.find(col => col.id === 'cycle')!}
                        value={item.cycle || ''}
                        isSelected={gridState.selectedCell?.rowId === item.id && gridState.selectedCell?.columnId === 'cycle'}
                        isEditing={gridState.editingCell?.rowId === item.id && gridState.editingCell?.columnId === 'cycle'}
                        onEdit={onCellEdit}
                        onSelect={onSelectedCellChange}
                        onEditingChange={onEditingCellChange}
                        readOnly={readOnly}
                      />
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="scrollable-areas-container">
        {displayAreaConfig.scrollableAreas.specifications?.visible && (
          <div className="specifications-scroll-area">
            {renderSpecificationsTable()}
          </div>
        )}
        
        {displayAreaConfig.scrollableAreas.maintenance?.visible && (
          <div className="maintenance-scroll-area">
            {renderMaintenanceTable()}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {displayAreaConfig.mode === 'maintenance' && renderMaintenanceTable()}
      {displayAreaConfig.mode === 'specifications' && renderSpecificationsTable()}
      {displayAreaConfig.mode === 'both' && renderBothTables()}
    </Box>
  );
};

export default MaintenanceGridLayout;