import { 
  RenderOptimizationConfig, 
  MemoryManagementConfig, 
  ScrollPerformanceConfig,
  PerformanceMetrics 
} from './types';

/**
 * レンダリング最適化ユーティリティ
 */
export class RenderOptimizer {
  private config: RenderOptimizationConfig;
  private renderQueue: (() => void)[] = [];
  private isProcessing = false;
  private frameId: number | null = null;

  constructor(config: RenderOptimizationConfig) {
    this.config = config;
  }

  /**
   * バッチレンダリングでタスクをキューに追加
   */
  queueRender(task: () => void): void {
    if (!this.config.enableBatching) {
      task();
      return;
    }

    this.renderQueue.push(task);
    
    if (!this.isProcessing) {
      this.processBatch();
    }
  }

  /**
   * バッチ処理の実行
   */
  private processBatch(): void {
    if (this.renderQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    
    this.frameId = requestAnimationFrame(() => {
      const batchSize = Math.min(this.config.batchSize, this.renderQueue.length);
      const batch = this.renderQueue.splice(0, batchSize);
      
      // バッチ内のタスクを実行
      batch.forEach(task => {
        try {
          task();
        } catch (error) {
          console.error('Render task error:', error);
        }
      });
      
      // 次のバッチを処理
      if (this.renderQueue.length > 0) {
        this.processBatch();
      } else {
        this.isProcessing = false;
      }
    });
  }

  /**
   * レンダリングキューをクリア
   */
  clearQueue(): void {
    this.renderQueue = [];
    this.isProcessing = false;
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<RenderOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * メモリ管理ユーティリティ
 */
export class MemoryManager {
  private config: MemoryManagementConfig;
  private cache = new Map<string, any>();
  private accessTimes = new Map<string, number>();
  private gcInterval: number | null = null;

  constructor(config: MemoryManagementConfig) {
    this.config = config;
    
    if (config.enableGarbageCollection) {
      this.startGarbageCollection();
    }
  }

  /**
   * キャッシュにアイテムを追加
   */
  set(key: string, value: any): void {
    // キャッシュサイズ制限チェック
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }

  /**
   * キャッシュからアイテムを取得
   */
  get(key: string): any {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.accessTimes.set(key, Date.now());
    }
    
    return value;
  }

  /**
   * キャッシュからアイテムを削除
   */
  delete(key: string): boolean {
    this.accessTimes.delete(key);
    return this.cache.delete(key);
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
  }

  /**
   * LRU（Least Recently Used）アイテムを削除
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * ガベージコレクションを開始
   */
  private startGarbageCollection(): void {
    this.gcInterval = window.setInterval(() => {
      this.runGarbageCollection();
    }, this.config.gcInterval);
  }

  /**
   * ガベージコレクションを実行
   */
  private runGarbageCollection(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分

    for (const [key, time] of this.accessTimes) {
      if (now - time > maxAge) {
        this.delete(key);
      }
    }
  }

  /**
   * メモリ使用量を取得
   */
  getMemoryUsage(): { cacheSize: number; itemCount: number } {
    return {
      cacheSize: this.cache.size,
      itemCount: this.accessTimes.size,
    };
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    
    this.clear();
  }
}

/**
 * スクロールパフォーマンス最適化ユーティリティ
 */
export class ScrollOptimizer {
  private config: ScrollPerformanceConfig;
  private lastScrollTime = 0;
  private scrollVelocity = 0;
  private isScrolling = false;
  private scrollEndTimer: number | null = null;
  private rafId: number | null = null;

  constructor(config: ScrollPerformanceConfig) {
    this.config = config;
  }

  /**
   * スクロールイベントを最適化して処理
   */
  optimizeScrollEvent(
    callback: (scrollTop: number, velocity: number, isScrolling: boolean) => void
  ): (event: Event) => void {
    return (event: Event) => {
      const target = event.target as HTMLElement;
      const scrollTop = target.scrollTop;
      const now = Date.now();
      
      // スクロール速度を計算
      if (this.lastScrollTime > 0) {
        const deltaTime = now - this.lastScrollTime;
        const deltaScroll = Math.abs(scrollTop - (target as any).lastScrollTop || 0);
        this.scrollVelocity = deltaTime > 0 ? deltaScroll / deltaTime : 0;
      }
      
      this.lastScrollTime = now;
      (target as any).lastScrollTop = scrollTop;
      this.isScrolling = true;

      // スクロール終了タイマーをリセット
      if (this.scrollEndTimer) {
        clearTimeout(this.scrollEndTimer);
      }
      
      this.scrollEndTimer = window.setTimeout(() => {
        this.isScrolling = false;
        this.scrollVelocity = 0;
        callback(scrollTop, 0, false);
      }, 150);

      // RAF スロットリングまたはデバウンス
      if (this.config.enableRafThrottling) {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
        }
        
        this.rafId = requestAnimationFrame(() => {
          callback(scrollTop, this.scrollVelocity, this.isScrolling);
        });
      } else if (this.config.enableDebouncing) {
        // デバウンス処理は呼び出し元で実装
        callback(scrollTop, this.scrollVelocity, this.isScrolling);
      } else {
        callback(scrollTop, this.scrollVelocity, this.isScrolling);
      }
    };
  }

  /**
   * スムーズスクロールを実装
   */
  smoothScrollTo(
    element: HTMLElement,
    targetScrollTop: number,
    duration: number = 300
  ): Promise<void> {
    return new Promise((resolve) => {
      const startScrollTop = element.scrollTop;
      const distance = targetScrollTop - startScrollTop;
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // イージング関数（ease-out）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        element.scrollTop = startScrollTop + distance * easeOut;
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          resolve();
        }
      };
      
      requestAnimationFrame(animateScroll);
    });
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = null;
    }
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/**
 * パフォーマンス分析ユーティリティ
 */
