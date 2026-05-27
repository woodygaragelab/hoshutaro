/**
 * UpdateNotification — 更新通知バナー
 *
 * Phase 4D: アプリ起動時にプラグイン更新 / アプリ更新をチェックし、
 * 非侵入的なバナーで通知する。
 *
 * プラン Track E Gap 2: アプリ更新は経路を 2 系統に分ける。
 *  - Tauri 梱包アプリ: ネイティブ updater（@tauri-apps/plugin-updater）で
 *    check → downloadAndInstall → relaunch。
 *  - ブラウザ / 開発モード: 従来のバックエンド REST（/api/updates/*）。
 * 動的 import により jest（非 Tauri）では @tauri-apps/plugin-* を読み込まない。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SystemUpdateAlt as UpdateIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { checkPluginUpdates, checkAppUpdate, applyAppUpdate } from '../../services/integration/pluginApi';
import { isTauri } from '../../services/apiBase';
import './UpdateNotification.css';

interface UpdateState {
  type: 'plugin' | 'app';
  message: string;
  detail: string;
}

/** ネイティブ updater の Update オブジェクトのうち本コンポーネントが使う部分。 */
interface TauriUpdateHandle {
  available: boolean;
  version: string;
  body?: string;
  downloadAndInstall: (onEvent?: (event: unknown) => void) => Promise<void>;
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
  // Tauri ネイティブ updater の Update オブジェクト（downloadAndInstall に必要）
  const tauriUpdateRef = useRef<TauriUpdateHandle | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // プラグイン更新（アプリ更新とは別系統、常にバックエンド経由）
      const pluginResult = await checkPluginUpdates().catch(() => ({ updates: [] }));
      if (pluginResult.updates && pluginResult.updates.length > 0) {
        setUpdate({
          type: 'plugin',
          message: 'プラグインの更新があります',
          detail: `${pluginResult.updates.length}個のプラグインが更新可能です`,
        });
        return;
      }

      // アプリ更新: Tauri 梱包時はネイティブ updater、それ以外はバックエンド REST
      if (isTauri()) {
        const { check } = await import('@tauri-apps/plugin-updater');
        const result = (await check()) as TauriUpdateHandle | null;
        if (result?.available) {
          tauriUpdateRef.current = result;
          setUpdate({
            type: 'app',
            message: `新しいバージョン v${result.version}`,
            detail: result.body?.slice(0, 80) || 'アップデートが利用可能です',
          });
        }
        return;
      }

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

  /** Tauri ネイティブ updater でダウンロード・インストール・再起動する。 */
  const applyTauriUpdate = async () => {
    const handle = tauriUpdateRef.current;
    if (!handle) throw new Error('更新オブジェクトが見つかりません');
    await handle.downloadAndInstall();
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
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
        if (isTauri() && tauriUpdateRef.current) {
          // ネイティブ updater: インストール完了後 relaunch（ここから先は復帰しない）
          setUpdateStatus('success');
          setUpdate({
            type: 'app',
            message: 'アップデートを適用しています',
            detail: 'ダウンロード完了後、自動的に再起動します。',
          });
          await applyTauriUpdate();
          return;
        }

        // ブラウザ / dev: バックエンド経由でステージング
        const result = await applyAppUpdate();
        if (result.status === 'staged') {
          setUpdateStatus('success');
          setUpdate({
            type: 'app',
            message: '再起動の準備が完了しました',
            detail: 'アプリを終了して再起動すると最新バージョンが適用されます。',
          });
        } else {
          setUpdateStatus('error');
          setUpdate({
            ...update,
            detail: 'アップデートに失敗しました。',
          });
        }
      } catch (err) {
        console.error(err);
        setUpdateStatus('error');
        setUpdate({
          ...update,
          detail: 'アップデートに失敗しました。',
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
