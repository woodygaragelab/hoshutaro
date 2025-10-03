import React, { useState, useCallback } from 'react';
import { Box, Typography, Paper, Button, Alert, Divider } from '@mui/material';
import { ExcelLikeGrid } from './ExcelLikeGrid';
import { GridColumn, ClipboardData } from './types';
import { HierarchicalData } from '../../types';

// Sample data for testing copy/paste functionality
const generateSampleData = (): HierarchicalData[] => {
  const data: HierarchicalData[] = [];
  
  for (let i = 1; i <= 10; i++) {
    data.push({
      id: `item-${i}`,
      task: `設備${i}`,
      bomCode: `BOM-${String(i).padStart(3, '0')}`,
      level: 1,
      specifications: [
        { key: '機器名称', value: `設備${i}`, order: 0 },
        { key: '型式', value: `MODEL-${i}`, order: 1 },
        { key: '製造年', value: `202${i % 4}`, order: 2 }
      ],
      results: {
        '2024-01': { planned: i % 3 === 0, actual: false, planCost: 0, actualCost: 0 },
        '2024-02': { planned: false, actual: i % 4 === 0, planCost: 0, actualCost: 0 },
        '2024-03': { planned: i % 2 === 0, actual: false, planCost: 0, actualCost: 0 },
        '2024-04': { planned: false, actual: i % 5 === 0, planCost: 0, actualCost: 0 }
      },
      rolledUpResults: {},
      children: []
    });
  }
  
  return data;
};

// Sample columns configuration
const sampleColumns: GridColumn[] = [
  {
    id: 'task',
    header: '設備名',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'task'
  },
  {
    id: 'bomCode',
    header: 'BOMコード',
    width: 120,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'bomCode'
  },
  {
    id: 'spec_機器名称',
    header: '機器名称',
    width: 150,
    minWidth: 100,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_機器名称'
  },
  {
    id: 'spec_型式',
    header: '型式',
    width: 120,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_型式'
  },
  {
    id: 'spec_製造年',
    header: '製造年',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'text',
    editable: true,
    accessor: 'spec_製造年'
  },
  {
    id: 'time_2024-01',
    header: '2024年1月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-01'
  },
  {
    id: 'time_2024-02',
    header: '2024年2月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-02'
  },
  {
    id: 'time_2024-03',
    header: '2024年3月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-03'
  },
  {
    id: 'time_2024-04',
    header: '2024年4月',
    width: 100,
    minWidth: 80,
    resizable: true,
    sortable: true,
    type: 'status',
    editable: true,
    accessor: 'time_2024-04'
  }
];

