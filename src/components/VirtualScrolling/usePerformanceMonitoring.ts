import { useCallback, useEffect, useRef, useState } from 'react';
import { UsePerformanceMonitoringProps, PerformanceMetrics } from './types';

/**
 * パフォーマンス監視用のカスタムフック
 * FPS、メモリ使用量、レンダリング時間を監視
 */
export const usePerformanceMonitoring = ({
  enabled = true,
  targetFPS = 60,
  memoryThreshold = 50 * 1024 * 1024, // 50MB
}: UsePerformanceMonitoringProps) => {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    currentFPS: 60,
    averageFPS: 60,
    renderTime: 0,
    scrollTime: 0,
    memoryUsage: 0,
    frameDrops: 0,
    lastMeasurement: Date.now(),
  });

  const [isPerformanceWarning, setIsPerformanceWarning] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);

  // Performance measurement refs
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const measurementStartRef = useRef<{ [key: string]: number }>({});
  const renderTimesRef = useRef<number[]>([]);
  const scrollTimesRef = useRef<number[]>([]);

  // FPS calculation
  const calculateFPS = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    const deltaTime = now - lastFrameTimeRef.current;
    
    if (deltaTime >= 1000) { // Calculate FPS every second
      const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
      
      // Update FPS history
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 10) {
        fpsHistoryRef.current.shift();
      }
      
      // Calculate average FPS
      const averageFPS = fpsHistoryRef.current.reduce((sum, f) => sum + f, 0) / fpsHistoryRef.current.length;
      
      // Count frame drops
      const frameDrops = fps < targetFPS * 0.9 ? performanceMetrics.frameDrops + 1 : performanceMetrics.frameDrops;
      
      setPerformanceMetrics(prev => ({
        ...prev,
        currentFPS: fps,
        averageFPS,
        frameDrops,
        lastMeasurement: now,
      }));
      
      // Reset counters
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    } else {
      frameCountRef.current++;
    }
  }, [enabled, targetFPS, performanceMetrics.frameDrops]);

  // Memory usage monitoring
  const monitorMemoryUsage = useCallback(() => {
    if (!enabled || !('memory' in performance)) return;

    try {
      const memInfo = (performance as any).memory;
      const currentMemory = memInfo.usedJSHeapSize;
      
      setMemoryUsage(currentMemory);
      setPerformanceMetrics(prev => ({
        ...prev,
        memoryUsage: currentMemory,
      }));
    } catch (error) {
      console.warn('Memory monitoring not available:', error);
    }
  }, [enabled]);

  // Start measurement
  const startMeasurement = useCallback((key: string) => {
    if (!enabled) return;
    measurementStartRef.current[key] = performance.now();
  }, [enabled]);

  // End measurement
  const endMeasurement = useCallback((key: string) => {
    if (!enabled || !measurementStartRef.current[key]) return;
    
    const duration = performance.now() - measurementStartRef.current[key];
    delete measurementStartRef.current[key];
    
    if (key === 'render') {
      renderTimesRef.current.push(duration);
      if (renderTimesRef.current.length > 100) {
        renderTimesRef.current.shift();
      }
      
      const averageRenderTime = renderTimesRef.current.reduce((sum, t) => sum + t, 0) / renderTimesRef.current.length;
      
      setPerformanceMetrics(prev => ({
        ...prev,
        renderTime: averageRenderTime,
      }));
    } else if (key === 'scroll') {
      scrollTimesRef.current.push(duration);
      if (scrollTimesRef.current.length > 100) {
        scrollTimesRef.current.shift();
      }
      
      const averageScrollTime = scrollTimesRef.current.reduce((sum, t) => sum + t, 0) / scrollTimesRef.current.length;
      
      setPerformanceMetrics(prev => ({
        ...prev,
        scrollTime: averageScrollTime,
      }));
    }
  }, [enabled]);

  // Performance warning detection
  useEffect(() => {
    if (!enabled) return;

    const hasPerformanceIssue = (
      performanceMetrics.currentFPS < targetFPS * 0.8 ||
      performanceMetrics.renderTime > 16 || // 60fps threshold
      performanceMetrics.scrollTime > 8 ||
      memoryUsage > memoryThreshold
    );

    setIsPerformanceWarning(hasPerformanceIssue);
  }, [enabled, performanceMetrics, targetFPS, memoryUsage, memoryThreshold]);

  // Performance monitoring loop
  useEffect(() => {
    if (!enabled) return;

    let animationFrameId: number;
    let memoryMonitoringInterval: number;

    const performanceLoop = () => {
      calculateFPS();
      animationFrameId = requestAnimationFrame(performanceLoop);
    };

    // Start FPS monitoring
    animationFrameId = requestAnimationFrame(performanceLoop);

    // Start memory monitoring (less frequent)
    memoryMonitoringInterval = window.setInterval(monitorMemoryUsage, 2000);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (memoryMonitoringInterval) {
        clearInterval(memoryMonitoringInterval);
      }
    };
  }, [enabled, calculateFPS, monitorMemoryUsage]);

  // Performance optimization suggestions
  const getOptimizationSuggestions = useCallback(() => {
    const suggestions: string[] = [];

    if (performanceMetrics.currentFPS < targetFPS * 0.8) {
      suggestions.push('FPSが低下しています。仮想スクロールの有効化を検討してください。');
    }

    if (performanceMetrics.renderTime > 16) {
      suggestions.push('レンダリング時間が長すぎます。メモ化の有効化を検討してください。');
    }

    if (performanceMetrics.scrollTime > 8) {
      suggestions.push('スクロール処理が重いです。デバウンスの有効化を検討してください。');
    }

    if (memoryUsage > memoryThreshold) {
      suggestions.push('メモリ使用量が多すぎます。キャッシュのクリーンアップを検討してください。');
    }

    if (performanceMetrics.frameDrops > 10) {
      suggestions.push('フレームドロップが多発しています。バッチレンダリングの有効化を検討してください。');
    }

    return suggestions;
  }, [performanceMetrics, targetFPS, memoryUsage, memoryThreshold]);

  // Performance report
  const getPerformanceReport = useCallback(() => {
    return {
      metrics: performanceMetrics,
      memoryUsage,
      isWarning: isPerformanceWarning,
      suggestions: getOptimizationSuggestions(),
      timestamp: Date.now(),
    };
  }, [performanceMetrics, memoryUsage, isPerformanceWarning, getOptimizationSuggestions]);

  // Reset performance metrics
  const resetMetrics = useCallback(() => {
    setPerformanceMetrics({
      currentFPS: 60,
      averageFPS: 60,
      renderTime: 0,
      scrollTime: 0,
      memoryUsage: 0,
      frameDrops: 0,
      lastMeasurement: Date.now(),
    });
    
    frameCountRef.current = 0;
    lastFrameTimeRef.current = Date.now();
    fpsHistoryRef.current = [];
    renderTimesRef.current = [];
    scrollTimesRef.current = [];
    setIsPerformanceWarning(false);
  }, []);

  // Performance grade calculation
  const getPerformanceGrade = useCallback(() => {
    const fpsScore = Math.min(100, (performanceMetrics.currentFPS / targetFPS) * 100);
    const renderScore = Math.max(0, 100 - (performanceMetrics.renderTime / 16) * 100);
    const memoryScore = Math.max(0, 100 - (memoryUsage / memoryThreshold) * 100);
    
    const overallScore = (fpsScore + renderScore + memoryScore) / 3;
    
    if (overallScore >= 90) return 'A';
    if (overallScore >= 80) return 'B';
    if (overallScore >= 70) return 'C';
    if (overallScore >= 60) return 'D';
    return 'F';
  }, [performanceMetrics, targetFPS, memoryUsage, memoryThreshold]);

  return {
    // State
    performanceMetrics,
    isPerformanceWarning,
    memoryUsage,
    
    // Actions
    startMeasurement,
    endMeasurement,
    resetMetrics,
    
    // Utilities
    getOptimizationSuggestions,
    getPerformanceReport,
    getPerformanceGrade,
    
    // Computed values
    isHighPerformance: performanceMetrics.currentFPS >= targetFPS * 0.9 && memoryUsage < memoryThreshold * 0.8,
    isLowPerformance: performanceMetrics.currentFPS < targetFPS * 0.6 || memoryUsage > memoryThreshold,
    performanceGrade: getPerformanceGrade(),
  };
};