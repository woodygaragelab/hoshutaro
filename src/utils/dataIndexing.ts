/**
 * Data Indexing Utility
 * 
 * Provides O(1) lookup performance for assets, work orders, and associations (WorkOrderLines)
 * by maintaining in-memory indexes.
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import type {
  Asset,
  WorkOrder,
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

  build(assets: Asset[]): void {
    this.index.clear();
    assets.forEach(asset => this.index.set(asset.id, asset));
  }

  get(id: string): Asset | undefined { return this.index.get(id); }
  has(id: string): boolean { return this.index.has(id); }
  set(asset: Asset): void { this.index.set(asset.id, asset); }
  delete(id: string): boolean { return this.index.delete(id); }
  getAll(): Asset[] { return Array.from(this.index.values()); }
  size(): number { return this.index.size; }
  clear(): void { this.index.clear(); }
}

/**
 * Index for WorkOrders by ID
 */
export class WorkOrderIndex {
  private index: Map<string, WorkOrder>;
  private classificationIndex: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
    this.classificationIndex = new Map();
  }

  build(workOrders: WorkOrder[]): void {
    this.index.clear();
    this.classificationIndex.clear();

    workOrders.forEach(wo => {
      this.index.set(wo.id, wo);
      if (!this.classificationIndex.has(wo.ClassificationId)) {
        this.classificationIndex.set(wo.ClassificationId, new Set());
      }
      this.classificationIndex.get(wo.ClassificationId)!.add(wo.id);
    });
  }

  get(id: string): WorkOrder | undefined { return this.index.get(id); }
  has(id: string): boolean { return this.index.has(id); }
  
  set(wo: WorkOrder): void {
    const existing = this.index.get(wo.id);
    if (existing && existing.ClassificationId !== wo.ClassificationId) {
      const oldSet = this.classificationIndex.get(existing.ClassificationId);
      if (oldSet) oldSet.delete(wo.id);
    }
    if (!this.classificationIndex.has(wo.ClassificationId)) {
      this.classificationIndex.set(wo.ClassificationId, new Set());
    }
    this.classificationIndex.get(wo.ClassificationId)!.add(wo.id);
    this.index.set(wo.id, wo);
  }

  delete(id: string): boolean {
    const wo = this.index.get(id);
    if (wo) {
      const set = this.classificationIndex.get(wo.ClassificationId);
      if (set) set.delete(id);
    }
    return this.index.delete(id);
  }

  getAll(): WorkOrder[] { return Array.from(this.index.values()); }
  getByClassification(cls: string): WorkOrder[] {
    const ids = this.classificationIndex.get(cls);
    if (!ids) return [];
    return Array.from(ids).map(id => this.index.get(id)).filter((wo): wo is WorkOrder => wo !== undefined);
  }
  size(): number { return this.index.size; }
  clear(): void { this.index.clear(); this.classificationIndex.clear(); }
}

/**
 * Index for WorkOrderLine by asset and workOrder
 */
