import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn, GridState, DisplayAreaConfig } from '../ExcelLikeGrid/types';
import Resizer from './Resizer';

interface MaintenanceGridLayoutProps {
  data: HierarchicalData[];
  columns: GridColumn[];
  displayAreaConfig: DisplayAreaConfig;
  gridState: GridState;
  viewMode: 'status' | 'cost';
  groupedData?: { [key: string]: HierarchicalData[] };
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onColumnResize: (columnId: string, width: number) => void;
  onRowResize: (rowId: string, height: number) => void;
  onSelectedCellChange: (rowId: string | null, columnId: string | null) => void;
  onEditingCellChange: (rowId: string | null, columnId: string | null) => void;
  onSelectedRangeChange: (range: any) => void;
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  virtualScrolling: boolean;
  readOnly: boolean;
}
import MaintenanceTableHeader from './MaintenanceTableHeader';
import MaintenanceTableBody from './MaintenanceTableBody';

export const MaintenanceGridLayout: React.FC<MaintenanceGridLayoutProps> = ({
  data,
  columns,
  displayAreaConfig,
  gridState,
  viewMode,
  groupedData,
  onCellEdit,
  onColumnResize,
  onSelectedCellChange,
  onEditingCellChange,
  onUpdateItem,
  virtualScrolling,
  readOnly
}) => {
  // Scroll synchronization state
  const [syncScrollTop, setSyncScrollTop] = useState(0);
  const fixedAreaRef = useRef<HTMLDivElement>(null);
  const specAreaRef = useRef<HTMLDivElement>(null);
  const maintenanceAreaRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Organize columns by area
  const columnsByArea = useMemo(() => {
    const fixed = columns.filter(col => displayAreaConfig.fixedColumns.includes(col.id));
    const specifications = columns.filter(col => 
      displayAreaConfig.scrollableAreas.specifications?.columns.includes(col.id) || false
    );
    const maintenance = columns.filter(col => 
      displayAreaConfig.scrollableAreas.maintenance?.columns.includes(col.id) || false
    );

    return { fixed, specifications, maintenance };
  }, [columns, displayAreaConfig]);

  // Resizable area widths state
  const [fixedAreaWidth, setFixedAreaWidth] = useState<number>(250);
  const [specAreaWidth, setSpecAreaWidth] = useState<number>(400);

  // Initialize area widths based on columns and config
  useEffect(() => {
    const initialFixedWidth = columnsByArea.fixed?.reduce((sum, col) => sum + col.width, 0) || 250;
    const initialSpecWidth = displayAreaConfig.scrollableAreas.specifications?.width || 400;
    
    setFixedAreaWidth(initialFixedWidth);
    setSpecAreaWidth(initialSpecWidth);
  }, [columnsByArea.fixed, displayAreaConfig.scrollableAreas.specifications?.width]);

  // Handle scroll synchronization between areas
  const handleScrollSync = useCallback((scrollTop: number, sourceArea: 'fixed' | 'spec' | 'maintenance') => {
    if (isScrollingSyncRef.current) return;
    
    isScrollingSyncRef.current = true;
    setSyncScrollTop(scrollTop);
    
    // Sync scroll position to other areas
    if (sourceArea !== 'fixed' && fixedAreaRef.current) {
      fixedAreaRef.current.scrollTop = scrollTop;
    }
    if (sourceArea !== 'spec' && specAreaRef.current) {
      specAreaRef.current.scrollTop = scrollTop;
    }
    if (sourceArea !== 'maintenance' && maintenanceAreaRef.current) {
      maintenanceAreaRef.current.scrollTop = scrollTop;
    }
    
    // Reset sync flag after a short delay
    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 50);
  }, []);

  // Determine layout based on display mode
  const layoutStyle = useMemo(() => {
    const { mode } = displayAreaConfig;
    
    if (mode === 'both') {
      return {
        display: 'flex',
        flexDirection: 'row' as const,
        height: '100%',
        overflow: 'hidden'
      };
    }
    
    return {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      overflow: 'auto'
    };
  }, [displayAreaConfig.mode]);

  // Handle resizing of areas
  const handleFixedAreaResize = useCallback((delta: number) => {
    setFixedAreaWidth(prev => Math.max(150, Math.min(600, prev + delta)));
  }, []);

  const handleSpecAreaResize = useCallback((delta: number) => {
    setSpecAreaWidth(prev => Math.max(200, Math.min(800, prev + delta)));
  }, []);

  // Calculate area widths for split layout
  const areaWidths = useMemo(() => {
    const fixedWidth = fixedAreaWidth;
    const specWidth = specAreaWidth;
    const maintenanceWidth = displayAreaConfig.scrollableAreas.maintenance?.width || 0;
    
    return { fixedWidth, specWidth, maintenanceWidth };
  }, [fixedAreaWidth, specAreaWidth, displayAreaConfig.scrollableAreas]);

  const renderSingleArea = () => {
    const visibleColumns = [
      ...columnsByArea.fixed,
      ...(displayAreaConfig.mode === 'specifications' ? columnsByArea.specifications : []),
      ...(displayAreaConfig.mode === 'maintenance' ? columnsByArea.maintenance : [])
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <MaintenanceTableHeader
          columns={visibleColumns}
          gridState={gridState}
          onColumnResize={onColumnResize}
        />
        <MaintenanceTableBody
          data={data}
          columns={visibleColumns}
          gridState={gridState}
          viewMode={viewMode}
          groupedData={groupedData}
          onCellEdit={onCellEdit}
          onSelectedCellChange={onSelectedCellChange}
          onEditingCellChange={onEditingCellChange}
          onUpdateItem={onUpdateItem}
          virtualScrolling={virtualScrolling}
          readOnly={readOnly}
        />
      </Box>
    );
  };

  const renderSplitAreas = () => {
    return (
      <Box sx={layoutStyle}>
        {/* Fixed columns area - Equipment list */}
        <Box
          sx={{
            width: areaWidths.fixedWidth,
            minWidth: areaWidths.fixedWidth,
            maxWidth: areaWidths.fixedWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '2px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            position: 'relative',
            zIndex: 2,
            boxShadow: '2px 0 4px rgba(0,0,0,0.08)'
          }}
        >
          {/* Resizer for fixed area */}
          <Resizer
            direction="horizontal"
            onResize={handleFixedAreaResize}
            className="fixed-area-resizer"
          />
          <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <MaintenanceTableHeader
              columns={columnsByArea.fixed}
              gridState={gridState}
              onColumnResize={onColumnResize}
            />
          </Box>
          <Box 
            ref={fixedAreaRef}
            sx={{ 
              overflow: 'auto', 
              flex: 1,
              '&::-webkit-scrollbar': {
                width: '0px',
                background: 'transparent'
              }
            }}
            onScroll={(e) => handleScrollSync(e.currentTarget.scrollTop, 'fixed')}
          >
            <MaintenanceTableBody
              data={data}
              columns={columnsByArea.fixed}
              gridState={gridState}
              viewMode={viewMode}
              groupedData={groupedData}
              onCellEdit={onCellEdit}
              onSelectedCellChange={onSelectedCellChange}
              onEditingCellChange={onEditingCellChange}
              onUpdateItem={onUpdateItem}
              virtualScrolling={virtualScrolling}
              readOnly={readOnly}
              isFixedArea={true}
              syncScrollTop={syncScrollTop}
            />
          </Box>
        </Box>

        {/* Scrollable areas container */}
        <Box sx={{ 
          display: 'flex', 
          flex: 1, 
          minWidth: 0, // Allow shrinking
          overflow: 'hidden' 
        }}>
          {/* Specifications area */}
          {displayAreaConfig.scrollableAreas.specifications?.visible && (
            <Box
              sx={{
                width: displayAreaConfig.scrollableAreas.maintenance?.visible ? 
                  `${areaWidths.specWidth}px` : '100%',
                minWidth: displayAreaConfig.scrollableAreas.maintenance?.visible ? 
                  `${areaWidths.specWidth}px` : 'auto',
                maxWidth: displayAreaConfig.scrollableAreas.maintenance?.visible ? 
                  `${areaWidths.specWidth}px` : 'none',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: displayAreaConfig.scrollableAreas.maintenance?.visible ? '1px solid' : 'none',
                borderColor: 'divider',
                overflow: 'hidden',
                backgroundColor: 'background.paper',
                position: 'relative',
                boxShadow: 'none'
              }}
            >
              {/* Resizer for specifications area (only show when maintenance area is also visible) */}
              {displayAreaConfig.scrollableAreas.maintenance?.visible && (
                <Resizer
                  direction="horizontal"
                  onResize={handleSpecAreaResize}
                  className="spec-area-resizer"
                />
              )}
              <Box sx={{ width: '100%', overflow: 'hidden' }}>
                <MaintenanceTableHeader
                  columns={columnsByArea.specifications}
                  gridState={gridState}
                  onColumnResize={onColumnResize}
                />
              </Box>
              <Box 
                ref={specAreaRef}
                sx={{ 
                  overflow: 'auto', 
                  flex: 1,
                  '&::-webkit-scrollbar': {
                    width: '0px',
                    background: 'transparent'
                  }
                }}
                onScroll={(e) => handleScrollSync(e.currentTarget.scrollTop, 'spec')}
              >
                <MaintenanceTableBody
                  data={data}
                  columns={columnsByArea.specifications}
                  gridState={gridState}
                  viewMode={viewMode}
                  groupedData={groupedData}
                  onCellEdit={onCellEdit}
                  onSelectedCellChange={onSelectedCellChange}
                  onEditingCellChange={onEditingCellChange}
                  onUpdateItem={onUpdateItem}
                  virtualScrolling={virtualScrolling}
                  readOnly={readOnly}
                  isScrollableArea={true}
                  syncScrollTop={syncScrollTop}
                />
              </Box>
            </Box>
          )}

          {/* Maintenance area */}
          {displayAreaConfig.scrollableAreas.maintenance?.visible && (
            <Box
              sx={{
                flex: 1,
                minWidth: 0, // Allow shrinking
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'background.paper'
              }}
            >
              <Box sx={{ width: '100%', overflow: 'hidden' }}>
                <MaintenanceTableHeader
                  columns={columnsByArea.maintenance}
                  gridState={gridState}
                  onColumnResize={onColumnResize}
                />
              </Box>
              <Box 
                ref={maintenanceAreaRef}
                sx={{ 
                  overflow: 'auto', 
                  flex: 1,
                  '&::-webkit-scrollbar': {
                    width: '8px',
                    height: '8px'
                  },
                  '&::-webkit-scrollbar-track': {
                    backgroundColor: 'rgba(0,0,0,0.1)'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px'
                  }
                }}
                onScroll={(e) => handleScrollSync(e.currentTarget.scrollTop, 'maintenance')}
              >
                <MaintenanceTableBody
                  data={data}
                  columns={columnsByArea.maintenance}
                  gridState={gridState}
                  viewMode={viewMode}
                  groupedData={groupedData}
                  onCellEdit={onCellEdit}
                  onSelectedCellChange={onSelectedCellChange}
                  onEditingCellChange={onEditingCellChange}
                  onUpdateItem={onUpdateItem}
                  virtualScrolling={virtualScrolling}
                  readOnly={readOnly}
                  isScrollableArea={true}
                  syncScrollTop={syncScrollTop}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ flex: 1, overflow: 'hidden' }}>
      {displayAreaConfig.mode === 'both' ? renderSplitAreas() : renderSingleArea()}
    </Box>
  );
};

export default MaintenanceGridLayout;