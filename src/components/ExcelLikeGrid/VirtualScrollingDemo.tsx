import React, { useState, useMemo } from 'react';
import { Box, Typography, Button, Slider, FormControlLabel, Switch, Paper } from '@mui/material';
import { ExcelLikeGrid } from './ExcelLikeGrid';
import { GridColumn, DisplayAreaConfig } from './types';
import { HierarchicalData } from '../../types';

const VirtualScrollingDemo: React.FC = () => {
  const [dataSize, setDataSize] = useState(1000);
  const [virtualScrollingEnabled, setVirtualScrollingEnabled] = useState(true);
  const [displayMode, setDisplayMode] = useState<'maintenance' | 'specifications' | 'both'>('maintenance');

  // Generate large dataset for performance testing
  const data = useMemo((): HierarchicalData[] => {
    const items: HierarchicalData[] = [];
    
    for (let i = 0; i < dataSize; i++) {
      const item: HierarchicalData = {
        id: `item-${i}`,
        task: `設備 ${i + 1}`,
        bomCode: `BOM-${String(i + 1).padStart(4, '0')}`,
        level: Math.floor(i / 100) + 1,
        specifications: [
          { key: '機器名称', value: `設備名 ${i + 1}`, order: 1 },
          { key: '型式', value: `MODEL-${i + 1}`, order: 2 },
          { key: '製造年', value: `${2020 + (i % 4)}`, order: 3 },
          { key: '容量', value: `${100 + (i % 500)}kW`, order: 4 }
        ],
        children: [],
        results: {},
        rolledUpResults: {}
      };

      // Generate maintenance data for multiple years
      const years = ['2024', '2025', '2026'];
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      
      years.forEach(year => {
        months.forEach(month => {
          const key = `${year}-${month}`;
          // Simulate different maintenance statuses
          const planned = Math.random() > 0.5;
          const actual = Math.random() > 0.5;
          item.results[key] = {
            planned,
            actual,
            planCost: planned ? Math.floor(Math.random() * 100000) : 0,
            actualCost: actual ? Math.floor(Math.random() * 120000) : 0
          };
          item.rolledUpResults[key] = item.results[key];
        });
      });

      items.push(item);
    }
    
    return items;
  }, [dataSize]);

  // Define columns for the grid
  const columns = useMemo((): GridColumn[] => {
    const baseColumns: GridColumn[] = [
      {
        id: 'task',
        header: '設備名',
        width: 200,
        minWidth: 150,
        maxWidth: 300,
        resizable: true,
        sortable: true,
        type: 'text',
        editable: false
      },
      {
        id: 'bomCode',
        header: 'BOMコード',
        width: 120,
        minWidth: 100,
        maxWidth: 150,
        resizable: true,
        sortable: true,
        type: 'text',
        editable: false
      }
    ];

    // Add specification columns
    const specColumns: GridColumn[] = [
      {
        id: 'spec_name',
        header: '機器名称',
        width: 150,
        minWidth: 100,
        maxWidth: 200,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: true
      },
      {
        id: 'spec_model',
        header: '型式',
        width: 120,
        minWidth: 100,
        maxWidth: 150,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: true
      },
      {
        id: 'spec_year',
        header: '製造年',
        width: 100,
        minWidth: 80,
        maxWidth: 120,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: true
      },
      {
        id: 'spec_capacity',
        header: '容量',
        width: 100,
        minWidth: 80,
        maxWidth: 120,
        resizable: true,
        sortable: false,
        type: 'text',
        editable: true
      }
    ];

    // Add maintenance columns (3 years × 12 months)
    const maintenanceColumns: GridColumn[] = [];
    const years = ['2024', '2025', '2026'];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    years.forEach(year => {
      months.forEach(month => {
        maintenanceColumns.push({
          id: `${year}-${month}`,
          header: `${year}/${month}`,
          width: 80,
          minWidth: 60,
          maxWidth: 100,
          resizable: true,
          sortable: false,
          type: 'status',
          editable: true
        });
      });
    });

    return [...baseColumns, ...specColumns, ...maintenanceColumns];
  }, []);

  // Display area configuration
  const displayAreaConfig = useMemo((): DisplayAreaConfig => ({
    mode: displayMode,
    fixedColumns: ['task', 'bomCode'],
    scrollableAreas: {
      specifications: {
        visible: displayMode === 'specifications' || displayMode === 'both',
        width: 400,
        columns: ['spec_name', 'spec_model', 'spec_year', 'spec_capacity']
      },
      maintenance: {
        visible: displayMode === 'maintenance' || displayMode === 'both',
        width: 800,
        columns: columns.filter(col => 
          col.id.match(/^\d{4}-\d{2}$/)
        ).map(col => col.id)
      }
    }
  }), [displayMode, columns]);

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edited:', { rowId, columnId, value });
  };

  const handleColumnResize = (columnId: string, width: number) => {
    console.log('Column resized:', { columnId, width });
  };

  const handleRowResize = (rowId: string, height: number) => {
    console.log('Row resized:', { rowId, height });
  };

  const handleDisplayAreaChange = (config: DisplayAreaConfig) => {
    setDisplayMode(config.mode);
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        Virtual Scrolling Performance Demo
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 200 }}>
            <Typography gutterBottom>
              Data Size: {dataSize.toLocaleString()} rows
            </Typography>
            <Slider
              value={dataSize}
              onChange={(_, value) => setDataSize(value as number)}
              min={100}
              max={10000}
              step={100}
              marks={[
                { value: 100, label: '100' },
                { value: 1000, label: '1K' },
                { value: 5000, label: '5K' },
                { value: 10000, label: '10K' }
              ]}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Switch
                checked={virtualScrollingEnabled}
                onChange={(e) => setVirtualScrollingEnabled(e.target.checked)}
              />
            }
            label="Virtual Scrolling"
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={displayMode === 'maintenance' ? 'contained' : 'outlined'}
              onClick={() => setDisplayMode('maintenance')}
              size="small"
            >
              Maintenance Only
            </Button>
            <Button
              variant={displayMode === 'specifications' ? 'contained' : 'outlined'}
              onClick={() => setDisplayMode('specifications')}
              size="small"
            >
              Specifications Only
            </Button>
            <Button
              variant={displayMode === 'both' ? 'contained' : 'outlined'}
              onClick={() => setDisplayMode('both')}
              size="small"
            >
              Both Areas
            </Button>
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Press Ctrl+Shift+P to toggle performance monitor. 
          Total cells: {(dataSize * columns.length).toLocaleString()}
        </Typography>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ExcelLikeGrid
          data={data}
          columns={columns}
          displayAreaConfig={displayAreaConfig}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onDisplayAreaChange={handleDisplayAreaChange}
          virtualScrolling={virtualScrollingEnabled}
          readOnly={false}
        />
      </Box>
    </Box>
  );
};

export default VirtualScrollingDemo;