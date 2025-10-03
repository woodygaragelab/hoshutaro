import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Switch, FormControlLabel } from '@mui/material';
import { HierarchicalData } from './types';
import { EnhancedMaintenanceGrid } from './components/ExcelLikeGrid/EnhancedMaintenanceGrid';

// Sample data that matches the existing App.tsx structure
const sampleData: HierarchicalData[] = [
  {
    id: 'pump-001',
    task: '遠心ポンプ P-001',
    bomCode: 'P-001',
    level: 1,
    cycle: 12,
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 0 },
      { key: '型式', value: 'CP-100A', order: 1 },
      { key: '容量', value: '100 L/min', order: 2 },
      { key: '揚程', value: '50 m', order: 3 },
      { key: '電動機出力', value: '5.5 kW', order: 4 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: false, planCost: 150, actualCost: 0 },
      '2025': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: 'プラント A > ポンプ設備 > 遠心ポンプ'
  },
  {
    id: 'motor-001',
    task: '誘導電動機 M-001',
    bomCode: 'M-001',
    level: 1,
    cycle: 6,
    specifications: [
      { key: '機器名称', value: '誘導電動機', order: 0 },
      { key: '型式', value: 'IM-200B', order: 1 },
      { key: '出力', value: '5.5 kW', order: 2 },
      { key: '電圧', value: '400 V', order: 3 }
    ],
    children: [],
    results: {
      '2024': { planned: false, actual: true, planCost: 0, actualCost: 120 },
      '2025': { planned: true, actual: false, planCost: 180, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: 'プラント A > 電動機設備 > 誘導電動機'
  }
];

const timeHeaders = ['2024', '2025', '2026'];

export const SpecificationEditIntegrationDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(sampleData);
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('both');
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [showBomCode, setShowBomCode] = useState(true);
  const [showCycle, setShowCycle] = useState(true);

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
    console.log('Item updated:', updatedItem);
  };

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edit:', { rowId, columnId, value });
    
    // Update the maintenance data
    const item = data.find(d => d.id === rowId);
    if (item) {
      const updatedResults = { ...item.results };
      if (!updatedResults[columnId]) {
        updatedResults[columnId] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
      }
      updatedResults[columnId] = { ...updatedResults[columnId], ...value };
      
      const updatedItem = { ...item, results: updatedResults };
      handleUpdateItem(updatedItem);
    }
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    console.log('Specification edit:', { rowId, specIndex, key, value });
    
    // This is handled by the SpecificationEditManager, but we can add additional logging here
    if (key === 'add') {
      console.log(`Added new specification to ${rowId}`);
    } else if (key === 'delete') {
      console.log(`Deleted specification ${specIndex} from ${rowId}`);
    } else if (key === 'reorder') {
      console.log(`Reordered specification in ${rowId}: ${value}`);
    } else {
      console.log(`Updated specification ${specIndex} ${key} to "${value}" for ${rowId}`);
    }
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        機器仕様編集機能 - 統合デモ
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        既存のApp.tsxと統合された機器仕様編集機能のデモです。
        星取表と機器仕様の両方を同時に編集できます。
      </Typography>

      {/* Control Panel */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          表示設定
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant={displayMode === 'specifications' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('specifications')}
          >
            機器仕様のみ
          </Button>
          <Button
            variant={displayMode === 'maintenance' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('maintenance')}
          >
            計画実績のみ
          </Button>
          <Button
            variant={displayMode === 'both' ? 'contained' : 'outlined'}
            onClick={() => setDisplayMode('both')}
          >
            両方表示
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={viewMode === 'cost'}
                onChange={(e) => setViewMode(e.target.checked ? 'cost' : 'status')}
              />
            }
            label={`表示モード: ${viewMode === 'cost' ? 'コスト' : '星取'}`}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showBomCode}
                onChange={(e) => setShowBomCode(e.target.checked)}
              />
            }
            label="TAG No.表示"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showCycle}
                onChange={(e) => setShowCycle(e.target.checked)}
              />
            }
            label="周期表示"
          />
        </Box>
      </Paper>

      {/* Grid Component */}
      <Paper sx={{ flex: 1, overflow: 'hidden' }}>
        <EnhancedMaintenanceGrid
          data={data}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={showBomCode}
          showCycle={showCycle}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onUpdateItem={handleUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      </Paper>

      {/* Status Display */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          現在のデータ状態
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 200 }}>
          {JSON.stringify(data, null, 2)}
        </Typography>
      </Paper>
    </Box>
  );
};

export default SpecificationEditIntegrationDemo;