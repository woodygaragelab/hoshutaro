/**
 * PluginManager — プラグイン管理ダイアログ
 *
 * Phase 4B: インストール済み / 利用可能 の2タブ構成
 * バックエンド Plugin REST API と連動
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Close as CloseIcon,
  Extension as ExtensionIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { PluginInfo, PluginConfigSchemaField, LicenseInfo } from '../../services/integration/types';
import {
  fetchPlugins,
  fetchRegistry,
  installPlugin,
  uninstallPlugin,
  startPlugin,
  stopPlugin,
  fetchPluginConfig,
  updatePluginConfig,
  fetchLicenseInfo,
} from '../../services/integration/pluginApi';

import './PluginManager.css';

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

  // Config editing state
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configSchema, setConfigSchema] = useState<Record<string, PluginConfigSchemaField>>({});
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pluginList, registryData, licenseData] = await Promise.all([
        fetchPlugins().catch(() => []),
        fetchRegistry().catch(() => ({ plugins: [] })),
        fetchLicenseInfo().catch(() => null),
      ]);
      setPlugins(pluginList);
      setRegistry((registryData as any).plugins || []);
      if (licenseData) setLicense(licenseData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // Actions
  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await startPlugin(id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      await stopPlugin(id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  };

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

  const handleOpenConfig = async (id: string) => {
    try {
      const data = await fetchPluginConfig(id);
      const manifest = data.manifest as any;
      setConfigSchema(manifest?.configSchema || {});
      setConfigValues(data.config || {});
      setEditingConfig(id);
    } catch (e) {
      console.error('Failed to load plugin config:', e);
    }
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setActionLoading(editingConfig);
    try {
      await updatePluginConfig(editingConfig, configValues);
      setEditingConfig(null);
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

  const editingPlugin = plugins.find(p => p.id === editingConfig);

  return (
    <div className="plugin-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="plugin-manager-dialog">

        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-title">
            <ExtensionIcon sx={{ fontSize: 18 }} />
            プラグイン管理
          </div>
          <button className="pm-close-btn" onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          <button
            className={`pm-tab ${tab === 'installed' ? 'active' : ''}`}
            onClick={() => setTab('installed')}
          >
            インストール済み ({plugins.length})
          </button>
          <button
            className={`pm-tab ${tab === 'available' ? 'active' : ''}`}
            onClick={() => setTab('available')}
          >
            利用可能 ({registry.filter(r => !r.installed).length})
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="pm-close-btn"
            onClick={loadData}
            title="更新"
            style={{ padding: '6px' }}
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Content */}
        <div className="pm-content">
          {loading && <div className="pm-empty">読み込み中...</div>}

          {!loading && tab === 'installed' && (
            <>
              {plugins.length === 0 ? (
                <div className="pm-empty">
                  インストール済みのプラグインはありません。<br />
                  「利用可能」タブからインストールできます。
                </div>
              ) : (
                plugins.map(plugin => (
                  <div key={plugin.id} className="pm-card">
                    <div className="pm-card-icon">{plugin.icon}</div>
                    <div className="pm-card-body">
                      <div className="pm-card-name">{plugin.name}</div>
                      <div className="pm-card-meta">
                        <span className={`pm-badge ${plugin.category}`}>
                          {getCategoryLabel(plugin.category)}
                        </span>
                        <span className="pm-version">v{plugin.version}</span>
                        <span className="pm-status">
                          <span className={`pm-status-dot ${plugin.status}`} />
                          {getStatusLabel(plugin.status)}
                        </span>
                      </div>

                      {/* Config Section */}
                      {editingConfig === plugin.id && (
                        <div className="pm-config-section">
                          {Object.entries(configSchema).map(([key, field]) => (
                            <div key={key} className="pm-config-field">
                              <label className="pm-config-label">
                                {field.label} {field.required && '*'}
                              </label>
                              <input
                                className="pm-config-input"
                                type={field.type === 'secret' ? 'password' : 'text'}
                                value={configValues[key] || ''}
                                placeholder={field.default?.toString() || ''}
                                onChange={(e) => setConfigValues(prev => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))}
                              />
                            </div>
                          ))}
                          <div className="pm-config-actions">
                            <button className="pm-action-btn primary" onClick={handleSaveConfig}>
                              保存
                            </button>
                            <button className="pm-action-btn" onClick={() => setEditingConfig(null)}>
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pm-card-actions">
                      {plugin.status === 'running' ? (
                        <button
                          className="pm-action-btn"
                          onClick={() => handleStop(plugin.id)}
                          disabled={actionLoading === plugin.id}
                          title="停止"
                        >
                          <StopIcon sx={{ fontSize: 14 }} />
                        </button>
                      ) : (
                        <button
                          className="pm-action-btn"
                          onClick={() => handleStart(plugin.id)}
                          disabled={actionLoading === plugin.id}
                          title="起動"
                        >
                          <PlayIcon sx={{ fontSize: 14 }} />
                        </button>
                      )}
                      <button
                        className="pm-action-btn"
                        onClick={() => editingConfig === plugin.id
                          ? setEditingConfig(null)
                          : handleOpenConfig(plugin.id)}
                        title="設定"
                      >
                        <SettingsIcon sx={{ fontSize: 14 }} />
                      </button>
                      <button
                        className="pm-action-btn danger"
                        onClick={() => handleUninstall(plugin.id)}
                        disabled={actionLoading === plugin.id}
                        title="アンインストール"
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {!loading && tab === 'available' && (
            <>
              {registry.filter(r => !r.installed).length === 0 ? (
                <div className="pm-empty">
                  すべてのプラグインがインストール済みです。
                </div>
              ) : (
                registry.filter(r => !r.installed).map(plugin => (
                  <div key={plugin.id} className="pm-card">
                    <div className="pm-card-icon">{plugin.icon}</div>
                    <div className="pm-card-body">
                      <div className="pm-card-name">{plugin.name}</div>
                      <div className="pm-card-meta">
                        <span className={`pm-badge ${plugin.category}`}>
                          {getCategoryLabel(plugin.category)}
                        </span>
                        <span className="pm-version">v{plugin.version}</span>
                        <span className={`pm-badge ${plugin.license === 'premium' ? 'connector' : 'utility'}`}>
                          {plugin.license === 'premium' ? 'Premium' : 'Free'}
                        </span>
                      </div>
                    </div>
                    <div className="pm-card-actions">
                      <button
                        className="pm-action-btn primary"
                        onClick={() => handleInstall(plugin.id)}
                        disabled={actionLoading === plugin.id}
                      >
                        {actionLoading === plugin.id ? '...' : (
                          <>
                            <DownloadIcon sx={{ fontSize: 14, mr: 0.5 }} />
                            インストール
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* License Bar */}
        {license && (
          <div className="pm-license-bar">
            <span>
              プラン: <span className="pm-license-plan">{license.plan}</span>
              {license.isDevMode && ' (開発モード)'}
            </span>
            <span>
              Gemini: {license.geminiUsed} / {license.geminiQuota === -1 ? '∞' : license.geminiQuota}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
