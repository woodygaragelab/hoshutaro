/**
 * Memoization utilities for performance optimization
 * 
 * Provides memoization helpers for expensive operations like data transformation,
 * filtering, sorting, and aggregation.
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

/**
 * Simple memoization cache with LRU eviction
 */
class MemoCache<K, V> {
  private cache: Map<string, { value: V; timestamp: number }>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const keyStr = this.serializeKey(key);
    const entry = this.cache.get(keyStr);
    
    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now();
      return entry.value;
    }
    
    return undefined;
  }

  set(key: K, value: V): void {
    const keyStr = this.serializeKey(key);
    
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(keyStr, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  private serializeKey(key: K): string {
    if (typeof key === 'string' || typeof key === 'number') {
      return String(key);
    }
    return JSON.stringify(key);
  }
}

/**
 * Memoize a function with custom cache key generation
 */
export function memoize<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  options: {
    maxSize?: number;
    keyGenerator?: (...args: Args) => any;
  } = {}
): (...args: Args) => Result {
  const cache = new MemoCache<any, Result>(options.maxSize);
  const keyGenerator = options.keyGenerator || ((...args: Args) => args);

  return (...args: Args): Result => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Memoize with shallow equality check for object arguments
 */
export function memoizeShallow<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  maxSize: number = 100
): (...args: Args) => Result {
  return memoize(fn, {
    maxSize,
    keyGenerator: (...args: Args) => {
      // Create a stable key from arguments
      return args.map(arg => {
        if (arg === null || arg === undefined) {
          return String(arg);
        }
        if (typeof arg === 'object') {
          // For objects, create a key from their properties
          if (Array.isArray(arg)) {
            return `[${arg.length}]`;
          }
          return `{${Object.keys(arg).sort().join(',')}}`;
        }
        return String(arg);
      }).join('|');
    }
  });
}

/**
 * Memoize with deep equality check (slower but more accurate)
 */
export function memoizeDeep<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  maxSize: number = 50
): (...args: Args) => Result {
  return memoize(fn, {
    maxSize,
    keyGenerator: (...args: Args) => JSON.stringify(args)
  });
}

/**
 * Create a memoized selector for data transformation
 */
export function createMemoizedSelector<Input, Output>(
  selector: (input: Input) => Output,
  equalityFn?: (a: Input, b: Input) => boolean
): (input: Input) => Output {
  let lastInput: Input | undefined;
  let lastOutput: Output | undefined;
  
  const defaultEqualityFn = (a: Input, b: Input): boolean => {
    // Shallow equality check
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (a === null || b === null) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => (a as any)[key] === (b as any)[key]);
  };
  
  const equality = equalityFn || defaultEqualityFn;
  
  return (input: Input): Output => {
    if (lastInput !== undefined && equality(input, lastInput)) {
      return lastOutput!;
    }
    
    lastInput = input;
    lastOutput = selector(input);
    return lastOutput;
  };
}

/**
 * Memoize array operations with stable references
 */
export function memoizeArray<T, R>(
  fn: (arr: T[]) => R,
  maxSize: number = 50
): (arr: T[]) => R {
  return memoize(fn, {
    maxSize,
    keyGenerator: (arr: T[]) => {
      // Use array length and first/last items as key
      if (arr.length === 0) return '[]';
      if (arr.length === 1) return `[1:${JSON.stringify(arr[0])}]`;
      return `[${arr.length}:${JSON.stringify(arr[0])}:${JSON.stringify(arr[arr.length - 1])}]`;
    }
  });
}

/**
 * Batch memoization - memoize multiple related functions together
 */
export class MemoizationBatch {
  private caches: Map<string, MemoCache<any, any>>;

  constructor() {
    this.caches = new Map();
  }

  memoize<Args extends any[], Result>(
    name: string,
    fn: (...args: Args) => Result,
    maxSize: number = 100
  ): (...args: Args) => Result {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MemoCache(maxSize));
    }
    
    const cache = this.caches.get(name)!;
    
    return (...args: Args): Result => {
      const cached = cache.get(args);
      
      if (cached !== undefined) {
        return cached;
      }
      
      const result = fn(...args);
      cache.set(args, result);
      return result;
    };
  }

  clear(name?: string): void {
    if (name) {
      this.caches.get(name)?.clear();
    } else {
      this.caches.forEach(cache => cache.clear());
    }
  }

  clearAll(): void {
    this.caches.clear();
  }
}

/**
 * Memoize with time-based expiration
 */
export function memoizeWithTTL<Args extends any[], Result>(
  fn: (...args: Args) => Result,
  ttlMs: number = 5000,
  maxSize: number = 100
): (...args: Args) => Result {
  const cache = new Map<string, { value: Result; expiry: number }>();
  
  return (...args: Args): Result => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);
    
    if (cached && cached.expiry > now) {
      return cached.value;
    }
    
    // Evict expired entries
    for (const [k, v] of cache.entries()) {
      if (v.expiry <= now) {
        cache.delete(k);
      }
    }
    
    // Evict oldest if cache is full
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        cache.delete(firstKey);
      }
    }
    
    const result = fn(...args);
    cache.set(key, { value: result, expiry: now + ttlMs });
    return result;
  };
}

export default {
  memoize,
  memoizeShallow,
  memoizeDeep,
  createMemoizedSelector,
  memoizeArray,
  memoizeWithTTL,
  MemoizationBatch
};
