/**
 * Data Indexing Utility
 * 
 * Provides O(1) lookup performance for assets, tasks, and associations
 * by maintaining in-memory indexes.
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import type {
  Asset,
  Task,
  WorkOrderLine,
  HierarchyPath,
} from '../types/maintenanceTask';

/**
 * Index for assets by ID
 */
export class AssetIndex {
  private index: Map<string, Asset>;

  constructor() {
    this.index = new Map();
  }

  /**
   * Build index from assets array
   */
  build(assets: Asset[]): void {
    this.index.clear();
    assets.forEach(asset => {
      this.index.set(asset.id, asset);
    });
  }

  /**
   * Get asset by ID - O(1) lookup
   */
  get(id: string): Asset | undefined {
    return this.index.get(id);
  }

  /**
   * Check if asset exists - O(1) lookup
   */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * Add or update asset in index
   */
  set(asset: Asset): void {
    this.index.set(asset.id, asset);
  }

  /**
   * Remove asset from index
   */
  delete(id: string): boolean {
    return this.index.delete(id);
  }

  /**
   * Get all assets
   */
  getAll(): Asset[] {
    return Array.from(this.index.values());
  }

  /**
   * Get count of assets
   */
  size(): number {
    return this.index.size;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
  }
}

/**
 * Index for tasks by ID
 */
export class TaskIndex {
  private index: Map<string, Task>;
  private classificationIndex: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
    this.classificationIndex = new Map();
  }

  /**
   * Build index from tasks array
   */
  build(tasks: Task[]): void {
    this.index.clear();
    this.classificationIndex.clear();

    tasks.forEach(task => {
      this.index.set(task.id, task);

      // Build classification index
      if (!this.classificationIndex.has(task.classification)) {
        this.classificationIndex.set(task.classification, new Set());
      }
      this.classificationIndex.get(task.classification)!.add(task.id);
    });
  }

  /**
   * Get task by ID - O(1) lookup
   */
  get(id: string): Task | undefined {
    return this.index.get(id);
  }

  /**
   * Check if task exists - O(1) lookup
   */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * Add or update task in index
   */
  set(task: Task): void {
    // Remove from old classification if exists
    const existingTask = this.index.get(task.id);
    if (existingTask && existingTask.classification !== task.classification) {
      const oldClassSet = this.classificationIndex.get(existingTask.classification);
      if (oldClassSet) {
        oldClassSet.delete(task.id);
      }
    }

    // Add to new classification
    if (!this.classificationIndex.has(task.classification)) {
      this.classificationIndex.set(task.classification, new Set());
    }
    this.classificationIndex.get(task.classification)!.add(task.id);

    this.index.set(task.id, task);
  }

  /**
   * Remove task from index
   */
  delete(id: string): boolean {
    const task = this.index.get(id);
    if (task) {
      const classSet = this.classificationIndex.get(task.classification);
      if (classSet) {
        classSet.delete(id);
      }
    }
    return this.index.delete(id);
  }

  /**
   * Get all tasks
   */
  getAll(): Task[] {
    return Array.from(this.index.values());
  }

  /**
   * Get tasks by classification - O(1) lookup
   */
  getByClassification(classification: string): Task[] {
    const taskIds = this.classificationIndex.get(classification);
    if (!taskIds) {
      return [];
    }
    return Array.from(taskIds)
      .map(id => this.index.get(id))
      .filter((task): task is Task => task !== undefined);
  }

  /**
   * Get count of tasks
   */
  size(): number {
    return this.index.size;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
    this.classificationIndex.clear();
  }
}

/**
 * Index for associations by asset and task
 */
