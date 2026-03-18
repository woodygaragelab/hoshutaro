/**
 * ViewModeManager Unit Tests
 * 
 * Tests for view mode switching, data transformation, filtering, and time scale aggregation
 */

import { ViewModeManager } from '../ViewModeManager';
import {
  Task,
  Asset,
  WorkOrder,
  WorkOrderLine,
  WorkOrderSchedule,
  HierarchyDefinition,
} from '../../types/maintenanceTask';

describe('ViewModeManager', () => {
  let viewModeManager: ViewModeManager;
  let tasks: Task[];
  let assets: Asset[];
  let workOrders: WorkOrder[];
  let workOrderLines: WorkOrderLine[];
  let hierarchy: HierarchyDefinition;

  beforeEach(() => {
    // サンプルデータの準備
    tasks = [
      {
        id: 'task-001',
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'task-002',
        name: 'オーバーホール',
        description: '設備の全面的な分解点検と修理',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'task-003',
        name: '緊急修理',
        description: '緊急時の修理作業',
        classification: '02',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    assets = [
      {
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
      {
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
    ];

    workOrders = [
      {
        id: 'wo-001',
        name: '年次点検パッケージ',
        taskClassificationId: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'wo-002',
        name: 'オーバーホールパッケージ',
        taskClassificationId: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    workOrderLines = [
      {
        id: 'line-001',
        workOrderId: 'wo-001',
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {
          '2024-05-15': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
          '2025-05-20': {
            planned: true,
            actual: false,
            planCost: 520000,
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-05-15'),
      },
      {
        id: 'line-002',
        workOrderId: 'wo-002',
        assetId: 'T-4220',
        taskId: 'task-002',
        schedule: {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-02-01'),
      },
      {
        id: 'line-003',
        workOrderId: 'wo-002',
        assetId: 'P-101',
        taskId: 'task-002',
        schedule: {
          '2025-03-15': {
            planned: true,
            actual: false,
            planCost: 800000,
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    hierarchy = {
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

    viewModeManager = new ViewModeManager(tasks, assets, workOrderLines, hierarchy, workOrders);
  });

  describe('getCurrentMode', () => {
    it('初期モードは機器ベースである', () => {
      expect(viewModeManager.getCurrentMode()).toBe('equipment-based');
    });
  });

  describe('switchMode', () => {
    it('表示モードを切り替えられる', () => {
      viewModeManager.switchMode('task-based');
      expect(viewModeManager.getCurrentMode()).toBe('task-based');

      viewModeManager.switchMode('equipment-based');
      expect(viewModeManager.getCurrentMode()).toBe('equipment-based');
    });

    it('preserveState=trueの場合、フィルターが保持される', () => {
      viewModeManager.applyFilters({
        hierarchyPath: { '製油所': '第一製油所' },
      });

      viewModeManager.switchMode('task-based', true);

      const state = viewModeManager.getCurrentState();
      expect(state.filters.hierarchyPath).toEqual({ '製油所': '第一製油所' });
    });

    it('preserveState=falseの場合、フィルターがリセットされる', () => {
      viewModeManager.applyFilters({
        hierarchyPath: { '製油所': '第一製油所' },
      });

      viewModeManager.switchMode('task-based', false);

      const state = viewModeManager.getCurrentState();
      expect(state.filters.hierarchyPath).toBeUndefined();
    });
  });

  describe('applyFilters', () => {
    it('フィルターを適用できる', () => {
      viewModeManager.applyFilters({
        hierarchyPath: { '製油所': '第一製油所' },
        taskClassification: '01',
      });

      const state = viewModeManager.getCurrentState();
      expect(state.filters.hierarchyPath).toEqual({ '製油所': '第一製油所' });
      expect(state.filters.taskClassification).toBe('01');
    });

    it('既存のフィルターに追加される', () => {
      viewModeManager.applyFilters({
        hierarchyPath: { '製油所': '第一製油所' },
      });

      viewModeManager.applyFilters({
        taskClassification: '01',
      });

      const state = viewModeManager.getCurrentState();
      expect(state.filters.hierarchyPath).toEqual({ '製油所': '第一製油所' });
      expect(state.filters.taskClassification).toBe('01');
    });
  });

  describe('getEquipmentBasedData', () => {
    it('機器ベースの行データを生成する', () => {
      const rows = viewModeManager.getEquipmentBasedData();

      // 階層ヘッダーと機器行が含まれる
      expect(rows.length).toBeGreaterThan(0);

      // 機器行を確認
      const assetRows = rows.filter(row => row.type === 'asset');
      expect(assetRows.length).toBe(2);

      // P-101の行を確認
      const p101Row = assetRows.find(row => row.assetId === 'P-101');
      expect(p101Row).toBeDefined();
      expect(p101Row!.assetName).toContain('原油供給ポンプ');
      expect(p101Row!.tasks).toHaveLength(2); // 2つの作業が関連付けられている
    });

    it('階層構造が正しく構築される', () => {
      const rows = viewModeManager.getEquipmentBasedData();

      // 階層ヘッダー行を確認
      const hierarchyRows = rows.filter(row => row.type === 'hierarchy');
      expect(hierarchyRows.length).toBeGreaterThan(0);

      // 製油所レベルの行を確認
      const plantRow = hierarchyRows.find(
        row => row.hierarchyKey === '製油所' && row.hierarchyValue === '第一製油所'
      );
      expect(plantRow).toBeDefined();
      expect(plantRow!.level).toBe(0);
    });

    it('フィルターが適用される', () => {
      viewModeManager.applyFilters({
        hierarchyPath: { 'エリア': 'Aエリア' },
      });

      const rows = viewModeManager.getEquipmentBasedData();
      const assetRows = rows.filter(row => row.type === 'asset');

      // Aエリアの機器のみが含まれる
      expect(assetRows.length).toBe(1);
      expect(assetRows[0].assetId).toBe('P-101');
    });
  });

  describe('getTaskBasedData', () => {
    it('作業ベースの行データを生成する', () => {
      const rows = viewModeManager.getTaskBasedData();

      // 階層、機器、作業の行が含まれる
      expect(rows.length).toBeGreaterThan(0);

      // 階層行を確認
      const hierarchyRows = rows.filter(row => row.type === 'hierarchy');
      expect(hierarchyRows.length).toBeGreaterThan(0);

      // 機器行を確認
      const assetRows = rows.filter(row => row.type === 'asset');
      expect(assetRows.length).toBe(2); // P-101とE-201

      // 作業行を確認
      const taskRows = rows.filter(row => row.type === 'workOrderLine');
      expect(taskRows.length).toBe(3); // 3つの関連付け
    });

    it('階層レベルが正しく設定される', () => {
      const rows = viewModeManager.getTaskBasedData();

      // 階層行のレベルを確認
      const hierarchyRow = rows.find(row => row.type === 'hierarchy');
      expect(hierarchyRow).toBeDefined();
      expect(hierarchyRow!.level).toBe(0);

      // 機器行のレベルは0（実装仕様）
      const assetRow = rows.find(row => row.type === 'asset');
      expect(assetRow).toBeDefined();
      expect(assetRow!.level).toBe(0);

      // 作業行のレベルは1（実装仕様）
      const taskRow = rows.find(row => row.type === 'workOrderLine');
      expect(taskRow).toBeDefined();
      expect(taskRow!.level).toBe(1);
    });

    it('フィルターが適用される', () => {
      viewModeManager.applyFilters({
        taskClassification: '01',
      });

      const rows = viewModeManager.getTaskBasedData();

      // 分類01の作業のみが含まれる
      const taskRows = rows.filter(row => row.type === 'workOrderLine');
      expect(taskRows.length).toBeGreaterThan(0);
      taskRows.forEach(row => {
        expect(row.classification).toBe('01');
      });
    });
  });

  describe('aggregateScheduleByTimeScale', () => {
    let schedule: WorkOrderSchedule;

    beforeEach(() => {
      schedule = {
        '2025-02-01': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-02-15': {
          planned: true,
          actual: false,
          planCost: 500000,
          actualCost: 0,
        },
        '2025-11-30': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
      };
    });

    it('日単位で集約する（集約なし）', () => {
      const aggregated = viewModeManager.aggregateScheduleByTimeScale(schedule, 'day');

      expect(Object.keys(aggregated)).toHaveLength(3);
      expect(aggregated['2025-02-01']).toBeDefined();
      expect(aggregated['2025-02-15']).toBeDefined();
      expect(aggregated['2025-11-30']).toBeDefined();
    });

    it('月単位で集約する', () => {
      const aggregated = viewModeManager.aggregateScheduleByTimeScale(schedule, 'month');

      expect(Object.keys(aggregated)).toHaveLength(2);

      // 2025-02の集約
      expect(aggregated['2025-02']).toBeDefined();
      expect(aggregated['2025-02'].planned).toBe(true);
      expect(aggregated['2025-02'].actual).toBe(true); // 1つでもtrueならtrue
      expect(aggregated['2025-02'].totalPlanCost).toBe(1500000);
      expect(aggregated['2025-02'].totalActualCost).toBe(950000);
      expect(aggregated['2025-02'].count).toBe(2);

      // 2025-11の集約
      expect(aggregated['2025-11']).toBeDefined();
      expect(aggregated['2025-11'].planned).toBe(true);
      expect(aggregated['2025-11'].actual).toBe(false);
      expect(aggregated['2025-11'].totalPlanCost).toBe(1000000);
      expect(aggregated['2025-11'].count).toBe(1);
    });

    it('年単位で集約する', () => {
      const aggregated = viewModeManager.aggregateScheduleByTimeScale(schedule, 'year');

      expect(Object.keys(aggregated)).toHaveLength(1);

      // 2025の集約
      expect(aggregated['2025']).toBeDefined();
      expect(aggregated['2025'].planned).toBe(true);
      expect(aggregated['2025'].actual).toBe(true); // 1つでもtrueならtrue
      expect(aggregated['2025'].totalPlanCost).toBe(2500000);
      expect(aggregated['2025'].totalActualCost).toBe(950000);
      expect(aggregated['2025'].count).toBe(3);
    });

    it('OR演算が正しく動作する', () => {
      const testSchedule: WorkOrderSchedule = {
        '2025-01-01': {
          planned: false,
          actual: true,
          planCost: 0,
          actualCost: 100000,
        },
        '2025-01-15': {
          planned: true,
          actual: false,
          planCost: 200000,
          actualCost: 0,
        },
      };

      const aggregated = viewModeManager.aggregateScheduleByTimeScale(testSchedule, 'month');

      // 両方のフラグがtrueになる
      expect(aggregated['2025-01'].planned).toBe(true);
      expect(aggregated['2025-01'].actual).toBe(true);
    });
  });

  describe('getDisplaySymbol', () => {
    it('計画あり・実績ありの場合、◎を返す', () => {
      const status = {
        planned: true,
        actual: true,
        totalPlanCost: 1000000,
        totalActualCost: 950000,
        count: 1,
      };

      expect(viewModeManager.getDisplaySymbol(status)).toBe('◎');
    });

    it('計画あり・実績なしの場合、○を返す', () => {
      const status = {
        planned: true,
        actual: false,
        totalPlanCost: 1000000,
        totalActualCost: 0,
        count: 1,
      };

      expect(viewModeManager.getDisplaySymbol(status)).toBe('○');
    });

    it('計画なし・実績ありの場合、●を返す', () => {
      const status = {
        planned: false,
        actual: true,
        totalPlanCost: 0,
        totalActualCost: 950000,
        count: 1,
      };

      expect(viewModeManager.getDisplaySymbol(status)).toBe('●');
    });

    it('計画なし・実績なしの場合、空文字を返す', () => {
      const status = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0,
      };

      expect(viewModeManager.getDisplaySymbol(status)).toBe('');
    });
  });

  describe('updateData', () => {
    it('データを更新できる', () => {
      const newTask: Task = {
        id: 'task-004',
        name: '新しい作業',
        description: '新しい作業の説明',
        classification: '03',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      viewModeManager.updateData([...tasks, newTask], assets, workOrderLines, hierarchy, workOrders);

      const rows = viewModeManager.getTaskBasedData();
      const taskRows = rows.filter(row => row.type === 'workOrderLine');

      // Task rows only appear for associations, so still 3 (no association for newTask)
      expect(taskRows.length).toBe(3);
    });
  });

  describe('日付範囲フィルター', () => {
    it('日付範囲内の機器のみを表示する', () => {
      viewModeManager.applyFilters({
        dateRange: { start: '2025-01-01', end: '2025-06-30' },
      });

      const rows = viewModeManager.getEquipmentBasedData();
      const assetRows = rows.filter(row => row.type === 'asset');

      // 2025年前半に作業がある機器のみ
      expect(assetRows.length).toBe(2);
    });

    it('日付範囲外の機器は除外される', () => {
      viewModeManager.applyFilters({
        dateRange: { start: '2026-01-01', end: '2026-12-31' },
      });

      const rows = viewModeManager.getEquipmentBasedData();
      const assetRows = rows.filter(row => row.type === 'asset');

      // 2026年に作業がある機器はない
      expect(assetRows.length).toBe(0);
    });
  });

  describe('getEditContext', () => {
    it('機器ベースモードの場合、single-assetスコープを返す', () => {
      viewModeManager.switchMode('equipment-based');
      const context = viewModeManager.getEditContext();

      expect(context.viewMode).toBe('equipment-based');
      expect(context.editScope).toBe('single-asset');
    });

    it('作業ベースモードの場合、all-assetsスコープを返す', () => {
      viewModeManager.switchMode('task-based');
      const context = viewModeManager.getEditContext();

      expect(context.viewMode).toBe('task-based');
      expect(context.editScope).toBe('all-assets');
    });
  });
});
