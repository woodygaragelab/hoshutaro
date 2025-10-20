import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { SpecificationEditDialog } from './SpecificationEditDialog';
import { SpecificationValue } from '../CommonEdit/types';

// サンプルデータ
const SAMPLE_SPECIFICATIONS: SpecificationValue[] = [
  { key: '型式', value: 'ABC-123', order: 1 },
  { key: 'メーカー', value: '株式会社サンプル', order: 2 },
  { key: '定格電力', value: '100W', order: 3 },
  { key: '電源電圧', value: 'AC100V', order: 4 },
  { key: '寸法', value: '300×200×150mm', order: 5 },
  { key: '重量', value: '2.5kg', order: 6 },
];

/**
 * 機器仕様編集ダイアログのデモコンポーネント
 */
export const SpecificationEditDialogExample: React.FC = () => {
  const [specifications, setSpecifications] = useState<SpecificationValue[]>(SAMPLE_SPECIFICATIONS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deviceType, setDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleOpenDialog = (event: React.MouseEvent<HTMLElement>, device: 'desktop' | 'tablet' | 'mobile') => {
    setDeviceType(device);
    if (device === 'desktop') {
      setAnchorEl(event.currentTarget);
    } else {
      setAnchorEl(null);
    }
    setDialogOpen(true);
    setValidationErrors([]);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setAnchorEl(null);
    setValidationErrors([]);
  };

  const handleSaveSpecifications = (newSpecifications: SpecificationValue[]) => {
    setSpecifications(newSpecifications);
    console.log('Specifications saved:', newSpecifications);
  };

  const handleValidationError = (errors: string[]) => {
    setValidationErrors(errors);
    console.error('Validation errors:', errors);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon color="primary" />
        機器仕様編集ダイアログ デモ
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        デバイス別に最適化された機器仕様編集ダイアログのデモです。
        各デバイスタイプでの表示と操作性を確認できます。
      </Typography>

      {/* デバイス選択ボタン */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            デバイスタイプを選択してダイアログを開く
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={(e) => handleOpenDialog(e, 'desktop')}
              startIcon={<SettingsIcon />}
            >
              デスクトップ（ポップオーバー）
            </Button>
            <Button
              variant="outlined"
              onClick={(e) => handleOpenDialog(e, 'tablet')}
              startIcon={<SettingsIcon />}
            >
              タブレット（ダイアログ）
            </Button>
            <Button
              variant="outlined"
              onClick={(e) => handleOpenDialog(e, 'mobile')}
              startIcon={<SettingsIcon />}
            >
              モバイル（フルスクリーン）
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 現在の仕様表示 */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            現在の機器仕様 ({specifications.length}項目)
          </Typography>
          <List dense>
            {specifications.map((spec, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={spec.order} size="small" variant="outlined" />
                        <Typography variant="subtitle2" fontWeight="bold">
                          {spec.key}
                        </Typography>
                      </Box>
                    }
                    secondary={spec.value}
                  />
                </ListItem>
                {index < specifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* バリデーションエラー表示 */}
      {validationErrors.length > 0 && (
        <Paper sx={{ p: 2, mb: 4, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography variant="h6" gutterBottom>
            バリデーションエラー
          </Typography>
          <List dense>
            {validationErrors.map((error, index) => (
              <ListItem key={index}>
                <ListItemText primary={`• ${error}`} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* デバイス別の特徴説明 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            デバイス別の特徴
          </Typography>
          
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                デスクトップ
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • ポップオーバー形式で表示
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • ドラッグ&ドロップで順序変更
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • キーボードショートカット対応
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • インライン編集モード
              </Typography>
              <Typography variant="body2">
                • 詳細なバリデーション表示
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                タブレット
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • モーダルダイアログで表示
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • タッチ操作に適したボタンサイズ
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 上下ボタンで順序変更
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 画面回転対応
              </Typography>
              <Typography variant="body2">
                • 適応的キーボード表示
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                モバイル
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • フルスクリーン表示
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 大きなタッチターゲット
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 簡略化されたUI
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • 片手操作対応
              </Typography>
              <Typography variant="body2">
                • 自動スクロール機能
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ダイアログコンポーネント */}
      <SpecificationEditDialog
        open={dialogOpen}
        specifications={specifications}
        onSave={handleSaveSpecifications}
        onClose={handleCloseDialog}
        deviceType={deviceType}
        anchorEl={anchorEl}
        maxItems={20}
        onValidationError={handleValidationError}
        userName="デモユーザー"
        readOnly={false}
        allowReorder={true}
      />
    </Box>
  );
};

export default SpecificationEditDialogExample;