export class AssociationIndex {
  private index: Map<string, WorkOrderLine>;
  private assetIndex: Map<string, Set<string>>;
  private taskIndex: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
    this.assetIndex = new Map();
    this.taskIndex = new Map();
  }

  /**
   * Build index from associations array
   */
  build(associations: WorkOrderLine[]): void {
    this.index.clear();
    this.assetIndex.clear();
    this.taskIndex.clear();

    associations.forEach(assoc => {
      this.index.set(assoc.id, assoc);

      // Build asset index
      if (!this.assetIndex.has(assoc.assetId)) {
        this.assetIndex.set(assoc.assetId, new Set());
      }
      this.assetIndex.get(assoc.assetId)!.add(assoc.id);

      // Build task index
      if (!this.taskIndex.has(assoc.taskId)) {
        this.taskIndex.set(assoc.taskId, new Set());
      }
      this.taskIndex.get(assoc.taskId)!.add(assoc.id);
    });
  }

  /**
   * Get association by ID - O(1) lookup
   */
  get(id: string): WorkOrderLine | undefined {
    return this.index.get(id);
  }

  /**
   * Check if association exists - O(1) lookup
   */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * Add or update association in index
   */
  set(association: WorkOrderLine): void {
    // Remove from old indexes if exists
    const existingAssoc = this.index.get(association.id);
    if (existingAssoc) {
      if (existingAssoc.assetId !== association.assetId) {
        const oldAssetSet = this.assetIndex.get(existingAssoc.assetId);
        if (oldAssetSet) {
          oldAssetSet.delete(association.id);
        }
      }
      if (existingAssoc.taskId !== association.taskId) {
        const oldTaskSet = this.taskIndex.get(existingAssoc.taskId);
        if (oldTaskSet) {
          oldTaskSet.delete(association.id);
        }
      }
    }

    // Add to new indexes
    if (!this.assetIndex.has(association.assetId)) {
      this.assetIndex.set(association.assetId, new Set());
    }
    this.assetIndex.get(association.assetId)!.add(association.id);

    if (!this.taskIndex.has(association.taskId)) {
      this.taskIndex.set(association.taskId, new Set());
    }
    this.taskIndex.get(association.taskId)!.add(association.id);

    this.index.set(association.id, association);
  }

  /**
   * Remove association from index
   */
  delete(id: string): boolean {
    const assoc = this.index.get(id);
    if (assoc) {
      const assetSet = this.assetIndex.get(assoc.assetId);
      if (assetSet) {
        assetSet.delete(id);
      }
      const taskSet = this.taskIndex.get(assoc.taskId);
      if (taskSet) {
        taskSet.delete(id);
      }
    }
    return this.index.delete(id);
  }

  /**
   * Get all associations
   */
  getAll(): WorkOrderLine[] {
    return Array.from(this.index.values());
  }

  /**
   * Get associations by asset ID - O(1) lookup
   */
  getByAsset(assetId: string): WorkOrderLine[] {
    const assocIds = this.assetIndex.get(assetId);
    if (!assocIds) {
      return [];
    }
    return Array.from(assocIds)
      .map(id => this.index.get(id))
      .filter((assoc): assoc is WorkOrderLine => assoc !== undefined);
  }

  /**
   * Get associations by task ID - O(1) lookup
   */
  getByTask(taskId: string): WorkOrderLine[] {
    const assocIds = this.taskIndex.get(taskId);
    if (!assocIds) {
      return [];
    }
    return Array.from(assocIds)
      .map(id => this.index.get(id))
      .filter((assoc): assoc is TaskAssociation => assoc !== undefined);
  }

  /**
   * Get count of associations
   */
  size(): number {
    return this.index.size;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
    this.assetIndex.clear();
    this.taskIndex.clear();
  }
}

/**
 * Index for assets by hierarchy path
 */
