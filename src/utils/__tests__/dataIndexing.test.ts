/**
 * Tests for Data Indexing Utility
 */

import {
  AssetIndex,
  TaskIndex,
  AssociationIndex,
  HierarchyIndex,
  DataIndexManager,
} from '../dataIndexing';
import type {
  Asset,
  Task,
  TaskAssociation,
  HierarchyPath,
} from '../../types/maintenanceTask';

describe('AssetIndex', () => {
  let assetIndex: AssetIndex;
  let sampleAssets: Asset[];

  beforeEach(() => {
    assetIndex = new AssetIndex();
    sampleAssets = [
      {
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'T-4220',
        name: '貯蔵タンク',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Cエリア',
          'ユニット': '製品貯蔵エリア',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  test('should build index from assets array', () => {
    assetIndex.build(sampleAssets);
    expect(assetIndex.size()).toBe(2);
    expect(assetIndex.has('P-101')).toBe(true);
    expect(assetIndex.has('T-4220')).toBe(true);
  });

  test('should get asset by ID with O(1) lookup', () => {
    assetIndex.build(sampleAssets);
    const asset = assetIndex.get('P-101');
    expect(asset).toBeDefined();
    expect(asset?.name).toBe('原油供給ポンプ');
  });

  test('should return undefined for non-existent asset', () => {
    assetIndex.build(sampleAssets);
    const asset = assetIndex.get('NON-EXISTENT');
    expect(asset).toBeUndefined();
  });

  test('should add new asset to index', () => {
    assetIndex.build(sampleAssets);
    const newAsset: Asset = {
      id: 'E-201',
      name: '熱交換器',
      hierarchyPath: {
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
        'ユニット': '原油蒸留ユニット',
      },
      specifications: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    assetIndex.set(newAsset);
    expect(assetIndex.size()).toBe(3);
    expect(assetIndex.has('E-201')).toBe(true);
  });

  test('should update existing asset in index', () => {
    assetIndex.build(sampleAssets);
    const updatedAsset: Asset = {
      ...sampleAssets[0],
      name: '更新されたポンプ',
    };
    assetIndex.set(updatedAsset);
    expect(assetIndex.size()).toBe(2);
    expect(assetIndex.get('P-101')?.name).toBe('更新されたポンプ');
  });

  test('should delete asset from index', () => {
    assetIndex.build(sampleAssets);
    const deleted = assetIndex.delete('P-101');
    expect(deleted).toBe(true);
    expect(assetIndex.size()).toBe(1);
    expect(assetIndex.has('P-101')).toBe(false);
  });

  test('should return all assets', () => {
    assetIndex.build(sampleAssets);
    const allAssets = assetIndex.getAll();
    expect(allAssets).toHaveLength(2);
  });

  test('should clear index', () => {
    assetIndex.build(sampleAssets);
    assetIndex.clear();
    expect(assetIndex.size()).toBe(0);
  });
});

describe('TaskIndex', () => {
  let taskIndex: TaskIndex;
  let sampleTasks: Task[];

  beforeEach(() => {
    taskIndex = new TaskIndex();
    sampleTasks = [
      {
        id: 'task-001',
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-002',
        name: 'オーバーホール',
        description: '設備の全面的な分解点検と修理',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'task-003',
        name: '緊急修理',
        description: '緊急対応が必要な修理',
        classification: '02',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  test('should build index from tasks array', () => {
    taskIndex.build(sampleTasks);
    expect(taskIndex.size()).toBe(3);
    expect(taskIndex.has('task-001')).toBe(true);
  });

  test('should get task by ID with O(1) lookup', () => {
    taskIndex.build(sampleTasks);
    const task = taskIndex.get('task-001');
    expect(task).toBeDefined();
    expect(task?.name).toBe('年次点検');
  });

  test('should get tasks by classification with O(1) lookup', () => {
    taskIndex.build(sampleTasks);
    const tasks01 = taskIndex.getByClassification('01');
    expect(tasks01).toHaveLength(2);
    expect(tasks01.map(t => t.id)).toContain('task-001');
    expect(tasks01.map(t => t.id)).toContain('task-002');

    const tasks02 = taskIndex.getByClassification('02');
    expect(tasks02).toHaveLength(1);
    expect(tasks02[0].id).toBe('task-003');
  });

  test('should return empty array for non-existent classification', () => {
    taskIndex.build(sampleTasks);
    const tasks = taskIndex.getByClassification('99');
    expect(tasks).toEqual([]);
  });

  test('should add new task to index', () => {
    taskIndex.build(sampleTasks);
    const newTask: Task = {
      id: 'task-004',
      name: '改造工事',
      description: '設備改造',
      classification: '03',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    taskIndex.set(newTask);
    expect(taskIndex.size()).toBe(4);
    expect(taskIndex.getByClassification('03')).toHaveLength(1);
  });

  test('should update task classification in index', () => {
    taskIndex.build(sampleTasks);
    const updatedTask: Task = {
      ...sampleTasks[0],
      classification: '02',
    };
    taskIndex.set(updatedTask);
    expect(taskIndex.getByClassification('01')).toHaveLength(1);
    expect(taskIndex.getByClassification('02')).toHaveLength(2);
  });

  test('should delete task from index', () => {
    taskIndex.build(sampleTasks);
    const deleted = taskIndex.delete('task-001');
    expect(deleted).toBe(true);
    expect(taskIndex.size()).toBe(2);
    expect(taskIndex.getByClassification('01')).toHaveLength(1);
  });

  test('should clear index', () => {
    taskIndex.build(sampleTasks);
    taskIndex.clear();
    expect(taskIndex.size()).toBe(0);
    expect(taskIndex.getByClassification('01')).toEqual([]);
  });
});

describe('AssociationIndex', () => {
  let associationIndex: AssociationIndex;
  let sampleAssociations: TaskAssociation[];

  beforeEach(() => {
    associationIndex = new AssociationIndex();
    sampleAssociations = [
      {
        id: 'assoc-001',
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {
          '2024-05': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'assoc-002',
        assetId: 'P-101',
        taskId: 'task-002',
        schedule: {
          '2025-02': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'assoc-003',
        assetId: 'T-4220',
        taskId: 'task-001',
        schedule: {
          '2024-06': {
            planned: true,
            actual: true,
            planCost: 300000,
            actualCost: 320000,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  test('should build index from associations array', () => {
    associationIndex.build(sampleAssociations);
    expect(associationIndex.size()).toBe(3);
    expect(associationIndex.has('assoc-001')).toBe(true);
  });

  test('should get association by ID with O(1) lookup', () => {
    associationIndex.build(sampleAssociations);
    const assoc = associationIndex.get('assoc-001');
    expect(assoc).toBeDefined();
    expect(assoc?.assetId).toBe('P-101');
    expect(assoc?.taskId).toBe('task-001');
  });

  test('should get associations by asset ID with O(1) lookup', () => {
    associationIndex.build(sampleAssociations);
    const assocs = associationIndex.getByAsset('P-101');
    expect(assocs).toHaveLength(2);
    expect(assocs.map(a => a.id)).toContain('assoc-001');
    expect(assocs.map(a => a.id)).toContain('assoc-002');
  });

  test('should get associations by task ID with O(1) lookup', () => {
    associationIndex.build(sampleAssociations);
    const assocs = associationIndex.getByTask('task-001');
    expect(assocs).toHaveLength(2);
    expect(assocs.map(a => a.id)).toContain('assoc-001');
    expect(assocs.map(a => a.id)).toContain('assoc-003');
  });

  test('should return empty array for non-existent asset', () => {
    associationIndex.build(sampleAssociations);
    const assocs = associationIndex.getByAsset('NON-EXISTENT');
    expect(assocs).toEqual([]);
  });

  test('should return empty array for non-existent task', () => {
    associationIndex.build(sampleAssociations);
    const assocs = associationIndex.getByTask('NON-EXISTENT');
    expect(assocs).toEqual([]);
  });

  test('should add new association to index', () => {
    associationIndex.build(sampleAssociations);
    const newAssoc: TaskAssociation = {
      id: 'assoc-004',
      assetId: 'E-201',
      taskId: 'task-003',
      schedule: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    associationIndex.set(newAssoc);
    expect(associationIndex.size()).toBe(4);
    expect(associationIndex.getByAsset('E-201')).toHaveLength(1);
    expect(associationIndex.getByTask('task-003')).toHaveLength(1);
  });

  test('should update association indexes when asset changes', () => {
    associationIndex.build(sampleAssociations);
    const updatedAssoc: TaskAssociation = {
      ...sampleAssociations[0],
      assetId: 'E-201',
    };
    associationIndex.set(updatedAssoc);
    expect(associationIndex.getByAsset('P-101')).toHaveLength(1);
    expect(associationIndex.getByAsset('E-201')).toHaveLength(1);
  });

  test('should delete association from index', () => {
    associationIndex.build(sampleAssociations);
    const deleted = associationIndex.delete('assoc-001');
    expect(deleted).toBe(true);
    expect(associationIndex.size()).toBe(2);
    expect(associationIndex.getByAsset('P-101')).toHaveLength(1);
    expect(associationIndex.getByTask('task-001')).toHaveLength(1);
  });

  test('should clear index', () => {
    associationIndex.build(sampleAssociations);
    associationIndex.clear();
    expect(associationIndex.size()).toBe(0);
    expect(associationIndex.getByAsset('P-101')).toEqual([]);
    expect(associationIndex.getByTask('task-001')).toEqual([]);
  });
});

describe('HierarchyIndex', () => {
  let hierarchyIndex: HierarchyIndex;
  let sampleAssets: Asset[];

  beforeEach(() => {
    hierarchyIndex = new HierarchyIndex();
    sampleAssets = [
      {
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'P-102',
        name: '原油供給ポンプ2',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'T-4220',
        name: '貯蔵タンク',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Cエリア',
          'ユニット': '製品貯蔵エリア',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  test('should build index from assets array', () => {
    hierarchyIndex.build(sampleAssets);
    const assetIds = hierarchyIndex.getAssetIds({
      '製油所': '第一製油所',
    });
    expect(assetIds).toHaveLength(3);
  });

  test('should get assets by full hierarchy path with O(1) lookup', () => {
    hierarchyIndex.build(sampleAssets);
    const assetIds = hierarchyIndex.getAssetIds({
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    });
    expect(assetIds).toHaveLength(2);
    expect(assetIds).toContain('P-101');
    expect(assetIds).toContain('P-102');
  });

  test('should get assets by partial hierarchy path with O(1) lookup', () => {
    hierarchyIndex.build(sampleAssets);
    const assetIds = hierarchyIndex.getAssetIds({
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
    });
    expect(assetIds).toHaveLength(2);
    expect(assetIds).toContain('P-101');
    expect(assetIds).toContain('P-102');
  });

  test('should return empty array for non-existent hierarchy path', () => {
    hierarchyIndex.build(sampleAssets);
    const assetIds = hierarchyIndex.getAssetIds({
      '製油所': '第二製油所',
    });
    expect(assetIds).toEqual([]);
  });

  test('should update asset hierarchy in index', () => {
    hierarchyIndex.build(sampleAssets);
    const oldPath: HierarchyPath = {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    };
    const newPath: HierarchyPath = {
      '製油所': '第一製油所',
      'エリア': 'Bエリア',
      'ユニット': '接触改質ユニット',
    };
    hierarchyIndex.updateAsset('P-101', oldPath, newPath);

    const oldAssets = hierarchyIndex.getAssetIds(oldPath);
    expect(oldAssets).toHaveLength(1);
    expect(oldAssets).not.toContain('P-101');

    const newAssets = hierarchyIndex.getAssetIds(newPath);
    expect(newAssets).toHaveLength(1);
    expect(newAssets).toContain('P-101');
  });

  test('should delete asset from hierarchy index', () => {
    hierarchyIndex.build(sampleAssets);
    const path: HierarchyPath = {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    };
    hierarchyIndex.deleteAsset('P-101', path);

    const assetIds = hierarchyIndex.getAssetIds(path);
    expect(assetIds).toHaveLength(1);
    expect(assetIds).not.toContain('P-101');
  });

  test('should clear index', () => {
    hierarchyIndex.build(sampleAssets);
    hierarchyIndex.clear();
    const assetIds = hierarchyIndex.getAssetIds({
      '製油所': '第一製油所',
    });
    expect(assetIds).toEqual([]);
  });
});

describe('DataIndexManager', () => {
  let indexManager: DataIndexManager;
  let sampleData: {
    assets: Asset[];
    tasks: Task[];
    associations: TaskAssociation[];
  };

  beforeEach(() => {
    indexManager = new DataIndexManager();
    sampleData = {
      assets: [
        {
          id: 'P-101',
          name: '原油供給ポンプ',
          hierarchyPath: {
            '製油所': '第一製油所',
            'エリア': 'Aエリア',
            'ユニット': '原油蒸留ユニット',
          },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: 'task-001',
          name: '年次点検',
          description: '年次定期点検作業',
          classification: '01',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      associations: [
        {
          id: 'assoc-001',
          assetId: 'P-101',
          taskId: 'task-001',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
  });

  test('should build all indexes', () => {
    indexManager.buildAll(sampleData);
    expect(indexManager.assets.size()).toBe(1);
    expect(indexManager.tasks.size()).toBe(1);
    expect(indexManager.associations.size()).toBe(1);
  });

  test('should provide access to all indexes', () => {
    indexManager.buildAll(sampleData);
    expect(indexManager.assets.get('P-101')).toBeDefined();
    expect(indexManager.tasks.get('task-001')).toBeDefined();
    expect(indexManager.associations.get('assoc-001')).toBeDefined();
    expect(indexManager.hierarchy.getAssetIds({ '製油所': '第一製油所' })).toHaveLength(1);
  });

  test('should clear all indexes', () => {
    indexManager.buildAll(sampleData);
    indexManager.clearAll();
    expect(indexManager.assets.size()).toBe(0);
    expect(indexManager.tasks.size()).toBe(0);
    expect(indexManager.associations.size()).toBe(0);
  });

  test('should provide statistics', () => {
    indexManager.buildAll(sampleData);
    const stats = indexManager.getStats();
    expect(stats.assetCount).toBe(1);
    expect(stats.taskCount).toBe(1);
    expect(stats.associationCount).toBe(1);
  });
});

describe('Performance Tests', () => {
  test('should handle large dataset efficiently', () => {
    const indexManager = new DataIndexManager();
    
    // Generate large dataset
    const assets: Asset[] = [];
    const tasks: Task[] = [];
    const associations: TaskAssociation[] = [];

    // Create 1000 assets
    for (let i = 0; i < 1000; i++) {
      assets.push({
        id: `ASSET-${i}`,
        name: `Asset ${i}`,
        hierarchyPath: {
          '製油所': `製油所${Math.floor(i / 100)}`,
          'エリア': `エリア${Math.floor(i / 10)}`,
          'ユニット': `ユニット${i}`,
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create 100 tasks
    for (let i = 0; i < 100; i++) {
      tasks.push({
        id: `TASK-${i}`,
        name: `Task ${i}`,
        description: `Description ${i}`,
        classification: `${(i % 20) + 1}`.padStart(2, '0'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create 5000 associations (5 per asset on average)
    for (let i = 0; i < 5000; i++) {
      associations.push({
        id: `ASSOC-${i}`,
        assetId: `ASSET-${Math.floor(i / 5)}`,
        taskId: `TASK-${i % 100}`,
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Build indexes
    const startTime = performance.now();
    indexManager.buildAll({ assets, tasks, associations });
    const buildTime = performance.now() - startTime;

    // Build should be fast (< 100ms for this dataset)
    expect(buildTime).toBeLessThan(100);

    // Test O(1) lookups
    const lookupStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      indexManager.assets.get(`ASSET-${i}`);
      indexManager.tasks.get(`TASK-${i % 100}`);
      indexManager.associations.getByAsset(`ASSET-${i}`);
    }
    const lookupTime = performance.now() - lookupStart;

    // 1000 lookups should be very fast (< 10ms)
    expect(lookupTime).toBeLessThan(10);
  });
});
