import { ErrorHandlingConfiguration, RecoveryStrategy, ErrorContext, OfflineData } from './types';

/**
 * エラーリカバリマネージャー
 * 自動リカバリ、オフライン編集、エラー報告機能を提供
 */
export class ErrorRecoveryManager {
  private config: ErrorHandlingConfiguration;
  private offlineData: Map<string, OfflineData> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private isOnline = navigator.onLine;

  constructor(config: ErrorHandlingConfiguration) {
    this.config = config;
    this.initializeRecoveryStrategies();
    this.setupOfflineHandling();
  }

  /**
   * リカバリ戦略を初期化
   */
  private initializeRecoveryStrategies(): void {
    // ネットワークエラーのリカバリ戦略
    this.recoveryStrategies.set('NetworkError', {
      name: 'Network Recovery',
      canRecover: (error: Error) => error.message.includes('Network') || error.message.includes('fetch'),
      recover: async (error: Error, context: ErrorContext) => {
        // ネットワーク接続を確認
        if (!navigator.onLine) {
          throw new Error('オフライン状態です');
        }

        // 指数バックオフでリトライ
        const delay = Math.min(1000 * Math.pow(2, context.retryCount), 10000);
        await this.delay(delay);

        // 接続テスト
        try {
          await fetch('/api/health', { method: 'HEAD' });
          return true;
        } catch {
          throw new Error('ネットワーク接続に失敗しました');
        }
      },
    });

    // メモリエラーのリカバリ戦略
    this.recoveryStrategies.set('MemoryError', {
      name: 'Memory Recovery',
      canRecover: (error: Error) => error.message.includes('Memory') || error.message.includes('out of memory'),
      recover: async (error: Error, context: ErrorContext) => {
        // ガベージコレクションを強制実行
        if ('gc' in window && typeof (window as any).gc === 'function') {
          (window as any).gc();
        }

        // キャッシュをクリア
        this.clearCaches();

        // メモリ使用量をチェック
        if ('memory' in performance) {
          const memInfo = (performance as any).memory;
          if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.9) {
            throw new Error('メモリ不足が解消されませんでした');
          }
        }

        return true;
      },
    });

    // レンダリングエラーのリカバリ戦略
    this.recoveryStrategies.set('RenderError', {
      name: 'Render Recovery',
      canRecover: (error: Error) => error.message.includes('render') || error.stack?.includes('render'),
      recover: async (error: Error, context: ErrorContext) => {
        // DOM状態をリセット
        this.resetDOMState();

        // 少し待ってから再レンダリング
        await this.delay(100);

        return true;
      },
    });

    // タッチ操作エラーのリカバリ戦略
    this.recoveryStrategies.set('TouchError', {
      name: 'Touch Recovery',
      canRecover: (error: Error) => error.message.includes('Touch') || error.message.includes('touch'),
      recover: async (error: Error, context: ErrorContext) => {
        // タッチイベントリスナーをリセット
        this.resetTouchListeners();

        // デバイスの向きが変わった場合の対応
        if (context.deviceType === 'mobile' || context.deviceType === 'tablet') {
          await this.delay(300); // 向き変更の完了を待つ
        }

        return true;
      },
    });

