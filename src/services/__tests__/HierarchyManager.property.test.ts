/**
 * HierarchyManager Property-Based Tests
 * 
 * **Feature: maintenance-task-management**
 * 
 * These tests use fast-check to verify universal properties that should hold
 * across all valid inputs for the HierarchyManager.
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.8
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { HierarchyManager } from '../HierarchyManager';
import { AssetManager } from '../AssetManager';
import { HierarchyPath, HierarchyLevel } from '../../types/maintenanceTask';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid hierarchy level keys (non-empty strings)
 * Filters out JavaScript built-in property names to avoid conflicts
 */
const builtInPropertyNames = new Set([
  'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
  'propertyIsEnumerable', 'toLocaleString', '__proto__', '__defineGetter__',
  '__defineSetter__', '__lookupGetter__', '__lookupSetter__'
]);

const hierarchyLevelKeyGenerator = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && !builtInPropertyNames.has(s.trim()))
  .map(s => s.trim());

/**
 * Generator for valid hierarchy values (non-empty strings)
 */
const hierarchyValueGenerator = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim());

/**
 * Generator for valid order numbers (1-100)
 */
const orderGenerator = fc.integer({ min: 1, max: 100 });

/**
 * Generator for asset IDs
 */
const assetIdGenerator = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => s.trim().length > 0 && /^[A-Z0-9-]+$/i.test(s));

/**
 * Generator for asset names
 */
const assetNameGenerator = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for a hierarchy level with values
 */
const hierarchyLevelWithValuesGenerator = fc.record({
  key: hierarchyLevelKeyGenerator,
  order: orderGenerator,
  values: fc.array(hierarchyValueGenerator, { minLength: 1, maxLength: 5 })
    .map(arr => Array.from(new Set(arr))) // Ensure unique values
});

/**
 * Generator for multiple hierarchy levels (1-10 levels)
 */
const hierarchyLevelsGenerator = fc.array(
  hierarchyLevelWithValuesGenerator,
  { minLength: 1, maxLength: 10 }
).chain(levels => {
  // Ensure unique keys
  const uniqueKeys = new Set<string>();
  const uniqueLevels = levels.filter(level => {
    if (uniqueKeys.has(level.key)) {
      return false;
    }
    uniqueKeys.add(level.key);
    return true;
  });
  
  // Ensure we have at least 1 level
  if (uniqueLevels.length === 0) {
    return fc.constant([{
      key: 'DefaultLevel',
      order: 1,
      values: ['Value1', 'Value2']
    }]);
  }
  
  return fc.constant(uniqueLevels);
});

/**
 * Generator for a valid hierarchy path based on given levels
 */
