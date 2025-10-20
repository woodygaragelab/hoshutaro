import { 
  DataSyncConfiguration, 
  SyncOperation, 
  SyncConflict, 
  SyncStatus,
  DataIntegrityCheck,
  ConflictResolution 
} from './types';
import { HierarchicalData } from '../../types';

/**
 * データ同期マネージャー
 * リアルタイムデータ同期、競合解決、データ整合性チェックを提供
 */
export class DataSyncManager {
  private config: DataSyncConfiguration;
  private syncQueue: Map<string, SyncOperation> = new Map();
  private conflictQueue: Map<string, SyncConflict> = new Map();
  private syncStatus: SyncStatus = 'idle';
  private lastSyncTimestamp = 0;
  private syncTimer: number | null = null;
  private websocket: WebSocket | null = null;
  private retryCount = 0;

  // Event listeners
  private onSyncStatusChange?: (status: SyncStatus) => void;
  private onConflictDetected?: (conflict: SyncConflict) => void;
  private onDataUpdated?: (data: HierarchicalData[]) => void;
  private onIntegrityViolation?: (violation: DataIntegrityCheck) => void;

  constructor(config: DataSyncConfiguration) {
    this.config = config;
    this.initializeSync();
  }

  /**
   * 同期システムを初期化
   */
  private initializeSync(): void {
    if (this.config.enableRealTimeSync) {
      this.setupWebSocket();
    }

    if (this.config.syncInterval > 0) {
      this.startSyncTimer();
    }
  }

  /**
   * WebSocket接続を設定
   */
  private setupWebSocket(): void {
    try {
      this.websocket = new WebSocket(this.config.websocketUrl || 'ws://localhost:8080/sync');
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected for real-time sync');
        this.setSyncStatus('connected');
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.setSyncStatus('disconnected');
        this.scheduleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.setSyncStatus('error');
      };
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  }

  /**
   * WebSocketメッセージを処理
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'data_update':
          this.handleRemoteDataUpdate(message.data);
          break;
        case 'conflict_detected':
          this.handleRemoteConflict(message.conflict);
          break;
        case 'sync_status':
          this.handleSyncStatusUpdate(message.status);
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * リモートデータ更新を処理
   */
  private handleRemoteDataUpdate(data: any): void {
    // データ整合性チェック
    const integrityCheck = this.performIntegrityCheck(data);
    if (!integrityCheck.isValid) {
      this.onIntegrityViolation?.(integrityCheck);
      return;
    }

    // 競合チェック
    const conflict = this.detectConflict(data);
    if (conflict) {
      this.conflictQueue.set(conflict.id, conflict);
      this.onConflictDetected?.(conflict);
      return;
    }

    // データ更新
    this.onDataUpdated?.(data);
  }

  /**
   * リモート競合を処理
   */
  private handleRemoteConflict(conflict: SyncConflict): void {
    this.conflictQueue.set(conflict.id, conflict);
    this.onConflictDetected?.(conflict);
  }

  /**
   * 同期ステータス更新を処理
   */
  private handleSyncStatusUpdate(status: any): void {
    this.setSyncStatus(status.state);
    this.lastSyncTimestamp = status.timestamp;
  }

  /**
   * データ変更を同期キューに追加
   */
  addToSyncQueue(
    operation: 'create' | 'update' | 'delete',
    itemId: string,
    data: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    const syncOperation: SyncOperation = {
      id: `${operation}_${itemId}_${Date.now()}`,
      type: operation,
      itemId,
      data,
      timestamp: Date.now(),
      priority,
      retryCount: 0,
      status: 'pending',
    };

    this.syncQueue.set(syncOperation.id, syncOperation);

    // 高優先度の場合は即座に同期
    if (priority === 'high' || this.config.enableOptimisticUpdates) {
      this.processSyncQueue();
    }
  }

  /**
   * セル編集を同期
   */
  syncCellEdit(
    rowId: string,
    columnId: string,
    value: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    this.addToSyncQueue('update', `${rowId}_${columnId}`, {
      type: 'cell_edit',
      rowId,
      columnId,
      value,
      timestamp: Date.now(),
    }, priority);
  }

  /**
   * 機器仕様編集を同期
   */
  syncSpecificationEdit(
    rowId: string,
    specIndex: number,
    key: string,
    value: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    this.addToSyncQueue('update', `${rowId}_spec_${specIndex}`, {
      type: 'specification_edit',
      rowId,
      specIndex,
      key,
      value,
      timestamp: Date.now(),
    }, priority);
  }

