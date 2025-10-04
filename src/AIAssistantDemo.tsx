import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { SmartToy as AIIcon } from '@mui/icons-material';
import { AIAssistantPanel } from './components/AIAssistant';
import { MaintenanceSuggestion } from './components/AIAssistant/types';

const AIAssistantDemo: React.FC = () => {
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            AIアシスタントパネル デモ
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            設備保全のためのAIアシスタント機能をお試しください
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
            <strong>機能紹介:</strong>
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>設備の保全計画や故障予測に関する質問応答</li>
            <li>AIによる保全推奨事項の提案と星取表への反映</li>
            <li>Excelファイルのドラッグ&ドロップアップロード</li>
            <li>チャット形式の直感的なインターフェース</li>
          </ul>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            試してみる質問例:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {[
              '設備の保全計画について教えて',
              '故障予測はどのように行いますか？',
              'コスト最適化の方法は？',
              'メンテナンス周期の推奨は？'
            ].map((question, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                onClick={() => {
                  setIsAIOpen(true);
                  // Note: In a real implementation, we would pass this question to the AI panel
                }}
              >
                {question}
              </Button>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            実装済み機能:
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ サイドパネル形式のレイアウト
              </Typography>
              <Typography variant="body2" color="text.secondary">
                右側からスライドインするモダンなパネルデザイン
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ チャット形式UI
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ユーザーとAIの対話を直感的に表示
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ メッセージ履歴表示
              </Typography>
              <Typography variant="body2" color="text.secondary">
                過去の会話履歴を保持・表示
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ モックAI応答システム
              </Typography>
              <Typography variant="body2" color="text.secondary">
                事前定義パターンによる設備保全の質問応答
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ 保全推奨事項の提案
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AIによる保全アクションの提案と星取表反映
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ Excelファイル処理
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ドラッグ&ドロップによるファイル解析
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ クイックアクション
              </Typography>
              <Typography variant="body2" color="text.secondary">
                よく使う質問のワンクリック入力
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                ✅ 設備データベース連携
              </Typography>
              <Typography variant="body2" color="text.secondary">
                設備IDや名称による個別分析
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

export default AIAssistantDemo;