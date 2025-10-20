import { OfflineData, ErrorContext } from './types';
import { HierarchicalData } from '../../types';

/**
 * オフラインモードマネージャー
 * オフライン編集機能とデータ同期を管理
 */
export class OfflineModeManager {
  private isOnline = navigator.onLine;
  private offlineQueue: Map<string, OfflineData> = new Map();
  private syncQueue: Map<string, any> = new Map();
  private storageKey = 'grid_offline_data';
  private maxStorageSize = 10 * 1024 * 1024; // 10MB
  private syncInterval = 30000; // 30秒
  private syncTimer: number | null = null;

  constructor() {
    this.setupEventListeners();
    this.restoreOfflineData();
    this.startSyncTimer();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    window.addEventListener('beforeunload', this.saveOfflineData.bind(this));
  }

  /**
   * オンライン状態になった時の処理
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    console.log('Online mode activated');
    
    // オフラインキューを同期
    await this.syncOfflineQueue();
    
    // 同期タイマーを再開
    this.startSyncTimer();
  }

  /**
   * オフライン状態になった時の処理
   */
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Offline mode activated');
    
    // 同期タイマーを停止
    this.stopSyncTimer();
    
    // オフラインデータを保存
    this.saveOfflineData();
  }

  /**
   * データをオフラインキューに追加
   */
  addToOfflineQueue(
    operation: 'create' | 'update' | 'delete',
    itemId: string,
    data: any,
    deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): void {
    const offlineData: OfflineData = {
      key: `${operation}_${itemId}_${Date.now()}`,
      data: {
        operation,
        itemId,
        data,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      deviceType,
      syncStatus: 'pending',
    };

    this.offlineQueue.set(offlineData.key, offlineData);
    
    // ストレージに保存
    this.saveOfflineData();
    
    console.log(`Added to offline queue: ${offlineData.key}`);
  }

  /**
   * セル編集をオフラインキューに追加
   */
  addCellEdit(
    rowId: string,
    columnId: string,
    value: any,
    deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): void {
    this.addToOfflineQueue('update', `${rowId}_${columnId}`, {
      type: 'cell_edit',
      rowId,
      columnId,
      value,
    }, deviceType);
  }

  /**
   * 機器仕様編集をオフラインキューに追加
   */
  addSpecificationEdit(
    rowId: string,
    specIndex: number,
    key: string,
    value: string,
    deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): void {
    this.addToOfflineQueue('update', `${rowId}_spec_${specIndex}`, {
      type: 'specification_edit',
      rowId,
      specIndex,
      key,
      value,
    }, deviceType);
  }

  /**
   * アイテム作成をオフラインキューに追加
   */
  addItemCreation(
    item: HierarchicalData,
    deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): void {
    this.addToOfflineQueue('create', item.id, {
      type: 'item_creation',
      item,
    }, deviceType);
  }

  /**
   * アイテム削除をオフラインキューに追加
   */
  addItemDeletion(
    itemId: string,
    deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): void {
    this.addToOfflineQueue('delete', itemId, {
      type: 'item_deletion',
      itemId,
    }, deviceType);
  }

  /**
   * オフラインキューを同期
   */
  private async syncOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.size === 0) {
      return;
    }

    console.log(`Syncing ${this.offlineQueue.size} offline operations`);

    const syncPromises: Promise<void>[] = [];

    for (const [key, offlineData] of this.offlineQueue) {
      if (offlineData.syncStatus === 'pending') {
        syncPromises.push(this.syncSingleOperation(key, offlineData));
      }
    }

    try {
      await Promise.allSettled(syncPromises);
      
      // 同期済みのデータを削除
      for (const [key, offlineData] of this.offlineQueue) {
        if (offlineData.syncStatus === 'synced') {
          this.offlineQueue.delete(key);
        }
      }
      
      // ストレージを更新
      this.saveOfflineData();
      
      console.log('Offline queue sync completed');
    } catch (error) {
      console.error('Failed to sync offline queue:', error);
    }
  }

  /**
   * 単一操作を同期
   */
  private async syncSingleOperation(key: string, offlineData: OfflineData): Promise<void> {
    try {
      const { operation, itemId, data } = offlineData.data;
      
      switch (data.type) {
        case 'cell_edit':
          await this.syncCellEdit(data);
          break;
        case 'specification_edit':
          await this.syncSpecificationEdit(data);
          break;
        case 'item_creation':
          await this.syncItemCreation(data);
          break;
        case 'item_deletion':
          await this.syncItemDeletion(data);
          break;
        default:
          console.warn(`Unknown operation type: ${data.type}`);
      }
      
      // 同期成功
      offlineData.syncStatus = 'synced';
      console.log(`Synced operation: ${key}`);
      
    } catch (error) {
      // 同期失敗
      offlineData.syncStatus = 'error';
      console.error(`Failed to sync operation: ${key}`, error);
      
      // 競合エラーの場合は特別な処理
      if (error instanceof Error && error.message.includes('conflict')) {
        await this.handleSyncConflict(key, offlineData, error);
      }
    }
  }

  /**
   * セル編集を同期
   */
  private async syncCellEdit(data: any): Promise<void> {
    // 実際の実装では、サーバーAPIを呼び出し
    console.log('Syncing cell edit:', data);
    
    // シミュレーション
    await this.delay(100);
    
    // 競合チェック
    if (Math.random() < 0.05) { // 5%の確率で競合
      throw new Error('Sync conflict: Cell was modified by another user');
    }
  }

  /**
   * 機器仕様編集を同期
   */
  private async syncSpecificationEdit(data: any): Promise<void> {
    console.log('Syncing specification edit:', data);
    await this.delay(100);
    
    if (Math.random() < 0.03) { // 3%の確率で競合
      throw new Error('Sync conflict: Specification was modified by another user');
    }
  }

  /**
   * アイテム作成を同期
   */
  private async syncItemCreation(data: any): Promise<void> {
    console.log('Syncing item creation:', data);
    await this.delay(200);
    
    if (Math.random() < 0.02) { // 2%の確率で競合
      throw new Error('Sync conflict: Item with same ID already exists');
    }
  }

  /**
   * アイテム削除を同期
   */
  private async syncItemDeletion(data: any): Promise<void> {
    console.log('Syncing item deletion:', data);
    await this.delay(150);
    
    if (Math.random() < 0.01) { // 1%の確率で競合
      throw new Error('Sync conflict: Item was already deleted');
    }
  }

  /**
   * 同期競合を処理
   */
  private async handleSyncConflict(
    key: string,
    offlineData: OfflineData,
    error: Error
  ): Promise<void> {
    console.log(`Handling sync conflict for: ${key}`);
    
    // 競合解決UI を表示する必要がある
    // ここでは簡単な自動解決を実装
    
    const { operation, itemId, data } = offlineData.data;
    
    // 最新データを取得
    const latestData = await this.fetchLatestData(itemId);
    
    // 自動マージを試行
    const mergedData = this.attemptAutoMerge(data, latestData);
    
    if (mergedData) {
      // マージ成功 - 再同期
      offlineData.data.data = mergedData;
      await this.syncSingleOperation(key, offlineData);
    } else {
      // マージ失敗 - 手動解決が必要
      console.warn(`Manual conflict resolution required for: ${key}`);
      // 実際の実装では、ユーザーに競合解決UIを表示
    }
  }

  /**
   * 最新データを取得
   */
  private async fetchLatestData(itemId: string): Promise<any> {
    // 実際の実装では、サーバーから最新データを取得
    console.log(`Fetching latest data for: ${itemId}`);
    await this.delay(100);
    
    return {
      id: itemId,
      lastModified: Date.now(),
      // その他のデータ
    };
  }

  /**
   * 自動マージを試行
   */
  private attemptAutoMerge(localData: any, serverData: any): any | null {
    // 簡単なマージロジック
    // 実際の実装では、より複雑なマージアルゴリズムが必要
    
    if (localData.type === 'cell_edit') {
      // セル編集の場合、タイムスタンプで判定
      if (localData.timestamp > serverData.lastModified) {
        return localData; // ローカルの変更を優先
      } else {
        return null; // 手動解決が必要
      }
    }
    
    return null;
  }

  /**
   * オフラインデータをストレージに保存
   */
  private saveOfflineData(): void {
    try {
      const data = Array.from(this.offlineQueue.entries());
      const serialized = JSON.stringify(data);
      
      // サイズチェック
      if (serialized.length > this.maxStorageSize) {
        console.warn('Offline data exceeds maximum storage size');
        this.cleanupOldData();
        return;
      }
      
      localStorage.setItem(this.storageKey, serialized);
      console.log(`Saved ${data.length} offline operations to storage`);
      
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }

  /**
   * ストレージからオフラインデータを復元
   */
  private restoreOfflineData(): void {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (serialized) {
        const data = JSON.parse(serialized);
        this.offlineQueue = new Map(data);
        console.log(`Restored ${this.offlineQueue.size} offline operations from storage`);
      }
    } catch (error) {
      console.error('Failed to restore offline data:', error);
    }
  }

  /**
   * 古いデータをクリーンアップ
   */
  private cleanupOldData(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24時間
    const now = Date.now();
    
    for (const [key, data] of this.offlineQueue) {
      if (now - data.timestamp > maxAge) {
        this.offlineQueue.delete(key);
      }
    }
    
    console.log(`Cleaned up old offline data. Remaining: ${this.offlineQueue.size}`);
  }

  /**
   * 同期タイマーを開始
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = window.setInterval(() => {
      if (this.isOnline) {
        this.syncOfflineQueue();
      }
    }, this.syncInterval);
  }

  /**
   * 同期タイマーを停止
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * オフライン状態を取得
   */
  getOfflineStatus(): {
    isOnline: boolean;
    queueSize: number;
    pendingOperations: number;
    errorOperations: number;
  } {
    const pending = Array.from(this.offlineQueue.values()).filter(
      data => data.syncStatus === 'pending'
    ).length;
    
    const errors = Array.from(this.offlineQueue.values()).filter(
      data => data.syncStatus === 'error'
    ).length;
    
    return {
      isOnline: this.isOnline,
      queueSize: this.offlineQueue.size,
      pendingOperations: pending,
      errorOperations: errors,
    };
  }

  /**
   * 手動同期を実行
   */
  async forcSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    
    await this.syncOfflineQueue();
  }

  /**
   * オフラインキューをクリア
   */
  clearOfflineQueue(): void {
    this.offlineQueue.clear();
    localStorage.removeItem(this.storageKey);
    console.log('Offline queue cleared');
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stopSyncTimer();
    this.saveOfflineData();
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('beforeunload', this.saveOfflineData);
  }
}