  /**
   * 同期キューを処理
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncStatus === 'syncing' || this.syncQueue.size === 0) {
      return;
    }

    this.setSyncStatus('syncing');

    try {
      // 優先度順にソート
      const operations = Array.from(this.syncQueue.values()).sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // バッチ処理
      const batchSize = this.config.batchSize || 10;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        await this.processBatch(batch);
      }

      this.setSyncStatus('synced');
      this.lastSyncTimestamp = Date.now();
      this.retryCount = 0;

    } catch (error) {
      console.error('Sync queue processing failed:', error);
      this.setSyncStatus('error');
      this.scheduleRetry();
    }
  }

  /**
   * バッチを処理
   */
  private async processBatch(operations: SyncOperation[]): Promise<void> {
    const promises = operations.map(operation => this.processSingleOperation(operation));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const operation = operations[index];
      
      if (result.status === 'fulfilled') {
        operation.status = 'completed';
        this.syncQueue.delete(operation.id);
      } else {
        operation.status = 'failed';
        operation.retryCount++;
        
        if (operation.retryCount >= this.config.maxRetries) {
          console.error(`Operation failed after ${this.config.maxRetries} retries:`, operation);
          this.syncQueue.delete(operation.id);
        }
      }
    });
  }

  /**
   * 単一操作を処理
   */
  private async processSingleOperation(operation: SyncOperation): Promise<void> {
    // データ整合性チェック
    const integrityCheck = this.performIntegrityCheck(operation.data);
    if (!integrityCheck.isValid) {
      throw new Error(`Integrity check failed: ${integrityCheck.violations.join(', ')}`);
    }

    // 競合チェック
    const conflict = this.detectConflict(operation.data);
    if (conflict) {
      this.conflictQueue.set(conflict.id, conflict);
      throw new Error(`Conflict detected: ${conflict.description}`);
    }

    // サーバーに送信
    await this.sendToServer(operation);
  }

  /**
   * サーバーにデータを送信
   */
  private async sendToServer(operation: SyncOperation): Promise<void> {
    const endpoint = this.getEndpointForOperation(operation);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`,
      },
      body: JSON.stringify({
        operation: operation.type,
        itemId: operation.itemId,
        data: operation.data,
        timestamp: operation.timestamp,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Server error: ${error.message}`);
    }

    const result = await response.json();
    
    // 競合が検出された場合
    if (result.conflict) {
      const conflict: SyncConflict = {
        id: `conflict_${operation.id}`,
        operationId: operation.id,
        type: 'data_conflict',
        localData: operation.data,
        remoteData: result.remoteData,
        timestamp: Date.now(),
        description: result.conflict.description,
        severity: result.conflict.severity || 'medium',
      };
      
      this.conflictQueue.set(conflict.id, conflict);
      throw new Error('Conflict detected during sync');
    }
  }

  /**
   * 操作に対応するエンドポイントを取得
   */
  private getEndpointForOperation(operation: SyncOperation): string {
    const baseUrl = this.config.apiBaseUrl || '/api';
    
    switch (operation.data.type) {
      case 'cell_edit':
        return `${baseUrl}/cells/update`;
      case 'specification_edit':
        return `${baseUrl}/specifications/update`;
      case 'item_creation':
        return `${baseUrl}/items/create`;
      case 'item_deletion':
        return `${baseUrl}/items/delete`;
      default:
        return `${baseUrl}/sync`;
    }
  }

  /**
   * データ整合性チェックを実行
   */
  private performIntegrityCheck(data: any): DataIntegrityCheck {
    const violations: string[] = [];

    // 必須フィールドチェック
    if (data.type === 'cell_edit') {
      if (!data.rowId) violations.push('rowId is required');
      if (!data.columnId) violations.push('columnId is required');
      if (data.value === undefined) violations.push('value is required');
    }

    if (data.type === 'specification_edit') {
      if (!data.rowId) violations.push('rowId is required');
      if (data.specIndex === undefined) violations.push('specIndex is required');
      if (!data.key) violations.push('key is required');
      if (!data.value) violations.push('value is required');
    }

    // データ型チェック
    if (data.timestamp && typeof data.timestamp !== 'number') {
      violations.push('timestamp must be a number');
    }

    // 値の範囲チェック
    if (data.type === 'cell_edit' && data.columnId.startsWith('time_')) {
      // 星取表の値チェック
      if (typeof data.value === 'object') {
        if (typeof data.value.planned !== 'boolean') {
          violations.push('planned must be boolean');
        }
        if (typeof data.value.actual !== 'boolean') {
          violations.push('actual must be boolean');
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      timestamp: Date.now(),
    };
  }

  /**
   * 競合を検出
   */
  private detectConflict(data: any): SyncConflict | null {
    // 簡単な競合検出ロジック
    // 実際の実装では、より複雑な競合検出が必要

    // タイムスタンプベースの競合検出
    if (data.lastModified && data.lastModified < this.lastSyncTimestamp) {
      return {
        id: `conflict_${Date.now()}`,
        operationId: data.id || 'unknown',
        type: 'timestamp_conflict',
        localData: data,
        remoteData: null, // リモートデータは別途取得
        timestamp: Date.now(),
        description: 'Data was modified by another user',
        severity: 'medium',
      };
    }

    return null;
  }

  /**
   * 競合を解決
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    const conflict = this.conflictQueue.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    try {
      let resolvedData: any;

      switch (resolution.strategy) {
        case 'use_local':
          resolvedData = conflict.localData;
          break;
        case 'use_remote':
          resolvedData = conflict.remoteData;
          break;
        case 'merge':
          resolvedData = this.mergeData(conflict.localData, conflict.remoteData);
          break;
        case 'manual':
          resolvedData = resolution.manualData;
          break;
        default:
          throw new Error(`Unknown resolution strategy: ${resolution.strategy}`);
      }

      // 解決されたデータを同期
      await this.sendResolvedData(conflict, resolvedData);
      
      // 競合キューから削除
      this.conflictQueue.delete(conflictId);
      
      console.log(`Conflict resolved: ${conflictId}`);
      
    } catch (error) {
      console.error(`Failed to resolve conflict: ${conflictId}`, error);
      throw error;
    }
  }

  /**
   * データをマージ
   */
  private mergeData(localData: any, remoteData: any): any {
    // 簡単なマージロジック
    // 実際の実装では、より複雑なマージアルゴリズムが必要
    
    if (localData.type === 'cell_edit') {
      // セル編集の場合、タイムスタンプで判定
      return localData.timestamp > remoteData.timestamp ? localData : remoteData;
    }
    
    if (localData.type === 'specification_edit') {
      // 機器仕様の場合、フィールドごとにマージ
      return {
        ...remoteData,
        ...localData,
        timestamp: Math.max(localData.timestamp, remoteData.timestamp),
      };
    }
    
    return localData;
  }

  /**
   * 解決されたデータを送信
   */
  private async sendResolvedData(conflict: SyncConflict, resolvedData: any): Promise<void> {
    const endpoint = `${this.config.apiBaseUrl || '/api'}/conflicts/resolve`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`,
      },
      body: JSON.stringify({
        conflictId: conflict.id,
        resolvedData,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to send resolved data: ${error.message}`);
    }
  }

  /**
   * 同期ステータスを設定
   */
  private setSyncStatus(status: SyncStatus): void {
    if (this.syncStatus !== status) {
      this.syncStatus = status;
      this.onSyncStatusChange?.(status);
    }
  }

  /**
   * 同期タイマーを開始
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = window.setInterval(() => {
      this.processSyncQueue();
    }, this.config.syncInterval);
  }

  /**
   * 再接続をスケジュール
   */
  private scheduleReconnect(): void {
    setTimeout(() => {
      if (this.config.enableRealTimeSync) {
        this.setupWebSocket();
      }
    }, 5000); // 5秒後に再接続
  }

  /**
   * リトライをスケジュール
   */
  private scheduleRetry(): void {
    if (this.retryCount < this.config.maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      this.retryCount++;
      
      setTimeout(() => {
        this.processSyncQueue();
      }, delay);
    }
  }

  /**
   * イベントリスナーを設定
   */
  setEventListeners(listeners: {
    onSyncStatusChange?: (status: SyncStatus) => void;
    onConflictDetected?: (conflict: SyncConflict) => void;
    onDataUpdated?: (data: HierarchicalData[]) => void;
    onIntegrityViolation?: (violation: DataIntegrityCheck) => void;
  }): void {
    this.onSyncStatusChange = listeners.onSyncStatusChange;
    this.onConflictDetected = listeners.onConflictDetected;
    this.onDataUpdated = listeners.onDataUpdated;
    this.onIntegrityViolation = listeners.onIntegrityViolation;
  }

  /**
   * 同期ステータスを取得
   */
  getSyncStatus(): {
    status: SyncStatus;
    queueSize: number;
    conflictCount: number;
    lastSyncTimestamp: number;
  } {
    return {
      status: this.syncStatus,
      queueSize: this.syncQueue.size,
      conflictCount: this.conflictQueue.size,
      lastSyncTimestamp: this.lastSyncTimestamp,
    };
  }

  /**
   * 競合リストを取得
   */
  getConflicts(): SyncConflict[] {
    return Array.from(this.conflictQueue.values());
  }

  /**
   * 手動同期を実行
   */
  async forceSync(): Promise<void> {
    await this.processSyncQueue();
  }

  /**
   * 同期キューをクリア
   */
  clearSyncQueue(): void {
    this.syncQueue.clear();
  }

  /**
   * 競合キューをクリア
   */
  clearConflictQueue(): void {
    this.conflictQueue.clear();
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.syncQueue.clear();
    this.conflictQueue.clear();
  }
}