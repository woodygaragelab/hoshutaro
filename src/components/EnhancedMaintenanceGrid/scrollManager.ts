import React from 'react';

/**
 * スクロール位置管理ユーティリティ
 */
export interface ScrollPosition {
  top: number;
  left: number;
  timestamp: number;
}

export interface ScrollAreaState {
  fixed: ScrollPosition;
  specifications: ScrollPosition;
  maintenance: ScrollPosition;
}

export class ScrollManager {
  private scrollState: ScrollAreaState;
  private storageKey: string;

  constructor(storageKey: string = 'maintenance-grid-scroll') {
    this.storageKey = storageKey;
    this.scrollState = this.loadScrollState();
  }

  /**
   * スクロール状態をローカルストレージから読み込み
   */
  private loadScrollState(): ScrollAreaState {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 1時間以内のデータのみ復元
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (parsed.maintenance?.timestamp > oneHourAgo) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load scroll state:', error);
    }

    return {
      fixed: { top: 0, left: 0, timestamp: Date.now() },
      specifications: { top: 0, left: 0, timestamp: Date.now() },
      maintenance: { top: 0, left: 0, timestamp: Date.now() },
    };
  }

  /**
   * スクロール状態をローカルストレージに保存
   */
  private saveScrollState(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.scrollState));
    } catch (error) {
      console.warn('Failed to save scroll state:', error);
    }
  }

  /**
   * 指定エリアのスクロール位置を更新
   */
  updateScrollPosition(
    area: 'fixed' | 'specifications' | 'maintenance',
    position: { top: number; left: number }
  ): void {
    this.scrollState[area] = {
      ...position,
      timestamp: Date.now(),
    };
    
    // デバウンスして保存
    this.debouncedSave();
  }

  /**
   * 指定エリアのスクロール位置を取得
   */
  getScrollPosition(area: 'fixed' | 'specifications' | 'maintenance'): ScrollPosition {
    return this.scrollState[area];
  }

  /**
   * 全エリアのスクロール位置を取得
   */
  getAllScrollPositions(): ScrollAreaState {
    return { ...this.scrollState };
  }

  /**
   * スクロール位置をリセット
   */
  resetScrollPositions(): void {
    const now = Date.now();
    this.scrollState = {
      fixed: { top: 0, left: 0, timestamp: now },
      specifications: { top: 0, left: 0, timestamp: now },
      maintenance: { top: 0, left: 0, timestamp: now },
    };
    this.saveScrollState();
  }

  /**
   * タイムスケール変更時の特別なリセット処理
   */
  resetForTimeScaleChange(): void {
    // タイムスケール変更時は完全にリセット
    this.resetScrollPositions();
    
    // ローカルストレージからも削除して完全にクリア
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear scroll state:', error);
    }
  }

  /**
   * 垂直スクロール位置を同期
   */
  syncVerticalScroll(
    _sourceArea: 'fixed' | 'specifications' | 'maintenance',
    scrollTop: number
  ): void {
    const timestamp = Date.now();
    
    // 全エリアの垂直スクロール位置を更新
    Object.keys(this.scrollState).forEach(area => {
      const areaKey = area as keyof ScrollAreaState;
      this.scrollState[areaKey] = {
        ...this.scrollState[areaKey],
        top: scrollTop,
        timestamp,
      };
    });
    
    this.debouncedSave();
  }

  /**
   * 水平スクロール位置を更新（メンテナンスエリアのみ）
   */
  updateHorizontalScroll(scrollLeft: number): void {
    this.scrollState.maintenance = {
      ...this.scrollState.maintenance,
      left: scrollLeft,
      timestamp: Date.now(),
    };
    
    this.debouncedSave();
  }

  // デバウンス用のタイマー
  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * デバウンスされた保存処理
   */
  private debouncedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(() => {
      this.saveScrollState();
      this.saveTimer = null;
    }, 200); // 200ms後に保存（高速化）
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveScrollState(); // 最終保存
    }
  }
}

/**
 * スクロール同期ユーティリティ
 */
export class ScrollSynchronizer {
  private isScrolling: boolean = false;
  private scrollTimeout: NodeJS.Timeout | null = null;
  private lastScrollTime: number = 0;
  private readonly throttleDelay: number = 8; // ~120fps for smoother scrolling

  /**
   * スクロールイベントを同期
   */
  synchronizeScroll(
    sourceElement: HTMLElement,
    targetElements: HTMLElement[],
    direction: 'vertical' | 'horizontal' | 'both' = 'vertical'
  ): void {
    if (this.isScrolling) return;

    const now = Date.now();
    const timeSinceLastScroll = now - this.lastScrollTime;

    // スロットリング
    if (timeSinceLastScroll < this.throttleDelay) {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      
      this.scrollTimeout = setTimeout(() => {
        this.synchronizeScroll(sourceElement, targetElements, direction);
      }, this.throttleDelay - timeSinceLastScroll);
      return;
    }

    this.lastScrollTime = now;
    this.isScrolling = true;

    requestAnimationFrame(() => {
      const sourceScrollTop = sourceElement.scrollTop;
      const sourceScrollLeft = sourceElement.scrollLeft;

      targetElements.forEach(target => {
        if (target === sourceElement) return;

        if (direction === 'vertical' || direction === 'both') {
          if (Math.abs(target.scrollTop - sourceScrollTop) > 1) {
            target.scrollTop = sourceScrollTop;
          }
        }

        if (direction === 'horizontal' || direction === 'both') {
          if (Math.abs(target.scrollLeft - sourceScrollLeft) > 1) {
            target.scrollLeft = sourceScrollLeft;
          }
        }
      });

      // フラグをリセット
      setTimeout(() => {
        this.isScrolling = false;
      }, 10);
    });
  }

  /**
   * スムーズスクロール
   */
  smoothScrollTo(
    element: HTMLElement,
    position: { top?: number; left?: number },
    duration: number = 300
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTop = element.scrollTop;
      const startLeft = element.scrollLeft;
      const targetTop = position.top ?? startTop;
      const targetLeft = position.left ?? startLeft;
      
      const deltaTop = targetTop - startTop;
      const deltaLeft = targetLeft - startLeft;
      
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // イージング関数（ease-out）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        element.scrollTop = startTop + deltaTop * easeOut;
        element.scrollLeft = startLeft + deltaLeft * easeOut;
        
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
  cleanup(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }
}

/**
 * スクロール管理用のカスタムフック
 */
export const useScrollManager = (storageKey?: string) => {
  const scrollManager = new ScrollManager(storageKey);
  const scrollSynchronizer = new ScrollSynchronizer();

  // クリーンアップ
  React.useEffect(() => {
    return () => {
      scrollManager.cleanup();
      scrollSynchronizer.cleanup();
    };
  }, []);

  return {
    updateScrollPosition: scrollManager.updateScrollPosition.bind(scrollManager),
    getScrollPosition: scrollManager.getScrollPosition.bind(scrollManager),
    getAllScrollPositions: scrollManager.getAllScrollPositions.bind(scrollManager),
    resetScrollPositions: scrollManager.resetScrollPositions.bind(scrollManager),
    resetForTimeScaleChange: scrollManager.resetForTimeScaleChange.bind(scrollManager),
    syncVerticalScroll: scrollManager.syncVerticalScroll.bind(scrollManager),
    updateHorizontalScroll: scrollManager.updateHorizontalScroll.bind(scrollManager),
    synchronizeScroll: scrollSynchronizer.synchronizeScroll.bind(scrollSynchronizer),
    smoothScrollTo: scrollSynchronizer.smoothScrollTo.bind(scrollSynchronizer),
  };
};