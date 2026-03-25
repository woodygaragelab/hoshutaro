/**
 * AssetManager - Manages equipment (assets) in the maintenance management system
 * 
 * This service handles CRUD operations for assets and provides hierarchy-based filtering.
 * Assets are physical equipment that require maintenance and are organized in a dynamic hierarchy.
 * 
 * Requirements: 3.1, 3.2, 7.1
 */

import { Asset, HierarchyPath, AssetClassificationPath, Specification } from '../types/maintenanceTask';
import { UndoRedoManager } from './UndoRedoManager';

/**
 * AssetManager class
 * Provides methods to create, read, update, and delete assets
 */
export class AssetManager {
  private assets: Map<string, Asset>;
  private undoRedoManager?: UndoRedoManager;

  constructor(undoRedoManager?: UndoRedoManager) {
    this.assets = new Map();
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
   * Validate asset data
   * @private
   */
  private validateAssetData(data: {
    id: string;
    name: string;
    hierarchyPath: HierarchyPath;
    specifications?: Specification[];
  }, isUpdate: boolean = false): void {
    // Validate asset ID
    if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
      throw new Error('機器IDは必須です。');
    }

    // Check for duplicate ID (only on create)
    if (!isUpdate && this.assets.has(data.id)) {
      throw new Error(`機器ID ${data.id} は既に存在します。`);
    }

    // Validate asset name
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('機器名は必須です。');
    }

    // Validate hierarchy path
    if (!data.hierarchyPath || typeof data.hierarchyPath !== 'object' || data.hierarchyPath === null) {
      throw new Error('階層パスは必須です。');
    }

    if (Object.keys(data.hierarchyPath).length === 0) {
      throw new Error('階層パスには少なくとも1つのレベルが必要です。');
    }

    // Validate hierarchy path values
    for (const [key, value] of Object.entries(data.hierarchyPath)) {
      if (!key || key.trim() === '') {
        throw new Error('階層パスのキーは空にできません。');
      }
      if (!value || typeof value !== 'string' || value.trim() === '') {
        throw new Error(`階層レベル "${key}" の値は空にできません。`);
      }
    }

