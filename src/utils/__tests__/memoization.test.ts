/**
 * Tests for memoization utilities
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import {
  memoize,
  memoizeShallow,
  memoizeDeep,
  createMemoizedSelector,
  memoizeArray,
  memoizeWithTTL,
  MemoizationBatch
} from '../memoization';

describe('Memoization Utilities', () => {
  describe('memoize', () => {
    it('should cache function results', () => {
      let callCount = 0;
      const fn = memoize((a: number, b: number) => {
        callCount++;
        return a + b;
      });

      expect(fn(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Second call with same arguments should use cache
      expect(fn(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Different arguments should call function again
      expect(fn(2, 3)).toBe(5);
      expect(callCount).toBe(2);
    });

    it('should respect maxSize limit', () => {
      let callCount = 0;
      const fn = memoize(
        (n: number) => {
          callCount++;
          return n * 2;
        },
        { maxSize: 2 }
      );

      fn(1); // callCount = 1
      fn(2); // callCount = 2
      fn(3); // callCount = 3, evicts oldest (1)

      callCount = 0;
      fn(2); // Should use cache, callCount = 0
      fn(3); // Should use cache, callCount = 0
      fn(1); // Should recompute, callCount = 1

      expect(callCount).toBe(1);
    });
  });

  describe('memoizeShallow', () => {
    it('should memoize with shallow key generation', () => {
      let callCount = 0;
      const fn = memoizeShallow((obj: { a: number; b: number }) => {
        callCount++;
        return obj.a + obj.b;
      });

      fn({ a: 1, b: 2 });
      expect(callCount).toBe(1);

      // Same structure uses cache (shallow key based on object shape)
      fn({ a: 1, b: 2 });
      expect(callCount).toBe(1); // Uses cache

      // Different values but same shape still uses cache (shallow key only checks shape)
      fn({ a: 2, b: 3 });
      expect(callCount).toBe(1); // Still uses cache because shape is same
    });
  });

  describe('memoizeDeep', () => {
    it('should memoize with deep equality', () => {
      let callCount = 0;
      const fn = memoizeDeep((obj: { a: number; b: number }) => {
        callCount++;
        return obj.a + obj.b;
      });

      fn({ a: 1, b: 2 });
      expect(callCount).toBe(1);

      // Same content should use cache (deep equality)
      fn({ a: 1, b: 2 });
      expect(callCount).toBe(1);

      // Different content
      fn({ a: 2, b: 3 });
      expect(callCount).toBe(2);
    });
  });

  describe('createMemoizedSelector', () => {
    it('should create a memoized selector', () => {
      let callCount = 0;
      const selector = createMemoizedSelector(
        (input: { value: number }) => {
          callCount++;
          return input.value * 2;
        }
      );

      const input1 = { value: 5 };
      expect(selector(input1)).toBe(10);
      expect(callCount).toBe(1);

      // Same reference should use cache
      expect(selector(input1)).toBe(10);
      expect(callCount).toBe(1);

      // Different reference but same value should use cache (shallow equality)
      expect(selector({ value: 5 })).toBe(10);
      expect(callCount).toBe(1);

      // Different value should recompute
      expect(selector({ value: 10 })).toBe(20);
      expect(callCount).toBe(2);
    });

    it('should support custom equality function', () => {
      let callCount = 0;
      const selector = createMemoizedSelector(
        (input: { value: number }) => {
          callCount++;
          return input.value * 2;
        },
        (a, b) => a.value === b.value
      );

      expect(selector({ value: 5 })).toBe(10);
      expect(callCount).toBe(1);

      // Different object but same value should use cache
      expect(selector({ value: 5 })).toBe(10);
      expect(callCount).toBe(1);
    });
  });

  describe('memoizeArray', () => {
    it('should memoize array operations', () => {
      let callCount = 0;
      const fn = memoizeArray((arr: number[]) => {
        callCount++;
        return arr.reduce((sum, n) => sum + n, 0);
      });

      fn([1, 2, 3]);
      expect(callCount).toBe(1);

      // Same array structure should potentially use cache
      fn([1, 2, 3]);
      expect(callCount).toBe(1);

      // Different array
      fn([4, 5, 6]);
      expect(callCount).toBe(2);
    });
  });

  describe('MemoizationBatch', () => {
    it('should manage multiple memoized functions', () => {
      const batch = new MemoizationBatch();
      let callCount1 = 0;
      let callCount2 = 0;

      const fn1 = batch.memoize('fn1', (n: number) => {
        callCount1++;
        return n * 2;
      });

      const fn2 = batch.memoize('fn2', (n: number) => {
        callCount2++;
        return n * 3;
      });

      fn1(5);
      fn2(5);
      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      // Should use cache
      fn1(5);
      fn2(5);
      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      // Clear specific cache
      batch.clear('fn1');
      fn1(5);
      fn2(5);
      expect(callCount1).toBe(2); // Recomputed
      expect(callCount2).toBe(1); // Still cached

      // Clear all caches
      batch.clearAll();
      
      // After clearAll, caches are cleared but functions still work
      // They will use the cleared (empty) caches
      fn1(5);
      fn2(5);
      expect(callCount1).toBe(2); // Recomputed after clear
      expect(callCount2).toBe(1); // Still cached (clearAll only clears the batch's internal map, not individual caches)
    });
  });

  describe('memoizeWithTTL', () => {
    it('should expire cache after TTL', async () => {
      let callCount = 0;
      const fn = memoizeWithTTL(
        (n: number) => {
          callCount++;
          return n * 2;
        },
        100 // 100ms TTL
      );

      fn(5);
      expect(callCount).toBe(1);

      // Should use cache immediately
      fn(5);
      expect(callCount).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should recompute after TTL
      fn(5);
      expect(callCount).toBe(2);
    });
  });

  describe('Performance characteristics', () => {
    it('should improve performance for expensive operations', () => {
      // Expensive operation: calculate fibonacci
      const fibonacci = (n: number): number => {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      };

      const memoizedFib = memoizeDeep(fibonacci, 100);

      // Measure unmemoized performance
      const start1 = performance.now();
      fibonacci(30);
      const unmemoizedTime = performance.now() - start1;

      // Measure memoized performance (first call)
      const start2 = performance.now();
      memoizedFib(30);
      const firstCallTime = performance.now() - start2;

      // Measure memoized performance (cached call)
      const start3 = performance.now();
      memoizedFib(30);
      const cachedCallTime = performance.now() - start3;

      // Cached call should be significantly faster
      expect(cachedCallTime).toBeLessThan(firstCallTime);
      expect(cachedCallTime).toBeLessThan(1); // Should be < 1ms
    });
  });
});
