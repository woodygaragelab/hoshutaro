import React, { useState, useMemo } from 'react';
import { Box, Typography, FormControlLabel, Switch, Button, ButtonGroup } from '@mui/material';
import { EnhancedMaintenanceGrid } from './EnhancedMaintenanceGrid';
import { HierarchicalData } from '../../types';

// Sample data that matches the existing HierarchicalData structure
const sampleData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプA-001',
    level: 3,
    bomCode: 'P-001',
    cycle: 12,
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 0 },
      { key: '型式', value: 'CP-100', order: 1 },
      { key: '容量', value: '100L/min', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2025': { planned: false, actual: true, planCost: 0, actualCost: 45000 }
    },
    rolledUpResults: {},
    hierarchyPath: '建屋A > 機械室 > ポンプ設備'
  },
  {
    id: '2',
    task: 'モーターB-002',
    level: 3,
    bomCode: 'M-002',
    cycle: 6,
    specifications: [
      { key: '機器名称', value: '誘導電動機', order: 0 },
      { key: '型式', value: 'IM-200', order: 1 },
      { key: '出力', value: '5.5kW', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: true, planCost: 30000, actualCost: 32000 },
      '2025': { planned: true, actual: false, planCost: 30000, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: '建屋A > 機械室 > 電動機設備'
  },
  {
    id: '3',
    task: 'バルブC-003',
    level: 3,
    bomCode: 'V-003',
    cycle: 24,
    specifications: [
      { key: '機器名称', value: 'ボールバルブ', order: 0 },
      { key: '型式', value: 'BV-50', order: 1 },
      { key: '口径', value: '50A', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2025': { planned: true, actual: false, planCost: 15000, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: '建屋B > 配管室 > バルブ設備'
  }
];

const sampleTimeHeaders = ['2024', '2025', '2026'];

export const EnhancedMaintenanceGridDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(sampleData);
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('maintenance');
  const [showBomCode, setShowBomCode] = useState(true);
  const [showCycle, setShowCycle] = useState(true);

  // Group data by hierarchy path
  const groupedData = useMemo(() => {
    return data.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [data]);

  const handleCellEdit = (rowId: string, timeHeader: string, value: any) => {
    setData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          const updatedResults = { ...item.results };
          updatedResults[timeHeader] = value;
          return { ...item, results: updatedResults };
        }
        return item;
      })
    );
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    setData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          const updatedSpecs = [...(item.specifications || [])];
          if (updatedSpecs[specIndex]) {
            updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], [key]: value };
          }
          return { ...item, specifications: updatedSpecs };
        }
        return item;
      })
    );
  };

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Enhanced Maintenance Grid Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" gutterBottom>
        This demo shows the integration of the existing HierarchicalData structure with Excel-like grid functionality.
        It preserves the existing TableRow component behavior while adding enhanced editing capabilities.
      </Typography>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={viewMode === 'cost'}
              onChange={(e) => setViewMode(e.target.checked ? 'cost' : 'status')}
            />
          }
          label={`View Mode: ${viewMode === 'cost' ? 'Cost' : 'Status'}`}
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={showBomCode}
              onChange={(e) => setShowBomCode(e.target.checked)}
            />
          }
          label="Show TAG No."
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={showCycle}
              onChange={(e) => setShowCycle(e.target.checked)}
            />
          }
          label="Show Cycle"
        />

        <ButtonGroup variant="outlined" size="small">
          <Button
            variant={displayMode === 'specifications' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('specifications')}
          >
            Specifications Only
          </Button>
          <Button
            variant={displayMode === 'maintenance' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('maintenance')}
          >
            Maintenance Only
          </Button>
          <Button
            variant={displayMode === 'both' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('both')}
          >
            Both
          </Button>
        </ButtonGroup>
      </Box>

      {/* Grid */}
      <Box sx={{ flex: 1, border: '1px solid #ddd', borderRadius: 1 }}>
        <EnhancedMaintenanceGrid
          data={data}
          timeHeaders={sampleTimeHeaders}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={showBomCode}
          showCycle={showCycle}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onUpdateItem={handleUpdateItem}
          groupedData={groupedData}
        />
      </Box>

      {/* Instructions */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Instructions:
        </Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li>Click on any cell to select it</li>
            <li>Double-click or press Enter/F2 to edit a cell</li>
            <li>Use Tab, Enter, and arrow keys to navigate between cells</li>
            <li>Press Escape to cancel editing</li>
            <li>Switch between display modes to see specifications, maintenance data, or both</li>
            <li>Toggle view mode between status symbols and cost values</li>
            <li>The grid preserves all existing HierarchicalData functionality</li>
          </ul>
        </Typography>
      </Box>
    </Box>
  );
};

export default EnhancedMaintenanceGridDemo;