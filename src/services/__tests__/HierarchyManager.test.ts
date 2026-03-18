/**
 * HierarchyManager Unit Tests
 * 
 * Tests for the HierarchyManager service that manages dynamic equipment hierarchy.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import { HierarchyManager } from '../HierarchyManager';
import { AssetManager } from '../AssetManager';
import { HierarchyDefinition } from '../../types/maintenanceTask';

describe('HierarchyManager', () => {
  let hierarchyManager: HierarchyManager;
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager();
    hierarchyManager = new HierarchyManager(assetManager);
  });

  describe('Level Management', () => {
    describe('addHierarchyLevel', () => {
      it('should add a new hierarchy level', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        const hierarchy = hierarchyManager.getHierarchyDefinition();
        expect(hierarchy.levels).toHaveLength(1);
        expect(hierarchy.levels[0].key).toBe('製油所');
        expect(hierarchy.levels[0].order).toBe(1);
        expect(hierarchy.levels[0].values).toEqual([]);
      });

      it('should add multiple levels and sort by order', () => {
        hierarchyManager.addHierarchyLevel('ユニット', 3);
        hierarchyManager.addHierarchyLevel('製油所', 1);
        hierarchyManager.addHierarchyLevel('エリア', 2);
        
        const hierarchy = hierarchyManager.getHierarchyDefinition();
        expect(hierarchy.levels).toHaveLength(3);
        expect(hierarchy.levels[0].key).toBe('製油所');
        expect(hierarchy.levels[1].key).toBe('エリア');
        expect(hierarchy.levels[2].key).toBe('ユニット');
      });

      it('should throw error if level key is empty', () => {
        expect(() => {
          hierarchyManager.addHierarchyLevel('', 1);
        }).toThrow('階層レベルのキーは必須です。');
      });

      it('should throw error if level already exists', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        expect(() => {
          hierarchyManager.addHierarchyLevel('製油所', 2);
        }).toThrow('階層レベル "製油所" は既に存在します。');
      });

      it('should throw error if max levels (10) exceeded', () => {
        // Add 10 levels
        for (let i = 1; i <= 10; i++) {
          hierarchyManager.addHierarchyLevel(`Level${i}`, i);
        }
        
        // Try to add 11th level
        expect(() => {
          hierarchyManager.addHierarchyLevel('Level11', 11);
        }).toThrow('階層レベルの最大数（10）に達しました。');
      });

      it('should throw error if order is less than 1', () => {
        expect(() => {
          hierarchyManager.addHierarchyLevel('製油所', 0);
        }).toThrow('階層レベルの順序は1以上の整数である必要があります。');
      });
    });

    describe('removeHierarchyLevel', () => {
      it('should remove a hierarchy level', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        hierarchyManager.addHierarchyLevel('エリア', 2);
        
        hierarchyManager.removeHierarchyLevel('製油所');
        
        const hierarchy = hierarchyManager.getHierarchyDefinition();
        expect(hierarchy.levels).toHaveLength(1);
        expect(hierarchy.levels[0].key).toBe('エリア');
      });

      it('should remove level from all assets', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        hierarchyManager.addHierarchyLevel('エリア', 2);
        
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
        });
        
        hierarchyManager.removeHierarchyLevel('製油所');
        
        const updatedAsset = assetManager.getAsset('P-101');
        expect(updatedAsset?.hierarchyPath).toEqual({ 'エリア': 'Aエリア' });
      });

      it('should throw error if level not found', () => {
        expect(() => {
          hierarchyManager.removeHierarchyLevel('NonExistent');
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if trying to remove last level', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        expect(() => {
          hierarchyManager.removeHierarchyLevel('製油所');
        }).toThrow('最後の階層レベルは削除できません（最低1レベル必要）。');
      });
    });

    describe('reorderHierarchyLevel', () => {
      it('should reorder a hierarchy level', () => {
        hierarchyManager.addHierarchyLevel('製油所', 2);
        hierarchyManager.addHierarchyLevel('エリア', 3);
        hierarchyManager.addHierarchyLevel('ユニット', 4);
        
        hierarchyManager.reorderHierarchyLevel('ユニット', 1);
        
        const hierarchy = hierarchyManager.getHierarchyDefinition();
        expect(hierarchy.levels[0].key).toBe('ユニット');
        expect(hierarchy.levels[0].order).toBe(1);
        expect(hierarchy.levels[1].key).toBe('製油所');
        expect(hierarchy.levels[2].key).toBe('エリア');
      });

      it('should throw error if level not found', () => {
        expect(() => {
          hierarchyManager.reorderHierarchyLevel('NonExistent', 1);
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if new order is less than 1', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        expect(() => {
          hierarchyManager.reorderHierarchyLevel('製油所', 0);
        }).toThrow('階層レベルの順序は1以上の整数である必要があります。');
      });
    });

    describe('updateHierarchyLevelKey', () => {
      it('should update hierarchy level key', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        hierarchyManager.updateHierarchyLevelKey('製油所', 'Refinery');
        
        const hierarchy = hierarchyManager.getHierarchyDefinition();
        expect(hierarchy.levels[0].key).toBe('Refinery');
      });

      it('should update level key in all assets', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所' },
          specifications: [],
        });
        
        hierarchyManager.updateHierarchyLevelKey('製油所', 'Refinery');
        
        const updatedAsset = assetManager.getAsset('P-101');
        expect(updatedAsset?.hierarchyPath).toEqual({ 'Refinery': '第一製油所' });
      });

      it('should throw error if new key is empty', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        
        expect(() => {
          hierarchyManager.updateHierarchyLevelKey('製油所', '');
        }).toThrow('新しい階層レベルのキーは必須です。');
      });

      it('should throw error if old key not found', () => {
        expect(() => {
          hierarchyManager.updateHierarchyLevelKey('NonExistent', 'NewKey');
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if new key already exists', () => {
        hierarchyManager.addHierarchyLevel('製油所', 1);
        hierarchyManager.addHierarchyLevel('エリア', 2);
        
        expect(() => {
          hierarchyManager.updateHierarchyLevelKey('製油所', 'エリア');
        }).toThrow('階層レベル "エリア" は既に存在します。');
      });
    });
  });

  describe('Value Management', () => {
    beforeEach(() => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
    });

    describe('addHierarchyValue', () => {
      it('should add a value to a hierarchy level', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        const level = hierarchyManager.getHierarchyLevelByKey('製油所');
        expect(level?.values).toContain('第一製油所');
      });

      it('should sort values alphabetically', () => {
        hierarchyManager.addHierarchyValue('製油所', '第二製油所');
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        const level = hierarchyManager.getHierarchyLevelByKey('製油所');
        expect(level?.values).toEqual(['第一製油所', '第二製油所']);
      });

      it('should throw error if value is empty', () => {
        expect(() => {
          hierarchyManager.addHierarchyValue('製油所', '');
        }).toThrow('階層の値は必須です。');
      });

      it('should throw error if level not found', () => {
        expect(() => {
          hierarchyManager.addHierarchyValue('NonExistent', 'Value');
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if value already exists', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        expect(() => {
          hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        }).toThrow('値 "第一製油所" は階層レベル "製油所" に既に存在します。');
      });
    });

    describe('updateHierarchyValue', () => {
      it('should update a hierarchy value', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        hierarchyManager.updateHierarchyValue('製油所', '第一製油所', '第三製油所');
        
        const level = hierarchyManager.getHierarchyLevelByKey('製油所');
        expect(level?.values).toContain('第三製油所');
        expect(level?.values).not.toContain('第一製油所');
      });

      it('should update value in all assets', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所' },
          specifications: [],
        });
        
        hierarchyManager.updateHierarchyValue('製油所', '第一製油所', '第三製油所');
        
        const updatedAsset = assetManager.getAsset('P-101');
        expect(updatedAsset?.hierarchyPath['製油所']).toBe('第三製油所');
      });

      it('should throw error if new value is empty', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        expect(() => {
          hierarchyManager.updateHierarchyValue('製油所', '第一製油所', '');
        }).toThrow('新しい階層の値は必須です。');
      });

      it('should throw error if level not found', () => {
        expect(() => {
          hierarchyManager.updateHierarchyValue('NonExistent', 'Old', 'New');
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if old value not found', () => {
        expect(() => {
          hierarchyManager.updateHierarchyValue('製油所', 'NonExistent', 'New');
        }).toThrow('値 "NonExistent" は階層レベル "製油所" に見つかりません。');
      });

      it('should throw error if new value already exists', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        hierarchyManager.addHierarchyValue('製油所', '第二製油所');
        
        expect(() => {
          hierarchyManager.updateHierarchyValue('製油所', '第一製油所', '第二製油所');
        }).toThrow('値 "第二製油所" は階層レベル "製油所" に既に存在します。');
      });
    });

    describe('deleteHierarchyValue', () => {
      it('should delete a hierarchy value', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        hierarchyManager.deleteHierarchyValue('製油所', '第一製油所');
        
        const level = hierarchyManager.getHierarchyLevelByKey('製油所');
        expect(level?.values).not.toContain('第一製油所');
      });

      it('should throw error if level not found', () => {
        expect(() => {
          hierarchyManager.deleteHierarchyValue('NonExistent', 'Value');
        }).toThrow('階層レベル "NonExistent" が見つかりません。');
      });

      it('should throw error if value not found', () => {
        expect(() => {
          hierarchyManager.deleteHierarchyValue('製油所', 'NonExistent');
        }).toThrow('値 "NonExistent" は階層レベル "製油所" に見つかりません。');
      });

      it('should throw error if value is in use by assets', () => {
        hierarchyManager.addHierarchyValue('製油所', '第一製油所');
        
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所' },
          specifications: [],
        });
        
        expect(() => {
          hierarchyManager.deleteHierarchyValue('製油所', '第一製油所');
        }).toThrow('値 "第一製油所" は 1 個の機器で使用されているため、階層レベル "製油所" から削除できません。');
      });
    });
  });

  describe('Asset Management', () => {
    beforeEach(() => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('製油所', '第二製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');
      hierarchyManager.addHierarchyValue('エリア', 'Bエリア');
    });

    describe('reassignAssetHierarchy', () => {
      it('should reassign asset to new hierarchy path', () => {
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
        });
        
        hierarchyManager.reassignAssetHierarchy('P-101', {
          '製油所': '第二製油所',
          'エリア': 'Bエリア',
        });
        
        const updatedAsset = assetManager.getAsset('P-101');
        expect(updatedAsset?.hierarchyPath).toEqual({
          '製油所': '第二製油所',
          'エリア': 'Bエリア',
        });
      });

      it('should throw error if asset not found', () => {
        expect(() => {
          hierarchyManager.reassignAssetHierarchy('NonExistent', {
            '製油所': '第一製油所',
            'エリア': 'Aエリア',
          });
        }).toThrow('機器 "NonExistent" が見つかりません。');
      });

      it('should throw error if hierarchy path is invalid', () => {
        assetManager.createAsset({
          id: 'P-101',
          name: 'Pump',
          hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
          specifications: [],
        });
        
        expect(() => {
          hierarchyManager.reassignAssetHierarchy('P-101', {
            '製油所': '第一製油所',
            // Missing 'エリア'
          });
        }).toThrow('無効な階層パスです。すべての必須レベルが指定され、有効な値を持っている必要があります。');
      });
    });

    describe('validateHierarchyPath', () => {
      it('should validate a correct hierarchy path', () => {
        const isValid = hierarchyManager.validateHierarchyPath({
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
        });
        
        expect(isValid).toBe(true);
      });

      it('should reject empty hierarchy path', () => {
        const isValid = hierarchyManager.validateHierarchyPath({});
        expect(isValid).toBe(false);
      });

      it('should reject path with missing levels', () => {
        const isValid = hierarchyManager.validateHierarchyPath({
          '製油所': '第一製油所',
          // Missing 'エリア'
        });
        
        expect(isValid).toBe(false);
      });

      it('should reject path with invalid values', () => {
        const isValid = hierarchyManager.validateHierarchyPath({
          '製油所': 'NonExistent',
          'エリア': 'Aエリア',
        });
        
        expect(isValid).toBe(false);
      });

      it('should reject path with extra keys', () => {
        const isValid = hierarchyManager.validateHierarchyPath({
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ExtraKey': 'ExtraValue',
        });
        
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
    });

    it('should get hierarchy level keys', () => {
      const keys = hierarchyManager.getHierarchyLevelKeys();
      expect(keys).toEqual(['製油所', 'エリア']);
    });

    it('should get hierarchy level by key', () => {
      const level = hierarchyManager.getHierarchyLevelByKey('製油所');
      expect(level).not.toBeNull();
      expect(level?.key).toBe('製油所');
      expect(level?.values).toContain('第一製油所');
    });

    it('should return null for non-existent level', () => {
      const level = hierarchyManager.getHierarchyLevelByKey('NonExistent');
      expect(level).toBeNull();
    });

    it('should get hierarchy level count', () => {
      const count = hierarchyManager.getHierarchyLevelCount();
      expect(count).toBe(2);
    });

    it('should check if hierarchy level exists', () => {
      expect(hierarchyManager.hasHierarchyLevel('製油所')).toBe(true);
      expect(hierarchyManager.hasHierarchyLevel('NonExistent')).toBe(false);
    });

    it('should get hierarchy values', () => {
      const values = hierarchyManager.getHierarchyValues('製油所');
      expect(values).toEqual(['第一製油所']);
    });

    it('should return empty array for non-existent level', () => {
      const values = hierarchyManager.getHierarchyValues('NonExistent');
      expect(values).toEqual([]);
    });
  });

  describe('setHierarchyDefinition', () => {
    it('should set entire hierarchy definition', () => {
      const newHierarchy: HierarchyDefinition = {
        levels: [
          { key: '製油所', order: 1, values: ['第一製油所', '第二製油所'] },
          { key: 'エリア', order: 2, values: ['Aエリア', 'Bエリア'] },
        ],
      };
      
      hierarchyManager.setHierarchyDefinition(newHierarchy);
      
      const hierarchy = hierarchyManager.getHierarchyDefinition();
      expect(hierarchy.levels).toHaveLength(2);
      expect(hierarchy.levels[0].key).toBe('製油所');
      expect(hierarchy.levels[1].key).toBe('エリア');
    });

    it('should throw error if hierarchy is invalid', () => {
      expect(() => {
        hierarchyManager.setHierarchyDefinition(null as any);
      }).toThrow('階層定義は有効なオブジェクトである必要があります。');
    });

    it('should throw error if level count is less than 1', () => {
      expect(() => {
        hierarchyManager.setHierarchyDefinition({ levels: [] });
      }).toThrow('階層は1から10レベルの間である必要があります。');
    });

    it('should throw error if level count exceeds 10', () => {
      const levels = Array.from({ length: 11 }, (_, i) => ({
        key: `Level${i + 1}`,
        order: i + 1,
        values: [],
      }));
      
      expect(() => {
        hierarchyManager.setHierarchyDefinition({ levels });
      }).toThrow('階層は1から10レベルの間である必要があります。');
    });

    it('should throw error if level has empty key', () => {
      expect(() => {
        hierarchyManager.setHierarchyDefinition({
          levels: [{ key: '', order: 1, values: [] }],
        });
      }).toThrow('すべての階層レベルにはキーが必要です。');
    });

    it('should throw error if level has duplicate keys', () => {
      expect(() => {
        hierarchyManager.setHierarchyDefinition({
          levels: [
            { key: '製油所', order: 1, values: [] },
            { key: '製油所', order: 2, values: [] },
          ],
        });
      }).toThrow('階層レベルには一意のキーが必要です。');
    });
  });
});
