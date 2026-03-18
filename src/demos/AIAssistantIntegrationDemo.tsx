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
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Divider
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Integration as IntegrationIcon,
  CloudUpload as UploadIcon,
  TableChart as TableIcon,
  AutoFixHigh as MappingIcon,
  Assessment as AnalysisIcon,
  CheckCircle as CheckIcon,
  Psychology as BrainIcon,
  Sync as SyncIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { AIAssistantPanel } from './components/AIAssistant';
import { MaintenanceSuggestion } from './components/AIAssistant/types';

const AIAssistantIntegrationDemo: React.FC = () => {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [notification, setNotification] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);

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

  const steps = [
    {
      label: 'AIアシスタント起動',
      description: 'サイドパネル形式のAIアシスタントを起動します',
      icon: <AIIcon color="primary" />
    },
    {
      label: '設備保全の質問',
      description: 'モックAIサービスによる設備保全に関する質問応答',
      icon: <BrainIcon color="primary" />
    },
    {
      label: 'Excelファイル処理',
      description: 'ドラッグ&ドロップによるExcelファイルのアップロードと解析',
      icon: <UploadIcon color="primary" />
    },
    {
      label: '星取表統合',
      description: 'AI提案を既存の星取表データに反映',
      icon: <IntegrationIcon color="primary" />
    }
  ];

  const implementedFeatures = [
    {
      category: 'UI/UX',
      features: [
        { name: 'サイドパネル形式レイアウト', status: 'completed' },
        { name: 'チャット形式インターフェース', status: 'completed' },
        { name: 'メッセージ履歴表示', status: 'completed' },
        { name: 'レスポンシブデザイン', status: 'completed' }
      ]
    },
    {
      category: 'AI機能',
      features: [
        { name: 'モックAI応答システム', status: 'completed' },
        { name: '事前定義応答パターン', status: 'completed' },
        { name: '保全推奨事項提案', status: 'completed' },
        { name: '設備データベース連携', status: 'completed' }
      ]
    },
    {
      category: 'Excel処理',
      features: [
        { name: 'ドラッグ&ドロップアップロード', status: 'completed' },
        { name: 'SheetJSによるファイル解析', status: 'completed' },
        { name: 'データマッピング提案', status: 'completed' },
        { name: 'プレビュー機能', status: 'completed' }
      ]
    },
    {
      category: '星取表統合',
      features: [
        { name: '既存データ構造との互換性', status: 'completed' },
        { name: 'AI提案の星取表反映', status: 'completed' },
        { name: '類似提案の自動生成', status: 'completed' },
        { name: 'エラーハンドリング', status: 'completed' }
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'in-progress':
        return <SyncIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            AIアシスタント統合デモ
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            設備保全のためのAIアシスタント機能と既存星取表システムとの完全統合デモ
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

        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>実装完了:</strong> AIアシスタントパネル（モック版）の全機能が実装されました！
            サイドパネル、モックAI応答、Excelファイル処理、星取表統合のすべてが動作します。
          </Typography>
        </Alert>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  使用方法
                </Typography>
                <Stepper activeStep={activeStep} orientation="vertical">
                  {steps.map((step, index) => (
                    <Step key={index}>
                      <StepLabel
                        icon={step.icon}
                        onClick={() => setActiveStep(index)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {step.label}
                      </StepLabel>
                      <StepContent>
                        <Typography variant="body2" color="text.secondary">
                          {step.description}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            onClick={() => setActiveStep(index + 1)}
                            disabled={index === steps.length - 1}
                          >
                            次へ
                          </Button>
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  技術仕様
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="React 18 + TypeScript"
                      secondary="モダンなフロントエンド技術スタック"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Material-UI v5"
                      secondary="統一されたデザインシステム"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="SheetJS (xlsx)"
                      secondary="ブラウザ内Excelファイル処理"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="モックAIサービス"
                      secondary="事前定義パターンによる応答生成"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            実装済み機能一覧
          </Typography>
          <Grid container spacing={2}>
            {implementedFeatures.map((category, categoryIndex) => (
              <Grid item xs={12} md={6} key={categoryIndex}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    {category.category}
                  </Typography>
                  <List dense>
                    {category.features.map((feature, featureIndex) => (
                      <ListItem key={featureIndex} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {getStatusIcon(feature.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
                                {feature.name}
                              </Typography>
                              <Chip
                                label={feature.status === 'completed' ? '完了' : '進行中'}
                                size="small"
                                color={getStatusColor(feature.status) as any}
                                variant="outlined"
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6" gutterBottom>
            デモシナリオ
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>1. 基本的な質問応答:</strong> 「設備の保全計画について教えて」と入力
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>2. 故障予測:</strong> 「故障予測を行って」と入力してAI提案を確認
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>3. Excelインポート:</strong> 「Excel」ボタンからファイルをアップロード
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>4. 提案適用:</strong> AI提案の「星取表に適用」ボタンをクリック
            </Typography>
            <Typography variant="body2">
              <strong>5. エラーハンドリング:</strong> 無効なデータでエラー処理を確認
            </Typography>
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

export default AIAssistantIntegrationDemo;