const hierarchyPathGenerator = (levels: HierarchyLevel[]): fc.Arbitrary<HierarchyPath> => {
  if (levels.length === 0) {
    return fc.constant({});
  }
  
  const pathRecord: Record<string, fc.Arbitrary<string>> = {};
  levels.forEach(level => {
    if (level.values.length > 0) {
      pathRecord[level.key] = fc.constantFrom(...level.values);
    } else {
      pathRecord[level.key] = hierarchyValueGenerator;
    }
  });
  
  return fc.record(pathRecord) as fc.Arbitrary<HierarchyPath>;
};

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('HierarchyManager Property-Based Tests', () => {
  let hierarchyManager: HierarchyManager;
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager();
    hierarchyManager = new HierarchyManager(assetManager);
  });

  /**
   * **Feature: maintenance-task-management, Property 10: 階層名変更の一括更新**
   * 
   * For any hierarchy level and name, when renaming a hierarchy level,
   * all assets using that hierarchy path should be updated.
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 10: 階層名変更の一括更新', () => {
    it('should update all assets when renaming a hierarchy level', () => {
      fc.assert(
        fc.property(
          hierarchyLevelKeyGenerator,
          hierarchyLevelKeyGenerator,
          hierarchyValueGenerator,
          fc.array(assetIdGenerator, { minLength: 1, maxLength: 10 })
            .map(arr => Array.from(new Set(arr))), // Ensure unique asset IDs
          (oldKey, newKey, value, assetIds) => {
            // Skip if keys are the same
            fc.pre(oldKey !== newKey);
            
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Create hierarchy level with value
            manager.addHierarchyLevel(oldKey, 1);
            manager.addHierarchyValue(oldKey, value);
            
            // Create assets using this hierarchy level
            const assetManager = (manager as any).assetManager;
            assetIds.forEach(assetId => {
              assetManager.createAsset({
                id: assetId,
                name: `Asset ${assetId}`,
                hierarchyPath: { [oldKey]: value },
                specifications: []
              });
            });
            
            // Action: Rename the hierarchy level
            manager.updateHierarchyLevelKey(oldKey, newKey);
            
            // Verification: All assets should have the new key
            assetIds.forEach(assetId => {
              const asset = assetManager.getAsset(assetId);
              expect(asset).not.toBeNull();
              expect(asset!.hierarchyPath[newKey]).toBe(value);
              expect(asset!.hierarchyPath[oldKey]).toBeUndefined();
            });
            
            // Verify hierarchy definition updated
            const hierarchy = manager.getHierarchyDefinition();
            expect(hierarchy.levels.some(l => l.key === newKey)).toBe(true);
            expect(hierarchy.levels.some(l => l.key === oldKey)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 11: 階層再割り当ての完全性**
   * 
   * For any asset and new hierarchy path, when reassigning an asset,
   * the asset should appear in the new hierarchy and be removed from the old hierarchy.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 11: 階層再割り当ての完全性', () => {
    it('should completely reassign assets to new hierarchy paths', () => {
      fc.assert(
        fc.property(
          hierarchyLevelsGenerator,
          assetIdGenerator,
          assetNameGenerator,
          (levels, assetId, assetName) => {
            const manager = new HierarchyManager(new AssetManager());
            const assetManager = (manager as any).assetManager;
            
            // Setup: Create hierarchy levels
            levels.forEach(level => {
              manager.addHierarchyLevel(level.key, level.order);
              level.values.forEach(value => {
                manager.addHierarchyValue(level.key, value);
              });
            });
            
            // Generate two different valid hierarchy paths
            const pathGen = hierarchyPathGenerator(levels);
            const [oldPath, newPath] = fc.sample(pathGen, 2);
            
            // Skip if paths are identical
            fc.pre(JSON.stringify(oldPath) !== JSON.stringify(newPath));
            
            // Create asset with old path
            assetManager.createAsset({
              id: assetId,
              name: assetName,
              hierarchyPath: oldPath,
              specifications: []
            });
            
            // Action: Reassign to new path
            manager.reassignAssetHierarchy(assetId, newPath);
            
            // Verification: Asset should have new path
            const asset = assetManager.getAsset(assetId);
            expect(asset).not.toBeNull();
            expect(asset!.hierarchyPath).toEqual(newPath);
            
            // Verify old path is not present
            Object.keys(oldPath).forEach(key => {
              if (oldPath[key] !== newPath[key]) {
                expect(asset!.hierarchyPath[key]).not.toBe(oldPath[key]);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 12: 階層パスのバリデーション**
   * 
   * For any hierarchy path, if not all required levels are specified,
   * validation should fail.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 12: 階層パスのバリデーション', () => {
    it('should reject paths missing required levels', () => {
      fc.assert(
        fc.property(
          hierarchyLevelsGenerator,
          (levels) => {
            // Need at least 2 levels to test missing levels
            fc.pre(levels.length >= 2);
            
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Create hierarchy levels
            levels.forEach(level => {
              manager.addHierarchyLevel(level.key, level.order);
              level.values.forEach(value => {
                manager.addHierarchyValue(level.key, value);
              });
            });
            
            // Create incomplete path (missing at least one level)
            const incompletePath: HierarchyPath = {};
            const numLevelsToInclude = Math.floor(Math.random() * (levels.length - 1)) + 0; // 0 to length-1
            
            for (let i = 0; i < numLevelsToInclude; i++) {
              const level = levels[i];
              incompletePath[level.key] = level.values[0];
            }
            
            // Verification: Validation should fail
            const isValid = manager.validateHierarchyPath(incompletePath);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept paths with all required levels', () => {
      fc.assert(
        fc.property(
          hierarchyLevelsGenerator,
          (levels) => {
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Create hierarchy levels
            levels.forEach(level => {
              manager.addHierarchyLevel(level.key, level.order);
              level.values.forEach(value => {
                manager.addHierarchyValue(level.key, value);
              });
            });
            
            // Create complete path with all levels
            const completePath: HierarchyPath = {};
            levels.forEach(level => {
              completePath[level.key] = level.values[0];
            });
            
            // Verification: Validation should succeed
            const isValid = manager.validateHierarchyPath(completePath);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject paths with invalid values', () => {
      fc.assert(
        fc.property(
          hierarchyLevelsGenerator,
          hierarchyValueGenerator,
          (levels, invalidValue) => {
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Create hierarchy levels
            levels.forEach(level => {
              manager.addHierarchyLevel(level.key, level.order);
              level.values.forEach(value => {
                manager.addHierarchyValue(level.key, value);
              });
            });
            
            // Create path with one invalid value
            const pathWithInvalidValue: HierarchyPath = {};
            levels.forEach((level, index) => {
              if (index === 0) {
                // Use invalid value for first level
                // Make sure it's not in the valid values
                fc.pre(!level.values.includes(invalidValue));
                pathWithInvalidValue[level.key] = invalidValue;
              } else {
                pathWithInvalidValue[level.key] = level.values[0];
              }
            });
            
            // Verification: Validation should fail
            const isValid = manager.validateHierarchyPath(pathWithInvalidValue);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 13: 階層変更の参照整合性**
   * 
   * For any hierarchy change, after the change, all asset hierarchy references
   * should remain valid.
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 13: 階層変更の参照整合性', () => {
    it('should maintain valid asset references after hierarchy value updates', () => {
      fc.assert(
        fc.property(
          hierarchyLevelKeyGenerator,
          hierarchyValueGenerator,
          hierarchyValueGenerator,
          fc.array(assetIdGenerator, { minLength: 1, maxLength: 10 })
            .map(arr => Array.from(new Set(arr))),
          (levelKey, oldValue, newValue, assetIds) => {
            // Skip if values are the same
            fc.pre(oldValue !== newValue);
            
            const manager = new HierarchyManager(new AssetManager());
            const assetManager = (manager as any).assetManager;
            
            // Setup: Create hierarchy level with old value
            manager.addHierarchyLevel(levelKey, 1);
            manager.addHierarchyValue(levelKey, oldValue);
            
            // Create assets using old value
            assetIds.forEach(assetId => {
              assetManager.createAsset({
                id: assetId,
                name: `Asset ${assetId}`,
                hierarchyPath: { [levelKey]: oldValue },
                specifications: []
              });
            });
            
            // Action: Update hierarchy value
            manager.updateHierarchyValue(levelKey, oldValue, newValue);
            
            // Verification: All assets should have valid hierarchy paths
            const invalidAssets = manager.validateAllAssetHierarchies();
            expect(invalidAssets).toEqual([]);
            
            // All assets should have the new value
            assetIds.forEach(assetId => {
              const asset = assetManager.getAsset(assetId);
              expect(asset).not.toBeNull();
              expect(asset!.hierarchyPath[levelKey]).toBe(newValue);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain valid asset references after hierarchy level key updates', () => {
      fc.assert(
        fc.property(
          hierarchyLevelKeyGenerator,
          hierarchyLevelKeyGenerator,
          hierarchyValueGenerator,
          fc.array(assetIdGenerator, { minLength: 1, maxLength: 10 })
            .map(arr => Array.from(new Set(arr))),
          (oldKey, newKey, value, assetIds) => {
            // Skip if keys are the same
            fc.pre(oldKey !== newKey);
            
            const manager = new HierarchyManager(new AssetManager());
            const assetManager = (manager as any).assetManager;
            
            // Setup: Create hierarchy level
            manager.addHierarchyLevel(oldKey, 1);
            manager.addHierarchyValue(oldKey, value);
            
            // Create assets
            assetIds.forEach(assetId => {
              assetManager.createAsset({
                id: assetId,
                name: `Asset ${assetId}`,
                hierarchyPath: { [oldKey]: value },
                specifications: []
              });
            });
            
            // Action: Update level key
            manager.updateHierarchyLevelKey(oldKey, newKey);
            
            // Verification: All assets should have valid hierarchy paths
            const invalidAssets = manager.validateAllAssetHierarchies();
            expect(invalidAssets).toEqual([]);
            
            // All assets should use the new key
            assetIds.forEach(assetId => {
              const asset = assetManager.getAsset(assetId);
              expect(asset).not.toBeNull();
              expect(asset!.hierarchyPath[newKey]).toBe(value);
              expect(asset!.hierarchyPath[oldKey]).toBeUndefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 27: 階層レベル追加の完全性**
   * 
   * For any new hierarchy level key and order, when adding a hierarchy level,
   * it should be correctly added to the hierarchy definition.
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 27: 階層レベル追加の完全性', () => {
    it('should correctly add hierarchy levels to the definition', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              key: hierarchyLevelKeyGenerator,
              order: orderGenerator
            }),
            { minLength: 1, maxLength: 10 }
          ).chain(levels => {
            // Ensure unique keys
            const uniqueKeys = new Set<string>();
            const uniqueLevels = levels.filter(level => {
              if (uniqueKeys.has(level.key)) {
                return false;
              }
              uniqueKeys.add(level.key);
              return true;
            });
            return fc.constant(uniqueLevels.slice(0, 10)); // Max 10 levels
          }),
          (levelsToAdd) => {
            const manager = new HierarchyManager(new AssetManager());
            
            // Action: Add all levels
            levelsToAdd.forEach(level => {
              manager.addHierarchyLevel(level.key, level.order);
            });
            
            // Verification: All levels should be in the hierarchy
            const hierarchy = manager.getHierarchyDefinition();
            expect(hierarchy.levels.length).toBe(levelsToAdd.length);
            
            levelsToAdd.forEach(levelToAdd => {
              const foundLevel = hierarchy.levels.find(l => l.key === levelToAdd.key);
              expect(foundLevel).toBeDefined();
              expect(foundLevel!.key).toBe(levelToAdd.key);
              expect(foundLevel!.order).toBe(levelToAdd.order);
              expect(foundLevel!.values).toEqual([]);
            });
            
            // Verify levels are sorted by order
            for (let i = 1; i < hierarchy.levels.length; i++) {
              expect(hierarchy.levels[i].order).toBeGreaterThanOrEqual(hierarchy.levels[i - 1].order);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 28: 階層レベル削除の伝播**
   * 
   * For any hierarchy level key, when deleting a hierarchy level,
   * that level should be removed from all assets.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 28: 階層レベル削除の伝播', () => {
    it('should remove deleted level from all assets', () => {
      fc.assert(
        fc.property(
          hierarchyLevelKeyGenerator,
          hierarchyLevelKeyGenerator,
          hierarchyValueGenerator,
          hierarchyValueGenerator,
          fc.array(assetIdGenerator, { minLength: 1, maxLength: 10 })
            .map(arr => Array.from(new Set(arr))),
          (levelKey1, levelKey2, value1, value2, assetIds) => {
            // Need two different levels
            fc.pre(levelKey1 !== levelKey2);
            
            const manager = new HierarchyManager(new AssetManager());
            const assetManager = (manager as any).assetManager;
            
            // Setup: Create two hierarchy levels
            manager.addHierarchyLevel(levelKey1, 1);
            manager.addHierarchyLevel(levelKey2, 2);
            manager.addHierarchyValue(levelKey1, value1);
            manager.addHierarchyValue(levelKey2, value2);
            
            // Create assets using both levels
            assetIds.forEach(assetId => {
              assetManager.createAsset({
                id: assetId,
                name: `Asset ${assetId}`,
                hierarchyPath: {
                  [levelKey1]: value1,
                  [levelKey2]: value2
                },
                specifications: []
              });
            });
            
            // Action: Remove first level
            manager.removeHierarchyLevel(levelKey1);
            
            // Verification: All assets should not have the removed level
            assetIds.forEach(assetId => {
              const asset = assetManager.getAsset(assetId);
              expect(asset).not.toBeNull();
              expect(asset!.hierarchyPath[levelKey1]).toBeUndefined();
              expect(asset!.hierarchyPath[levelKey2]).toBe(value2);
            });
            
            // Verify hierarchy definition doesn't have the removed level
            const hierarchy = manager.getHierarchyDefinition();
            expect(hierarchy.levels.some(l => l.key === levelKey1)).toBe(false);
            expect(hierarchy.levels.some(l => l.key === levelKey2)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 29: 動的階層レベル数の制約**
   * 
   * For any hierarchy definition, the number of hierarchy levels
   * should be between 1 and 10.
   * 
   * **Validates: Requirements 3.8**
   */
  describe('Property 29: 動的階層レベル数の制約', () => {
    it('should maintain level count between 1 and 10', () => {
      fc.assert(
        fc.property(
          fc.array(hierarchyLevelKeyGenerator, { minLength: 1, maxLength: 15 })
            .map(arr => Array.from(new Set(arr))), // Ensure unique keys
          (levelKeys) => {
            const manager = new HierarchyManager(new AssetManager());
            
            let addedCount = 0;
            let rejectedCount = 0;
            
            // Try to add all levels
            levelKeys.forEach((key, index) => {
              try {
                manager.addHierarchyLevel(key, index + 1);
                addedCount++;
              } catch (error) {
                // Should only fail if we've reached max (10)
                if (addedCount >= 10) {
                  expect((error as Error).message).toContain('階層レベルの最大数');
                  rejectedCount++;
                } else {
                  // Unexpected error
                  throw error;
                }
              }
            });
            
            // Verification: Level count should be between 1 and 10
            const hierarchy = manager.getHierarchyDefinition();
            expect(hierarchy.levels.length).toBeGreaterThanOrEqual(1);
            expect(hierarchy.levels.length).toBeLessThanOrEqual(10);
            expect(hierarchy.levels.length).toBe(Math.min(addedCount, 10));
            
            // If we tried to add more than 10, some should have been rejected
            if (levelKeys.length > 10) {
              expect(rejectedCount).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow removing the last level', () => {
      fc.assert(
        fc.property(
          hierarchyLevelKeyGenerator,
          (levelKey) => {
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Create single level
            manager.addHierarchyLevel(levelKey, 1);
            
            // Verification: Should have exactly 1 level
            expect(manager.getHierarchyLevelCount()).toBe(1);
            
            // Action: Try to remove the last level
            expect(() => {
              manager.removeHierarchyLevel(levelKey);
            }).toThrow('最後の階層レベルは削除できません');
            
            // Verification: Level should still exist
            expect(manager.getHierarchyLevelCount()).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow removing levels when count is above 1', () => {
      fc.assert(
        fc.property(
          fc.array(hierarchyLevelKeyGenerator, { minLength: 2, maxLength: 10 })
            .map(arr => Array.from(new Set(arr))),
          (levelKeys) => {
            // Need at least 2 unique keys
            fc.pre(levelKeys.length >= 2);
            
            const manager = new HierarchyManager(new AssetManager());
            
            // Setup: Add all levels
            levelKeys.forEach((key, index) => {
              manager.addHierarchyLevel(key, index + 1);
            });
            
            const initialCount = manager.getHierarchyLevelCount();
            expect(initialCount).toBe(levelKeys.length);
            
            // Action: Remove all but one level
            for (let i = 0; i < levelKeys.length - 1; i++) {
              manager.removeHierarchyLevel(levelKeys[i]);
              
              // Verification: Count should decrease
              const currentCount = manager.getHierarchyLevelCount();
              expect(currentCount).toBe(initialCount - i - 1);
              expect(currentCount).toBeGreaterThanOrEqual(1);
            }
            
            // Final verification: Should have exactly 1 level left
            expect(manager.getHierarchyLevelCount()).toBe(1);
            
            // Should not be able to remove the last one
            expect(() => {
              manager.removeHierarchyLevel(levelKeys[levelKeys.length - 1]);
            }).toThrow('最後の階層レベルは削除できません');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
