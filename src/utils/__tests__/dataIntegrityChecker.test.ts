/**
 * データ整合性チェッカーのテスト
 */

import { DataIntegrityChecker } from '../dataIntegrityChecker';
import {
  DataModel,
  Task,
  Asset,
  TaskAssociation,
  HierarchyDefinition,
} from '../../types/maintenanceTask';

describe('DataIntegrityChecker', () => {
  let checker: DataIntegrityChecker;

  beforeEach(() => {
    checker = new DataIntegrityChecker();
  });

  // テスト用の有効なデータモデルを作成
  const createValidDataModel = (): DataModel => {
    const tasks: { [id: string]: Task } = {
      'task-001': {
        id: 'task-001',
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      'task-002': {
        id: 'task-002',
        name: 'オーバーホール',
        description: '設備の全面的な分解点検と修理',
        classification: '02',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    };

    const assets: { [id: string]: Asset } = {
      'P-101': {
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [{ key: '型式', value: '遠心式', order: 1 }],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      'T-4220': {
        id: 'T-4220',
        name: '貯蔵タンク',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Cエリア',
          'ユニット': '製品貯蔵エリア',
        },
        specifications: [{ key: '型式', value: '浮き屋根式', order: 1 }],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    };

    const associations: { [id: string]: TaskAssociation } = {
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
        updatedAt: new Date('2024-05-15'),
      },
      'assoc-002': {
        id: 'assoc-002',
        assetId: 'T-4220',
        taskId: 'task-002',
        schedule: {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-02-01'),
      },
    };

    const hierarchy: HierarchyDefinition = {
      levels: [
        {
          key: '製油所',
          order: 1,
          values: ['第一製油所', '第二製油所'],
        },
        {
          key: 'エリア',
          order: 2,
          values: ['Aエリア', 'Bエリア', 'Cエリア'],
        },
        {
          key: 'ユニット',
          order: 3,
          values: ['原油蒸留ユニット', '接触改質ユニット', '製品貯蔵エリア'],
        },
      ],
    };

    return {
      version: '2.0.0',
      tasks,
      assets,
      associations,
      hierarchy,
      metadata: {
        lastModified: new Date('2024-05-15'),
      },
    };
  };

  describe('checkDataModel', () => {
    it('有効なデータモデルに対してエラーを返さない', () => {
      const dataModel = createValidDataModel();
      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalTasks).toBe(2);
      expect(result.summary.totalAssets).toBe(2);
      expect(result.summary.totalAssociations).toBe(2);
    });

    it('複数のエラーを同時に検出できる', () => {
      const dataModel = createValidDataModel();
      
      // 孤立した関連付けを追加
      dataModel.associations['assoc-003'] = {
        id: 'assoc-003',
        assetId: 'INVALID-ASSET',
        taskId: 'INVALID-TASK',
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 重複IDを追加
      dataModel.tasks['task-003'] = {
        ...dataModel.tasks['task-001'],
        id: 'task-001', // 重複ID
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.summary.orphanedAssociations).toBeGreaterThan(0);
      expect(result.summary.duplicateIds).toBeGreaterThan(0);
    });
  });

  describe('孤立した関連付けのチェック', () => {
    it('存在しない作業を参照する関連付けを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.associations['assoc-orphan'] = {
        id: 'assoc-orphan',
        assetId: 'P-101',
        taskId: 'NON_EXISTENT_TASK',
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.orphanedAssociations).toBe(1);
      
      const orphanedError = result.errors.find(
        e => e.type === 'ORPHANED_ASSOCIATION' && e.details?.taskId === 'NON_EXISTENT_TASK'
      );
      expect(orphanedError).toBeDefined();
      expect(orphanedError?.message).toContain('NON_EXISTENT_TASK');
    });

    it('存在しない機器を参照する関連付けを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.associations['assoc-orphan'] = {
        id: 'assoc-orphan',
        assetId: 'NON_EXISTENT_ASSET',
        taskId: 'task-001',
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.orphanedAssociations).toBe(1);
      
      const orphanedError = result.errors.find(
        e => e.type === 'ORPHANED_ASSOCIATION' && e.details?.assetId === 'NON_EXISTENT_ASSET'
      );
      expect(orphanedError).toBeDefined();
      expect(orphanedError?.message).toContain('NON_EXISTENT_ASSET');
    });

    it('作業と機器の両方が存在しない関連付けを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.associations['assoc-orphan'] = {
        id: 'assoc-orphan',
        assetId: 'NON_EXISTENT_ASSET',
        taskId: 'NON_EXISTENT_TASK',
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.orphanedAssociations).toBe(2); // 作業と機器で2つのエラー
    });
  });

  describe('無効な参照のチェック', () => {
    it('無効な作業IDを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.tasks['task-invalid'] = {
        id: '', // 無効なID
        name: 'テスト作業',
        description: 'テスト',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidReferences).toBeGreaterThan(0);
    });

    it('無効な機器IDを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['asset-invalid'] = {
        id: null as any, // 無効なID
        name: 'テスト機器',
        hierarchyPath: {},
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidReferences).toBeGreaterThan(0);
    });

    it('無効な関連付けスケジュールを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.associations['assoc-invalid'] = {
        id: 'assoc-invalid',
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: null as any, // 無効なスケジュール
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidReferences).toBeGreaterThan(0);
    });
  });

  describe('重複IDのチェック', () => {
    it('重複する作業IDを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.tasks['task-003'] = {
        id: 'task-001', // 既存のIDと重複
        name: '重複作業',
        description: 'テスト',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.duplicateIds).toBeGreaterThan(0);
      
      const duplicateError = result.errors.find(
        e => e.type === 'DUPLICATE_ID' && e.details?.duplicateId === 'task-001'
      );
      expect(duplicateError).toBeDefined();
    });

    it('重複する機器IDを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['E-201'] = {
        id: 'P-101', // 既存のIDと重複
        name: '重複機器',
        hierarchyPath: {},
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.duplicateIds).toBeGreaterThan(0);
    });

    it('キーとIDの不一致を検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.tasks['task-mismatch'] = {
        id: 'task-different', // キーと異なるID
        name: 'テスト作業',
        description: 'テスト',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.duplicateIds).toBeGreaterThan(0);
      
      const mismatchError = result.errors.find(
        e => e.type === 'DUPLICATE_ID' && e.message.includes('一致しません')
      );
      expect(mismatchError).toBeDefined();
    });
  });

  describe('無効な階層パスのチェック', () => {
    it('存在しないレベルキーを検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['P-102'] = {
        id: 'P-102',
        name: 'テストポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          '無効なレベル': '無効な値', // 存在しないレベルキー
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidHierarchyPaths).toBeGreaterThan(0);
      
      const invalidLevelError = result.errors.find(
        e => e.type === 'INVALID_HIERARCHY_PATH' && e.message.includes('無効なレベルキー')
      );
      expect(invalidLevelError).toBeDefined();
    });

    it('存在しないレベル値を検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['P-102'] = {
        id: 'P-102',
        name: 'テストポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': '無効なエリア', // 存在しない値
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidHierarchyPaths).toBeGreaterThan(0);
      
      const invalidValueError = result.errors.find(
        e => e.type === 'INVALID_HIERARCHY_PATH' && e.message.includes('無効な値')
      );
      expect(invalidValueError).toBeDefined();
    });

    it('必須レベルの欠落を検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['P-102'] = {
        id: 'P-102',
        name: 'テストポンプ',
        hierarchyPath: {
          '製油所': '第一製油所',
          // 'エリア'と'ユニット'が欠落
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidHierarchyPaths).toBeGreaterThan(0);
      
      const missingLevelErrors = result.errors.filter(
        e => e.type === 'INVALID_HIERARCHY_PATH' && e.message.includes('含まれていません')
      );
      expect(missingLevelErrors.length).toBeGreaterThan(0);
    });

    it('階層パスが存在しない場合を検出する', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['P-102'] = {
        id: 'P-102',
        name: 'テストポンプ',
        hierarchyPath: null as any, // 階層パスが存在しない
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(false);
      expect(result.summary.invalidHierarchyPaths).toBeGreaterThan(0);
    });
  });

  describe('データ一貫性のチェック（警告）', () => {
    it('関連付けのない作業に対して警告を出す', () => {
      const dataModel = createValidDataModel();
      dataModel.tasks['task-unused'] = {
        id: 'task-unused',
        name: '未使用作業',
        description: 'テスト',
        classification: '01',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(true); // 警告のみなので有効
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const unusedTaskWarning = result.warnings.find(
        w => w.type === 'MISSING_DATA' && w.entityId === 'task-unused'
      );
      expect(unusedTaskWarning).toBeDefined();
    });

    it('関連付けのない機器に対して警告を出す', () => {
      const dataModel = createValidDataModel();
      dataModel.assets['E-201'] = {
        id: 'E-201',
        name: '未使用機器',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(true); // 警告のみなので有効
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const unusedAssetWarning = result.warnings.find(
        w => w.type === 'MISSING_DATA' && w.entityId === 'E-201'
      );
      expect(unusedAssetWarning).toBeDefined();
    });

    it('古いデータモデルバージョンに対して警告を出す', () => {
      const dataModel = createValidDataModel();
      dataModel.version = '1.0.0'; // 古いバージョン

      const result = checker.checkDataModel(dataModel);

      expect(result.isValid).toBe(true); // 警告のみなので有効
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const versionWarning = result.warnings.find(
        w => w.type === 'DEPRECATED_FORMAT'
      );
      expect(versionWarning).toBeDefined();
    });
  });

  describe('formatCheckResult', () => {
    it('チェック結果を読みやすい形式でフォーマットする', () => {
      const dataModel = createValidDataModel();
      const result = checker.checkDataModel(dataModel);
      const formatted = checker.formatCheckResult(result);

      expect(formatted).toContain('データ整合性チェック結果');
      expect(formatted).toContain('ステータス');
      expect(formatted).toContain('サマリー');
      expect(formatted).toContain('作業数: 2');
      expect(formatted).toContain('機器数: 2');
      expect(formatted).toContain('関連付け数: 2');
    });

    it('エラーがある場合はエラーセクションを含む', () => {
      const dataModel = createValidDataModel();
      dataModel.associations['assoc-orphan'] = {
        id: 'assoc-orphan',
        assetId: 'INVALID',
        taskId: 'INVALID',
        schedule: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = checker.checkDataModel(dataModel);
      const formatted = checker.formatCheckResult(result);

      expect(formatted).toContain('エラー');
      expect(formatted).toContain('ORPHANED_ASSOCIATION');
    });

    it('警告がある場合は警告セクションを含む', () => {
      const dataModel = createValidDataModel();
      dataModel.version = '1.0.0';

      const result = checker.checkDataModel(dataModel);
      const formatted = checker.formatCheckResult(result);

      expect(formatted).toContain('警告');
      expect(formatted).toContain('DEPRECATED_FORMAT');
    });
  });
});