export class PerformanceAnalyzer {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize = 100;

  /**
   * メトリクスを記録
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now(),
    } as PerformanceMetrics & { timestamp: number });

    // 履歴サイズを制限
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }
  }

  /**
   * パフォーマンス統計を取得
   */
  getStatistics(): {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageRenderTime: number;
    maxRenderTime: number;
    totalFrameDrops: number;
    performanceTrend: 'improving' | 'stable' | 'degrading';
  } {
    if (this.metrics.length === 0) {
      return {
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        totalFrameDrops: 0,
        performanceTrend: 'stable',
      };
    }

    const fps = this.metrics.map(m => m.currentFPS);
    const renderTimes = this.metrics.map(m => m.renderTime);
    const frameDrops = this.metrics.reduce((sum, m) => sum + m.frameDrops, 0);

    // トレンド分析（最近の10サンプル）
    const recentMetrics = this.metrics.slice(-10);
    const trend = this.analyzeTrend(recentMetrics.map(m => m.currentFPS));

    return {
      averageFPS: fps.reduce((sum, f) => sum + f, 0) / fps.length,
      minFPS: Math.min(...fps),
      maxFPS: Math.max(...fps),
      averageRenderTime: renderTimes.reduce((sum, t) => sum + t, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      totalFrameDrops: frameDrops,
      performanceTrend: trend,
    };
  }

  /**
   * パフォーマンストレンドを分析
   */
  private analyzeTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
    if (values.length < 5) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    const threshold = 2; // FPS

    if (difference > threshold) return 'improving';
    if (difference < -threshold) return 'degrading';
    return 'stable';
  }

  /**
   * パフォーマンスレポートを生成
   */
  generateReport(): string {
    const stats = this.getStatistics();
    
    return `
パフォーマンスレポート
=====================
平均FPS: ${stats.averageFPS.toFixed(1)}
最小FPS: ${stats.minFPS.toFixed(1)}
最大FPS: ${stats.maxFPS.toFixed(1)}
平均レンダリング時間: ${stats.averageRenderTime.toFixed(2)}ms
最大レンダリング時間: ${stats.maxRenderTime.toFixed(2)}ms
総フレームドロップ数: ${stats.totalFrameDrops}
パフォーマンストレンド: ${stats.performanceTrend}
サンプル数: ${this.metrics.length}
    `.trim();
  }

  /**
   * メトリクス履歴をクリア
   */
  clearHistory(): void {
    this.metrics = [];
  }
}

/**
 * 統合パフォーマンス最適化マネージャー
 */
export class PerformanceOptimizationManager {
  private renderOptimizer: RenderOptimizer;
  private memoryManager: MemoryManager;
  private scrollOptimizer: ScrollOptimizer;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor(
    renderConfig: RenderOptimizationConfig,
    memoryConfig: MemoryManagementConfig,
    scrollConfig: ScrollPerformanceConfig
  ) {
    this.renderOptimizer = new RenderOptimizer(renderConfig);
    this.memoryManager = new MemoryManager(memoryConfig);
    this.scrollOptimizer = new ScrollOptimizer(scrollConfig);
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  /**
   * 各最適化ツールにアクセス
   */
  get render() { return this.renderOptimizer; }
  get memory() { return this.memoryManager; }
  get scroll() { return this.scrollOptimizer; }
  get analyzer() { return this.performanceAnalyzer; }

  /**
   * 全体的なクリーンアップ
   */
  destroy(): void {
    this.renderOptimizer.clearQueue();
    this.memoryManager.destroy();
    this.scrollOptimizer.destroy();
    this.performanceAnalyzer.clearHistory();
  }
}