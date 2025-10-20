/**
 * 星取表グリッドのパフォーマンス最適化ユーティリティ
 */
import React from 'react';

export interface PerformanceConfig {
  enableVirtualScrolling: boolean;
  enableMemoization: boolean;
  enableDebouncing: boolean;
  debounceDelay: number;
  throttleDelay: number;
  maxRenderItems: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableVirtualScrolling: true,
  enableMemoization: true,
  enableDebouncing: true,
  debounceDelay: 100,
  throttleDelay: 16,
  maxRenderItems: 1000,
};

/**
 * スケール変更時のパフォーマンス最適化クラス
 */
export class ScaleChangeOptimizer {
  private isOptimizing: boolean = false;
  private optimizationTimeout: NodeJS.Timeout | null = null;
  private pendingOperations: (() => void)[] = [];

  /**
   * スケール変更の開始を通知
   */
  startScaleChange(): void {
    this.isOptimizing = true;
    this.clearPendingOperations();
  }

  /**
   * スケール変更の完了を通知
   */
  endScaleChange(): void {
    if (this.optimizationTimeout) {
      clearTimeout(this.optimizationTimeout);
    }

    this.optimizationTimeout = setTimeout(() => {
      this.isOptimizing = false;
      this.executePendingOperations();
    }, 150); // スケール変更後の安定化を待つ
  }

  /**
   * 最適化中かどうかを確認
   */
  getOptimizationStatus(): boolean {
    return this.isOptimizing;
  }

  /**
   * 操作を遅延実行キューに追加
   */
  deferOperation(operation: () => void): void {
    if (this.isOptimizing) {
      this.pendingOperations.push(operation);
    } else {
      operation();
    }
  }

  /**
   * 保留中の操作をすべて実行
   */
  private executePendingOperations(): void {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];
    
    // バッチ実行でパフォーマンスを向上
    requestAnimationFrame(() => {
      operations.forEach(operation => {
        try {
          operation();
        } catch (error) {
          console.warn('Deferred operation failed:', error);
        }
      });
    });
  }

  /**
   * 保留中の操作をクリア
   */
  private clearPendingOperations(): void {
    this.pendingOperations = [];
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.optimizationTimeout) {
      clearTimeout(this.optimizationTimeout);
    }
    this.clearPendingOperations();
  }
}

/**
 * レンダリング最適化ユーティリティ
 */
export class RenderOptimizer {
  private renderQueue: Map<string, () => void> = new Map();
  private renderTimeout: NodeJS.Timeout | null = null;
  private isRendering: boolean = false;

  /**
   * レンダリング操作をキューに追加
   */
  queueRender(key: string, renderFunction: () => void): void {
    this.renderQueue.set(key, renderFunction);
    this.scheduleRender();
  }

  /**
   * レンダリングをスケジュール
   */
  private scheduleRender(): void {
    if (this.renderTimeout || this.isRendering) {
      return;
    }

    this.renderTimeout = setTimeout(() => {
      this.executeRenders();
    }, 16); // 次のフレームで実行
  }

  /**
   * キューに入っているレンダリング操作を実行
   */
  private executeRenders(): void {
    if (this.isRendering) return;

    this.isRendering = true;
    this.renderTimeout = null;

    requestAnimationFrame(() => {
      const renders = Array.from(this.renderQueue.values());
      this.renderQueue.clear();

      renders.forEach(render => {
        try {
          render();
        } catch (error) {
          console.warn('Render operation failed:', error);
        }
      });

      this.isRendering = false;
    });
  }

  /**
   * 特定のキーのレンダリングをキャンセル
   */
  cancelRender(key: string): void {
    this.renderQueue.delete(key);
  }

  /**
   * すべてのレンダリングをキャンセル
   */
  cancelAllRenders(): void {
    this.renderQueue.clear();
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.cancelAllRenders();
  }
}

/**
 * メモリ使用量最適化ユーティリティ
 */
