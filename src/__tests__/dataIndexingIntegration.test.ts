/**
 * Data Indexing Integration Test
 * 
 * Tests that data indexing is properly integrated into search and filtering operations
 * Requirements: 10.1, 10.2, 10.3
 */

import { dataIndexManager } from '../utils/dataIndexing';
import type { Asset, Task, TaskAssociation } from '../types/maintenanceTask';

describe('Data Indexing Integration', () => {
  beforeEach(() => {
    dataIndexManager.clearAll();
  });

  describe('Asset Search with Index', () => {
    it('should find assets by ID using index', () => {
      const assets: Asset[] = [
        {
          id: 'P-101',
          name: '原油供給ポンプ',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'T-4220',
          name: '貯蔵タンク',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Cエリア' },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      dataIndexManager.assets.build(assets);

      // O(1) lookup
      const asset = dataIndexManager.assets.get('P-101');
      expect(asset).toBeDefined();
      expect(asset?.name).toBe('原油供給ポンプ');
    });

    it('should find assets by hierarchy path using index', () => {
      const assets: Asset[] = [
        {
          id: 'P-101',
          name: '原油供給ポンプ',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'P-102',
          name: '原油供給ポンプ2',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'T-4220',
          name: '貯蔵タンク',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Cエリア' },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      dataIndexManager.buildAll({ assets, tasks: [], associations: [] });

      // O(1) lookup by hierarchy path
      const assetIds = dataIndexManager.hierarchy.getAssetIds({
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
      });

      expect(assetIds).toHaveLength(2);
      expect(assetIds).toContain('P-101');
      expect(assetIds).toContain('P-102');
    });
  });

  describe('Task Search with Index', () => {
    it('should find tasks by classification using index', () => {
      const tasks: Task[] = [
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
          description: '緊急時の修理作業',
          classification: '02',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      dataIndexManager.tasks.build(tasks);

      // O(1) lookup by classification
      const classification01Tasks = dataIndexManager.tasks.getByClassification('01');
      expect(classification01Tasks).toHaveLength(2);
      expect(classification01Tasks.map(t => t.id)).toContain('task-001');
      expect(classification01Tasks.map(t => t.id)).toContain('task-002');
    });
  });

  describe('Association Search with Index', () => {
    it('should find associations by asset using index', () => {
      const associations: TaskAssociation[] = [
        {
          id: 'assoc-001',
          assetId: 'P-101',
          taskId: 'task-001',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'assoc-002',
          assetId: 'P-101',
          taskId: 'task-002',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'assoc-003',
          assetId: 'T-4220',
          taskId: 'task-001',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      dataIndexManager.associations.build(associations);

      // O(1) lookup by asset
      const assetAssociations = dataIndexManager.associations.getByAsset('P-101');
      expect(assetAssociations).toHaveLength(2);
      expect(assetAssociations.map(a => a.taskId)).toContain('task-001');
      expect(assetAssociations.map(a => a.taskId)).toContain('task-002');
    });

    it('should find associations by task using index', () => {
      const associations: TaskAssociation[] = [
        {
          id: 'assoc-001',
          assetId: 'P-101',
          taskId: 'task-001',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'assoc-002',
          assetId: 'P-101',
          taskId: 'task-002',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'assoc-003',
          assetId: 'T-4220',
          taskId: 'task-001',
          schedule: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      dataIndexManager.associations.build(associations);

      // O(1) lookup by task
      const taskAssociations = dataIndexManager.associations.getByTask('task-001');
      expect(taskAssociations).toHaveLength(2);
      expect(taskAssociations.map(a => a.assetId)).toContain('P-101');
      expect(taskAssociations.map(a => a.assetId)).toContain('T-4220');
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large datasets efficiently', () => {
      // Create 1000 assets
      const assets: Asset[] = [];
      for (let i = 0; i < 1000; i++) {
        assets.push({
          id: `asset-${i}`,
          name: `Asset ${i}`,
          hierarchyPath: {
            '製油所': i < 500 ? '第一製油所' : '第二製油所',
            'エリア': `エリア${i % 10}`,
          },
          specifications: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const startBuild = performance.now();
      dataIndexManager.buildAll({ assets, tasks: [], associations: [] });
      const buildTime = performance.now() - startBuild;

      // Build should be fast (< 100ms for 1000 assets)
      expect(buildTime).toBeLessThan(100);

      // Lookups should be O(1)
      const startLookup = performance.now();
      for (let i = 0; i < 100; i++) {
        dataIndexManager.assets.get(`asset-${i}`);
      }
      const lookupTime = performance.now() - startLookup;

      // 100 lookups should be very fast (< 10ms)
      expect(lookupTime).toBeLessThan(10);
    });
  });
});
