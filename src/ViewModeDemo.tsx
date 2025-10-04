import React, { useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, Paper } from '@mui/material';
import EnhancedMaintenanceGrid from './components/EnhancedMaintenanceGrid/EnhancedMaintenanceGrid';
import { HierarchicalData } from './types';

const sampleData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプ点検',
    bomCode: 'P001',
    cycle: 6,
    level: 3,
    hierarchyPath: '機械設備 > ポンプ > 冷却水ポンプ',
    children: [],
    specifications: [
      { key: '機器名称', value: '冷却水ポンプ', order: 0 },
      { key: '型式', value: 'CP-100', order: 1 },
      { key: '容量', value: '100L/min', order: 2 }
    ],
    results: {
      '2024': {
        planned: true,
        actual: true,
        planCost: 50,
        actualCost: 45
      },
      '2025': {
        planned: true,
        actual: false,
        planCost: 55,
        actualCost: 0
      }
    },
    rolledUpResults: {}
  },
  {
    id: '2',
    task: 'モーター交換',
    bomCode: 'M001',
    cycle: 24,
    level: 3,
    hierarchyPath: '機械設備 > モーター > 駆動モーター',
    children: [],
    specifications: [
      { key: '機器名称', value: '駆動モーター', order: 0 },
      { key: '型式', value: 'MT-200', order: 1 },
      { key: '出力', value: '5kW', order: 2 }
    ],
    results: {
      '2024': {
        planned: false,
        actual: true,
        planCost: 0,
        actualCost: 200
      },
      '2025': {
        planned: true,
        actual: false,
        planCost: 180,
        actualCost: 0
      }
    },
    rolledUpResults: {}
  }
];

const ViewModeDemo: React.FC = () => {
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('maintenance');

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'status' | 'cost' | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleDisplayModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'specifications' | 'maintenance' | 'both' | null
  ) => {
    if (newMode !== null) {
      setDisplayMode(newMode);
    }
  };

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edit:', { rowId, columnId, value });
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    console.log('Specification edit:', { rowId, specIndex, key, value });
  };

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    console.log('Update item:', updatedItem);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        ViewMode Integration Demo
      </Typography>
      
      <Paper sx={{ padding: 2, marginBottom: 2 }}>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              表示モード:
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              <ToggleButton value="status">
                星取表示
              </ToggleButton>
              <ToggleButton value="cost">
                コスト表示
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              表示エリア:
            </Typography>
            <ToggleButtonGroup
              value={displayMode}
              exclusive
              onChange={handleDisplayModeChange}
              size="small"
            >
              <ToggleButton value="specifications">
                機器仕様
              </ToggleButton>
              <ToggleButton value="maintenance">
                計画実績
              </ToggleButton>
              <ToggleButton value="both">
                両方表示
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ height: '600px', border: '1px solid', borderColor: 'divider' }}>
        <EnhancedMaintenanceGrid
          data={sampleData}
          timeHeaders={['2024', '2025']}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={true}
          showCycle={true}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onUpdateItem={handleUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      </Box>
    </Box>
  );
};

export default ViewModeDemo;