export const CopyPasteDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(generateSampleData());
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [clipboardInfo, setClipboardInfo] = useState<ClipboardData | null>(null);

  const handleCellEdit = useCallback((rowId: string, columnId: string, value: any) => {
    setData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          // Handle different types of cell updates
          if (columnId.startsWith('spec_')) {
            const specKey = columnId.replace('spec_', '');
            const specifications = [...(item.specifications || [])];
            const specIndex = specifications.findIndex(s => s.key === specKey);
            
            if (specIndex >= 0) {
              specifications[specIndex] = { ...specifications[specIndex], value: String(value) };
            } else {
              specifications.push({ key: specKey, value: String(value), order: specifications.length });
            }
            
            return { ...item, specifications };
          } else if (columnId.startsWith('time_')) {
            const timeKey = columnId.replace('time_', '');
            const newResults = { ...item.results };
            
            if (!newResults[timeKey]) {
              newResults[timeKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
            }
            
            const result = newResults[timeKey];
            // Parse status symbols
            switch (value) {
              case '◎':
                result.planned = true;
                result.actual = true;
                break;
              case '〇':
                result.planned = true;
                result.actual = false;
                break;
              case '●':
                result.planned = false;
                result.actual = true;
                break;
              default:
                result.planned = false;
                result.actual = false;
            }
            
            return { ...item, results: newResults };
          } else {
            return { ...item, [columnId]: value };
          }
        }
        return item;
      })
    );
  }, []);

  const handleCopy = useCallback((clipboardData: ClipboardData) => {
    setClipboardInfo(clipboardData);
    setMessage({
      text: `${clipboardData.cells.length}行 × ${clipboardData.cells[0]?.length || 0}列のデータをコピーしました`,
      severity: 'success'
    });
  }, []);

  const handlePaste = useCallback(async (clipboardData: ClipboardData): Promise<boolean> => {
    try {
      // Custom paste logic can be implemented here
      // For now, we'll return true to use the default paste implementation
      setMessage({
        text: `${clipboardData.cells.length}行 × ${clipboardData.cells[0]?.length || 0}列のデータを貼り付けました`,
        severity: 'success'
      });
      return true;
    } catch (error) {
      setMessage({
        text: 'ペースト操作に失敗しました',
        severity: 'error'
      });
      return false;
    }
  }, []);

  const clearMessage = () => setMessage(null);

  const resetData = () => {
    setData(generateSampleData());
    setMessage({ text: 'データをリセットしました', severity: 'info' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        コピー&ペースト機能デモ
      </Typography>
      
      <Typography variant="body1" paragraph>
        このデモでは、ExcelLikeGridのコピー&ペースト機能をテストできます。
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          操作方法
        </Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li><strong>セル選択:</strong> セルをクリックして選択</li>
            <li><strong>範囲選択:</strong> Shiftキーを押しながらセルをクリック、またはマウスドラッグ</li>
            <li><strong>コピー:</strong> Ctrl+C（選択したセルまたは範囲をコピー）</li>
            <li><strong>ペースト:</strong> Ctrl+V（選択したセルに貼り付け）</li>
            <li><strong>編集:</strong> セルをクリックしてインライン編集</li>
            <li><strong>キャンセル:</strong> Escキーで編集をキャンセル</li>
          </ul>
        </Typography>
      </Paper>

      {message && (
        <Alert 
          severity={message.severity} 
          onClose={clearMessage}
          sx={{ mb: 2 }}
        >
          {message.text}
        </Alert>
      )}

      {clipboardInfo && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            クリップボード情報
          </Typography>
          <Typography variant="body2">
            <strong>ソースエリア:</strong> {clipboardInfo.sourceArea === 'specifications' ? '機器仕様' : '計画実績'}
          </Typography>
          <Typography variant="body2">
            <strong>データサイズ:</strong> {clipboardInfo.cells.length}行 × {clipboardInfo.cells[0]?.length || 0}列
          </Typography>
          <Typography variant="body2">
            <strong>コピー時刻:</strong> {new Date(clipboardInfo.timestamp).toLocaleString()}
          </Typography>
        </Paper>
      )}

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={resetData}>
          データをリセット
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ height: 600, border: '1px solid #e0e0e0' }}>
        <ExcelLikeGrid
          data={data}
          columns={sampleColumns}
          displayAreaConfig={{
            mode: 'both',
            fixedColumns: ['task', 'bomCode'],
            scrollableAreas: {
              specifications: {
                visible: true,
                width: 400,
                columns: ['spec_機器名称', 'spec_型式', 'spec_製造年']
              },
              maintenance: {
                visible: true,
                width: 400,
                columns: ['time_2024-01', 'time_2024-02', 'time_2024-03', 'time_2024-04']
              }
            }
          }}
          onCellEdit={handleCellEdit}
          onCopy={handleCopy}
          onPaste={handlePaste}
          virtualScrolling={false}
          readOnly={false}
        />
      </Box>

      <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          テストシナリオ
        </Typography>
        <Typography variant="body2" component="div">
          <ol>
            <li>単一セルを選択してコピー（Ctrl+C）し、別のセルに貼り付け（Ctrl+V）</li>
            <li>複数セルを範囲選択してコピー&ペースト</li>
            <li>機器仕様エリアと計画実績エリア間でのコピー&ペースト</li>
            <li>無効なデータ（数値列に文字列など）を貼り付けてエラーハンドリングを確認</li>
            <li>読み取り専用セルへの貼り付けを試行</li>
          </ol>
        </Typography>
      </Paper>
    </Box>
  );
};

export default CopyPasteDemo;