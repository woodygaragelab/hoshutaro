/**
 * HierarchyManager - Manages dynamic equipment hierarchy in the maintenance management system
 * 
 * This service handles dynamic hierarchy level management (1-10 levels), hierarchy value management,
 * and asset hierarchy reassignment. The hierarchy structure is flexible and can be modified at runtime.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import { HierarchyDefinition, HierarchyLevel, HierarchyPath, Asset } from '../types/maintenanceTask';
import { AssetManager } from './AssetManager';
import { UndoRedoManager } from './UndoRedoManager';

/**
 * HierarchyManager class
 * Provides methods to manage dynamic hierarchy levels and values
 */
export class HierarchyManager {
  private hierarchy: HierarchyDefinition;
  private assetManager: AssetManager;
  private undoRedoManager?: UndoRedoManager;

  constructor(assetManager: AssetManager, initialHierarchy?: HierarchyDefinition, undoRedoManager?: UndoRedoManager) {
    this.assetManager = assetManager;
    this.hierarchy = initialHierarchy || { levels: [] };
    this.undoRedoManager = undoRedoManager;
  }

  /**
   * Set the UndoRedoManager instance
   * This allows setting the manager after construction for circular dependency resolution
   */
  setUndoRedoManager(undoRedoManager: UndoRedoManager): void {
    this.undoRedoManager = undoRedoManager;
  }

  /**
   * Get the current hierarchy definition
   * Requirement 3.1: Retrieve hierarchy structure
   * 
   * @returns Current hierarchy definition
   */
  getHierarchyDefinition(): HierarchyDefinition {
    return JSON.parse(JSON.stringify(this.hierarchy)); // Deep clone to prevent external modifications
  }

  // ============================================================================
  // Level Management
  // ============================================================================

  /**
   * Add a new hierarchy level
   * Requirement 3.3: Create new hierarchy levels
   * Requirement 3.8: Support 1-10 dynamic hierarchy levels
   * 
   * @param levelKey - Key for the new level (e.g., "製油所", "エリア")
   * @param order - Display order for the level
   * @throws Error if level already exists or max levels exceeded
   */
  addHierarchyLevel(levelKey: string, order: number): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Check if level already exists
    if (this.hierarchy.levels.some(level => level.key === levelKey)) {
      throw new Error(`階層レベル "${levelKey}" は既に存在します。`);
    }

    // Validate max levels constraint (1-10)
    if (this.hierarchy.levels.length >= 10) {
      throw new Error('階層レベルの最大数（10）に達しました。');
    }

