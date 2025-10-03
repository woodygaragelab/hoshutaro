import React, { useState } from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';
import { ExcelLikeGrid } from './ExcelLikeGrid';
import { GridColumn } from './types';
import { HierarchicalData } from '../../types';

// Test data for keyboard navigation
const testData: HierarchicalData[] = [
  {
    id: '1',
    task: 'Equipment A',
    level: 1,
    bomCode: 'EQ001',
    cycle: 1,
    specifications: [],
    children: [],
    results: {},
    rolledUpResults: {}
  },
  {
    id: '2',
    task: 'Equipment B',
    level: 1,
    bomCode: 'EQ002',
    cycle: 2,
    specifications: [],
    children: [],
    results: {},
    rolledUpResults: {}
  },
  {
    id: '3',
    task: 'Equipment C',
    level: 1,
    bomCode: 'EQ003',
    cycle: 3,
    specifications: [],
    children: [],
    results: {},
    rolledUpResults: {}
  }
];

const testColumns: GridColumn[] = [
  {
    id: 'task',
    header: '機器名',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true
  },
  {
    id: 'bomCode',
    header: 'TAG No.',
    width: 120,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true
  },
  {
    id: 'cycle',
    header: '周期(年)',
    width: 100,
    minWidth: 60,
    resizable: true,
    sortable: true,
    type: 'number',
    editable: true
  }
];

export const KeyboardNavigationTest: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(testData);
  const [lastEdit, setLastEdit] = useState<string>('');

  const handleCellEdit = (rowId: string, columnId: string, updatedItem: any) => {
    setData(prevData => 
      prevData.map(item => 
        item.id === rowId ? updatedItem : item
      )
    );
    setLastEdit(`Edited ${columnId} in row ${rowId}`);
    console.log('Cell edited:', { rowId, columnId, updatedItem });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        キーボードナビゲーション テスト
      </Typography>
      
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>テスト手順:</strong><br/>
          1. セルをクリックして選択・編集開始 (要件3.1)<br/>
          2. Tabキーで次のセルに移動 (要件3.2)<br/>
          3. Enterキーで下のセルに移動 (要件3.3)<br/>
          4. 矢印キーで上下左右に移動 (要件3.6)<br/>
          5. 編集中にEscキーでキャンセル (要件3.10)
        </Typography>
      </Alert>

      {lastEdit && (
        <Alert severity="success" sx={{ mb: 2 }}>
          最後の編集: {lastEdit}
        </Alert>
      )}

      <Paper sx={{ height: 300, mt: 2 }}>
        <ExcelLikeGrid
          data={data}
          columns={testColumns}
          onCellEdit={handleCellEdit}
          virtualScrolling={false}
          readOnly={false}
        />
      </Paper>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6">実装された機能:</Typography>
        <ul>
          <li>✅ 要件3.1: セルクリックで即座にインライン編集モード</li>
          <li>✅ 要件3.2: Tabキーで次のセルに移動</li>
          <li>✅ 要件3.3: Enterキーで下のセルに移動</li>
          <li>✅ 要件3.6: 矢印キーで対応方向のセルに移動</li>
          <li>✅ 要件3.10: Escキーで編集キャンセル・元の値に戻す</li>
        </ul>
      </Box>
    </Box>
  );
};