export class HierarchyIndex {
  private index: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
  }

  /**
   * Build index from assets array
   */
  build(assets: Asset[]): void {
    this.index.clear();

    assets.forEach(asset => {
      const pathKeys = this.generatePathKeys(asset.hierarchyPath);
      pathKeys.forEach(pathKey => {
        if (!this.index.has(pathKey)) {
          this.index.set(pathKey, new Set());
        }
        this.index.get(pathKey)!.add(asset.id);
      });
    });
  }

  /**
   * Generate all possible path keys for a hierarchy path
   * For example, { "製油所": "第一製油所", "エリア": "Aエリア", "ユニット": "原油蒸留ユニット" }
   * generates all combinations:
   * - "エリア:Aエリア"
   * - "ユニット:原油蒸留ユニット"
   * - "製油所:第一製油所"
   * - "エリア:Aエリア|ユニット:原油蒸留ユニット"
   * - "エリア:Aエリア|製油所:第一製油所"
   * - "ユニット:原油蒸留ユニット|製油所:第一製油所"
   * - "エリア:Aエリア|ユニット:原油蒸留ユニット|製油所:第一製油所"
   */
  private generatePathKeys(hierarchyPath: HierarchyPath): string[] {
    const keys: string[] = [];
    const entries = Object.entries(hierarchyPath).sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB, 'ja')
    );

    // Generate all combinations of path segments
    const n = entries.length;
    for (let i = 1; i <= (1 << n) - 1; i++) {
      const combination: string[] = [];
      for (let j = 0; j < n; j++) {
        if (i & (1 << j)) {
          combination.push(`${entries[j][0]}:${entries[j][1]}`);
        }
      }
      keys.push(combination.join('|'));
    }

    return keys;
  }

  /**
   * Create a path key from a partial hierarchy path
   */
  private createPathKey(hierarchyPath: Partial<HierarchyPath>): string {
    return Object.entries(hierarchyPath)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB, 'ja'))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }

  /**
   * Get asset IDs by hierarchy path - O(1) lookup
   */
  getAssetIds(hierarchyPath: Partial<HierarchyPath>): string[] {
    const pathKey = this.createPathKey(hierarchyPath);
    const assetIds = this.index.get(pathKey);
    return assetIds ? Array.from(assetIds) : [];
  }

  /**
   * Update index when asset hierarchy changes
   */
  updateAsset(assetId: string, oldPath: HierarchyPath, newPath: HierarchyPath): void {
    // Remove from old paths
    const oldPathKeys = this.generatePathKeys(oldPath);
    oldPathKeys.forEach(pathKey => {
      const assetSet = this.index.get(pathKey);
      if (assetSet) {
        assetSet.delete(assetId);
      }
    });

    // Add to new paths
    const newPathKeys = this.generatePathKeys(newPath);
    newPathKeys.forEach(pathKey => {
      if (!this.index.has(pathKey)) {
        this.index.set(pathKey, new Set());
      }
      this.index.get(pathKey)!.add(assetId);
    });
  }

  /**
   * Remove asset from index
   */
  deleteAsset(assetId: string, hierarchyPath: HierarchyPath): void {
    const pathKeys = this.generatePathKeys(hierarchyPath);
    pathKeys.forEach(pathKey => {
      const assetSet = this.index.get(pathKey);
      if (assetSet) {
        assetSet.delete(assetId);
      }
    });
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear();
  }
}

/**
 * Master data index manager
 * Coordinates all indexes and provides unified interface
 */
export class DataIndexManager {
  public assets: AssetIndex;
  public tasks: TaskIndex;
  public associations: AssociationIndex;
  public hierarchy: HierarchyIndex;

  constructor() {
    this.assets = new AssetIndex();
    this.tasks = new TaskIndex();
    this.associations = new AssociationIndex();
    this.hierarchy = new HierarchyIndex();
  }

  /**
   * Build all indexes from data
   */
  buildAll(data: {
    assets: Asset[];
    tasks: Task[];
    associations: WorkOrderLine[];
  }): void {
    this.assets.build(data.assets);
    this.tasks.build(data.tasks);
    this.associations.build(data.associations);
    this.hierarchy.build(data.assets);
  }

  /**
   * Clear all indexes
   */
  clearAll(): void {
    this.assets.clear();
    this.tasks.clear();
    this.associations.clear();
    this.hierarchy.clear();
  }

  /**
   * Get statistics about indexes
   */
  getStats(): {
    assetCount: number;
    taskCount: number;
    associationCount: number;
  } {
    return {
      assetCount: this.assets.size(),
      taskCount: this.tasks.size(),
      associationCount: this.associations.size(),
    };
  }
}

/**
 * Create a singleton instance for global use
 */
export const dataIndexManager = new DataIndexManager();
