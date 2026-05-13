import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

/**
 * Sprint 3 で registry.py の LLM_MODELS に追加した cloud_proxy 経由モデル一覧。
 * Slice 3-D で `/api/llm/models` 等のエンドポイントから動的取得に切替予定。
 * 暫定で hard-code、freeSolo で他モデル ID も自由入力できる。
 */
const KNOWN_CLOUD_MODELS = [
  'cloud_claude_3_5_sonnet',
  'cloud_claude_3_haiku',
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
        <Autocomplete
          freeSolo
          options={KNOWN_CLOUD_MODELS as unknown as string[]}
          value={preferredModel}
          onChange={(_, newValue) => setPreferredModel(newValue ?? '')}
          onInputChange={(_, newInputValue) => setPreferredModel(newInputValue)}
          size="small"
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              label="優先 LLM モデル"
              placeholder="例: cloud_claude_3_5_sonnet"
              helperText="ログイン中のアカウントで既定として使う LLM モデル ID。空欄なら未設定。"
              inputProps={{
                ...params.inputProps,
                'data-testid': 'cloud-llm-preferred-model',
              }}
            />
          )}
        />
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