export class MemoryOptimizer {
  private cache: Map<string, { data: any; timestamp: number; size: number }> = new Map();
  private maxCacheSize: number = 50 * 1024 * 1024; // 50MB
  private currentCacheSize: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxCacheSize: number = 50 * 1024 * 1024) {
    this.maxCacheSize = maxCacheSize;
    this.startCleanupInterval();
  }

  /**
   * データをキャッシュに保存
   */
  cacheData(key: string, data: any): void {
    const size = this.estimateSize(data);
    
    // キャッシュサイズが上限を超える場合は古いエントリを削除
    while (this.currentCacheSize + size > this.maxCacheSize && this.cache.size > 0) {
      this.removeOldestEntry();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
    });
    this.currentCacheSize += size;
  }

  /**
   * キャッシュからデータを取得
   */
  getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry) {
      // アクセス時刻を更新
      entry.timestamp = Date.now();
      return entry.data;
    }
    return null;
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }

  /**
   * 最も古いエントリを削除
   */
  private removeOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentCacheSize -= entry.size;
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * データサイズを推定
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 文字列の概算バイト数
    } catch {
      return 1024; // デフォルト値
    }
  }

  /**
   * 定期的なクリーンアップを開始
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10分

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > maxAge) {
          this.currentCacheSize -= entry.size;
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // 1分ごとにクリーンアップ
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearCache();
  }
}

/**
 * パフォーマンス最適化マネージャー
 */
export class PerformanceManager {
  private scaleOptimizer: ScaleChangeOptimizer;
  private renderOptimizer: RenderOptimizer;
  private memoryOptimizer: MemoryOptimizer;
  private config: PerformanceConfig;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.scaleOptimizer = new ScaleChangeOptimizer();
    this.renderOptimizer = new RenderOptimizer();
    this.memoryOptimizer = new MemoryOptimizer();
  }

  /**
   * スケール変更の最適化を開始
   */
  startScaleChange(): void {
    this.scaleOptimizer.startScaleChange();
    this.renderOptimizer.cancelAllRenders();
  }

  /**
   * スケール変更の最適化を終了
   */
  endScaleChange(): void {
    this.scaleOptimizer.endScaleChange();
  }

  /**
   * レンダリングを最適化
   */
  optimizeRender(key: string, renderFunction: () => void): void {
    if (this.config.enableDebouncing) {
      this.renderOptimizer.queueRender(key, renderFunction);
    } else {
      renderFunction();
    }
  }

  /**
   * データをキャッシュ
   */
  cacheData(key: string, data: any): void {
    if (this.config.enableMemoization) {
      this.memoryOptimizer.cacheData(key, data);
    }
  }

  /**
   * キャッシュからデータを取得
   */
  getCachedData(key: string): any | null {
    if (this.config.enableMemoization) {
      return this.memoryOptimizer.getFromCache(key);
    }
    return null;
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * パフォーマンス統計を取得
   */
  getPerformanceStats(): {
    cacheSize: number;
    isOptimizing: boolean;
    config: PerformanceConfig;
  } {
    return {
      cacheSize: this.memoryOptimizer['currentCacheSize'],
      isOptimizing: this.scaleOptimizer.getOptimizationStatus(),
      config: this.config,
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.scaleOptimizer.cleanup();
    this.renderOptimizer.cleanup();
    this.memoryOptimizer.cleanup();
  }
}

/**
 * パフォーマンス最適化フック
 */
export const usePerformanceOptimization = (config?: Partial<PerformanceConfig>) => {
  const [manager] = React.useState(() => new PerformanceManager(config));

  React.useEffect(() => {
    return () => manager.cleanup();
  }, [manager]);

  return {
    startScaleChange: () => manager.startScaleChange(),
    endScaleChange: () => manager.endScaleChange(),
    optimizeRender: (key: string, renderFunction: () => void) => 
      manager.optimizeRender(key, renderFunction),
    cacheData: (key: string, data: any) => manager.cacheData(key, data),
    getCachedData: (key: string) => manager.getCachedData(key),
    updateConfig: (newConfig: Partial<PerformanceConfig>) => 
      manager.updateConfig(newConfig),
    getStats: () => manager.getPerformanceStats(),
  };
};