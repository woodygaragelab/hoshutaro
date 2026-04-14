/**
 * PluginManager — プラグイン管理ダイアログ
 *
 * Phase 4B: インストール済み / 利用可能 の2タブ構成
 * バックエンド Plugin REST API と連動
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tabs,
  Tab,
  Box,
  Typography,
  CircularProgress,
  Button,
  Chip,
  Alert,
  List,
  ListItem
} from '@mui/material';
import {
  Close as CloseIcon,
  Extension as ExtensionIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { PluginInfo, LicenseInfo } from '../../services/integration/types';
import {
  fetchPlugins,
  fetchRegistry,
  installPlugin,
  uninstallPlugin,
  fetchLicenseInfo,
} from '../../services/integration/pluginApi';

interface PluginManagerProps {
  open: boolean;
  onClose: () => void;
}

type TabKey = 'installed' | 'available';

interface RegistryPlugin {
  id: string;
  name: string;
  version: string;
  category: string;
  icon: string;
  license: string;
  installed: boolean;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<TabKey>('installed');
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [registry, setRegistry] = useState<RegistryPlugin[]>([]);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [pluginList, registryData, licenseData] = await Promise.all([
        fetchPlugins().catch((e) => {
          console.error('[PluginManager] fetchPlugins error:', e);
          return [];
        }),
        fetchRegistry().catch((e) => {
          console.error('[PluginManager] fetchRegistry error:', e);
          setErrorMsg('APIへの接続に失敗しました。サーバーが起動しているか確認してください。');
          return { plugins: [] };
        }),
        fetchLicenseInfo().catch((e) => {
          console.error('[PluginManager] fetchLicenseInfo error:', e);
          return null;
        }),
      ]);
      setPlugins(pluginList || []);
      setRegistry((registryData as any).plugins || []);
      if (licenseData) setLicense(licenseData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleInstall = async (id: string) => {
    setActionLoading(id);
    try {
      await installPlugin(id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!window.confirm(`プラグイン「${id}」をアンインストールしますか？`)) return;
    setActionLoading(id);
    try {
      await uninstallPlugin(id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return '起動中';
      case 'stopped': return '停止';
      case 'error': return 'エラー';
      case 'installing': return 'インストール中';
      default: return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'connector': return 'コネクタ';
      case 'llm-adapter': return 'LLMアダプタ';
      case 'utility': return 'ユーティリティ';
      default: return category;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        プラグイン管理
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 3, pt: 1, minHeight: '400px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs
            value={tab}
            onChange={(_, newVal) => setTab(newVal)}
            TabIndicatorProps={{ style: { display: 'none' } }}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                py: 0.5, px: 2, mr: 1,
                borderRadius: 4,
                textTransform: 'none',
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                bgcolor: 'action.selected',
                color: 'text.primary',
                fontWeight: 'bold',
              }
            }}
          >
            <Tab label={`インストール済み (${plugins.length})`} value="installed" />
            <Tab label={`利用可能 (${registry.filter(r => !r.installed).length})`} value="available" />
          </Tabs>
          <IconButton onClick={loadData} size="small" title="更新">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>

        {errorMsg && <Alert severity="error" sx={{ mt: 1 }}>{errorMsg}</Alert>}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <List sx={{ mt: 1 }}>
            {tab === 'installed' && (
              <>
                {plugins.length === 0 ? (
                  <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                    インストール済みのプラグインはありません。<br />
                    「利用可能」タブからインストールできます。
                  </Typography>
                ) : (
                  plugins.map(plugin => (
                    <ListItem 
                      key={plugin.id} 
                      sx={{ 
                        bgcolor: 'background.paper', 
                        mb: 1.5, 
                        borderRadius: 2, 
                        border: 1, 
                        borderColor: 'divider',
                        px: 2,
                        py: 2,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box sx={{ fontSize: 32, mr: 2, display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        {plugin.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                          {plugin.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={getCategoryLabel(plugin.category)} color={plugin.category === 'connector' ? 'primary' : plugin.category === 'llm-adapter' ? 'secondary' : 'default'} />
                          <Typography variant="caption" color="text.secondary">v{plugin.version}</Typography>
                          <Typography variant="caption" sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 0.5,
                            color: plugin.status === 'running' ? 'success.main' : plugin.status === 'error' ? 'error.main' : 'text.secondary'
                          }}>
                            <Box sx={{ 
                              width: 6, height: 6, borderRadius: '50%',
                              bgcolor: plugin.status === 'running' ? 'success.main' : plugin.status === 'error' ? 'error.main' : 'text.disabled'
                            }} />
                            {getStatusLabel(plugin.status)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', ml: 2 }}>
                        <IconButton 
                          color="error" 
                          onClick={() => handleUninstall(plugin.id)}
                          disabled={actionLoading === plugin.id}
                          title="アンインストール"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))
                )}
              </>
            )}

            {tab === 'available' && (
              <>
                {registry.filter(r => !r.installed).length === 0 ? (
                  <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                    すべてのプラグインがインストール済みです。
                  </Typography>
                ) : (
                  registry.filter(r => !r.installed).map(plugin => (
                    <ListItem 
                      key={plugin.id} 
                      sx={{ 
                        bgcolor: 'background.paper', 
                        mb: 1.5, 
                        borderRadius: 2, 
                        border: 1, 
                        borderColor: 'divider',
                        px: 2,
                        py: 2,
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ fontSize: 32, mr: 2, display: 'flex', alignItems: 'center' }}>
                        {plugin.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                          {plugin.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip size="small" label={getCategoryLabel(plugin.category)} color={plugin.category === 'connector' ? 'primary' : plugin.category === 'llm-adapter' ? 'secondary' : 'default'} />
                          <Typography variant="caption" color="text.secondary">v{plugin.version}</Typography>
                          <Chip size="small" label={plugin.license === 'premium' ? 'Premium' : 'Free'} variant="outlined" />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', ml: 2 }}>
                        <Button 
                          variant="contained" 
                          color="primary"
                          size="small"
                          onClick={() => handleInstall(plugin.id)}
                          disabled={actionLoading === plugin.id}
                          startIcon={<DownloadIcon />}
                        >
                          {actionLoading === plugin.id ? '...' : 'インストール'}
                        </Button>
                      </Box>
                    </ListItem>
                  ))
                )}
              </>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};
