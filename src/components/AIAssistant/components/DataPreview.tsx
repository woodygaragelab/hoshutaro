import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Alert
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  Download as ExportIcon
} from '@mui/icons-material';
import { DataMappingSuggestion } from '../types';

interface DataPreviewProps {
  data: any[];
  mappings: DataMappingSuggestion[];
  onApplyMappings?: (mappings: DataMappingSuggestion[]) => void;
  onExportData?: (data: any[]) => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({
  data,
  mappings,
  onApplyMappings,
  onExportData
}) => {
  if (!data || data.length === 0) {
    return (
      <Alert severity="info" icon={<PreviewIcon />}>
        プレビューするデータがありません
      </Alert>
    );
  }

  // データの列を取得
  const columns = Object.keys(data[0] || {});
  
  // マッピングされた列名を取得
  const getMappedColumnName = (originalColumn: string) => {
    const mapping = mappings.find(m => m.sourceColumn === originalColumn);
    return mapping ? mapping.targetField : originalColumn;
  };

  // 信頼度に基づく色を取得
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'default';
  };

  const handleApplyMappings = () => {
    if (onApplyMappings) {
      onApplyMappings(mappings);
    }
  };

  const handleExportData = () => {
    if (onExportData) {
      onExportData(data);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          データプレビュー ({data.length}行)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onApplyMappings && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleApplyMappings}
            >
              マッピングを適用
            </Button>
          )}
          {onExportData && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={handleExportData}
            >
              エクスポート
            </Button>
          )}
        </Box>
      </Box>

      {/* Column Mappings */}
      {mappings.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            列マッピング
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {mappings.map((mapping, index) => (
              <Chip
                key={index}
                label={`${mapping.sourceColumn} → ${mapping.targetField}`}
                size="small"
                color={getConfidenceColor(mapping.confidence)}
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Data Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 60, bgcolor: 'grey.100' }}>
                <Typography variant="caption" fontWeight="bold">
                  行
                </Typography>
              </TableCell>
              {columns.map((column) => {
                const mapping = mappings.find(m => m.sourceColumn === column);
                return (
                  <TableCell key={column} sx={{ minWidth: 120, bgcolor: 'grey.100' }}>
                    <Box>
                      <Typography variant="caption" fontWeight="bold">
                        {column}
                      </Typography>
                      {mapping && (
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={mapping.targetField}
                            size="small"
                            color={getConfidenceColor(mapping.confidence)}
                            variant="filled"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                <TableCell sx={{ bgcolor: 'grey.50', fontWeight: 'bold' }}>
                  {rowIndex + 1}
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column}>
                    <Typography variant="body2">
                      {row[column]?.toString() || '-'}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data.length >= 5 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          プレビューは最初の5行のみ表示されています。全データを確認するには、エクスポート機能をご利用ください。
        </Alert>
      )}
    </Box>
  );
};

export default DataPreview;