    // Validate specifications if provided
    if (data.specifications) {
      this.validateSpecifications(data.specifications);
    }
  }

  /**
   * Validate specifications array
   * @private
   */
  private validateSpecifications(specifications: Specification[]): void {
    if (!Array.isArray(specifications)) {
      throw new Error('仕様は配列である必要があります。');
    }

    const keys = new Set<string>();
    for (const spec of specifications) {
      // Validate specification structure
      if (!spec || typeof spec !== 'object') {
        throw new Error('仕様項目が無効です。');
      }

      // Validate key
      if (!spec.key || typeof spec.key !== 'string' || spec.key.trim() === '') {
        throw new Error('仕様のキーは必須です。');
      }

      // Check for duplicate keys
      if (keys.has(spec.key)) {
        throw new Error(`仕様のキー "${spec.key}" が重複しています。`);
      }
      keys.add(spec.key);

      // Validate value
      if (spec.value === undefined || spec.value === null || (typeof spec.value === 'string' && spec.value.trim() === '')) {
        throw new Error(`仕様 "${spec.key}" の値は必須です。`);
      }

      // Validate order
      if (typeof spec.order !== 'number' || spec.order < 0) {
        throw new Error(`仕様 "${spec.key}" の順序は0以上の数値である必要があります。`);
      }
    }
  }

  /**
   * Create a new asset
   * Requirement 3.1: Create assets with dynamic hierarchy
   * 
   * @param asset - Asset data without timestamps
   * @returns Created asset with timestamps
   */
  createAsset(asset: Omit<Asset, 'createdAt' | 'updatedAt'>): Asset {
    // Validate asset data
    this.validateAssetData(asset, false);

    // Create asset with timestamps
    const now = new Date();
    const newAsset: Asset = {
      ...asset,
      createdAt: now,
      updatedAt: now,
    };

    this.assets.set(newAsset.id, newAsset);

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_ASSET', {
        asset: { ...newAsset },
        isCreate: true
      });
    }

    return newAsset;
  }

  /**
   * Update an existing asset
   * Requirement 3.2: Update asset information
   * 
   * @param id - Asset ID
   * @param updates - Partial asset data to update
   * @returns Updated asset
   */
  updateAsset(id: string, updates: Partial<Asset>): Asset {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new Error(`機器が見つかりません: ${id}`);
    }

    // Validate that ID cannot be changed
    if (updates.id && updates.id !== id) {
      throw new Error('機器IDは変更できません。');
    }

    // Validate updates if any critical fields are being updated
    if (updates.name !== undefined || updates.hierarchyPath !== undefined || updates.specifications !== undefined) {
      const dataToValidate = {
        id: asset.id,
        name: updates.name ?? asset.name,
        hierarchyPath: updates.hierarchyPath ?? asset.hierarchyPath,
        specifications: updates.specifications ?? asset.specifications,
      };
      this.validateAssetData(dataToValidate, true);
    }

    // Update asset
    const updatedAsset: Asset = {
      ...asset,
      ...updates,
      id: asset.id, // Ensure ID doesn't change
      createdAt: asset.createdAt, // Preserve creation timestamp
      updatedAt: new Date(),
    };

    this.assets.set(id, updatedAsset);

    // Push state to undo/redo manager
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_ASSET', {
        previousAsset: { ...asset },
        updatedAsset: { ...updatedAsset }
      });
    }

    return updatedAsset;
  }

  /**
   * Delete an asset
   * Requirement 3.1: Delete assets
   * 
   * @param id - Asset ID
   */
  deleteAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new Error(`機器が見つかりません: ${id}`);
    }

    // Push state to undo/redo manager before deletion
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_ASSET', {
        asset: { ...asset },
        isDelete: true
      });
    }

    this.assets.delete(id);
  }

  /**
   * Get a single asset by ID
   * Requirement 3.1: Retrieve asset information
   * 
   * @param id - Asset ID
   * @returns Asset or null if not found
   */
  getAsset(id: string): Asset | null {
    return this.assets.get(id) || null;
  }

  /**
   * Get all assets
   * Requirement 3.1: Retrieve all assets
   * 
   * @returns Array of all assets
   */
  getAllAssets(): Asset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Get assets by hierarchy path
   * Supports partial hierarchy matching for filtering
   * Requirement 3.2: Filter assets by hierarchy
   * 
   * @param hierarchyPath - Partial hierarchy path to match
   * @returns Array of matching assets
   * 
   * @example
   * // Get all assets in "第一製油所"
   * getAssetsByHierarchy({ "製油所": "第一製油所" })
   * 
   * // Get all assets in "第一製油所" -> "Aエリア"
   * getAssetsByHierarchy({ "製油所": "第一製油所", "エリア": "Aエリア" })
   */
  getAssetsByHierarchy(hierarchyPath: Partial<HierarchyPath>): Asset[] {
    // If no hierarchy path provided, return all assets
    if (!hierarchyPath || Object.keys(hierarchyPath).length === 0) {
      return this.getAllAssets();
    }

    // Filter assets that match all provided hierarchy levels
    return Array.from(this.assets.values()).filter(asset => {
      return Object.entries(hierarchyPath).every(([key, value]) => {
        return asset.hierarchyPath[key] === value;
      });
    });
  }

  /**
   * Clear all assets (useful for testing)
   */
  clear(): void {
    this.assets.clear();
  }

  /**
   * Get the total number of assets
   */
  getAssetCount(): number {
    return this.assets.size;
  }

  /**
   * Check if an asset exists
   * 
   * @param id - Asset ID
   * @returns True if asset exists
   */
  hasAsset(id: string): boolean {
    return this.assets.has(id);
  }

  /**
   * Bulk create assets
   * Useful for data import and migration
   * 
   * @param assets - Array of assets to create
   * @returns Array of created assets
   */
  bulkCreateAssets(assets: Omit<Asset, 'createdAt' | 'updatedAt'>[]): Asset[] {
    const createdAssets: Asset[] = [];
    const errors: string[] = [];

    for (const asset of assets) {
      try {
        const created = this.createAsset(asset);
        createdAssets.push(created);
      } catch (error) {
        errors.push(`Failed to create asset ${asset.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
          }

    return createdAssets;
  }

  /**
   * Get assets by multiple IDs
   * 
   * @param ids - Array of asset IDs
   * @returns Array of found assets
   */
  getAssetsByIds(ids: string[]): Asset[] {
    return ids
      .map(id => this.assets.get(id))
      .filter((asset): asset is Asset => asset !== undefined);
  }

  /**
   * Search assets by name (case-insensitive partial match)
   * 
   * @param searchTerm - Search term
   * @returns Array of matching assets
   */
  searchAssetsByName(searchTerm: string): Asset[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllAssets();
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return Array.from(this.assets.values()).filter(asset =>
      asset.name.toLowerCase().includes(lowerSearchTerm) ||
      asset.id.toLowerCase().includes(lowerSearchTerm)
    );
  }

  /**
   * Get unique hierarchy values for a specific level
   * Useful for building filter dropdowns
   * 
   * @param levelKey - Hierarchy level key
   * @returns Array of unique values for that level
   */
  getUniqueHierarchyValues(levelKey: string): string[] {
    const values = new Set<string>();

    for (const asset of this.assets.values()) {
      const value = asset.hierarchyPath[levelKey];
      if (value) {
        values.add(value);
      }
    }

    return Array.from(values).sort();
  }

  /**
   * Get all unique hierarchy level keys used across all assets
   * 
   * @returns Array of unique hierarchy level keys
   */
  getAllHierarchyLevelKeys(): string[] {
    const keys = new Set<string>();

    for (const asset of this.assets.values()) {
      Object.keys(asset.hierarchyPath).forEach(key => keys.add(key));
    }

    return Array.from(keys).sort();
  }

  /**
   * Update specifications for an asset
   * 
   * @param id - Asset ID
   * @param specifications - New specifications array
   * @returns Updated asset
   */
  updateSpecifications(id: string, specifications: Specification[]): Asset {
    const asset = this.getAsset(id);
    if (!asset) {
      throw new Error(`機器が見つかりません: ${id}`);
    }

    // Validate specifications
    this.validateSpecifications(specifications);

    const updatedAsset = this.updateAsset(id, { specifications });

    // Push state to undo/redo manager (separate action for specifications)
    if (this.undoRedoManager) {
      this.undoRedoManager.pushState('UPDATE_SPECIFICATION', {
        assetId: id,
        previousSpecifications: asset.specifications,
        updatedSpecifications: specifications
      });
    }

    return updatedAsset;
  }

  /**
   * Add a specification to an asset
   * 
   * @param id - Asset ID
   * @param specification - Specification to add
   * @returns Updated asset
   */
  addSpecification(id: string, specification: Omit<Specification, 'order'>): Asset {
    const asset = this.getAsset(id);
    if (!asset) {
      throw new Error(`機器が見つかりません: ${id}`);
    }

    // Validate specification key and value
    if (!specification.key || specification.key.trim() === '') {
      throw new Error('仕様のキーは必須です。');
    }

    // Check for duplicate key
    if (asset.specifications.some(spec => spec.key === specification.key)) {
      throw new Error(`仕様のキー "${specification.key}" は既に存在します。`);
    }

    if (specification.value === undefined || specification.value === null ||
      (typeof specification.value === 'string' && specification.value.trim() === '')) {
      throw new Error('仕様の値は必須です。');
    }

    const maxOrder = asset.specifications.reduce((max, spec) => Math.max(max, spec.order), 0);
    const newSpec: Specification = {
      ...specification,
      order: maxOrder + 1,
    };

    const updatedSpecs = [...asset.specifications, newSpec];
    return this.updateAsset(id, { specifications: updatedSpecs });
  }

  /**
   * Remove a specification from an asset
   * 
   * @param id - Asset ID
   * @param specKey - Specification key to remove
   * @returns Updated asset
   */
  removeSpecification(id: string, specKey: string): Asset {
    const asset = this.getAsset(id);
    if (!asset) {
      throw new Error(`機器が見つかりません: ${id}`);
    }

    if (!specKey || specKey.trim() === '') {
      throw new Error('仕様のキーは必須です。');
    }

    const updatedSpecs = asset.specifications.filter(spec => spec.key !== specKey);

    // Check if specification was actually removed
    if (updatedSpecs.length === asset.specifications.length) {
      throw new Error(`仕様のキー "${specKey}" が見つかりません。`);
    }

    return this.updateAsset(id, { specifications: updatedSpecs });
  }
}

// Export singleton instance
export const assetManager = new AssetManager();