    // データ同期エラーのリカバリ戦略
    this.recoveryStrategies.set('SyncError', {
      name: 'Sync Recovery',
      canRecover: (error: Error) => error.message.includes('sync') || error.message.includes('conflict'),
      recover: async (error: Error, context: ErrorContext) => {
        // オフラインデータがある場合は保存
        if (this.hasOfflineData()) {
          await this.saveOfflineData();
        }

        // 最新データを再取得
        await this.refreshData();

        return true;
      },
    });
  }

  /**
   * オフライン処理を設定
   */
  private setupOfflineHandling(): void {
    if (!this.config.enableOfflineMode) return;

    // オンライン/オフライン状態の監視
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnlineRecovery();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOfflineMode();
    });

    // ページ離脱時にオフラインデータを保存
    window.addEventListener('beforeunload', () => {
      this.saveOfflineDataToStorage();
    });

    // 起動時にオフラインデータを復元
    this.restoreOfflineDataFromStorage();
  }

  /**
   * エラーリカバリを試行
   */
  async attemptRecovery(error: Error, context: ErrorContext): Promise<boolean> {
    if (!this.config.enableAutoRecovery) {
      throw error;
    }

    // リトライ回数チェック
    if (context.retryCount >= this.config.retryAttempts) {
      throw new Error(`最大リトライ回数(${this.config.retryAttempts})に達しました`);
    }

    // 適用可能なリカバリ戦略を検索
    for (const [key, strategy] of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        try {
          console.log(`Attempting recovery with strategy: ${strategy.name}`);
          const success = await strategy.recover(error, context);
          
          if (success) {
            console.log(`Recovery successful with strategy: ${strategy.name}`);
            return true;
          }
        } catch (recoveryError) {
          console.warn(`Recovery failed with strategy: ${strategy.name}`, recoveryError);
          continue;
        }
      }
    }

    // フォールバック動作
    if (this.config.fallbackBehavior === 'graceful') {
      return this.gracefulFallback(error, context);
    } else {
      throw error;
    }
  }

  /**
   * オフラインデータを保存
   */
  saveOfflineData(key: string, data: any): void {
    if (!this.config.enableOfflineMode) return;

    const offlineData: OfflineData = {
      key,
      data,
      timestamp: Date.now(),
      deviceType: 'desktop', // 実際の実装では現在のデバイスタイプを取得
      syncStatus: 'pending',
    };

    this.offlineData.set(key, offlineData);
  }

  /**
   * オフラインデータを取得
   */
  getOfflineData(key: string): OfflineData | undefined {
    return this.offlineData.get(key);
  }

  /**
   * オフラインデータの存在確認
   */
  hasOfflineData(): boolean {
    return this.offlineData.size > 0;
  }

  /**
   * オンライン復帰時の処理
   */
  private async handleOnlineRecovery(): Promise<void> {
    console.log('Online recovery started');

    // オフラインデータを同期
    for (const [key, data] of this.offlineData) {
      if (data.syncStatus === 'pending') {
        try {
          await this.syncOfflineData(key, data);
          data.syncStatus = 'synced';
        } catch (error) {
          console.error(`Failed to sync offline data for key: ${key}`, error);
          data.syncStatus = 'error';
        }
      }
    }

    // 同期済みデータを削除
    for (const [key, data] of this.offlineData) {
      if (data.syncStatus === 'synced') {
        this.offlineData.delete(key);
      }
    }
  }

  /**
   * オフラインモード開始時の処理
   */
  private handleOfflineMode(): void {
    console.log('Offline mode activated');
    
    // オフライン通知を表示
    this.showOfflineNotification();
  }

  /**
   * オフラインデータを同期
   */
  private async syncOfflineData(key: string, data: OfflineData): Promise<void> {
    // 実際の実装では、サーバーAPIを呼び出してデータを同期
    console.log(`Syncing offline data for key: ${key}`, data);
    
    // シミュレーション
    await this.delay(1000);
    
    // 競合チェック
    const hasConflict = Math.random() < 0.1; // 10%の確率で競合
    if (hasConflict) {
      throw new Error('Data conflict detected');
    }
  }

  /**
   * オフラインデータをローカルストレージに保存
   */
  private saveOfflineDataToStorage(): void {
    try {
      const serializedData = JSON.stringify(Array.from(this.offlineData.entries()));
      localStorage.setItem('offline_data', serializedData);
    } catch (error) {
      console.error('Failed to save offline data to storage:', error);
    }
  }

  /**
   * ローカルストレージからオフラインデータを復元
   */
  private restoreOfflineDataFromStorage(): void {
    try {
      const serializedData = localStorage.getItem('offline_data');
      if (serializedData) {
        const entries = JSON.parse(serializedData);
        this.offlineData = new Map(entries);
        
        // 古いデータを削除（24時間以上前）
        const maxAge = 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        for (const [key, data] of this.offlineData) {
          if (now - data.timestamp > maxAge) {
            this.offlineData.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore offline data from storage:', error);
    }
  }

  /**
   * グレースフルフォールバック
   */
  private async gracefulFallback(error: Error, context: ErrorContext): Promise<boolean> {
    console.log('Attempting graceful fallback');

    // 基本的なクリーンアップ
    this.clearCaches();
    this.resetDOMState();

    // 少し待つ
    await this.delay(this.config.retryDelay);

    // 最小限の機能で復旧を試行
    return true;
  }

  /**
   * キャッシュをクリア
   */
  private clearCaches(): void {
    // ブラウザキャッシュのクリア（可能な範囲で）
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  }

  /**
   * DOM状態をリセット
   */
  private resetDOMState(): void {
    // フォーカスをクリア
    if (document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }

    // 選択をクリア
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  }

  /**
   * タッチイベントリスナーをリセット
   */
  private resetTouchListeners(): void {
    // 既存のタッチイベントリスナーを削除
    // 実際の実装では、アプリケーション固有のリスナー管理が必要
    console.log('Resetting touch listeners');
  }

  /**
   * データを再取得
   */
  private async refreshData(): Promise<void> {
    // 実際の実装では、アプリケーションのデータ更新ロジックを呼び出し
    console.log('Refreshing data');
    await this.delay(500);
  }

  /**
   * オフライン通知を表示
   */
  private showOfflineNotification(): void {
    // 実際の実装では、UI通知システムを使用
    console.log('Showing offline notification');
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * リカバリマネージャーを破棄
   */
  destroy(): void {
    // イベントリスナーを削除
    window.removeEventListener('online', this.handleOnlineRecovery);
    window.removeEventListener('offline', this.handleOfflineMode);
    
    // オフラインデータを保存
    this.saveOfflineDataToStorage();
    
    // リソースをクリア
    this.offlineData.clear();
    this.recoveryStrategies.clear();
  }
}