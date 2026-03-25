import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Typography,
  Box,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  LLMSettings,
  TestConnectionResult,
  getLLMSettings,
  updateLLMSettings,
  testLLMConnection,
} from '../../../services/api';

interface LLMSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: LLMSettings = {
  llm_adapter: 'openai_compat',
  llm_base_url: 'http://127.0.0.1:11434/v1',
  llm_model: 'qwen2.5:7b',
  llm_api_key: 'none',
  llm_temperature: 0.1,
  llm_max_tokens: 2048,
};

export const LLMSettingsDialog: React.FC<LLMSettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getLLMSettings()
        .then(setSettings)
        .catch(() => setSettings(DEFAULT_SETTINGS))
        .finally(() => setLoading(false));
      setTestResult(null);
    }
  }, [open]);

  const handleChange = (field: keyof LLMSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testLLMConnection(settings);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, latency_ms: 0, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLLMSettings(settings);
      onClose();
    } catch (e: any) {
      alert('保存に失敗しました: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} disableEscapeKeyDown>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        LLM設定
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>プロバイダー (Adapter)</InputLabel>
          <Select
            label="プロバイダー (Adapter)"
            value={settings.llm_adapter}
            onChange={(e) => handleChange('llm_adapter', e.target.value)}
          >
            <MenuItem value="openai_compat">外部/ローカルサーバー接続 (OpenAI互換)</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="接続URL (Base URL)"
          fullWidth
          size="small"
          value={settings.llm_base_url}
          onChange={(e) => handleChange('llm_base_url', e.target.value)}
        />

        <TextField
          label="モデル名"
          fullWidth
          size="small"
          value={settings.llm_model}
          onChange={(e) => handleChange('llm_model', e.target.value)}
          helperText="Ollama / LocalAI / OpenAI などのモデルIDを入力"
        />

        <TextField
          label="APIキー (省略時は none)"
          fullWidth
          size="small"
          type="password"
          value={settings.llm_api_key}
          onChange={(e) => handleChange('llm_api_key', e.target.value)}
        />

        <Box>
          <Typography gutterBottom variant="body2" color="text.secondary">
            Temperature: {settings.llm_temperature.toFixed(2)}
          </Typography>
          <Slider
            value={settings.llm_temperature}
            min={0}
            max={1}
            step={0.05}
            onChange={(_, val) => handleChange('llm_temperature', val as number)}
            valueLabelDisplay="auto"
          />
        </Box>

        <Box>
          <Typography gutterBottom variant="body2" color="text.secondary">
            Max Tokens: {settings.llm_max_tokens}
          </Typography>
          <Slider
            value={settings.llm_max_tokens}
            min={128}
            max={8192}
            step={128}
            onChange={(_, val) => handleChange('llm_max_tokens', val as number)}
            valueLabelDisplay="auto"
          />
        </Box>

        {testResult && (
          <Box p={2} bgcolor={testResult.ok ? 'success.light' : 'error.light'} borderRadius={1}>
            <Typography variant="body2" color={testResult.ok ? 'success.main' : 'error.main'} fontWeight="bold">
              {testResult.ok ? `✓ 接続成功 (${testResult.latency_ms}ms)` : `✗ 接続失敗: ${testResult.error}`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleTest} disabled={testing} color="secondary">
          {testing ? 'テスト中...' : '接続テスト'}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} color="inherit">
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" color="primary" disableElevation>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
