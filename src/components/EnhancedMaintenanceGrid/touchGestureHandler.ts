import { useCallback, useRef, useEffect } from 'react';

export interface TouchGestureState {
  isScrolling: boolean;
  isPinching: boolean;
  lastTouchTime: number;
  touchStartX: number;
  touchStartY: number;
  scrollVelocityX: number;
  scrollVelocityY: number;
  scale: number;
  initialDistance: number;
}

export interface TouchGestureHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onWheel: (event: React.WheelEvent) => void;
}

export interface TouchGestureOptions {
  enablePinchZoom?: boolean;
  enableMomentumScrolling?: boolean;
  scrollSensitivity?: number;
  pinchSensitivity?: number;
  onScroll?: (deltaX: number, deltaY: number, velocity: { x: number; y: number }) => void;
  onPinch?: (scale: number, centerX: number, centerY: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
}

/**
 * タブレット向けタッチジェスチャーハンドラー
 * スムーズなスクロール、ピンチズーム、ダブルタップを提供
 */
export const useTouchGestureHandler = (options: TouchGestureOptions = {}): TouchGestureHandlers => {
  const {
    enablePinchZoom = false,
    enableMomentumScrolling = true,
    scrollSensitivity = 1.0,
    pinchSensitivity = 1.0,
    onScroll,
    onPinch,
    onDoubleTap,
  } = options;

  const gestureState = useRef<TouchGestureState>({
    isScrolling: false,
    isPinching: false,
    lastTouchTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    scrollVelocityX: 0,
    scrollVelocityY: 0,
    scale: 1,
    initialDistance: 0,
  });

  const momentumTimer = useRef<number | null>(null);
  const lastTouchPositions = useRef<{ x: number; y: number; time: number }[]>([]);

  // 2点間の距離を計算
  const getDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 2点の中心点を計算
  const getCenter = useCallback((touch1: React.Touch, touch2: React.Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  // 慣性スクロールを実装
  const applyMomentumScrolling = useCallback(() => {
    if (!enableMomentumScrolling || !onScroll) return;

    const { scrollVelocityX, scrollVelocityY } = gestureState.current;
    const friction = 0.95;
    const threshold = 0.1;

    if (Math.abs(scrollVelocityX) > threshold || Math.abs(scrollVelocityY) > threshold) {
      onScroll(scrollVelocityX, scrollVelocityY, { x: scrollVelocityX, y: scrollVelocityY });
      
      gestureState.current.scrollVelocityX *= friction;
      gestureState.current.scrollVelocityY *= friction;

      momentumTimer.current = requestAnimationFrame(applyMomentumScrolling);
    } else {
      gestureState.current.scrollVelocityX = 0;
      gestureState.current.scrollVelocityY = 0;
    }
  }, [enableMomentumScrolling, onScroll]);

  // タッチ開始
  const onTouchStart = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;
    const now = Date.now();

    if (momentumTimer.current) {
      cancelAnimationFrame(momentumTimer.current);
      momentumTimer.current = null;
    }

    if (touches.length === 1) {
      // シングルタッチ - スクロール開始
      const touch = touches[0];
      gestureState.current = {
        ...gestureState.current,
        isScrolling: true,
        isPinching: false,
        touchStartX: touch.clientX,
        touchStartY: touch.clientY,
        lastTouchTime: now,
      };

      lastTouchPositions.current = [{ x: touch.clientX, y: touch.clientY, time: now }];

      // ダブルタップ検出
      if (now - gestureState.current.lastTouchTime < 300 && onDoubleTap) {
        onDoubleTap(touch.clientX, touch.clientY);
      }
      gestureState.current.lastTouchTime = now;

    } else if (touches.length === 2 && enablePinchZoom) {
      // ピンチズーム開始
      const distance = getDistance(touches[0], touches[1]);
      gestureState.current = {
        ...gestureState.current,
        isScrolling: false,
        isPinching: true,
        initialDistance: distance,
        scale: 1,
      };
      
      // ピンチズーム時はpreventDefaultを呼び出さない（パッシブリスナー対応）
      // 代わりにCSSでtouch-actionを使用することを推奨
    }
  }, [enablePinchZoom, onDoubleTap, getDistance]);

  // タッチ移動
  const onTouchMove = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;
    const now = Date.now();

    if (touches.length === 1 && gestureState.current.isScrolling) {
      // スクロール処理
      const touch = touches[0];
      const deltaX = (gestureState.current.touchStartX - touch.clientX) * scrollSensitivity;
      const deltaY = (gestureState.current.touchStartY - touch.clientY) * scrollSensitivity;

      // 速度計算（慣性スクロール用）
      const positions = lastTouchPositions.current;
      positions.push({ x: touch.clientX, y: touch.clientY, time: now });
      
      // 古い位置データを削除（100ms以上前）
      while (positions.length > 1 && now - positions[0].time > 100) {
        positions.shift();
      }

      if (positions.length >= 2) {
        const recent = positions[positions.length - 1];
        const previous = positions[positions.length - 2];
        const timeDiff = recent.time - previous.time;
        
        if (timeDiff > 0) {
          gestureState.current.scrollVelocityX = (previous.x - recent.x) / timeDiff * 16; // 60fps換算
          gestureState.current.scrollVelocityY = (previous.y - recent.y) / timeDiff * 16;
        }
      }

      if (onScroll && (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) {
        onScroll(deltaX, deltaY, { 
          x: gestureState.current.scrollVelocityX, 
          y: gestureState.current.scrollVelocityY 
        });
      }

      gestureState.current.touchStartX = touch.clientX;
      gestureState.current.touchStartY = touch.clientY;

    } else if (touches.length === 2 && gestureState.current.isPinching && enablePinchZoom) {
      // ピンチズーム処理
      const distance = getDistance(touches[0], touches[1]);
      const scale = distance / gestureState.current.initialDistance;
      const center = getCenter(touches[0], touches[1]);

      gestureState.current.scale = scale * pinchSensitivity;

      if (onPinch) {
        onPinch(gestureState.current.scale, center.x, center.y);
      }

      // preventDefaultは呼び出さない（パッシブリスナー対応）
      // CSSのtouch-actionプロパティで制御
    }
  }, [scrollSensitivity, pinchSensitivity, onScroll, onPinch, enablePinchZoom, getDistance, getCenter]);

