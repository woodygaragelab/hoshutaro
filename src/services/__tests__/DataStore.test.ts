/**
 * DataStore Unit Tests
 * 
 * Tests for JSON data loading, saving, and validation
 */

import { DataStore, ValidationError } from '../DataStore';
import type { DataModel } from '../../types/maintenanceTask';

describe('DataStore', () => {
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = new DataStore();
  });

  // サンプルの有効なデータモデル
  const validDataModel: DataModel = {
    version: '2.0.0',
    tasks: {
      'task-001': {
        id: 'task-001',
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    },
    assets: {
      'P-101': {
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
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    },
    associations: {
      'assoc-001': {
        id: 'assoc-001',
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {
          '2024-05-15': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    },
    hierarchy: {
      levels: [
        {
          key: '製油所',
          order: 1,
          values: ['第一製油所', '第二製油所'],
        },
        {
          key: 'エリア',
          order: 2,
          values: ['Aエリア', 'Bエリア'],
        },
        {
          key: 'ユニット',
          order: 3,
          values: ['原油蒸留ユニット'],
        },
      ],
    },
    metadata: {
      lastModified: new Date('2024-01-01'),
    },
  };

  describe('loadData', () => {
    it('有効なJSONオブジェクトを読み込める', () => {
      const result = dataStore.loadData(validDataModel);
      
      expect(result.version).toBe('2.0.0');
      expect(result.tasks['task-001']).toBeDefined();
      expect(result.assets['P-101']).toBeDefined();
      expect(result.associations['assoc-001']).toBeDefined();
    });

    it('有効なJSON文字列を読み込める', () => {
      const jsonString = JSON.stringify(validDataModel);
      const result = dataStore.loadData(jsonString);
      
      expect(result.version).toBe('2.0.0');
      expect(result.tasks['task-001']).toBeDefined();
    });

    it('日付文字列をDateオブジェクトに変換する', () => {
      const dataWithStringDates = {
        ...validDataModel,
        tasks: {
          'task-001': {
            ...validDataModel.tasks['task-001'],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      const result = dataStore.loadData(dataWithStringDates);
      
      expect(result.tasks['task-001'].createdAt).toBeInstanceOf(Date);
      expect(result.tasks['task-001'].updatedAt).toBeInstanceOf(Date);
    });

    it('バージョンが無い場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).version;

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('バージョン情報が必要です');
    });

    it('サポートされていないバージョンの場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel, version: '1.0.0' };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('サポートされていないバージョン');
    });

    it('tasksフィールドが無い場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).tasks;

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('tasksフィールドが必要です');
    });

    it('assetsフィールドが無い場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).assets;

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('assetsフィールドが必要です');
    });

    it('associationsフィールドが無い場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).associations;

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('associationsフィールドが必要です');
    });

    it('hierarchyフィールドが無い場合はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).hierarchy;

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('hierarchyフィールドが必要です');
    });
  });

  describe('Task Validation', () => {
    it('作業IDが無い場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        tasks: {
          'task-001': {
            ...validDataModel.tasks['task-001'],
            id: undefined,
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('IDが無効です');
    });

    it('作業IDがキーと一致しない場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        tasks: {
          'task-001': {
            ...validDataModel.tasks['task-001'],
            id: 'task-002',
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('IDがキーと一致しません');
    });

    it('作業名が無い場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        tasks: {
          'task-001': {
            ...validDataModel.tasks['task-001'],
            name: '',
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('名前が必要です');
    });

    it('作業分類が無効な場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        tasks: {
          'task-001': {
            ...validDataModel.tasks['task-001'],
            classification: '21', // 範囲外
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('分類が無効です');
    });
  });

  describe('Asset Validation', () => {
    it('機器IDが無い場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        assets: {
          'P-101': {
            ...validDataModel.assets['P-101'],
            id: undefined,
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('IDが無効です');
    });

    it('機器の階層パスが空の場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        assets: {
          'P-101': {
            ...validDataModel.assets['P-101'],
            hierarchyPath: {},
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('階層パスが空です');
    });
  });

  describe('Association Validation', () => {
    it('存在しない機器を参照する関連付けはエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-001': {
            ...validDataModel.associations['assoc-001'],
            assetId: 'NON-EXISTENT',
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('存在しない機器を参照しています');
    });

    it('存在しない作業を参照する関連付けはエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-001': {
            ...validDataModel.associations['assoc-001'],
            taskId: 'NON-EXISTENT',
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('存在しない作業を参照しています');
    });

    it('スケジュールのplannedが無効な場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-001': {
            ...validDataModel.associations['assoc-001'],
            schedule: {
              '2024-05-15': {
                planned: 'invalid' as any,
                actual: true,
                planCost: 500000,
                actualCost: 480000,
              },
            },
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('plannedが無効です');
    });

    it('スケジュールのコストが負の場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-001': {
            ...validDataModel.associations['assoc-001'],
            schedule: {
              '2024-05-15': {
                planned: true,
                actual: true,
                planCost: -100,
                actualCost: 480000,
              },
            },
          },
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('planCostが無効です');
    });
  });

  describe('Hierarchy Validation', () => {
    it('階層レベルが1未満の場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        hierarchy: {
          levels: [],
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('階層レベル数は1-10の範囲である必要があります');
    });

    it('階層レベルが10を超える場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        hierarchy: {
          levels: Array.from({ length: 11 }, (_, i) => ({
            key: `level-${i}`,
            order: i + 1,
            values: ['value'],
          })),
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('階層レベル数は1-10の範囲である必要があります');
    });

    it('重複した階層レベルキーの場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        hierarchy: {
          levels: [
            { key: '製油所', order: 1, values: ['第一製油所'] },
            { key: '製油所', order: 2, values: ['第二製油所'] },
          ],
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('重複した階層レベルキー');
    });

    it('重複した階層レベル順序の場合はエラーをスロー', () => {
      const invalidData = {
        ...validDataModel,
        hierarchy: {
          levels: [
            { key: '製油所', order: 1, values: ['第一製油所'] },
            { key: 'エリア', order: 1, values: ['Aエリア'] },
          ],
        },
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow('重複した階層レベル順序');
    });
  });

  describe('saveData', () => {
    it('有効なデータをJSON文字列に変換できる', () => {
      const jsonString = dataStore.saveData(validDataModel);
      
      expect(typeof jsonString).toBe('string');
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.version).toBe('2.0.0');
      expect(parsed.tasks['task-001']).toBeDefined();
    });

    it('保存時にlastModifiedを更新する', () => {
      const oldDate = new Date('2020-01-01');
      const dataWithOldDate = {
        ...validDataModel,
        metadata: {
          lastModified: oldDate,
        },
      };

      const jsonString = dataStore.saveData(dataWithOldDate);
      const parsed = JSON.parse(jsonString);
      
      const savedDate = new Date(parsed.metadata.lastModified);
      expect(savedDate.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('無効なデータの保存時はエラーをスロー', () => {
      const invalidData = { ...validDataModel };
      delete (invalidData as any).version;

      expect(() => dataStore.saveData(invalidData)).toThrow(ValidationError);
    });
  });

  describe('getData', () => {
    it('データをロードする前はnullを返す', () => {
      expect(dataStore.getData()).toBeNull();
    });

    it('データをロードした後は保存されたデータを返す', () => {
      dataStore.loadData(validDataModel);
      
      const data = dataStore.getData();
      expect(data).not.toBeNull();
      expect(data?.version).toBe('2.0.0');
    });
  });

  describe('データ整合性チェックの統合', () => {
    it('孤立した関連付けがある場合はエラーをスローする', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-orphan': {
            id: 'assoc-orphan',
            assetId: 'NON_EXISTENT_ASSET',
            taskId: 'NON_EXISTENT_TASK',
            schedule: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      // 基本バリデーションまたは整合性チェックでエラーが発生する
      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow(/存在しない/);
    });

    it('無効な階層パスがある場合はエラーをスローする', () => {
      const invalidData = {
        ...validDataModel,
        assets: {
          'P-102': {
            id: 'P-102',
            name: 'テストポンプ',
            hierarchyPath: {
              '製油所': '第一製油所',
              'エリア': '無効なエリア', // 階層定義に存在しない値
              'ユニット': '原油蒸留ユニット',
            },
            specifications: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        associations: {},
      };

      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow(/データ整合性エラー/);
    });

    it('重複IDがある場合はエラーをスローする', () => {
      const invalidData = {
        ...validDataModel,
        tasks: {
          ...validDataModel.tasks,
          'task-002': {
            id: 'task-001', // 既存のIDと重複
            name: '重複作業',
            description: 'テスト',
            classification: '01',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      // 基本バリデーションまたは整合性チェックでエラーが発生する
      expect(() => dataStore.loadData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.loadData(invalidData)).toThrow(/一致しません|重複/);
    });

    it('保存前にデータ整合性をチェックする', () => {
      const invalidData = {
        ...validDataModel,
        associations: {
          'assoc-orphan': {
            id: 'assoc-orphan',
            assetId: 'NON_EXISTENT_ASSET',
            taskId: 'task-001',
            schedule: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      // 基本バリデーションまたは整合性チェックでエラーが発生する
      expect(() => dataStore.saveData(invalidData)).toThrow(ValidationError);
      expect(() => dataStore.saveData(invalidData)).toThrow(/存在しない/);
    });

    it('警告がある場合でもデータを読み込める', () => {
      // コンソール警告をモック
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const dataWithWarnings = {
        ...validDataModel,
        tasks: {
          ...validDataModel.tasks,
          'task-unused': {
            id: 'task-unused',
            name: '未使用作業',
            description: 'テスト',
            classification: '01',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      };

      const result = dataStore.loadData(dataWithWarnings);
      
      expect(result).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('データ整合性の警告:');

      consoleWarnSpy.mockRestore();
    });

    it('警告がある場合でもデータを保存できる', () => {
      // コンソール警告をモック
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const dataWithWarnings = {
        ...validDataModel,
        version: '1.0.0', // 古いバージョン（警告）
      };

      // まず基本バリデーションを通すためにバージョンを戻す
      const validData = { ...validDataModel };
      
      // 未使用の作業を追加（警告のみ）
      validData.tasks = {
        ...validData.tasks,
        'task-unused': {
          id: 'task-unused',
          name: '未使用作業',
          description: 'テスト',
          classification: '01',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const result = dataStore.saveData(validData);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
