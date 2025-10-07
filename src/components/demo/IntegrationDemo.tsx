import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  TableChart as TableChartIcon,
  SmartToy as SmartToyIcon,
  FilterList as FilterListIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface FeatureStatus {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  requirements: string[];
  demoPath?: string;
}

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  steps: string[];
  features: string[];
  estimatedTime: string;
}

const IntegrationDemo: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [autoDemo, setAutoDemo] = useState(false);

  // Feature implementation status
  const features: FeatureStatus[] = [
    {
      id: 'design-system',
      name: 'モダンデザインシステム',
      description: '統一されたカラーパレット、タイポグラフィ、コンポーネント',
      status: 'completed',
      requirements: ['5.1', '5.2'],
      demoPath: '/design-system-demo'
    },
    {
      id: 'modern-header',
      name: 'モダンヘッダー統合',
      description: '既存機能を統合したレスポンシブヘッダー',
      status: 'completed',
      requirements: ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'],
    },
    {
      id: 'excel-grid',
      name: 'Excelライクグリッド',
      description: 'セル編集、キーボードナビゲーション、コピー&ペースト',
      status: 'completed',
      requirements: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10'],
      demoPath: '/excel-demo'
    },
    {
      id: 'display-areas',
      name: '表示エリア管理',
      description: '機器仕様・計画実績・両方表示の切り替え',
      status: 'completed',
      requirements: ['3.14', '3.15', '3.16', '3.17'],
    },
    {
      id: 'ai-assistant',
      name: 'AIアシスタント（モック）',
      description: 'チャット形式のAI支援とExcelインポート',
      status: 'completed',
      requirements: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'],
    },
    {
      id: 'advanced-filter',
      name: '高度フィルタリング',
      description: '複数条件検索と保存済みフィルター',
      status: 'completed',
      requirements: ['7.1', '7.2', '7.3', '7.4'],
    },
    {
      id: 'responsive',
      name: 'レスポンシブデザイン',
      description: 'モバイル・タブレット最適化',
      status: 'completed',
      requirements: ['6.1', '6.2', '6.3', '6.4'],
    },
    {
      id: 'performance',
      name: 'パフォーマンス最適化',
      description: '仮想スクロールと高速レンダリング',
      status: 'completed',
      requirements: ['8.1', '8.2', '8.3', '8.4'],
    }
  ];

  // Demo scenarios
  const demoScenarios: DemoScenario[] = [
    {
      id: 'basic-usage',
      title: '基本操作デモ',
      description: '星取表の基本的な表示・編集・検索機能',
      estimatedTime: '5分',
      features: ['modern-header', 'excel-grid'],
      steps: [
        'アプリケーションを起動し、モダンヘッダーを確認',
        '検索機能で特定の機器を検索',
        '階層フィルタリング（レベル1/2/3）を試用',
        'セルをクリックしてインライン編集を実行',
        'Tab/Enterキーでセル間移動を確認',
        '表示モード（星取⇔コスト）を切り替え'
      ]
    },
    {
      id: 'excel-operations',
      title: 'Excelライク操作デモ',
      description: 'Excel風の高度な操作機能',
      estimatedTime: '7分',
      features: ['excel-grid', 'display-areas'],
      steps: [
        'セル範囲を選択してコピー（Ctrl+C）',
        '別のセルにペースト（Ctrl+V）',
        '列境界をドラッグして列幅調整',
        '行境界をドラッグして行高調整',
        '表示エリア切り替え（機器仕様⇔計画実績⇔両方）',
        '機器仕様のインライン編集を実行'
      ]
    },
    {
      id: 'ai-integration',
      title: 'AIアシスタント統合デモ',
      description: 'AI支援機能とExcelインポート',
      estimatedTime: '10分',
      features: ['ai-assistant', 'excel-grid'],
      steps: [
        'AIアシスタントパネルを開く',
        '設備に関する質問をチャットで入力',
        'AI提案を星取表に反映',
        'Excelファイルをドラッグ&ドロップ',
        'AIによるデータマッピング提案を確認',
        'インポート結果を星取表で確認'
      ]
    },
    {
      id: 'advanced-features',
      title: '高度機能デモ',
      description: 'フィルタリング・レスポンシブ・パフォーマンス',
      estimatedTime: '8分',
      features: ['advanced-filter', 'responsive', 'performance'],
      steps: [
        '高度フィルターパネルで複数条件検索',
        'フィルター条件を保存・読み込み',
        'ブラウザ幅を変更してレスポンシブ動作確認',
        'モバイルビューでタッチ操作を試用',
        '大量データでの仮想スクロール性能確認',
        'パフォーマンスモニターで描画速度確認'
      ]
    },
    {
      id: 'integration-test',
      title: '統合機能テスト',
      description: '全機能を組み合わせた総合テスト',
      estimatedTime: '15分',
      features: ['design-system', 'modern-header', 'excel-grid', 'ai-assistant', 'advanced-filter', 'responsive'],
      steps: [
        '複数の機能を同時に使用',
        'AIアシスタントで提案を受けながら編集',
        'フィルタリングしながらExcel操作',
        'レスポンシブ環境での全機能確認',
        'データエクスポート・インポート',
        'パフォーマンス負荷テスト'
      ]
    }
  ];

  const getStatusColor = (status: FeatureStatus['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: FeatureStatus['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'in-progress': return <SettingsIcon color="warning" />;
      case 'pending': return <PlayArrowIcon color="disabled" />;
      default: return <PlayArrowIcon color="disabled" />;
    }
  };

  const handleStepClick = (step: number) => {
    setActiveStep(step);
  };

  const completedFeatures = features.filter(f => f.status === 'completed').length;
  const totalFeatures = features.length;
  const completionPercentage = Math.round((completedFeatures / totalFeatures) * 100);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Typography variant="h3" component="h1" gutterBottom align="center">
          🚀 HOSHUTARO フロントエンド改良 - 統合デモ
        </Typography>
        
        <Typography variant="h6" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          全機能統合とデモシナリオ - 実装完了度: {completionPercentage}%
        </Typography>

        {/* Progress Overview */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            📊 実装進捗概要
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="success.main">
                    {completedFeatures}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    完了機能
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary.main">
                    {totalFeatures}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    総機能数
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="info.main">
                    {completionPercentage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    完了率
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Alert severity="success" sx={{ mb: 2 }}>
            🎉 全ての主要機能が実装完了しました！既存機能を保持しながら、モダンなUI/UXを実現しています。
          </Alert>
        </Paper>

        {/* Feature Status */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            🔧 機能実装状況
          </Typography>
          <Grid container spacing={2}>
            {features.map((feature) => (
              <Grid item xs={12} md={6} lg={4} key={feature.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getStatusIcon(feature.status)}
                      <Typography variant="h6" sx={{ ml: 1 }}>
                        {feature.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {feature.description}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Chip 
                        label={feature.status === 'completed' ? '完了' : feature.status === 'in-progress' ? '進行中' : '待機中'}
                        color={getStatusColor(feature.status)}
                        size="small"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      要件: {feature.requirements.join(', ')}
                    </Typography>
                  </CardContent>
                  {feature.demoPath && (
                    <CardActions>
                      <Button size="small" href={feature.demoPath}>
                        デモを見る
                      </Button>
                    </CardActions>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Demo Scenarios */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            🎬 デモシナリオ
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={autoDemo}
                onChange={(e) => setAutoDemo(e.target.checked)}
              />
            }
            label="自動デモモード"
            sx={{ mb: 3 }}
          />

          <Stepper activeStep={activeStep} orientation="vertical">
            {demoScenarios.map((scenario, index) => (
              <Step key={scenario.id}>
                <StepLabel 
                  onClick={() => handleStepClick(index)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Typography variant="h6">
                    {scenario.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {scenario.description} - 所要時間: {scenario.estimatedTime}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      関連機能:
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {scenario.features.map((featureId) => {
                        const feature = features.find(f => f.id === featureId);
                        return feature ? (
                          <Chip
                            key={featureId}
                            label={feature.name}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            color={getStatusColor(feature.status)}
                          />
                        ) : null;
                      })}
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      実行手順:
                    </Typography>
                    <List dense>
                      {scenario.steps.map((step, stepIndex) => (
                        <ListItem key={stepIndex}>
                          <ListItemIcon>
                            <Typography variant="body2" color="primary">
                              {stepIndex + 1}
                            </Typography>
                          </ListItemIcon>
                          <ListItemText primary={step} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        // Navigate to main app for demo
                        window.location.href = '/';
                      }}
                      sx={{ mr: 1 }}
                    >
                      デモを開始
                    </Button>
                    <Button
                      onClick={() => setActiveStep(index + 1)}
                      disabled={index === demoScenarios.length - 1}
                    >
                      次のシナリオ
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Technical Specifications */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            🔧 技術仕様
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                フロントエンド技術スタック
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><DashboardIcon /></ListItemIcon>
                  <ListItemText primary="React 19 + TypeScript" secondary="モダンなフロントエンドフレームワーク" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SettingsIcon /></ListItemIcon>
                  <ListItemText primary="Material-UI v7" secondary="UIコンポーネントライブラリ" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SpeedIcon /></ListItemIcon>
                  <ListItemText primary="React-Window" secondary="仮想スクロールによる高速レンダリング" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SmartToyIcon /></ListItemIcon>
                  <ListItemText primary="Framer Motion" secondary="スムーズなアニメーション" />
                </ListItem>
              </List>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                実装済み機能
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><TableChartIcon /></ListItemIcon>
                  <ListItemText primary="Excelライクグリッド" secondary="セル編集・キーボードナビゲーション" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SearchIcon /></ListItemIcon>
                  <ListItemText primary="高度検索・フィルタリング" secondary="複数条件・保存済みフィルター" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><SmartToyIcon /></ListItemIcon>
                  <ListItemText primary="AIアシスタント（モック）" secondary="チャット・Excelインポート" />
                </ListItem>
                <ListItem>
                  <ListItemIcon><PhoneAndroidIcon /></ListItemIcon>
                  <ListItemText primary="レスポンシブデザイン" secondary="モバイル・タブレット対応" />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </Paper>

        {/* Next Steps */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            🚀 次のステップ
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            フロントエンド改良は完了しました。次の段階では以下の作業を推奨します：
          </Alert>
          
          <List>
            <ListItem>
              <ListItemIcon><CheckCircleIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="バックエンドAPI統合" 
                secondary="AWS API Gateway + Lambda + DynamoDB との連携実装"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="本格的なAI機能実装" 
                secondary="AWS Bedrock Agent との実際の統合"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="認証・認可システム" 
                secondary="AWS Cognito による ユーザー管理"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="本番環境デプロイ" 
                secondary="AWS Amplify または Vercel での本番運用"
              />
            </ListItem>
          </List>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default IntegrationDemo;