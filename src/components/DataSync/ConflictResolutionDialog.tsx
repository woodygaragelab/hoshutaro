import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Chip,
  Alert,
  Grid,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Person,
  Schedule,
  Merge,
  CompareArrows,
} from '@mui/icons-material';
import { SyncConflict, ConflictResolution } from './types';
import { detectDevice } from '../CommonEdit/deviceDetection';

interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: SyncConflict | null;
  onResolve: (conflictId: string, resolution: ConflictResolution) => void;
  onCancel: () => void;
  deviceType?: 'desktop' | 'tablet' | 'mobile';
}

/**
 * 競合解決ダイアログ
 * デバイス別最適化された競合解決UIを提供
 */
export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  open,
  conflict,
  onResolve,
  onCancel,
  deviceType,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictResolution['strategy']>('use_local');
  const [showDetails, setShowDetails] = useState(false);
  const [manualData, setManualData] = useState<any>(null);

  // デバイスタイプを検出
  const currentDeviceType = deviceType || detectDevice().type;

  // 競合データの分析
  const conflictAnalysis = useMemo(() => {
    if (!conflict) return null;

    const local = conflict.localData;
    const remote = conflict.remoteData;

    return {
      hasTimestampDifference: local.timestamp !== remote.timestamp,
      hasValueDifference: JSON.stringify(local.value) !== JSON.stringify(remote.value),
      localNewer: local.timestamp > remote.timestamp,
      remoteNewer: remote.timestamp > local.timestamp,
      canAutoMerge: conflict.type !== 'permission_conflict',
    };
  }, [conflict]);

  // 推奨解決策を取得
  const getRecommendedStrategy = useCallback((): ConflictResolution['strategy'] => {
    if (!conflict || !conflictAnalysis) return 'use_local';

    // タイムスタンプベースの推奨
    if (conflictAnalysis.localNewer) return 'use_local';
    if (conflictAnalysis.remoteNewer) return 'use_remote';
    
    // 自動マージ可能な場合
    if (conflictAnalysis.canAutoMerge) return 'merge';
    
    return 'manual';
  }, [conflict, conflictAnalysis]);

  // 初期化時に推奨戦略を設定
  React.useEffect(() => {
    if (conflict) {
      setSelectedStrategy(getRecommendedStrategy());
    }
  }, [conflict, getRecommendedStrategy]);

  // 解決実行
  const handleResolve = useCallback(() => {
    if (!conflict) return;

    const resolution: ConflictResolution = {
      strategy: selectedStrategy,
      ...(selectedStrategy === 'manual' && { manualData }),
      reason: `Resolved via ${selectedStrategy} strategy`,
    };

    onResolve(conflict.id, resolution);
  }, [conflict, selectedStrategy, manualData, onResolve]);

  // データプレビューコンポーネント
  const DataPreview: React.FC<{ 
    title: string; 
    data: any; 
    isRecommended?: boolean;
    icon?: React.ReactNode;
  }> = ({ title, data, isRecommended, icon }) => (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2,
        border: isRecommended ? '2px solid' : '1px solid',
        borderColor: isRecommended ? 'primary.main' : 'divider',
      }}
    >
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="subtitle1">{title}</Typography>
            {isRecommended && (
              <Chip label="推奨" size="small" color="primary" />
            )}
          </Box>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0 }}>
        {data.type === 'cell_edit' && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              セル: {data.rowId} × {data.columnId}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              値: {JSON.stringify(data.value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              更新日時: {new Date(data.timestamp).toLocaleString()}
            </Typography>
          </Box>
        )}
        
        {data.type === 'specification_edit' && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              機器仕様: {data.rowId} - {data.key}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              値: {data.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              更新日時: {new Date(data.timestamp).toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // デバイス別レイアウト設定
  const getDialogProps = () => {
    switch (currentDeviceType) {
      case 'mobile':
        return {
          fullScreen: true,
          maxWidth: false as const,
          PaperProps: {
            sx: { margin: 0, maxHeight: '100vh' }
          }
        };
      case 'tablet':
        return {
          maxWidth: 'md' as const,
          fullWidth: true,
          PaperProps: {
            sx: { margin: 2, maxHeight: 'calc(100vh - 64px)' }
          }
        };
      case 'desktop':
      default:
        return {
          maxWidth: 'lg' as const,
          fullWidth: true,
          PaperProps: {
            sx: { maxHeight: '80vh' }
          }
        };
    }
  };

  if (!conflict) return null;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      {...getDialogProps()}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrows color="warning" />
          <Typography variant="h6">
            データ競合の解決
          </Typography>
          <Chip 
            label={conflict.severity} 
            size="small" 
            color={
              conflict.severity === 'critical' ? 'error' :
              conflict.severity === 'high' ? 'warning' :
              conflict.severity === 'medium' ? 'info' : 'default'
            }
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 競合の説明 */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            {conflict.description}
          </Typography>
        </Alert>

        {/* 解決戦略の選択 */}
        <Typography variant="h6" gutterBottom>
          解決方法を選択してください
        </Typography>
        
        <RadioGroup
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value as ConflictResolution['strategy'])}
        >
          <FormControlLabel
            value="use_local"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1">ローカルの変更を使用</Typography>
                <Typography variant="caption" color="text.secondary">
                  あなたの変更を優先します
                </Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            value="use_remote"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1">リモートの変更を使用</Typography>
                <Typography variant="caption" color="text.secondary">
                  他のユーザーの変更を優先します
                </Typography>
              </Box>
            }
          />
          
          {conflictAnalysis?.canAutoMerge && (
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">自動マージ</Typography>
                  <Typography variant="caption" color="text.secondary">
                    可能な場合は両方の変更を統合します
                  </Typography>
                </Box>
              }
            />
          )}
          
          <FormControlLabel
            value="manual"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1">手動解決</Typography>
                <Typography variant="caption" color="text.secondary">
                  カスタムの値を指定します
                </Typography>
              </Box>
            }
          />
        </RadioGroup>

        <Divider sx={{ my: 3 }} />

        {/* データ比較 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">データ比較</Typography>
          <IconButton
            size="small"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <DataPreview
              title="ローカルの変更"
              data={conflict.localData}
              isRecommended={selectedStrategy === 'use_local'}
              icon={<Person fontSize="small" />}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <DataPreview
              title="リモートの変更"
              data={conflict.remoteData}
              isRecommended={selectedStrategy === 'use_remote'}
              icon={<Schedule fontSize="small" />}
            />
          </Grid>
        </Grid>

        {/* 詳細情報 */}
        <Collapse in={showDetails}>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              競合詳細
            </Typography>
            <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
              {JSON.stringify(conflict, null, 2)}
            </Typography>
          </Box>
        </Collapse>

        {/* 手動解決の入力 */}
        {selectedStrategy === 'manual' && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              手動解決データ
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              手動解決機能は開発中です。現在は他の解決方法を選択してください。
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button 
          onClick={onCancel}
          size={currentDeviceType === 'mobile' ? 'large' : 'medium'}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleResolve}
          variant="contained"
          disabled={selectedStrategy === 'manual' && !manualData}
          size={currentDeviceType === 'mobile' ? 'large' : 'medium'}
          startIcon={<Merge />}
        >
          解決実行
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictResolutionDialog;