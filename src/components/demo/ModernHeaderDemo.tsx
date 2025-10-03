import React, { useState } from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { ModernHeader } from '../layout';
import type { HeaderAction } from '../layout';

const ModernHeaderDemo: React.FC = () => {
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [notifications] = useState(3);

  const handleAIAssistantToggle = () => {
    setIsAIAssistantOpen(!isAIAssistantOpen);
  };

  const handleSettingsOpen = () => {
    console.log('Settings opened');
  };

  const handleUserMenuClick = (action: string) => {
    console.log('User menu action:', action);
  };

  // Custom actions for demo
  const customActions: HeaderAction[] = [
    {
      id: 'export',
      icon: <span>📊</span>,
      label: 'エクスポート',
      tooltip: 'データをエクスポート',
      priority: 'medium',
      dropdown: [
        {
          id: 'export-excel',
          label: 'Excelファイル',
          onClick: () => console.log('Export to Excel'),
        },
        {
          id: 'export-pdf',
          label: 'PDFファイル',
          onClick: () => console.log('Export to PDF'),
        },
        {
          id: 'export-csv',
          label: 'CSVファイル',
          onClick: () => console.log('Export to CSV'),
          divider: true,
        },
      ],
    },
  ];

  const mockUser = {
    name: '田中太郎',
    email: 'tanaka@example.com',
    avatar: undefined, // Will show initials
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <ModernHeader
        user={mockUser}
        onAIAssistantToggle={handleAIAssistantToggle}
        onSettingsOpen={handleSettingsOpen}
        isAIAssistantOpen={isAIAssistantOpen}
        title="HOSHUTARO"
        actions={customActions}
        notifications={notifications}
        onUserMenuClick={handleUserMenuClick}
      />
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            モダンヘッダーデモ
          </Typography>
          
          <Typography variant="body1" paragraph>
            このデモでは、新しいModernHeaderコンポーネントの機能を確認できます：
          </Typography>
          
          <Box component="ul" sx={{ pl: 3 }}>
            <li>ミニマルでモダンなデザイン</li>
            <li>レスポンシブ対応（768px以下でハンバーガーメニュー）</li>
            <li>ドロップダウンメニュー付きアクション</li>
            <li>ツールチップ表示</li>
            <li>通知バッジ</li>
            <li>ユーザーメニュー</li>
            <li>スムーズなアニメーション効果</li>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            AIアシスタント状態: {isAIAssistantOpen ? '開いています' : '閉じています'}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default ModernHeaderDemo;