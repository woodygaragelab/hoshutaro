/**
 * UpdateNotification — 更新通知バナー
 *
 * Phase 4D: アプリ起動時にプラグイン更新 / アプリ更新をチェックし、
 * 非侵入的なバナーで通知する
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  SystemUpdateAlt as UpdateIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { checkPluginUpdates, checkAppUpdate, applyAppUpdate } from '../../services/integration/pluginApi';
import './UpdateNotification.css';

interface UpdateState {
  type: 'plugin' | 'app';
  message: string;
  detail: string;
}

interface UpdateNotificationProps {
  /** PluginManager を開く */
  onOpenPluginManager?: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  onOpenPluginManager,
}) => {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const checkForUpdates = useCallback(async () => {
    try {
      // Check plugin updates
      const pluginResult = await checkPluginUpdates().catch(() => ({ updates: [] }));
      if (pluginResult.updates && pluginResult.updates.length > 0) {
        setUpdate({
          type: 'plugin',
          message: 'プラグインの更新があります',
          detail: `${pluginResult.updates.length}個のプラグインが更新可能です`,
        });
        return;
      }

      // Check app update
      const appResult = await checkAppUpdate().catch(() => ({ available: false } as Awaited<ReturnType<typeof checkAppUpdate>>));
      if (appResult.available && appResult.latestVersion) {
        setUpdate({
          type: 'app',
          message: `新しいバージョン v${appResult.latestVersion}`,
          detail: appResult.releaseNotes?.slice(0, 80) || 'アップデートが利用可能です',
        });
      }
    } catch {
      // Silent fail — updates check is non-critical
    }
  }, []);

  useEffect(() => {
    // Initial check with a small delay to not block startup
    const timer = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => {
      setUpdate(null);
      setDismissed(false);
      setUpdateStatus('idle');
    }, 200);
  };

  const handleAction = async () => {
    if (update?.type === 'plugin' && onOpenPluginManager) {
      onOpenPluginManager();
      handleDismiss();
      return;
    }
    
    if (update?.type === 'app') {
      setIsUpdating(true);
      try {
        const result = await applyAppUpdate();
        if (result.status === 'staged') {
          setUpdateStatus('success');
          setUpdate({
            type: 'app',
            message: '再起動の準備が完了しました',
            detail: 'アプリを終了して再起動すると最新バージョンが適用されます。'
          });
        } else {
          setUpdateStatus('error');
          setUpdate({
            ...update,
            detail: 'アップデートに失敗しました。'
          });
        }
      } catch (err) {
        console.error(err);
        setUpdateStatus('error');
        setUpdate({
          ...update,
          detail: 'ネットワークエラーが発生しました。'
        });
      } finally {
        setIsUpdating(false);
      }
    }
  };

  if (!update) return null;

  return (
    <div className={`update-notification ${dismissed ? 'dismissed' : ''}`}>
      <div className="un-icon">
        <UpdateIcon sx={{ fontSize: 18, color: updateStatus === 'success' ? '#4caf50' : updateStatus === 'error' ? '#f44336' : '#888' }} />
      </div>
      <div className="un-body">
        <div className="un-title">{update.message}</div>
        <div className="un-detail">{update.detail}</div>
      </div>
      <div className="un-actions">
        {updateStatus === 'success' ? (
          <button className="un-btn secondary" onClick={handleDismiss}>閉じる</button>
        ) : (
          <button className="un-btn primary" onClick={handleAction} disabled={isUpdating}>
            {isUpdating ? 'ダウンロード中...' : update.type === 'plugin' ? '詳細' : '更新'}
          </button>
        )}
      </div>
      <button className="un-dismiss" onClick={handleDismiss} disabled={isUpdating}>
        <CloseIcon sx={{ fontSize: 14 }} />
      </button>
    </div>
  );
};
