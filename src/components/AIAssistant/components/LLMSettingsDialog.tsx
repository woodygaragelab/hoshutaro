import React, { useState, useEffect, useRef } from 'react';
import { getPluginConfig, updatePluginConfig } from '../../../services/api';
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
  Snackbar,
  Alert,
  Autocomplete,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  LLMSettings,
  TestConnectionResult,
  getLLMSettings,
  updateLLMSettings,
  testLLMConnection,
  startLLMAdapter,
  getLLMModels,
  getLocalModels,
  LocalModelInfo,
  getInstalledPlugins,
  PluginInfo,
  callLLMTool
} from '../../../services/api';

interface LLMSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: LLMSettings = {
  llm_adapter: 'gemini',
  llm_temperature: 0.1,
  llm_max_tokens: 1024,
};

export const LLMSettingsDialog: React.FC<LLMSettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [pluginConfigs, setPluginConfigs] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [adapterStarted, setAdapterStarted] = useState(true);
  const [pluginDirty, setPluginDirty] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [startResult, setStartResult] = useState<{ok: boolean, message?: string} | null>(null);
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

  // Hugging Face Downloader States
  const [hfRepoId, setHfRepoId] = useState('OpenVINO/gpt-oss-20b-int4-ov');
  const [hfDownloadState, setHfDownloadState] = useState<{status: string, error?: string, downloaded_mb?: number}>({status: 'idle'});

  const hfTimerRef = useRef<number | null>(null);

  const startHfDownload = async () => {
    if (!hfRepoId) return;
    try {
      const pconf = pluginConfigs['openvino-adapter'] || {};
      const res = await callLLMTool('openvino-adapter', pconf, 'download_hf_model', { repo_id: hfRepoId });
      if (res && res.ok) {
        setHfDownloadState({ status: 'downloading' });
        startPollingStatus();
      } else {
        setHfDownloadState({ status: 'error', error: res?.error || 'Unknown error' });
      }
    } catch (e: any) {
      setHfDownloadState({ status: 'error', error: e.message });
    }
  };

  const startPollingStatus = () => {
    if (hfTimerRef.current) clearInterval(hfTimerRef.current);
    hfTimerRef.current = window.setInterval(async () => {
      try {
        const pconf = pluginConfigs['openvino-adapter'] || {};
        const state = await callLLMTool('openvino-adapter', pconf, 'get_download_status', {});
        if (!state) return;
        
        // サーバー再起動などで状態がロストした場合の中断検知
        if (!state.active && (state.status === 'idle' || !state.status)) {
          if (hfTimerRef.current) clearInterval(hfTimerRef.current);
          setHfDownloadState({ status: 'error', error: 'ダウンロードが中断されました（バックエンドが再起動した可能性があります）。もう一度ボタンを押して再開してください。' });
          return;
        }

        if (state.status === 'downloading' && state.downloaded_mb !== undefined) {
          setHfDownloadState(prev => ({ ...prev, downloaded_mb: state.downloaded_mb }));
        }

        if (state.status === 'completed' || state.status === 'error') {
          if (hfTimerRef.current) clearInterval(hfTimerRef.current);
          setHfDownloadState({ status: state.status, error: state.error });
          if (state.status === 'completed') {
             handleFetchModels();
          }
        }
      } catch (e) {
        // network polling drop
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (hfTimerRef.current) clearInterval(hfTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        getLLMSettings(),
        getInstalledPlugins().catch(() => [])
      ])
        .then(async ([fetchedSettings, pluginsData]) => {
           setSettings(fetchedSettings);
           setPlugins(pluginsData);
           
           if (fetchedSettings.llm_adapter === 'gemini') {
             setAdapterStarted(true);
           } else {
             const activePlugin = pluginsData.find((p: PluginInfo) => p.id === fetchedSettings.llm_adapter);
             setAdapterStarted(activePlugin?.status === 'running');
           }
           
           const llmAdapters = pluginsData.filter((p: PluginInfo) => p.category === 'llm-adapter');
           const configs: Record<string, any> = {};
           
           for (const adapter of llmAdapters) {
             try {
               const conf = await getPluginConfig(adapter.id);
               
               // 後方互換性
               if (adapter.id === 'ollama-adapter') {
                 if (conf.LLM_BASE_URL === undefined && conf.OLLAMA_BASE_URL !== undefined) conf.LLM_BASE_URL = conf.OLLAMA_BASE_URL;
                 if (conf.LLM_MODEL === undefined && conf.OLLAMA_MODEL !== undefined) conf.LLM_MODEL = conf.OLLAMA_MODEL;
                 if (conf.LLM_API_KEY === undefined && conf.OLLAMA_API_KEY !== undefined) conf.LLM_API_KEY = conf.OLLAMA_API_KEY;
               }

               if (adapter.configSchema) {
                 for (const [key, prop] of Object.entries(adapter.configSchema)) {
                   if (conf[key] === undefined) {
                     conf[key] = (prop as any).default || '';
                   }
                 }
               }
               configs[adapter.id] = conf;
             } catch (e) {
               configs[adapter.id] = {};
             }
           }
           setPluginConfigs(configs);
        })
        .catch(() => setSettings(DEFAULT_SETTINGS))
        .finally(() => setLoading(false));
      setTestResult(null);
      setStartResult(null);
      setPluginDirty(false);
    }
  }, [open]);

  const handleAdapterChange = (newAdapter: string) => {
    setSettings(prev => ({ ...prev, llm_adapter: newAdapter }));
    setAvailableModels([]);
    setTestResult(null);
    setStartResult(null);
    setPluginDirty(false);
    // Geminiは常に有効だが、MCPは「起動」アクションを要求する
    setAdapterStarted(newAdapter === 'gemini');
  };

  const handleGlobalChange = (field: keyof LLMSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handlePluginChange = (pluginId: string, field: string, value: any) => {
    setPluginConfigs(prev => ({
      ...prev,
      [pluginId]: {
        ...(prev[pluginId] || {}),
        [field]: value
      }
    }));
    setTestResult(null);
    setPluginDirty(true);
  };

  const handleStartAdapter = async () => {
    setStarting(true);
    setStartResult(null);
    setTestResult(null);
    try {
      const pconf = pluginConfigs[settings.llm_adapter] || {};
      const res = await startLLMAdapter(settings.llm_adapter, pconf);
      if (res.ok) {
        setAdapterStarted(true);
        setPluginDirty(false);
        setStartResult({ ok: true, message: `${settings.llm_adapter} を起動しました。` });
      } else {
        setStartResult({ ok: false, message: res.error || '起動に失敗しました。' });
      }
    } catch (e: any) {
      setStartResult({ ok: false, message: e.message });
    } finally {
      setStarting(false);
    }
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const pconf = pluginConfigs[settings.llm_adapter] || {};
      const models = await getLLMModels(settings.llm_adapter, pconf);
      setAvailableModels(models);
      if (models.length > 0) {
        setModelDropdownOpen(true);
      }
    } catch (e: any) {
      alert('モデル一覧の取得に失敗しました: ' + e.message);
    } finally {
      setFetchingModels(false);
    }
  };

  const doSaveParams = async () => {
    if (settings.llm_adapter !== 'gemini') {
      const pconf = pluginConfigs[settings.llm_adapter] || {};
      await updatePluginConfig(settings.llm_adapter, pconf);
    }
    await updateLLMSettings(settings);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const pconf = pluginConfigs[settings.llm_adapter] || {};
      const res = await testLLMConnection(settings.llm_adapter, pconf);
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
      await doSaveParams();
      onClose();
    } catch (e: any) {
      alert('保存に失敗しました: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderPluginSettings = () => {
    if (settings.llm_adapter === 'gemini') return null;
    
    const activePlugin = plugins.find(p => p.id === settings.llm_adapter);
    if (!activePlugin || !activePlugin.configSchema) return null;
    
    const pconf = pluginConfigs[settings.llm_adapter] || {};

    return Object.entries(activePlugin.configSchema).map(([key, schemaDef]: [string, any]) => {
      const val = pconf[key] !== undefined ? pconf[key] : (schemaDef.default || '');
      
      if (key === 'LLM_MODEL') {
        return (
          <Box key={key} sx={{ display: 'flex', gap: 1 }}>
            <Autocomplete
              freeSolo
              open={modelDropdownOpen}
              onOpen={() => setModelDropdownOpen(true)}
              onClose={() => setModelDropdownOpen(false)}
              size="small"
              options={availableModels}
              value={val}
              onChange={(_, newValue) => handlePluginChange(settings.llm_adapter, key, newValue || '')}
              onInputChange={(_, newInputValue) => handlePluginChange(settings.llm_adapter, key, newInputValue)}
              renderInput={(params) => <TextField {...params} label={schemaDef.label || key} />}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={handleFetchModels} disabled={fetchingModels}>
              取得
            </Button>
          </Box>
        );
      }
      
      if (schemaDef.options && Array.isArray(schemaDef.options)) {
        return (
          <FormControl key={key} fullWidth size="small">
            <InputLabel>{schemaDef.label || key}</InputLabel>
            <Select
              label={schemaDef.label || key}
              value={val}
              onChange={(e) => handlePluginChange(settings.llm_adapter, key, e.target.value)}
            >
              {schemaDef.options.map((opt: string) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }
      
      return (
        <TextField
          key={key}
          label={schemaDef.label || key}
          size="small"
          type={key.includes('KEY') ? 'password' : 'text'}
          value={val}
          onChange={(e) => handlePluginChange(settings.llm_adapter, key, e.target.value)}
          placeholder={schemaDef.default || ''}
        />
      );
    });
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
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        LLM設定
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: '380px', pb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>プロバイダー (Adapter)</InputLabel>
            <Select
              label="プロバイダー (Adapter)"
              value={settings.llm_adapter}
              onChange={(e) => handleAdapterChange(e.target.value)}
            >
              <MenuItem value="gemini">HOSHUTAROエージェント（Gemini）</MenuItem>
              {plugins.filter(p => p.category === 'llm-adapter').map(p => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {settings.llm_adapter !== 'gemini' && (
            <Button 
              variant={adapterStarted && !pluginDirty ? "outlined" : "contained"} 
              color={adapterStarted && pluginDirty ? "warning" : "primary"}
              onClick={handleStartAdapter}
              disabled={starting || (adapterStarted && !pluginDirty)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {starting ? '処理中...' : (
                adapterStarted ? (pluginDirty ? '再起動して適用' : '起動済み') : '起動'
              )}
            </Button>
          )}
        </Box>

        {settings.llm_adapter === 'gemini' && (
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.primary">
              HOSHUTAROエージェント（Gemini）の設定です。
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              ※ 内部で最適化されたパラメータを使用するため、詳細設定は必要ありません。<br/>
              ※ サブスクリプション化を見据え、APIキーの表示・編集は行えません。
            </Typography>
          </Box>
        )}

        {!adapterStarted && settings.llm_adapter !== 'gemini' && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            アダプターが起動していません。「起動」ボタンを押して初期化してください。
          </Alert>
        )}

        {adapterStarted && renderPluginSettings()}

        {adapterStarted && settings.llm_adapter !== 'gemini' && (
          <>
            <Box>
              <Typography gutterBottom variant="caption">Temperature: {settings.llm_temperature}</Typography>
              <Slider
                size="small"
                value={settings.llm_temperature}
                onChange={(_, v) => handleGlobalChange('llm_temperature', v as number)}
                min={0} max={2} step={0.1}
              />
            </Box>
            <Box>
              <Typography gutterBottom variant="caption">Max Tokens: {settings.llm_max_tokens}</Typography>
              <Slider
                size="small"
                value={settings.llm_max_tokens}
                onChange={(_, v) => handleGlobalChange('llm_max_tokens', v as number)}
                min={256} max={8192} step={256}
              />
            </Box>
          </>
        )}

        {adapterStarted && settings.llm_adapter === 'openvino-adapter' && (
          <Box sx={{ p: 2, mt: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              Hugging Face からモデルをダウンロード
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Hugging Faceのリポジトリ名（例: OpenVINO/gpt-oss-20b-int4-ov）を入力してダウンロードします。大きなモデルの場合、数十分かかることがあります。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField
                size="small"
                fullWidth
                label="Hugging Face Repo ID"
                value={hfRepoId}
                onChange={(e) => setHfRepoId(e.target.value)}
                disabled={hfDownloadState.status === 'downloading'}
                placeholder="OpenVINO/gpt-oss-20b-int4-ov"
              />
              <Button 
                variant="contained" 
                color="secondary" 
                onClick={startHfDownload}
                disabled={!hfRepoId || hfDownloadState.status === 'downloading'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                ダウンロード
              </Button>
            </Box>
            
            {hfDownloadState.status !== 'idle' && (
              <Box sx={{ mt: 2 }}>
                {hfDownloadState.status === 'downloading' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption">
                      ダウンロード中... {hfDownloadState.downloaded_mb !== undefined ? `${hfDownloadState.downloaded_mb} MB ダウンロード済` : '（バックグラウンドで処理しています）'}
                    </Typography>
                  </Box>
                )}
                {hfDownloadState.status === 'completed' && (
                  <Alert severity="success" size="small" sx={{ py: 0 }}>
                    ダウンロード完了！上部のModel一覧から選択できます。
                  </Alert>
                )}
                {hfDownloadState.status === 'error' && (
                  <Alert severity="error" size="small" sx={{ py: 0 }}>
                    エラーが発生しました: {hfDownloadState.error}
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        )}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'space-between' }}>
        <Button 
          onClick={handleTest} 
          disabled={!adapterStarted || testing || saving} 
          variant="outlined" 
          color="secondary"
        >
          {testing ? 'テスト中...' : 'テスト'}
        </Button>
        <Box>
          <Button onClick={onClose} disabled={saving} color="inherit" sx={{ mr: 1 }}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" color="primary">
            {saving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </DialogActions>
      <Snackbar
        open={!!testResult || !!startResult}
        autoHideDuration={6000}
        onClose={() => { setTestResult(null); setStartResult(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => { setTestResult(null); setStartResult(null); }} 
          severity={(testResult?.ok || startResult?.ok) ? 'success' : 'error'} 
          sx={{ width: '100%', whiteSpace: 'pre-wrap' }}
        >
          {startResult ? 
            startResult.message : 
            (testResult?.ok ? 
              `テスト成功:\n${testResult.response_text}` : 
              `テスト失敗: ${testResult?.error || ''}`
            )
          }
        </Alert>
      </Snackbar>
    </Dialog>
  );
};
