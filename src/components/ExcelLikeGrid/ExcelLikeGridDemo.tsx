import React, { useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { ExcelLikeGrid } from './ExcelLikeGrid';
import { GridColumn } from './types';
import { HierarchicalData } from '../../types';

// Sample data for demonstration
const sampleData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプA',
    level: 1,
    bomCode: 'P001',
    cycle: 1,
    specifications: [
      { key: 'manufacturer', value: 'メーカーA', order: 0 },
      { key: 'model', value: 'Model-X1', order: 1 }
    ],
    children: [],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 10000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 12000 },
      '2024-03': { planned: true, actual: true, planCost: 15000, actualCost: 14500 }
    },
    rolledUpResults: {}
  },
  {
    id: '2',
    task: 'モーターB',
    level: 1,
    bomCode: 'M001',
    cycle: 2,
    specifications: [
      { key: 'manufacturer', value: 'メーカーB', order: 0 },
      { key: 'model', value: 'Model-Y2', order: 1 }
    ],
    children: [],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: false, planCost: 8000, actualCost: 0 },
      '2024-03': { planned: false, actual: true, planCost: 0, actualCost: 8500 }
    },
    rolledUpResults: {}
  },
  {
    id: '3',
    task: 'バルブC',
    level: 1,
    bomCode: 'V001',
    cycle: 3,
    specifications: [
      { key: 'manufacturer', value: 'メーカーC', order: 0 },
      { key: 'model', value: 'Model-Z3', order: 1 }
    ],
    children: [],
    results: {
      '2024-01': { planned: true, actual: true, planCost: 5000, actualCost: 4800 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: true, actual: false, planCost: 5500, actualCost: 0 }
    },
    rolledUpResults: {}
  }
];

// Column definitions
const columns: GridColumn[] = [
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
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true
  },
  {
    id: 'cycle',
    header: '周期(年)',
    width: 80,
    minWidth: 60,
    resizable: true,
    sortable: true,
    type: 'number',
    editable: true
  },
  {
    id: 'manufacturer',
    header: 'メーカー',
    width: 120,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true
  },
  {
    id: '2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true
  },
  {
    id: '2024-02',
    header: '2024年2月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true
  },
  {
    id: '2024-03',
    header: '2024年3月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true
  }
];

export const ExcelLikeGridDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(sampleData);

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    setData(prevData => 
      prevData.map(item => 
        item.id === rowId ? value : item
      )
    );
    console.log('Cell edited:', { rowId, columnId, value });
  };

  const handleColumnResize = (columnId: string, width: number) => {
    console.log('Column resized:', { columnId, width });
  };

  const handleRowResize = (rowId: string, height: number) => {
    console.log('Row resized:', { rowId, height });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        ExcelLikeGrid デモ
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 2 }}>
        このデモでは、Excelライクなデータグリッドの基本機能を確認できます：
      </Typography>
      
      <ul>
        <li>セルをクリックして選択</li>
        <li>セルをダブルクリックして編集</li>
        <li>列の境界をドラッグして列幅をリサイズ</li>
        <li>列の境界をダブルクリックして自動リサイズ</li>
        <li>行の下端をドラッグして行高をリサイズ</li>
        <li>行の下端をダブルクリックして自動リサイズ</li>
        <li>Enterキーで編集確定、Escキーでキャンセル</li>
      </ul>

      <Paper sx={{ height: 400, mt: 2 }}>
        <ExcelLikeGrid
          data={data}
          columns={columns}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          virtualScrolling={false}
          readOnly={false}
        />
      </Paper>
    </Box>
  );
};