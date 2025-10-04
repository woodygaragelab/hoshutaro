import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  Alert,
  Snackbar,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  SmartToy as AIIcon,
  CloudUpload as UploadIcon,
  TableChart as TableIcon,
  AutoFixHigh as MappingIcon,
  Assessment as AnalysisIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { AIAssistantPanel } from './components/AIAssistant';
import { MaintenanceSuggestion } from './components/AIAssistant/types';

const ExcelProcessingDemo: React.FC = () => {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [notification, setNotification] = useState<string>('');

  const handleSuggestionApply = (suggestion: MaintenanceSuggestion) => {
    console.log('Applying suggestion:', suggestion);
    setNotification(
      `提案を適用しました: ${suggestion.equipmentId} - ${suggestion.timeHeader} (${suggestion.suggestedAction})`
    );
  };

  const handleExcelImport = (file: File) => {
    console.log('Excel file imported:', file.name);
    setNotification(`Excelファイル "${file.name}" をアップロードしました`);
  };

  const handleCloseNotification = () => {
    setNotification('');
  };

  const features = [
    {
      icon: <UploadIcon color="primary" />,
      title: 'ドラッグ&ドロップアップロード',
      description: 'Excelファイルを簡単にドラッグ&ドロップでアップロード'
    },
    {
      icon: <AnalysisIcon color="primary" />,
      title: 'ファイル解析',
      description: 'SheetJSを使用したブラウザ内でのExcelファイル解析'
    },
    {
      icon: <MappingIcon color="primary" />,
      title: 'データマッピング提案',
      description: 'AIによる自動的なデータフィールドマッピング提案'
    },
    {
      icon: <TableIcon color="primary" />,
      title: 'プレビュー機能',
      description: 'インポート前のデータプレビューと検証'
    }
  ];

  const sampleData = [
    { field: '設備ID', example: 'EQ001, EQ002, EQ003' },
    { field: '設備名', example: 'ポンプA-1, コンプレッサーB-2' },
    { field: '保全日付', example: '2024-04-15, 2024-05-20' },
    { field: '保全種別', example: '定期点検, 部品交換' },
    { field: '費用', example: '50000, 120000' }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Excelファイル処理機能 デモ
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            AIアシスタントによるExcelファイルのアップロード、解析、データマッピング機能をお試しください
          </Typography>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<AIIcon />}
            onClick={() => setIsAIOpen(true)}
            sx={{ mb: 3 }}
          >
            AIアシスタントを開く
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>新機能:</strong> Excelファイルのドラッグ&ドロップアップロード、自動データマッピング、プレビュー機能が追加されました！
          </Typography>
        </Alert>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  実装済み機能
                </Typography>
                <List>
                  {features.map((feature, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {feature.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={feature.title}
                        secondary={feature.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  サポートするデータ形式
                </Typography>
                <List>
                  {sampleData.map((item, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.field}
                        secondary={`例: ${item.example}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            使用方法:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              1. 上記の「AIアシスタントを開く」ボタンをクリック
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              2. チャット画面下部の「Excel」ボタンをクリック
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              3. Excelファイルをドラッグ&ドロップまたはファイル選択
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              4. 自動解析とデータマッピング提案を確認
            </Typography>
            <Typography variant="body2">
              5. プレビューデータを確認してマッピングを適用
            </Typography>
          </Box>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            技術仕様:
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ ファイル形式サポート
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Excel (.xlsx, .xls), CSV (.csv) - 最大10MB
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ ブラウザ内処理
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SheetJSライブラリによる高速なクライアントサイド処理
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ 自動マッピング
              </Typography>
              <Typography variant="body2" color="text.secondary">
                レーベンシュタイン距離による高精度フィールドマッピング
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ データ検証
              </Typography>
              <Typography variant="body2" color="text.secondary">
                型チェック、必須フィールド検証、エラー報告
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ プレビュー機能
              </Typography>
              <Typography variant="body2" color="text.secondary">
                インポート前のデータ確認とマッピング調整
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ エラーハンドリング
              </Typography>
              <Typography variant="body2" color="text.secondary">
                詳細なエラー報告と修正提案
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Paper>

      <AIAssistantPanel
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onSuggestionApply={handleSuggestionApply}
        onExcelImport={handleExcelImport}
      />

      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        message={notification}
      />
    </Container>
  );
};

export default ExcelProcessingDemo;