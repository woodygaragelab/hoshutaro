/**
 * Memory optimization utilities
 */

import React from 'react';

// Memory usage monitoring
export class MemoryMonitor {
  private memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
  private checkInterval: number | null = null;
  private callbacks: Array<(usage: number) => void> = [];

  start() {
    if (!('memory' in performance)) {
      console.warn('Memory API not supported');
      return;
    }

    this.checkInterval = window.setInterval(() => {
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize;
      
      if (usage > this.memoryThreshold) {
        console.warn(`High memory usage detected: ${Math.round(usage / 1024 / 1024)}MB`);
        this.callbacks.forEach(callback => callback(usage));
      }
    }, 5000);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  onHighMemoryUsage(callback: (usage: number) => void) {
    this.callbacks.push(callback);
  }

  getCurrentUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  forceGarbageCollection() {
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window) {
      (window as any).gc();
    }
  }
}

// Object pool for frequently created objects
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;

  constructor(createFn: () => T, resetFn?: (obj: T) => void, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T) {
    if (this.resetFn) {
      this.resetFn(obj);
    }
    this.pool.push(obj);
  }

  clear() {
    this.pool = [];
  }

  size(): number {
    return this.pool.length;
  }
}

// Weak reference cache for large objects
export class WeakCache<K extends object, V> {
  private cache = new WeakMap<K, V>();

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

// Memory-efficient data structures
export class CircularBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  pop(): T | undefined {
    if (this.size === 0) return undefined;
    
    this.tail = (this.tail - 1 + this.capacity) % this.capacity;
    const item = this.buffer[this.tail];
    this.size--;
    return item;
  }

  peek(): T | undefined {
    if (this.size === 0) return undefined;
    return this.buffer[(this.tail - 1 + this.capacity) % this.capacity];
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }

  getSize(): number {
    return this.size;
  }

  isFull(): boolean {
    return this.size === this.capacity;
  }
}

// Memory-efficient string interning
export class StringInterner {
  private strings = new Map<string, string>();

  intern(str: string): string {
    const existing = this.strings.get(str);
    if (existing) {
      return existing;
    }
    this.strings.set(str, str);
    return str;
  }

  clear(): void {
    this.strings.clear();
  }

  size(): number {
    return this.strings.size;
  }
}

// React hooks for memory optimization
export const useMemoryOptimization = () => {
  const memoryMonitor = React.useMemo(() => new MemoryMonitor(), []);
  
  React.useEffect(() => {
    memoryMonitor.start();
    return () => memoryMonitor.stop();
  }, [memoryMonitor]);

  return {
    getCurrentUsage: memoryMonitor.getCurrentUsage.bind(memoryMonitor),
    onHighMemoryUsage: memoryMonitor.onHighMemoryUsage.bind(memoryMonitor),
    forceGarbageCollection: memoryMonitor.forceGarbageCollection.bind(memoryMonitor),
  };
};

export const useObjectPool = <T>(
  createFn: () => T,
  resetFn?: (obj: T) => void,
  initialSize = 10
) => {
  const pool = React.useMemo(
    () => new ObjectPool(createFn, resetFn, initialSize),
    [createFn, resetFn, initialSize]
  );

  React.useEffect(() => {
    return () => pool.clear();
  }, [pool]);

  return pool;
};

export const useCircularBuffer = <T>(capacity: number) => {
  const buffer = React.useMemo(() => new CircularBuffer<T>(capacity), [capacity]);
  
  React.useEffect(() => {
    return () => buffer.clear();
  }, [buffer]);

  return buffer;
};

// Singleton instances
export const memoryMonitor = new MemoryMonitor();
export const stringInterner = new StringInterner();

// Auto-start memory monitoring in development
try {
  if (import.meta.env?.DEV) {
    memoryMonitor.start();
    memoryMonitor.onHighMemoryUsage((usage) => {
      console.warn(`High memory usage: ${Math.round(usage / 1024 / 1024)}MB`);
    });
  }
} catch {
  // Ignore if environment variables are not available
}