    // Validate order
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 1) {
      throw new Error('階層レベルの順序は1以上の整数である必要があります。');
    }

    // Create new level
    const newLevel: HierarchyLevel = {
      key: levelKey,
      order,
      values: [],
    };

    // Add level and re-sort by order
    this.hierarchy.levels.push(newLevel);
    this.hierarchy.levels.sort((a, b) => a.order - b.order);

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'ADD_LEVEL',
        levelKey,
        order
      });
    }
  }

  /**
   * Remove a hierarchy level
   * Requirement 3.4: Delete hierarchy levels
   * Requirement 3.8: Maintain minimum 1 level
   * 
   * @param levelKey - Key of the level to remove
   * @throws Error if level not found or would violate minimum constraint
   */
  removeHierarchyLevel(levelKey: string): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Find level index first
    const levelIndex = this.hierarchy.levels.findIndex(level => level.key === levelKey);
    if (levelIndex === -1) {
      throw new Error(`階層レベル "${levelKey}" が見つかりません。`);
    }

    // Check minimum levels constraint
    if (this.hierarchy.levels.length <= 1) {
      throw new Error('最後の階層レベルは削除できません（最低1レベル必要）。');
    }

    // Store removed level for undo
    const removedLevel = this.hierarchy.levels[levelIndex];

    // Remove level from hierarchy definition
    this.hierarchy.levels.splice(levelIndex, 1);

    // Remove this level from all assets
    const allAssets = this.assetManager.getAllAssets();
    const affectedAssets: { id: string; oldPath: HierarchyPath }[] = [];
    
    for (const asset of allAssets) {
      if (asset.hierarchyPath[levelKey]) {
        affectedAssets.push({ id: asset.id, oldPath: { ...asset.hierarchyPath } });
        const updatedPath = { ...asset.hierarchyPath };
        delete updatedPath[levelKey];
        this.assetManager.updateAsset(asset.id, { hierarchyPath: updatedPath });
      }
    }

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'REMOVE_LEVEL',
        levelKey,
        removedLevel: { ...removedLevel },
        affectedAssets
      });
    }
  }

  /**
   * Reorder a hierarchy level
   * Requirement 3.5: Change hierarchy level order
   * 
   * @param levelKey - Key of the level to reorder
   * @param newOrder - New order value
   * @throws Error if level not found
   */
  reorderHierarchyLevel(levelKey: string, newOrder: number): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Find level
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    if (!level) {
      throw new Error(`階層レベル "${levelKey}" が見つかりません。`);
    }

    // Validate new order
    if (typeof newOrder !== 'number' || !Number.isInteger(newOrder) || newOrder < 1) {
      throw new Error('階層レベルの順序は1以上の整数である必要があります。');
    }

    // Store old order for undo
    const oldOrder = level.order;

    // Update order
    level.order = newOrder;

    // Re-sort levels by order
    this.hierarchy.levels.sort((a, b) => a.order - b.order);

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'REORDER_LEVEL',
        levelKey,
        oldOrder,
        newOrder
      });
    }
  }

  /**
   * Update a hierarchy level key (rename)
   * Requirement 3.1: Edit hierarchy level names
   * 
   * @param oldKey - Current key
   * @param newKey - New key
   * @throws Error if old key not found or new key already exists
   */
  updateHierarchyLevelKey(oldKey: string, newKey: string): void {
    // Validate old key
    if (!oldKey || typeof oldKey !== 'string' || oldKey.trim() === '') {
      throw new Error('現在の階層レベルのキーは必須です。');
    }

    // Validate new key
    if (!newKey || typeof newKey !== 'string' || newKey.trim() === '') {
      throw new Error('新しい階層レベルのキーは必須です。');
    }

    // Check if old key exists
    const level = this.hierarchy.levels.find(l => l.key === oldKey);
    if (!level) {
      throw new Error(`階層レベル "${oldKey}" が見つかりません。`);
    }

    // Check if new key already exists
    if (oldKey !== newKey && this.hierarchy.levels.some(l => l.key === newKey)) {
      throw new Error(`階層レベル "${newKey}" は既に存在します。`);
    }

    // Update level key
    level.key = newKey;

    // Update all assets that use this level
    const allAssets = this.assetManager.getAllAssets();
    const affectedAssets: string[] = [];
    
    for (const asset of allAssets) {
      if (asset.hierarchyPath[oldKey]) {
        affectedAssets.push(asset.id);
        const updatedPath = { ...asset.hierarchyPath };
        updatedPath[newKey] = updatedPath[oldKey];
        delete updatedPath[oldKey];
        this.assetManager.updateAsset(asset.id, { hierarchyPath: updatedPath });
      }
    }

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'UPDATE_LEVEL_KEY',
        oldKey,
        newKey,
        affectedAssets
      });
    }
  }

  // ============================================================================
  // Value Management
  // ============================================================================

  /**
   * Add a value to a hierarchy level
   * Requirement 3.3: Add hierarchy values
   * 
   * @param levelKey - Key of the level
   * @param value - Value to add
   * @throws Error if level not found or value already exists
   */
  addHierarchyValue(levelKey: string, value: string): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Validate value
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error('階層の値は必須です。');
    }

    // Find level
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    if (!level) {
      throw new Error(`階層レベル "${levelKey}" が見つかりません。`);
    }

    // Check if value already exists
    if (level.values.includes(value)) {
      throw new Error(`値 "${value}" は階層レベル "${levelKey}" に既に存在します。`);
    }

    // Add value
    level.values.push(value);
    level.values.sort();

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'ADD_VALUE',
        levelKey,
        value
      });
    }
  }

  /**
   * Update a hierarchy value
   * Requirement 3.1: Edit hierarchy values
   * 
   * @param levelKey - Key of the level
   * @param oldValue - Current value
   * @param newValue - New value
   * @throws Error if level not found, old value not found, or new value already exists
   */
  updateHierarchyValue(levelKey: string, oldValue: string, newValue: string): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Validate old value
    if (!oldValue || typeof oldValue !== 'string') {
      throw new Error('現在の階層の値は必須です。');
    }

    // Validate new value
    if (!newValue || typeof newValue !== 'string' || newValue.trim() === '') {
      throw new Error('新しい階層の値は必須です。');
    }

    // Find level
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    if (!level) {
      throw new Error(`階層レベル "${levelKey}" が見つかりません。`);
    }

    // Check if old value exists
    const valueIndex = level.values.indexOf(oldValue);
    if (valueIndex === -1) {
      throw new Error(`値 "${oldValue}" は階層レベル "${levelKey}" に見つかりません。`);
    }

    // Check if new value already exists (unless it's the same as old value)
    if (oldValue !== newValue && level.values.includes(newValue)) {
      throw new Error(`値 "${newValue}" は階層レベル "${levelKey}" に既に存在します。`);
    }

    // Update value in hierarchy definition
    level.values[valueIndex] = newValue;
    level.values.sort();

    // Update all assets that use this value
    const allAssets = this.assetManager.getAllAssets();
    const affectedAssets: string[] = [];
    
    for (const asset of allAssets) {
      if (asset.hierarchyPath[levelKey] === oldValue) {
        affectedAssets.push(asset.id);
        const updatedPath = { ...asset.hierarchyPath };
        updatedPath[levelKey] = newValue;
        this.assetManager.updateAsset(asset.id, { hierarchyPath: updatedPath });
      }
    }

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'UPDATE_VALUE',
        levelKey,
        oldValue,
        newValue,
        affectedAssets
      });
    }
  }

  /**
   * Delete a hierarchy value
   * Requirement 3.4: Delete hierarchy values
   * 
   * @param levelKey - Key of the level
   * @param value - Value to delete
   * @throws Error if level not found, value not found, or value is in use
   */
  deleteHierarchyValue(levelKey: string, value: string): void {
    // Validate level key
    if (!levelKey || typeof levelKey !== 'string' || levelKey.trim() === '') {
      throw new Error('階層レベルのキーは必須です。');
    }

    // Validate value
    if (!value || typeof value !== 'string') {
      throw new Error('階層の値は必須です。');
    }

    // Find level
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    if (!level) {
      throw new Error(`階層レベル "${levelKey}" が見つかりません。`);
    }

    // Check if value exists
    const valueIndex = level.values.indexOf(value);
    if (valueIndex === -1) {
      throw new Error(`値 "${value}" は階層レベル "${levelKey}" に見つかりません。`);
    }

    // Check if value is in use by any assets
    const assetsUsingValue = this.assetManager.getAllAssets().filter(
      asset => asset.hierarchyPath[levelKey] === value
    );

    if (assetsUsingValue.length > 0) {
      throw new Error(
        `値 "${value}" は ${assetsUsingValue.length} 個の機器で使用されているため、階層レベル "${levelKey}" から削除できません。`
      );
    }

    // Remove value
    level.values.splice(valueIndex, 1);

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_HIERARCHY', {
        action: 'DELETE_VALUE',
        levelKey,
        value
      });
    }
  }

  // ============================================================================
  // Asset Management
  // ============================================================================

  /**
   * Reassign an asset to a new hierarchy path
   * Requirement 3.2: Move assets between hierarchy paths
   * Requirement 3.6: Reassign assets to new hierarchy
   * 
   * @param assetId - ID of the asset to reassign
   * @param newHierarchyPath - New hierarchy path
   * @throws Error if asset not found or hierarchy path is invalid
   */
  reassignAssetHierarchy(assetId: string, newHierarchyPath: HierarchyPath): void {
    // Validate asset ID
    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      throw new Error('機器IDは必須です。');
    }

    // Check if asset exists
    const asset = this.assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error(`機器 "${assetId}" が見つかりません。`);
    }

    // Validate new hierarchy path
    if (!newHierarchyPath || typeof newHierarchyPath !== 'object' || newHierarchyPath === null) {
      throw new Error('階層パスは有効なオブジェクトである必要があります。');
    }

    if (!this.validateHierarchyPath(newHierarchyPath)) {
      throw new Error('無効な階層パスです。すべての必須レベルが指定され、有効な値を持っている必要があります。');
    }

    // Store old hierarchy path for undo
    const oldHierarchyPath = { ...asset.hierarchyPath };

    // Update asset with new hierarchy path
    this.assetManager.updateAsset(assetId, { hierarchyPath: newHierarchyPath });

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('REASSIGN_HIERARCHY', {
        assetId,
        oldHierarchyPath,
        newHierarchyPath: { ...newHierarchyPath }
      });
    }
  }

  /**
   * Validate a hierarchy path
   * Requirement 3.6: Validate hierarchy paths
   * Requirement 3.7: Maintain reference integrity
   * 
   * @param path - Hierarchy path to validate
   * @returns True if path is valid
   */
  validateHierarchyPath(path: HierarchyPath): boolean {
    // Check if path is empty
    if (!path || Object.keys(path).length === 0) {
      return false;
    }

    // Check if all required levels are present
    for (const level of this.hierarchy.levels) {
      if (!path[level.key]) {
        return false;
      }

      // Check if value exists in level's allowed values
      if (level.values.length > 0 && !level.values.includes(path[level.key])) {
        return false;
      }
    }

    // Check if path contains any extra keys not in hierarchy definition
    const validKeys = new Set(this.hierarchy.levels.map(l => l.key));
    for (const key of Object.keys(path)) {
      if (!validKeys.has(key)) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all hierarchy level keys in order
   * 
   * @returns Array of hierarchy level keys
   */
  getHierarchyLevelKeys(): string[] {
    return this.hierarchy.levels.map(level => level.key);
  }

  /**
   * Get a hierarchy level by key
   * 
   * @param levelKey - Key of the level
   * @returns Hierarchy level or null if not found
   */
  getHierarchyLevelByKey(levelKey: string): HierarchyLevel | null {
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    return level ? { ...level, values: [...level.values] } : null; // Return a copy
  }

  /**
   * Get the number of hierarchy levels
   * 
   * @returns Number of levels
   */
  getHierarchyLevelCount(): number {
    return this.hierarchy.levels.length;
  }

  /**
   * Check if a hierarchy level exists
   * 
   * @param levelKey - Key of the level
   * @returns True if level exists
   */
  hasHierarchyLevel(levelKey: string): boolean {
    return this.hierarchy.levels.some(l => l.key === levelKey);
  }

  /**
   * Get all values for a specific hierarchy level
   * 
   * @param levelKey - Key of the level
   * @returns Array of values or empty array if level not found
   */
  getHierarchyValues(levelKey: string): string[] {
    const level = this.hierarchy.levels.find(l => l.key === levelKey);
    return level ? [...level.values] : [];
  }

  /**
   * Clear all hierarchy levels (useful for testing)
   * Note: This will fail if there are assets in the system
   */
  clear(): void {
    // Check if there are any assets
    const assetCount = this.assetManager.getAssetCount();
    if (assetCount > 0) {
      throw new Error(`Cannot clear hierarchy while ${assetCount} asset(s) exist`);
    }

    this.hierarchy = { levels: [] };
  }

  /**
   * Set the entire hierarchy definition
   * Useful for data import and migration
   * 
   * @param hierarchy - New hierarchy definition
   * @throws Error if hierarchy is invalid
   */
  setHierarchyDefinition(hierarchy: HierarchyDefinition): void {
    // Validate hierarchy
    if (!hierarchy || typeof hierarchy !== 'object' || hierarchy === null) {
      throw new Error('階層定義は有効なオブジェクトである必要があります。');
    }

    if (!hierarchy.levels || !Array.isArray(hierarchy.levels)) {
      throw new Error('階層定義にはレベルの配列が必要です。');
    }

    // Validate level count (1-10)
    if (hierarchy.levels.length < 1 || hierarchy.levels.length > 10) {
      throw new Error('階層は1から10レベルの間である必要があります。');
    }

    // Validate each level
    for (const level of hierarchy.levels) {
      if (!level || typeof level !== 'object') {
        throw new Error('階層レベルは有効なオブジェクトである必要があります。');
      }

      if (!level.key || typeof level.key !== 'string' || level.key.trim() === '') {
        throw new Error('すべての階層レベルにはキーが必要です。');
      }

      if (typeof level.order !== 'number' || !Number.isInteger(level.order) || level.order < 1) {
        throw new Error(`階層レベル "${level.key}" の順序は1以上の整数である必要があります。`);
      }

      if (!Array.isArray(level.values)) {
        throw new Error(`階層レベル "${level.key}" の値は配列である必要があります。`);
      }
    }

    // Check for duplicate keys
    const keys = hierarchy.levels.map(l => l.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      throw new Error('階層レベルには一意のキーが必要です。');
    }

    this.hierarchy = JSON.parse(JSON.stringify(hierarchy)); // Deep clone
  }

  /**
   * Bulk reassign assets to new hierarchy paths
   * Useful for mass updates
   * 
   * @param reassignments - Map of asset ID to new hierarchy path
   * @returns Array of successfully reassigned asset IDs
   */
  bulkReassignAssets(reassignments: Map<string, HierarchyPath>): string[] {
    const successfulIds: string[] = [];
    const errors: string[] = [];

    for (const [assetId, newPath] of reassignments.entries()) {
      try {
        this.reassignAssetHierarchy(assetId, newPath);
        successfulIds.push(assetId);
      } catch (error) {
        errors.push(
          `Failed to reassign asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    if (errors.length > 0) {
          }

    return successfulIds;
  }

  /**
   * Get assets grouped by hierarchy path
   * Useful for building hierarchy trees
   * 
   * @returns Map of hierarchy path string to array of assets
   */
  getAssetsGroupedByHierarchy(): Map<string, Asset[]> {
    const grouped = new Map<string, Asset[]>();
    const allAssets = this.assetManager.getAllAssets();

    for (const asset of allAssets) {
      const pathKey = this.hierarchyPathToString(asset.hierarchyPath);
      const existing = grouped.get(pathKey) || [];
      existing.push(asset);
      grouped.set(pathKey, existing);
    }

    return grouped;
  }

  /**
   * Convert hierarchy path to string representation
   * 
   * @param path - Hierarchy path
   * @returns String representation
   */
  private hierarchyPathToString(path: HierarchyPath): string {
    const keys = this.getHierarchyLevelKeys();
    return keys.map(key => path[key] || '').join(' > ');
  }

  /**
   * Validate that all assets have valid hierarchy paths
   * Requirement 3.7: Maintain reference integrity
   * 
   * @returns Array of asset IDs with invalid hierarchy paths
   */
  validateAllAssetHierarchies(): string[] {
    const invalidAssetIds: string[] = [];
    const allAssets = this.assetManager.getAllAssets();

    for (const asset of allAssets) {
      if (!this.validateHierarchyPath(asset.hierarchyPath)) {
        invalidAssetIds.push(asset.id);
      }
    }

    return invalidAssetIds;
  }
}

// Note: Singleton instance should be created with the assetManager instance
// export const hierarchyManager = new HierarchyManager(assetManager);
