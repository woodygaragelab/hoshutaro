/**
 * Performance monitoring utilities for tracking app performance
 */

import React from 'react';

interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
  type: 'render' | 'api' | 'user-interaction' | 'bundle-load';
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Monitor navigation timing
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric({
              name: 'page-load',
              duration: navEntry.loadEventEnd - navEntry.navigationStart,
              timestamp: Date.now(),
              type: 'bundle-load',
            });
          }
        }
      });
      
      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation timing not supported');
      }
    }

    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.name.includes('.js') || resourceEntry.name.includes('.css')) {
              this.recordMetric({
                name: `resource-${resourceEntry.name.split('/').pop()}`,
                duration: resourceEntry.responseEnd - resourceEntry.startTime,
                timestamp: Date.now(),
                type: 'bundle-load',
              });
            }
          }
        }
      });
      
      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource timing not supported');
      }
    }
  }

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log performance issues
    if (metric.duration > 1000) {
      console.warn(`Performance warning: ${metric.name} took ${metric.duration}ms`);
    }
  }

  measureAsync<T>(name: string, type: PerformanceMetrics['type'], fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return fn().then(
      (result) => {
        this.recordMetric({
          name,
          duration: performance.now() - start,
          timestamp: Date.now(),
          type,
        });
        return result;
      },
      (error) => {
        this.recordMetric({
          name: `${name}-error`,
          duration: performance.now() - start,
          timestamp: Date.now(),
          type,
        });
        throw error;
      }
    );
  }

  measureSync<T>(name: string, type: PerformanceMetrics['type'], fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      this.recordMetric({
        name,
        duration: performance.now() - start,
        timestamp: Date.now(),
        type,
      });
      return result;
    } catch (error) {
      this.recordMetric({
        name: `${name}-error`,
        duration: performance.now() - start,
        timestamp: Date.now(),
        type,
      });
      throw error;
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageMetric(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / relevantMetrics.length;
  }

  clearMetrics() {
    this.metrics = [];
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    measureAsync: performanceMonitor.measureAsync.bind(performanceMonitor),
    measureSync: performanceMonitor.measureSync.bind(performanceMonitor),
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getAverageMetric: performanceMonitor.getAverageMetric.bind(performanceMonitor),
  };
};

// Performance measurement decorator for React components
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  const WrappedComponent = React.memo((props: P) => {
    const renderStart = performance.now();
    
    React.useEffect(() => {
      const renderEnd = performance.now();
      performanceMonitor.recordMetric({
        name: `${componentName}-render`,
        duration: renderEnd - renderStart,
        timestamp: Date.now(),
        type: 'render',
      });
    });

    return React.createElement(Component, props);
  });

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return WrappedComponent;
};