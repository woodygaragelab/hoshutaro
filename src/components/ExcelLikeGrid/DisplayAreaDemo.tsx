import React, { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { ExcelLikeGrid } from './ExcelLikeGrid';
import { GridColumn, DisplayAreaConfig } from './types';
import { HierarchicalData } from '../../types';

// Sample data for demonstration
const sampleData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプA-001',
    bomCode: 'P001',
    level: 1,
    specifications: [
      { key: '型式', value: 'ABC-123', order: 1 },
      { key: '容量', value: '100L/min', order: 2 },
      { key: '電源', value: '200V', order: 3 }
    ],
    results: {
      '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 },
      '2024-03': { planned: true, actual: false, planCost: 50000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-02': { planned: false, actual: true, planCost: 0, actualCost: 45000 },
      '2024-03': { planned: true, actual: false, planCost: 50000, actualCost: 0 }
    },
    children: []
  },
  {
    id: '2',
    task: 'モーターB-002',
    bomCode: 'M002',
    level: 1,
    specifications: [
      { key: '型式', value: 'XYZ-456', order: 1 },
      { key: '出力', value: '5.5kW', order: 2 },
      { key: '回転数', value: '1800rpm', order: 3 }
    ],
    results: {
      '2024-01': { planned: false, actual: true, planCost: 0, actualCost: 30000 },
      '2024-02': { planned: true, actual: false, planCost: 35000, actualCost: 0 },
      '2024-03': { planned: true, actual: false, planCost: 35000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: false, actual: true, planCost: 0, actualCost: 30000 },
      '2024-02': { planned: true, actual: false, planCost: 35000, actualCost: 0 },
      '2024-03': { planned: true, actual: false, planCost: 35000, actualCost: 0 }
    },
    children: []
  }
];

// Sample columns configuration
const sampleColumns: GridColumn[] = [
  {
    id: 'task',
    header: '機器名',
    width: 200,
    minWidth: 150,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: false,
    accessor: 'task'
  },
  {
    id: 'bomCode',
    header: 'BOM Code',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: false,
    accessor: 'bomCode'
  },
  {
    id: 'spec_model',
    header: '型式',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'specifications.0.value'
  },
  {
    id: 'spec_capacity',
    header: '容量/出力',
    width: 120,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'specifications.1.value'
  },
  {
    id: 'spec_power',
    header: '電源/回転数',
    width: 120,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'specifications.2.value'
  },
  {
    id: '2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true,
    accessor: 'results.2024-01.planned'
  },
  {
    id: '2024-02',
    header: '2024年2月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true,
    accessor: 'results.2024-02.planned'
  },
  {
    id: '2024-03',
    header: '2024年3月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: false,
    type: 'status',
    editable: true,
    accessor: 'results.2024-03.planned'
  }
];

export const DisplayAreaDemo: React.FC = () => {
  const [displayAreaConfig, setDisplayAreaConfig] = useState<DisplayAreaConfig>({
    mode: 'maintenance',
    fixedColumns: ['task', 'bomCode'],
    scrollableAreas: {
      specifications: {
        visible: false,
        width: 400,
        columns: ['spec_model', 'spec_capacity', 'spec_power']
      },
      maintenance: {
        visible: true,
        width: 600,
        columns: ['2024-01', '2024-02', '2024-03']
      }
    }
  });

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edited:', { rowId, columnId, value });
    // Here you would update your data state
  };

  const handleColumnResize = (columnId: string, width: number) => {
    console.log('Column resized:', { columnId, width });
  };

  const handleRowResize = (rowId: string, height: number) => {
    console.log('Row resized:', { rowId, height });
  };

  const handleDisplayAreaChange = (config: DisplayAreaConfig) => {
    console.log('Display area changed:', config);
    setDisplayAreaConfig(config);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        表示エリア管理システム デモ
      </Typography>
      
      <Typography variant="body1" paragraph>
        このデモでは、機器仕様と計画実績の表示エリアを切り替える機能をテストできます。
        上部のボタンで「機器仕様のみ」「計画実績のみ」「両方表示」を切り替えてください。
      </Typography>

      <Box sx={{ height: 600, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <ExcelLikeGrid
          data={sampleData}
          columns={sampleColumns}
          displayAreaConfig={displayAreaConfig}
          onCellEdit={handleCellEdit}
          onColumnResize={handleColumnResize}
          onRowResize={handleRowResize}
          onDisplayAreaChange={handleDisplayAreaChange}
          virtualScrolling={false}
          readOnly={false}
        />
      </Box>

      <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          現在の設定:
        </Typography>
        <Typography variant="body2" component="pre">
          {JSON.stringify(displayAreaConfig, null, 2)}
        </Typography>
      </Box>
    </Container>
  );
};

export default DisplayAreaDemo;