import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { ExcelImportResult, DataMappingSuggestion } from '../types';
import { excelProcessingService } from '../services/ExcelProcessingService';

interface ExcelDropZoneProps {
  onFileProcessed: (result: ExcelImportResult, file: File) => void;
  onPreviewGenerated?: (previewData: any[], mappings: DataMappingSuggestion[]) => void;
}

const ExcelDropZone: React.FC<ExcelDropZoneProps> = ({
  onFileProcessed,
  onPreviewGenerated
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [lastResult, setLastResult] = useState<ExcelImportResult | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // プログレス更新のシミュレーション
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await excelProcessingService.processFile(file);
      
      clearInterval(progressInterval);
      setProcessingProgress(100);

      setLastResult(result);
      onFileProcessed(result, file);

      // プレビューデータの生成
      if (result.success && result.suggestions.length > 0 && onPreviewGenerated) {
        const previewData = await excelProcessingService.generatePreviewData(file, result.suggestions);
        onPreviewGenerated(previewData, result.suggestions);
      }

    } catch (error) {
      console.error('File processing error:', error);
      const errorResult: ExcelImportResult = {
        success: false,
        processedRows: 0,
        errors: [{
          row: 0,
          column: 'system',
          message: 'ファイル処理中にエラーが発生しました',
          severity: 'error'
        }],
        suggestions: []
      };
      setLastResult(errorResult);
      onFileProcessed(errorResult, file);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingProgress(0), 1000);
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning') => {
    return severity === 'error' ? <ErrorIcon color="error" /> : <WarningIcon color="warning" />;
  };

  const getSeverityColor = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'error' : 'warning';
  };

  return (
    <Box>
      {/* Drop Zone */}
      <Paper
        elevation={isDragOver ? 8 : 2}
        sx={{
          p: 3,
          textAlign: 'center',
          border: `2px dashed ${isDragOver ? '#1976d2' : '#ccc'}`,
          bgcolor: isDragOver ? 'action.hover' : 'background.paper',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.hover',
            borderColor: 'primary.main'
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Excelファイルをドラッグ&ドロップ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          または、ファイルを選択してください
        </Typography>
        
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="excel-file-input"
        />
        <label htmlFor="excel-file-input">
          <Button variant="contained" component="span" startIcon={<FileIcon />}>
            ファイルを選択
          </Button>
        </label>

        <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
          対応形式: Excel (.xlsx, .xls), CSV (.csv) | 最大サイズ: 10MB
        </Typography>
      </Paper>

      {/* Processing Progress */}
      {isProcessing && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            ファイルを処理中...
          </Typography>
          <LinearProgress variant="determinate" value={processingProgress} />
        </Box>
      )}

      {/* Results */}
      {lastResult && !isProcessing && (
        <Box sx={{ mt: 2 }}>
          <Alert 
            severity={lastResult.success ? 'success' : 'error'}
            icon={lastResult.success ? <SuccessIcon /> : <ErrorIcon />}
            sx={{ mb: 2 }}
          >
            {lastResult.success 
              ? `処理完了: ${lastResult.processedRows}行のデータを処理しました`
              : 'ファイル処理中にエラーが発生しました'
            }
          </Alert>

          {/* Data Mapping Suggestions */}
          {lastResult.suggestions.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                データマッピング提案
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {lastResult.suggestions.slice(0, 6).map((suggestion, index) => (
                  <Chip
                    key={index}
                    label={`${suggestion.sourceColumn} → ${suggestion.targetField}`}
                    size="small"
                    color={suggestion.confidence > 0.8 ? 'success' : 'default'}
                    variant="outlined"
                  />
                ))}
              </Box>
              {lastResult.suggestions.length > 6 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  他 {lastResult.suggestions.length - 6} 件のマッピング提案があります
                </Typography>
              )}
            </Paper>
          )}

          {/* Errors and Warnings */}
          {lastResult.errors.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                検出された問題 ({lastResult.errors.length}件)
              </Typography>
              <List dense>
                {lastResult.errors.slice(0, 5).map((error, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {getSeverityIcon(error.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={error.message}
                        secondary={`行 ${error.row}, 列 ${error.column}`}
                      />
                      <Chip
                        label={error.severity === 'error' ? 'エラー' : '警告'}
                        size="small"
                        color={getSeverityColor(error.severity)}
                        variant="outlined"
                      />
                    </ListItem>
                    {index < Math.min(lastResult.errors.length - 1, 4) && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              {lastResult.errors.length > 5 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  他 {lastResult.errors.length - 5} 件の問題があります
                </Typography>
              )}
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ExcelDropZone;