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
  Autocomplete,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  LLMSettings,
  TestConnectionResult,
  getLLMSettings,
  updateLLMSettings,
  testLLMConnection,
  getLLMModels,
  getLocalModels,
  LocalModelInfo
} from '../../../services/api';

interface LLMSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: LLMSettings = {
  llm_adapter: 'gemini',
  llm_base_url: '',
  llm_model: '',
  llm_api_key: '',
  llm_temperature: 0.1,
  llm_max_tokens: 1024,
  openvino_models_dir: '',
  openvino_model_path: '',
  openvino_device: 'AUTO',
  openvino_performance_mode: 'LATENCY',
};

export const LLMSettingsDialog: React.FC<LLMSettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [localModels, setLocalModels] = useState<LocalModelInfo[]>([]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getLLMSettings()
        .then(settings => {
           setSettings(settings)
           return getLocalModels(settings.openvino_models_dir)
        })
        .then(setLocalModels)
        .catch(() => setSettings(DEFAULT_SETTINGS))
        .finally(() => setLoading(false));
      setTestResult(null);
    }
  }, [open]);

  const handleModelsDirChange = async (newDir: string) => {
    handleChange('openvino_models_dir', newDir);
    try {
      const models = await getLocalModels(newDir);
      setLocalModels(models);
    } catch (e) {
      console.error("Failed to fetch models for new dir", e);
      setLocalModels([]);
    }
  };

  const handleChange = (field: keyof LLMSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const models = await getLLMModels(settings.llm_base_url, settings.llm_api_key);
      setAvailableModels(models);
    } catch (e: any) {
      alert('モデル一覧の取得に失敗しました: ' + e.message);
    } finally {
      setFetchingModels(false);
    }
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
            <MenuItem value="gemini">Google Gemini API (組み込み)</MenuItem>
            <MenuItem value="openai_compat">外部/ローカルサーバー接続 (OpenAI互換)</MenuItem>
            <MenuItem value="openvino_genai">ローカルエッジ推論 (OpenVINO NPU/GPU)</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" sx={{ color: '#aaa' }}>
          ※ LLMプラグインの接続先（URLや使用モデル）は、<br/>
          「プラグイン管理画面」の各プラグイン設定(⚙️)で行ってください。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" color="primary">
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