  // タッチ終了
  const onTouchEnd = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;

    if (touches.length === 0) {
      // 全てのタッチが終了
      if (gestureState.current.isScrolling && enableMomentumScrolling) {
        // 慣性スクロール開始
        momentumTimer.current = requestAnimationFrame(applyMomentumScrolling);
      }

      gestureState.current.isScrolling = false;
      gestureState.current.isPinching = false;
      lastTouchPositions.current = [];
    } else if (touches.length === 1 && gestureState.current.isPinching) {
      // ピンチから単一タッチに戻る
      const touch = touches[0];
      gestureState.current = {
        ...gestureState.current,
        isScrolling: true,
        isPinching: false,
        touchStartX: touch.clientX,
        touchStartY: touch.clientY,
      };
    }
  }, [enableMomentumScrolling, applyMomentumScrolling]);

  // ホイールイベント（マウス/トラックパッド対応）
  const onWheel = useCallback((event: React.WheelEvent) => {
    if (onScroll) {
      const deltaX = event.deltaX * scrollSensitivity;
      const deltaY = event.deltaY * scrollSensitivity;
      
      onScroll(deltaX, deltaY, { x: deltaX, y: deltaY });
      
      // ホイールイベントではpreventDefaultを呼び出さない
      // 必要に応じてCSSのoverscroll-behaviorで制御
    }
  }, [onScroll, scrollSensitivity]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (momentumTimer.current) {
        cancelAnimationFrame(momentumTimer.current);
      }
    };
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };
};

/**
 * スムーズスクロール用のユーティリティ関数
 */
export const smoothScrollTo = (
  element: HTMLElement,
  targetX: number,
  targetY: number,
  duration: number = 300
): Promise<void> => {
  return new Promise((resolve) => {
    const startX = element.scrollLeft;
    const startY = element.scrollTop;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    const startTime = performance.now();

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // イージング関数（ease-out）
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      element.scrollLeft = startX + deltaX * easeOut;
      element.scrollTop = startY + deltaY * easeOut;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animateScroll);
  });
};

/**
 * 横スクロールの正常動作を確保するためのユーティリティ
 */
export const ensureHorizontalScroll = (element: HTMLElement): void => {
  // 横スクロールが可能かチェック
  const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
  
  if (hasHorizontalScroll) {
    // 横スクロール用のスタイルを適用
    element.style.overflowX = 'auto';
    element.style.overflowY = 'auto';
    (element.style as any).WebkitOverflowScrolling = 'touch';
    
    // iOS Safari用の修正
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'scroll-position';
  }
};