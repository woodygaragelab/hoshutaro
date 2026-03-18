/**
 * Unit tests for AssetManager
 * 
 * Tests CRUD operations and hierarchy filtering functionality
 */

import { AssetManager } from '../AssetManager';
import { Specification } from '../../types/maintenanceTask';

describe('AssetManager', () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager();
  });

  describe('createAsset', () => {
    it('should create a new asset with timestamps', () => {
      const assetData = {
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [
          { key: '型式', value: '遠心式', order: 1 },
        ],
      };

      const asset = assetManager.createAsset(assetData);

      expect(asset.id).toBe('P-101');
      expect(asset.name).toBe('原油供給ポンプ');
      expect(asset.hierarchyPath).toEqual(assetData.hierarchyPath);
      expect(asset.specifications).toEqual(assetData.specifications);
      expect(asset.createdAt).toBeInstanceOf(Date);
      expect(asset.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error if asset ID is empty', () => {
      const assetData = {
        id: '',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      };

      expect(() => assetManager.createAsset(assetData)).toThrow('機器IDは必須です。');
    });

    it('should throw error if asset ID already exists', () => {
      const assetData = {
        id: 'P-101',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      };

      assetManager.createAsset(assetData);
      expect(() => assetManager.createAsset(assetData)).toThrow('機器ID P-101 は既に存在します。');
    });

    it('should throw error if asset name is empty', () => {
      const assetData = {
        id: 'P-101',
        name: '',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      };

      expect(() => assetManager.createAsset(assetData)).toThrow('機器名は必須です。');
    });

    it('should throw error if hierarchy path is empty', () => {
      const assetData = {
        id: 'P-101',
        name: 'Test Asset',
        hierarchyPath: {},
        specifications: [],
      };

      expect(() => assetManager.createAsset(assetData)).toThrow('階層パスには少なくとも1つのレベルが必要です。');
    });
  });

  describe('updateAsset', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
        },
        specifications: [],
      });
    });

    it('should update asset name', () => {
      const updated = assetManager.updateAsset('P-101', {
        name: '新しい名前',
      });

      expect(updated.name).toBe('新しい名前');
      expect(updated.id).toBe('P-101');
    });

    it('should update hierarchy path', () => {
      const newHierarchy = {
        '製油所': '第二製油所',
        'エリア': 'Bエリア',
      };

      const updated = assetManager.updateAsset('P-101', {
        hierarchyPath: newHierarchy,
      });

      expect(updated.hierarchyPath).toEqual(newHierarchy);
    });

    it('should update specifications', () => {
      const newSpecs: Specification[] = [
        { key: '型式', value: '遠心式', order: 1 },
        { key: '容量', value: '100m³/h', order: 2 },
      ];

      const updated = assetManager.updateAsset('P-101', {
        specifications: newSpecs,
      });

      expect(updated.specifications).toEqual(newSpecs);
    });

    it('should update updatedAt timestamp', () => {
      const original = assetManager.getAsset('P-101')!;
      const originalUpdatedAt = original.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        const updated = assetManager.updateAsset('P-101', {
          name: '新しい名前',
        });

        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }, 10);
    });

    it('should preserve createdAt timestamp', () => {
      const original = assetManager.getAsset('P-101')!;
      const originalCreatedAt = original.createdAt;

      const updated = assetManager.updateAsset('P-101', {
        name: '新しい名前',
      });

      expect(updated.createdAt).toEqual(originalCreatedAt);
    });

    it('should throw error if asset not found', () => {
      expect(() => assetManager.updateAsset('NONEXISTENT', { name: 'Test' }))
        .toThrow('機器が見つかりません: NONEXISTENT');
    });

    it('should throw error if trying to change ID', () => {
      expect(() => assetManager.updateAsset('P-101', { id: 'P-102' }))
        .toThrow('機器IDは変更できません。');
    });

    it('should throw error if name is empty', () => {
      expect(() => assetManager.updateAsset('P-101', { name: '' }))
        .toThrow('機器名は必須です。');
    });

    it('should throw error if hierarchy path is empty', () => {
      expect(() => assetManager.updateAsset('P-101', { hierarchyPath: {} }))
        .toThrow('階層パスには少なくとも1つのレベルが必要です。');
    });
  });

  describe('deleteAsset', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });
    });

    it('should delete an asset', () => {
      assetManager.deleteAsset('P-101');
      expect(assetManager.getAsset('P-101')).toBeNull();
    });

    it('should throw error if asset not found', () => {
      expect(() => assetManager.deleteAsset('NONEXISTENT'))
        .toThrow('機器が見つかりません: NONEXISTENT');
    });
  });

  describe('getAsset', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });
    });

    it('should return asset if found', () => {
      const asset = assetManager.getAsset('P-101');
      expect(asset).not.toBeNull();
      expect(asset!.id).toBe('P-101');
    });

    it('should return null if asset not found', () => {
      const asset = assetManager.getAsset('NONEXISTENT');
      expect(asset).toBeNull();
    });
  });

  describe('getAllAssets', () => {
    it('should return empty array when no assets', () => {
      expect(assetManager.getAllAssets()).toEqual([]);
    });

    it('should return all assets', () => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Asset 1',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      assetManager.createAsset({
        id: 'P-102',
        name: 'Asset 2',
        hierarchyPath: { '製油所': '第二製油所' },
        specifications: [],
      });

      const assets = assetManager.getAllAssets();
      expect(assets).toHaveLength(2);
      expect(assets.map(a => a.id)).toContain('P-101');
      expect(assets.map(a => a.id)).toContain('P-102');
    });
  });

  describe('getAssetsByHierarchy', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Asset 1',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
      });

      assetManager.createAsset({
        id: 'P-102',
        name: 'Asset 2',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Bエリア',
          'ユニット': '接触改質ユニット',
        },
        specifications: [],
      });

      assetManager.createAsset({
        id: 'T-4220',
        name: 'Asset 3',
        hierarchyPath: {
          '製油所': '第二製油所',
          'エリア': 'Cエリア',
          'ユニット': '製品貯蔵エリア',
        },
        specifications: [],
      });
    });

    it('should return all assets when no hierarchy path provided', () => {
      const assets = assetManager.getAssetsByHierarchy({});
      expect(assets).toHaveLength(3);
    });

    it('should filter by single hierarchy level', () => {
      const assets = assetManager.getAssetsByHierarchy({
        '製油所': '第一製油所',
      });

      expect(assets).toHaveLength(2);
      expect(assets.map(a => a.id)).toContain('P-101');
      expect(assets.map(a => a.id)).toContain('P-102');
    });

    it('should filter by multiple hierarchy levels', () => {
      const assets = assetManager.getAssetsByHierarchy({
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
      });

      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe('P-101');
    });

    it('should return empty array if no matches', () => {
      const assets = assetManager.getAssetsByHierarchy({
        '製油所': '存在しない製油所',
      });

      expect(assets).toEqual([]);
    });

    it('should filter by all hierarchy levels', () => {
      const assets = assetManager.getAssetsByHierarchy({
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
        'ユニット': '原油蒸留ユニット',
      });

      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe('P-101');
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Pump 1',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [],
      });

      assetManager.createAsset({
        id: 'P-102',
        name: 'Pump 2',
        hierarchyPath: { '製油所': '第二製油所', 'エリア': 'Bエリア' },
        specifications: [],
      });
    });

    it('should clear all assets', () => {
      assetManager.clear();
      expect(assetManager.getAllAssets()).toEqual([]);
    });

    it('should return asset count', () => {
      expect(assetManager.getAssetCount()).toBe(2);
    });

    it('should check if asset exists', () => {
      expect(assetManager.hasAsset('P-101')).toBe(true);
      expect(assetManager.hasAsset('NONEXISTENT')).toBe(false);
    });

    it('should get assets by IDs', () => {
      const assets = assetManager.getAssetsByIds(['P-101', 'P-102', 'NONEXISTENT']);
      expect(assets).toHaveLength(2);
      expect(assets.map(a => a.id)).toContain('P-101');
      expect(assets.map(a => a.id)).toContain('P-102');
    });

    it('should search assets by name', () => {
      const assets = assetManager.searchAssetsByName('Pump');
      expect(assets).toHaveLength(2);
    });

    it('should search assets by ID', () => {
      const assets = assetManager.searchAssetsByName('P-101');
      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe('P-101');
    });

    it('should return all assets for empty search term', () => {
      const assets = assetManager.searchAssetsByName('');
      expect(assets).toHaveLength(2);
    });

    it('should get unique hierarchy values', () => {
      const values = assetManager.getUniqueHierarchyValues('製油所');
      expect(values).toEqual(['第一製油所', '第二製油所']);
    });

    it('should get all hierarchy level keys', () => {
      const keys = assetManager.getAllHierarchyLevelKeys();
      expect(keys).toContain('製油所');
      expect(keys).toContain('エリア');
    });
  });

  describe('specification management', () => {
    beforeEach(() => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: '型式', value: '遠心式', order: 1 },
        ],
      });
    });

    it('should update specifications', () => {
      const newSpecs: Specification[] = [
        { key: '型式', value: '往復式', order: 1 },
        { key: '容量', value: '100m³/h', order: 2 },
      ];

      const updated = assetManager.updateSpecifications('P-101', newSpecs);
      expect(updated.specifications).toEqual(newSpecs);
    });

    it('should add specification', () => {
      const updated = assetManager.addSpecification('P-101', {
        key: '容量',
        value: '100m³/h',
      });

      expect(updated.specifications).toHaveLength(2);
      expect(updated.specifications[1].key).toBe('容量');
      expect(updated.specifications[1].order).toBe(2);
    });

    it('should remove specification', () => {
      assetManager.addSpecification('P-101', {
        key: '容量',
        value: '100m³/h',
      });

      const updated = assetManager.removeSpecification('P-101', '容量');
      expect(updated.specifications).toHaveLength(1);
      expect(updated.specifications[0].key).toBe('型式');
    });
  });

  describe('bulk operations', () => {
    it('should bulk create assets', () => {
      const assetsData = [
        {
          id: 'P-101',
          name: 'Asset 1',
          hierarchyPath: { '製油所': '第一製油所' },
          specifications: [],
        },
        {
          id: 'P-102',
          name: 'Asset 2',
          hierarchyPath: { '製油所': '第二製油所' },
          specifications: [],
        },
      ];

      const created = assetManager.bulkCreateAssets(assetsData);
      expect(created).toHaveLength(2);
      expect(assetManager.getAssetCount()).toBe(2);
    });

    it('should handle errors in bulk create gracefully', () => {
      const assetsData = [
        {
          id: 'P-101',
          name: 'Asset 1',
          hierarchyPath: { '製油所': '第一製油所' },
          specifications: [],
        },
        {
          id: '', // Invalid ID
          name: 'Asset 2',
          hierarchyPath: { '製油所': '第二製油所' },
          specifications: [],
        },
      ];

      const created = assetManager.bulkCreateAssets(assetsData);
      expect(created).toHaveLength(1);
      expect(created[0].id).toBe('P-101');
    });
  });
});
