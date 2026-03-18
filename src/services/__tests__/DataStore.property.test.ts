/**
 * DataStore Property-Based Tests
 * 
 * **Feature: maintenance-task-management**
 * 
 * Tests universal properties that should hold across all valid data models:
 * - Property 16: データモデルの分離
 * - Property 17: 参照整合性の検証
 */

import fc from 'fast-check';
import { DataStore, ValidationError } from '../DataStore';
import type { DataModel, Task, Asset, TaskAssociation, HierarchyLevel } from '../../types/maintenanceTask';

describe('DataStore Property-Based Tests', () => {
  // ========================================
  // Generators
  // ========================================

  /**
   * 作業分類ジェネレーター（01-20）
   */
  const classificationArb = fc.integer({ min: 1, max: 20 }).map(n => 
    n.toString().padStart(2, '0')
  );

  /**
   * 作業ジェネレーター
   */
  const taskArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 17 }).filter(s => s.trim().length > 0).map(s => `t-${s}`),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    description: fc.string({ maxLength: 500 }),
    classification: classificationArb,
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

  /**
   * 階層パスジェネレーター（動的階層レベルに対応）
   * 階層レベルの値リストから選択する
   */
  const hierarchyPathArb = (levels: { key: string; values: string[] }[]) => {
    const pathRecord: Record<string, fc.Arbitrary<string>> = {};
    levels.forEach(level => {
      if (level.values.length > 0) {
        pathRecord[level.key] = fc.constantFrom(...level.values);
      }
    });
    return fc.record(pathRecord);
  };

  /**
   * 機器ジェネレーター（階層レベルを受け取る）
   */
  const assetArb = (levels: { key: string; values: string[] }[]) => fc.record({
    id: fc.string({ minLength: 1, maxLength: 17 }).filter(s => s.trim().length > 0).map(s => `a-${s}`),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    hierarchyPath: hierarchyPathArb(levels),
    specifications: fc.array(
      fc.record({
        key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        value: fc.string({ maxLength: 200 }),
        order: fc.integer({ min: 1, max: 100 }),
      }),
      { maxLength: 10 }
    ),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

  /**
   * スケジュールエントリジェネレーター
   * Ensures business rule: if actual=false, then actualCost must be 0
   */
  const scheduleEntryArb = fc.record({
    planned: fc.boolean(),
    actual: fc.boolean(),
    planCost: fc.integer({ min: 0, max: 100000000 }),
    actualCost: fc.integer({ min: 0, max: 100000000 }),
  }).map(entry => ({
    ...entry,
    // Enforce business rule: if actual is false, actualCost must be 0
    actualCost: entry.actual ? entry.actualCost : 0,
    // Similarly, if planned is false, planCost should be 0
    planCost: entry.planned ? entry.planCost : 0,
  }));

  /**
   * 日付キージェネレーター（YYYY-MM-DD形式）
   */
  const dateKeyArb = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // 28日までに制限して無効な日付を避ける
  ).map(([year, month, day]) => 
    `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  );

  /**
   * 関連付けジェネレーター（有効な参照を持つ）
   */
  const associationArb = (assetIds: string[], taskIds: string[]) => {
    if (assetIds.length === 0 || taskIds.length === 0) {
      throw new Error('assetIds and taskIds must not be empty');
    }

    return fc.record({
      id: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0).map(s => `assoc-${s}`),
      assetId: fc.constantFrom(...assetIds),
      taskId: fc.constantFrom(...taskIds),
      schedule: fc.dictionary(
        dateKeyArb,
        scheduleEntryArb,
        { minKeys: 1, maxKeys: 5 }
      ),
      createdAt: fc.date(),
      updatedAt: fc.date(),
    });
  };

  /**
   * 階層レベルジェネレーター
   */
  const hierarchyLevelArb = fc.record({
    key: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    order: fc.integer({ min: 1, max: 10 }),
    values: fc.array(fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
  });

  /**
   * 有効なデータモデルジェネレーター
   */
  const validDataModelArb = fc.tuple(
    fc.array(taskArb, { minLength: 1, maxLength: 10 }),
    fc.integer({ min: 1, max: 10 })
  ).chain(([tasks, hierarchyLevelCount]) => {
    // 作業をマップに変換（IDの重複を排除）
    const tasksMap: { [id: string]: Task } = {};
    tasks.forEach(task => {
      tasksMap[task.id] = task;
    });

    const taskIds = Object.keys(tasksMap);
    
    // IDが空の場合はスキップ
    if (taskIds.length === 0) {
      return fc.constant({
        version: '2.0.0',
        tasks: tasksMap,
        assets: {},
        associations: {},
        hierarchy: {
          levels: [{
            key: 'level-1',
            order: 1,
            values: ['value-1'],
          }],
        },
        metadata: {
          lastModified: new Date(),
        },
      } as DataModel);
    }
    
    // 階層レベルを先に生成
    return fc.array(hierarchyLevelArb, { minLength: hierarchyLevelCount, maxLength: hierarchyLevelCount })
      .map(levels => {
        // 順序を一意にする
        return levels.map((level, index) => ({
          ...level,
          order: index + 1,
          key: `level-${index + 1}`, // キーも一意にする
        }));
      })
      .chain(uniqueLevels => {
        // 階層レベルを使って機器を生成（値リストも渡す）
        return fc.array(assetArb(uniqueLevels), { minLength: 1, maxLength: 10 })
          .chain(assets => {
            const assetsMap: { [id: string]: Asset } = {};
            assets.forEach(asset => {
              assetsMap[asset.id] = asset;
            });

            const assetIds = Object.keys(assetsMap);

            // IDが空の場合はスキップ
            if (assetIds.length === 0) {
              return fc.constant({
                version: '2.0.0',
                tasks: tasksMap,
                assets: assetsMap,
                associations: {},
                hierarchy: {
                  levels: uniqueLevels,
                },
                metadata: {
                  lastModified: new Date(),
                },
              } as DataModel);
            }

            // 関連付けを生成（必ず1つ以上生成）
            return fc.array(
              associationArb(assetIds, taskIds),
              { minLength: 1, maxLength: 20 }
            ).map(associations => {
              // IDの重複を排除
              const associationsMap: { [id: string]: TaskAssociation } = {};
              associations.forEach(assoc => {
                associationsMap[assoc.id] = assoc;
              });

              // 関連付けが空の場合は、少なくとも1つ作成
              if (Object.keys(associationsMap).length === 0) {
                const assocId = `assoc-${Date.now()}`;
                associationsMap[assocId] = {
                  id: assocId,
                  assetId: assetIds[0],
                  taskId: taskIds[0],
                  schedule: {
                    '2025-01-01': {
                      planned: true,
                      actual: false,
                      planCost: 100000,
                      actualCost: 0,
                    },
                  },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }

              // データモデルを返す
              return {
                version: '2.0.0',
                tasks: tasksMap,
                assets: assetsMap,
                associations: associationsMap,
                hierarchy: {
                  levels: uniqueLevels,
                },
                metadata: {
                  lastModified: new Date(),
                },
              } as DataModel;
            });
          });
      });
  });

  // ========================================
  // Property Tests
  // ========================================

  /**
   * **Feature: maintenance-task-management, Property 16: データモデルの分離**
   * 
   * *任意の*データセットに対して、作業、機器、関連付けは別々のエンティティとして保存される
   * **検証: 要件 7.1, 7.2**
   */
  test('Property 16: データモデルの分離', () => {
    fc.assert(
      fc.property(validDataModelArb, (dataModel) => {
        const dataStore = new DataStore();
        
        // データをロード
        const loadedData = dataStore.loadData(dataModel);

        // 作業、機器、関連付けが別々のオブジェクトとして存在することを確認
        expect(loadedData.tasks).toBeDefined();
        expect(loadedData.assets).toBeDefined();
        expect(loadedData.associations).toBeDefined();

        // それぞれが独立したオブジェクトであることを確認
        expect(typeof loadedData.tasks).toBe('object');
        expect(typeof loadedData.assets).toBe('object');
        expect(typeof loadedData.associations).toBe('object');

        // 作業、機器、関連付けが別々のオブジェクトとして存在することを確認
        const taskIds = Object.keys(loadedData.tasks);
        const assetIds = Object.keys(loadedData.assets);
        const associationIds = Object.keys(loadedData.associations);

        // 各エンティティが少なくとも1つ存在することを確認
        expect(taskIds.length).toBeGreaterThan(0);
        expect(assetIds.length).toBeGreaterThan(0);
        expect(associationIds.length).toBeGreaterThan(0);

        // 各エンティティが正しい型であることを確認
        Object.values(loadedData.tasks).forEach(task => {
          expect(task).toHaveProperty('id');
          expect(task).toHaveProperty('name');
          expect(task).toHaveProperty('classification');
          expect(task).not.toHaveProperty('assetId'); // 作業は機器への直接参照を持たない
        });

        Object.values(loadedData.assets).forEach(asset => {
          expect(asset).toHaveProperty('id');
          expect(asset).toHaveProperty('name');
          expect(asset).toHaveProperty('hierarchyPath');
          expect(asset).not.toHaveProperty('taskId'); // 機器は作業への直接参照を持たない
        });

        Object.values(loadedData.associations).forEach(association => {
          expect(association).toHaveProperty('id');
          expect(association).toHaveProperty('assetId');
          expect(association).toHaveProperty('taskId');
          expect(association).toHaveProperty('schedule');
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: maintenance-task-management, Property 17: 参照整合性の検証**
   * 
   * *任意の*データセットに対して、すべての関連付けは有効な作業IDと機器IDを参照する
   * **検証: 要件 7.4**
   */
  test('Property 17: 参照整合性の検証', () => {
    fc.assert(
      fc.property(validDataModelArb, (dataModel) => {
        const dataStore = new DataStore();
        
        // データをロード（バリデーションが実行される）
        const loadedData = dataStore.loadData(dataModel);

        // すべての関連付けが有効な参照を持つことを確認
        const taskIds = new Set(Object.keys(loadedData.tasks));
        const assetIds = new Set(Object.keys(loadedData.assets));

        Object.values(loadedData.associations).forEach(association => {
          // 関連付けが参照する作業IDが存在することを確認
          expect(taskIds.has(association.taskId)).toBe(true);
          
          // 関連付けが参照する機器IDが存在することを確認
          expect(assetIds.has(association.assetId)).toBe(true);

          // 参照先のエンティティが実際に取得できることを確認
          expect(loadedData.tasks[association.taskId]).toBeDefined();
          expect(loadedData.assets[association.assetId]).toBeDefined();
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: maintenance-task-management, Property 17 (反例): 無効な参照の検出**
   * 
   * *任意の*無効な参照を持つデータセットに対して、バリデーションはエラーをスローする
   * **検証: 要件 7.4**
   */
  test('Property 17 (反例): 無効な参照の検出', () => {
    fc.assert(
      fc.property(validDataModelArb, fc.string({ minLength: 1, maxLength: 20 }), (dataModel, invalidId) => {
        // 存在しないIDであることを確認
        fc.pre(!dataModel.tasks[invalidId] && !dataModel.assets[invalidId]);

        const dataStore = new DataStore();

        // 無効な作業IDを参照する関連付けを追加
        const invalidTaskRefData = {
          ...dataModel,
          associations: {
            ...dataModel.associations,
            'invalid-assoc': {
              id: 'invalid-assoc',
              assetId: Object.keys(dataModel.assets)[0],
              taskId: invalidId, // 存在しない作業ID
              schedule: {
                '2024-01-01': {
                  planned: true,
                  actual: false,
                  planCost: 1000,
                  actualCost: 0,
                },
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        };

        // バリデーションエラーがスローされることを確認
        expect(() => dataStore.loadData(invalidTaskRefData)).toThrow(ValidationError);
        expect(() => dataStore.loadData(invalidTaskRefData)).toThrow('存在しない作業を参照しています');

        // 無効な機器IDを参照する関連付けを追加
        const invalidAssetRefData = {
          ...dataModel,
          associations: {
            ...dataModel.associations,
            'invalid-assoc': {
              id: 'invalid-assoc',
              assetId: invalidId, // 存在しない機器ID
              taskId: Object.keys(dataModel.tasks)[0],
              schedule: {
                '2024-01-01': {
                  planned: true,
                  actual: false,
                  planCost: 1000,
                  actualCost: 0,
                },
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        };

        // バリデーションエラーがスローされることを確認
        expect(() => dataStore.loadData(invalidAssetRefData)).toThrow(ValidationError);
        expect(() => dataStore.loadData(invalidAssetRefData)).toThrow('存在しない機器を参照しています');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: maintenance-task-management, Property 16 & 17: ラウンドトリップの一貫性**
   * 
   * *任意の*有効なデータモデルに対して、保存して再ロードした後もデータの分離と参照整合性が保たれる
   * **検証: 要件 7.1, 7.2, 7.4**
   */
  test('Property 16 & 17: ラウンドトリップの一貫性', () => {
    fc.assert(
      fc.property(validDataModelArb, (dataModel) => {
        const dataStore1 = new DataStore();
        const dataStore2 = new DataStore();

        // データをロード
        const loadedData = dataStore1.loadData(dataModel);

        // データを保存
        const savedJson = dataStore1.saveData(loadedData);

        // 保存したデータを再ロード
        const reloadedData = dataStore2.loadData(savedJson);

        // データの分離が保たれていることを確認
        expect(reloadedData.tasks).toBeDefined();
        expect(reloadedData.assets).toBeDefined();
        expect(reloadedData.associations).toBeDefined();

        // 参照整合性が保たれていることを確認
        const taskIds = new Set(Object.keys(reloadedData.tasks));
        const assetIds = new Set(Object.keys(reloadedData.assets));

        Object.values(reloadedData.associations).forEach(association => {
          expect(taskIds.has(association.taskId)).toBe(true);
          expect(assetIds.has(association.assetId)).toBe(true);
        });

        // エンティティ数が保たれていることを確認
        expect(Object.keys(reloadedData.tasks).length).toBe(Object.keys(loadedData.tasks).length);
        expect(Object.keys(reloadedData.assets).length).toBe(Object.keys(loadedData.assets).length);
        expect(Object.keys(reloadedData.associations).length).toBe(Object.keys(loadedData.associations).length);
      }),
      { numRuns: 100 }
    );
  });
});
