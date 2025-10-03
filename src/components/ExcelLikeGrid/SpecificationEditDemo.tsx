import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Divider } from '@mui/material';
import { HierarchicalData } from '../../types';
import { EnhancedMaintenanceGrid } from './EnhancedMaintenanceGrid';

// Sample data for demonstration
const sampleData: HierarchicalData[] = [
  {
    id: 'pump-001',
    task: '遠心ポンプ P-001',
    bomCode: 'P-001',
    level: 1,
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
  },
  {
    id: 'valve-001',
    task: 'ボールバルブ V-001',
    bomCode: 'V-001',
    level: 1,
    specifications: [
      { key: '機器名称', value: 'ボールバルブ', order: 0 },
      { key: '型式', value: 'BV-50', order: 1 },
      { key: '口径', value: '50A', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: true, planCost: 80, actualCost: 75 },
      '2025': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {},
    hierarchyPath: 'プラント B > バルブ設備 > ボールバルブ'
  }
];

const timeHeaders = ['2024', '2025', '2026'];

export const SpecificationEditDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(sampleData);
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('specifications');
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
    console.log('Item updated:', updatedItem);
  };

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edit:', { rowId, columnId, value });
    // This would typically update the maintenance data
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    console.log('Specification edit:', { rowId, specIndex, key, value });
    // Additional logging or processing for specification changes
  };

  const handleColumnResize = (columnId: string, width: number) => {
    console.log('Column resize:', { columnId, width });
  };

  const handleRowResize = (rowId: string, height: number) => {
    console.log('Row resize:', { rowId, height });
  };

  return (
    <Box sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        機器仕様編集機能デモ
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        このデモでは、機器仕様のインライン編集機能を試すことができます。
        仕様項目をダブルクリックして編集し、右クリックまたはメニューボタンで項目の追加・削除・並び替えが可能です。
      </Typography>

      {/* Control Panel */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          表示設定
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
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

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant={viewMode === 'status' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('status')}
          >
            星取表示
          </Button>
          <Button
            variant={viewMode === 'cost' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('cost')}
          >
            コスト表示
          </Button>
        </Box>
      </Paper>

      {/* Grid Component */}
      <Paper sx={{ flex: 1, overflow: 'hidden' }}>
        <EnhancedMaintenanceGrid
          data={data}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={true}
          showCycle={false}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onUpdateItem={handleUpdateItem}
          virtualScrolling={false}
          readOnly={false}
        />
      </Paper>

      {/* Instructions */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          操作方法
        </Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li><strong>編集開始:</strong> セルをダブルクリック、またはセル選択後にEnter/F2キー</li>
            <li><strong>編集確定:</strong> Enter/Tabキー</li>
            <li><strong>編集キャンセル:</strong> Escキー</li>
            <li><strong>仕様項目追加:</strong> 仕様項目名を右クリック、またはInsertキー</li>
            <li><strong>仕様項目削除:</strong> 仕様項目名を右クリック、またはDeleteキー</li>
            <li><strong>並び替え:</strong> 右クリックメニューから「上に移動」「下に移動」</li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
};

export default SpecificationEditDemo;