export class WorkOrderLineIndex {
  private index: Map<string, WorkOrderLine>;
  private assetIndex: Map<string, Set<string>>;
  private woIndex: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
    this.assetIndex = new Map();
    this.woIndex = new Map();
  }

  build(lines: WorkOrderLine[]): void {
    this.index.clear();
    this.assetIndex.clear();
    this.woIndex.clear();

    lines.forEach(line => {
      this.index.set(line.id, line);

      if (!this.assetIndex.has(line.AssetId)) {
        this.assetIndex.set(line.AssetId, new Set());
      }
      this.assetIndex.get(line.AssetId)!.add(line.id);

      if (!this.woIndex.has(line.WorkOrderId)) {
        this.woIndex.set(line.WorkOrderId, new Set());
      }
      this.woIndex.get(line.WorkOrderId)!.add(line.id);
    });
  }

  get(id: string): WorkOrderLine | undefined { return this.index.get(id); }
  has(id: string): boolean { return this.index.has(id); }

  set(line: WorkOrderLine): void {
    const prev = this.index.get(line.id);
    if (prev) {
      if (prev.AssetId !== line.AssetId) {
        this.assetIndex.get(prev.AssetId)?.delete(line.id);
      }
      if (prev.WorkOrderId !== line.WorkOrderId) {
        this.woIndex.get(prev.WorkOrderId)?.delete(line.id);
      }
    }
    if (!this.assetIndex.has(line.AssetId)) this.assetIndex.set(line.AssetId, new Set());
    this.assetIndex.get(line.AssetId)!.add(line.id);

    if (!this.woIndex.has(line.WorkOrderId)) this.woIndex.set(line.WorkOrderId, new Set());
    this.woIndex.get(line.WorkOrderId)!.add(line.id);

    this.index.set(line.id, line);
  }

  delete(id: string): boolean {
    const line = this.index.get(id);
    if (line) {
      this.assetIndex.get(line.AssetId)?.delete(id);
      this.woIndex.get(line.WorkOrderId)?.delete(id);
    }
    return this.index.delete(id);
  }

  getAll(): WorkOrderLine[] { return Array.from(this.index.values()); }
  getByAsset(assetId: string): WorkOrderLine[] {
    const ids = this.assetIndex.get(assetId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.index.get(id)).filter((a): a is WorkOrderLine => a !== undefined);
  }
  getByWorkOrder(woId: string): WorkOrderLine[] {
    const ids = this.woIndex.get(woId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.index.get(id)).filter((a): a is WorkOrderLine => a !== undefined);
  }
  size(): number { return this.index.size; }
  clear(): void { this.index.clear(); this.assetIndex.clear(); this.woIndex.clear(); }
}

export class HierarchyIndex {
  private index: Map<string, Set<string>>;

  constructor() {
    this.index = new Map();
  }

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

  private generatePathKeys(hierarchyPath: HierarchyPath): string[] {
    const keys: string[] = [];
    const entries = Object.entries(hierarchyPath).sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB, 'ja')
    );

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

  private createPathKey(hierarchyPath: Partial<HierarchyPath>): string {
    return Object.entries(hierarchyPath)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB, 'ja'))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }

  getAssetIds(hierarchyPath: Partial<HierarchyPath>): string[] {
    const pathKey = this.createPathKey(hierarchyPath);
    const assetIds = this.index.get(pathKey);
    return assetIds ? Array.from(assetIds) : [];
  }

  updateAsset(assetId: string, oldPath: HierarchyPath, newPath: HierarchyPath): void {
    const oldPathKeys = this.generatePathKeys(oldPath);
    oldPathKeys.forEach(pathKey => this.index.get(pathKey)?.delete(assetId));

    const newPathKeys = this.generatePathKeys(newPath);
    newPathKeys.forEach(pathKey => {
      if (!this.index.has(pathKey)) this.index.set(pathKey, new Set());
      this.index.get(pathKey)!.add(assetId);
    });
  }

  deleteAsset(assetId: string, hierarchyPath: HierarchyPath): void {
    const pathKeys = this.generatePathKeys(hierarchyPath);
    pathKeys.forEach(pathKey => this.index.get(pathKey)?.delete(assetId));
  }

  clear(): void {
    this.index.clear();
  }
}

export class DataIndexManager {
  public assets: AssetIndex;
  public workOrders: WorkOrderIndex;
  public associations: WorkOrderLineIndex;
  public hierarchy: HierarchyIndex;

  constructor() {
    this.assets = new AssetIndex();
    this.workOrders = new WorkOrderIndex();
    this.associations = new WorkOrderLineIndex();
    this.hierarchy = new HierarchyIndex();
  }

  buildAll(data: {
    assets: Asset[];
    workOrders: WorkOrder[];
    associations: WorkOrderLine[];
  }): void {
    this.assets.build(data.assets);
    this.workOrders.build(data.workOrders);
    this.associations.build(data.associations);
    this.hierarchy.build(data.assets);
  }

  clearAll(): void {
    this.assets.clear();
    this.workOrders.clear();
    this.associations.clear();
    this.hierarchy.clear();
  }

  getStats(): {
    assetCount: number;
    woCount: number;
    associationCount: number;
  } {
    return {
      assetCount: this.assets.size(),
      woCount: this.workOrders.size(),
      associationCount: this.associations.size(),
    };
  }
}

export const dataIndexManager = new DataIndexManager();
