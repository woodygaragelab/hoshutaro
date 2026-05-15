import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';

/**
 * クラウド LLM モデルのフレンドリー表示。
 *
 * - id: registry.py の LLM_MODELS キーと完全一致 (バックエンド側の解決用)
 * - label: ユーザー向け表示名 (docs/10 §2 用語マッピング表に従い、内部 ID は隠す)
 *
 * 将来 `/api/llm/models` エンドポイントから動的取得に切替予定 (Slice 3-D 残)、
 * 現状は hard-code。新モデル追加時は backend/app/llm/registry.py と本配列の両方を
 * 更新する。
 */
type CloudModelOption = { id: string; label: string };
const CLOUD_MODEL_OPTIONS: readonly CloudModelOption[] = [
  { id: 'cloud_claude_3_5_sonnet', label: 'Claude 3.5 Sonnet (クラウド)' },
  { id: 'cloud_claude_3_haiku', label: 'Claude 3 Haiku (クラウド)' },
] as const;
import { useAuth } from '../../../hooks/useAuth';
import { useLLMSettings, type LLMSettingsData } from '../../../hooks/useLLMSettings';

/**
 * HOSHUTARO Track D Sprint 2 - LLMSettingsDialog 内のクラウド同期セクション
 * (Slice 2-C)。
 *
 * 役割:
 *   - DynamoDB `LLMSettings` のうち、**アカウント全体で共有すべき項目**
 *     (preferredModel / mtpEnabled) を編集する UI
 *   - 既存の LLMSettingsDialog の他セクション (adapter / temperature / HF download)
 *     は **デバイス固有** なので変更しない
 *
 * 未認証の場合は `null` を返す (AuthGuard で守られているので通常は到達しないが、
 * defensive)。
 *
 * `fallbackModels[]` と `customApiKeys` は型としては `useLLMSettings` から扱える
 * が、本 Slice では UI 提供を見送る (Sprint 5 で encrypted handling 整備後に拡張)。
 */
export function CloudLLMSettingsSection() {
  const { user } = useAuth();
  const {
    settings,
    isLoading,
    error,
    DEFAULTS,
    updateAsync,
    isUpdating,
    updateError,
  } = useLLMSettings();

  const [preferredModel, setPreferredModel] = useState<string>('');
  const [mtpEnabled, setMtpEnabled] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  // settings が来たら state を同期 (初回 load / refetch)
  useEffect(() => {
    if (settings === undefined) return; // まだ fetch 中
    const data: LLMSettingsData = settings ?? DEFAULTS;
    setPreferredModel(data.preferredModel ?? '');
    setMtpEnabled(data.mtpEnabled);
  }, [settings, DEFAULTS]);

  if (!user) return null;

  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
        data-testid="cloud-llm-loading"
      >
        <CircularProgress size={20} />
      </Box>
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    try {
      await updateAsync({
        preferredModel: preferredModel.trim() || null,
        mtpEnabled,
      });
      setSuccess('クラウド設定を保存しました。');
    } catch {
      // updateError 経由で表示されるため、ここでは追加処理なし
    }
  }

  return (
    <Box
      component="form"
      onSubmit={handleSave}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        クラウド同期設定 (アカウント全体で共有)
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
          {error.message}
        </Alert>
      )}
      {updateError && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert" aria-live="polite">
          {updateError.message}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
          {success}
        </Alert>
      )}
      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel id="cloud-llm-preferred-model-label" shrink>
            優先モデル
          </InputLabel>
          <Select
            labelId="cloud-llm-preferred-model-label"
            id="cloud-llm-preferred-model"
            value={preferredModel}
            label="優先モデル"
            displayEmpty
            onChange={(e: SelectChangeEvent) => setPreferredModel(e.target.value)}
            inputProps={{ 'data-testid': 'cloud-llm-preferred-model' }}
          >
            <MenuItem value="">
              <em>未設定</em>
            </MenuItem>
            {CLOUD_MODEL_OPTIONS.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={mtpEnabled}
              onChange={(e) => setMtpEnabled(e.target.checked)}
            />
          }
          label="MTP (Speculative Decoding) を有効化"
        />
        <Button
          type="submit"
          variant="outlined"
          size="small"
          disabled={isUpdating}
          startIcon={
            isUpdating ? <CircularProgress size={14} color="inherit" /> : null
          }
          sx={{ alignSelf: 'flex-start' }}
        >
          {isUpdating ? '保存中…' : 'クラウド設定を保存'}
        </Button>
      </Stack>
    </Box>
  );
}

export default CloudLLMSettingsSection;
