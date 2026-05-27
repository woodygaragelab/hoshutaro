import { ViewModeManager } from '../ViewModeManager';
import type {
  Asset,
  WorkOrder,
  WorkOrderLine,
  HierarchyDefinition,
  AggregatedStatus,
} from '../../types/maintenanceTask';

// ----------------- Fixtures -----------------

const makeAsset = (id: string, overrides: Partial<Asset> = {}): Asset => ({
  id,
  name: `Asset ${id}`,
  hierarchyPath: { plant: 'P1', area: 'A1' },
  classificationPath: {},
  specifications: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const makeWorkOrder = (id: string, overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  id,
  name: `WO ${id}`,
  ClassificationId: 'cls-1',
  CreatedAt: new Date('2024-01-01'),
  UpdatedAt: new Date('2024-01-01'),
  ...overrides,
});

const makeLine = (id: string, woId: string, assetId: string, overrides: Partial<WorkOrderLine> = {}): WorkOrderLine => ({
  id,
  name: `Line ${id}`,
  WorkOrderId: woId,
  AssetId: assetId,
  PlanScheduleStart: new Date('2024-04-01'),
  PlanScheduleEnd: new Date('2024-04-02'),
  ActualScheduleStart: new Date('2024-04-01'),
  ActualScheduleEnd: new Date('2024-04-02'),
  Planned: true,
  Actual: false,
  PlanCost: 1000,
  ActualCost: 0,
  CreatedAt: new Date('2024-01-01'),
  UpdatedAt: new Date('2024-01-01'),
  ...overrides,
});

const twoLevelHierarchy = (): HierarchyDefinition => ({
  levels: [
    { key: 'plant', values: [{ value: 'P1' }, { value: 'P2' }], order: 1 },
    { key: 'area', values: [{ value: 'A1' }, { value: 'A2' }], order: 2 },
  ],
});

const emptyHierarchy = (): HierarchyDefinition => ({ levels: [] });

// ----------------- Tests -----------------

describe('ViewModeManager — initialization & state', () => {
  it('starts in asset-based mode by default with empty filters', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    expect(m.getCurrentMode()).toBe('asset-based');
    expect(m.getCurrentState().filters).toEqual({});
  });

  it('exposes the loaded WorkOrderLines via getWorkOrderLines', () => {
    const lines = [makeLine('wol-1', 'wo-1', 'a-1')];
    const m = new ViewModeManager([], lines, emptyHierarchy());
    expect(m.getWorkOrderLines()).toHaveLength(1);
    expect(m.getWorkOrderLines()[0].id).toBe('wol-1');
  });

  it('returns an editContext that pairs viewMode with editScope', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    expect(m.getEditContext()).toEqual({ viewMode: 'asset-based', editScope: 'single-asset' });
    m.switchMode('workorder-based');
    expect(m.getEditContext()).toEqual({ viewMode: 'workorder-based', editScope: 'all-assets' });
  });
});

describe('ViewModeManager.switchMode', () => {
  it('switches between asset-based and workorder-based modes', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    m.switchMode('workorder-based');
    expect(m.getCurrentMode()).toBe('workorder-based');
    m.switchMode('asset-based');
    expect(m.getCurrentMode()).toBe('asset-based');
  });

  it('preserves filters when preserveState is true (default)', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    m.applyFilters({ hierarchyPath: { plant: 'P1' } });
    m.switchMode('workorder-based');
    expect(m.getCurrentState().filters.hierarchyPath).toEqual({ plant: 'P1' });
  });

  it('clears filters when preserveState is false', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    m.applyFilters({ hierarchyPath: { plant: 'P1' } });
    m.switchMode('workorder-based', false);
    expect(m.getCurrentState().filters).toEqual({});
  });
});

describe('ViewModeManager.applyFilters', () => {
  it('merges filter values without losing existing ones', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    m.applyFilters({ hierarchyPath: { plant: 'P1' } });
    m.applyFilters({ taskClassification: 'cls-1' });
    expect(m.getCurrentState().filters).toEqual({
      hierarchyPath: { plant: 'P1' },
      taskClassification: 'cls-1',
    });
  });
});

describe('ViewModeManager.getAssetBasedData', () => {
  it('groups assets under a single synthetic root when no hierarchy is defined', () => {
    const assets = [makeAsset('a-1'), makeAsset('a-2')];
    const m = new ViewModeManager(assets, [], emptyHierarchy());
    const rows = m.getAssetBasedData();
    const hierarchyRows = rows.filter(r => r.type === 'hierarchy');
    expect(hierarchyRows).toHaveLength(1);
    expect(hierarchyRows[0].type === 'hierarchy' && hierarchyRows[0].hierarchyValue).toBe('全ての機器');
    expect(rows.filter(r => r.type === 'asset')).toHaveLength(2);
  });

  it('groups assets by hierarchy path, walking levels in order', () => {
    const assets = [
      makeAsset('a-1', { hierarchyPath: { plant: 'P1', area: 'A1' } }),
      makeAsset('a-2', { hierarchyPath: { plant: 'P1', area: 'A2' } }),
      makeAsset('a-3', { hierarchyPath: { plant: 'P2', area: 'A1' } }),
    ];
    const m = new ViewModeManager(assets, [], twoLevelHierarchy());
    const rows = m.getAssetBasedData();
    const hierarchyRows = rows.filter(r => r.type === 'hierarchy');
    // 3 leaf groups (P1>A1, P1>A2, P2>A1), each containing one asset
    expect(hierarchyRows).toHaveLength(3);
    expect(rows.filter(r => r.type === 'asset')).toHaveLength(3);
  });

  it('attaches WorkOrderLines to their referenced asset', () => {
    const assets = [makeAsset('a-1')];
    const lines = [
      makeLine('wol-1', 'wo-1', 'a-1'),
      makeLine('wol-2', 'wo-2', 'a-1'),
    ];
    const workOrders = [makeWorkOrder('wo-1', { name: 'Annual' }), makeWorkOrder('wo-2', { name: 'Quarterly' })];
    const m = new ViewModeManager(assets, lines, twoLevelHierarchy(), workOrders);
    const rows = m.getAssetBasedData();
    const assetRow = rows.find(r => r.type === 'asset');
    expect(assetRow?.type === 'asset' && assetRow.workOrderLines).toHaveLength(2);
  });

  it('falls back to "不明な発注" when a line references a missing WorkOrder', () => {
    const assets = [makeAsset('a-1')];
    const lines = [makeLine('wol-1', 'missing-wo', 'a-1')];
    const m = new ViewModeManager(assets, lines, twoLevelHierarchy(), []);
    const rows = m.getAssetBasedData();
    const assetRow = rows.find(r => r.type === 'asset');
    if (assetRow?.type === 'asset') {
      expect(assetRow.workOrderLines[0].workOrderName).toBe('不明な発注');
    }
  });

  it('applies hierarchyPath filter', () => {
    const assets = [
      makeAsset('a-1', { hierarchyPath: { plant: 'P1', area: 'A1' } }),
      makeAsset('a-2', { hierarchyPath: { plant: 'P2', area: 'A1' } }),
    ];
    const m = new ViewModeManager(assets, [], twoLevelHierarchy());
    m.applyFilters({ hierarchyPath: { plant: 'P1' } });
    const rows = m.getAssetBasedData();
    const assetIds = rows.filter(r => r.type === 'asset').map(r => r.type === 'asset' ? r.assetId : null);
    expect(assetIds).toEqual(['a-1']);
  });

  it('applies dateRange filter on PlanScheduleStart of attached lines', () => {
    const assets = [makeAsset('a-1'), makeAsset('a-2')];
    const lines = [
      makeLine('wol-1', 'wo-1', 'a-1', { PlanScheduleStart: new Date('2024-04-15') }),
      makeLine('wol-2', 'wo-1', 'a-2', { PlanScheduleStart: new Date('2024-12-15') }),
    ];
    const m = new ViewModeManager(assets, lines, twoLevelHierarchy());
    m.applyFilters({ dateRange: { start: '2024-04-01T00:00:00.000Z', end: '2024-06-30T23:59:59.999Z' } });
    const rows = m.getAssetBasedData();
    const assetIds = rows.filter(r => r.type === 'asset').map(r => r.type === 'asset' ? r.assetId : null);
    expect(assetIds).toEqual(['a-1']);
  });
});

describe('ViewModeManager.getWorkOrderBasedData', () => {
  it('produces one parent row per WorkOrder', () => {
    const workOrders = [makeWorkOrder('wo-1'), makeWorkOrder('wo-2')];
    const m = new ViewModeManager([], [], emptyHierarchy(), workOrders);
    const rows = m.getWorkOrderBasedData();
    const woRows = rows.filter(r => r.type === 'workOrder');
    expect(woRows.map(r => r.type === 'workOrder' ? r.workOrderId : null)).toEqual(['wo-1', 'wo-2']);
  });

  it('aggregates schedule entries into the parent row', () => {
    const workOrders = [makeWorkOrder('wo-1')];
    const lines = [
      makeLine('wol-1', 'wo-1', 'a-1', { Planned: true, Actual: false, PlanCost: 100, ActualCost: 0 }),
      makeLine('wol-2', 'wo-1', 'a-2', { Planned: false, Actual: true, PlanCost: 0, ActualCost: 200 }),
    ];
    const m = new ViewModeManager([], lines, emptyHierarchy(), workOrders);
    const rows = m.getWorkOrderBasedData('month');
    const wo = rows.find(r => r.type === 'workOrder');
    expect(wo?.type === 'workOrder' && wo.aggregatedSchedule).toBeDefined();
    if (wo?.type === 'workOrder' && wo.aggregatedSchedule) {
      const monthKey = '2024-04';
      expect(wo.aggregatedSchedule[monthKey]).toBeDefined();
      expect(wo.aggregatedSchedule[monthKey].planned).toBe(true);
      expect(wo.aggregatedSchedule[monthKey].actual).toBe(true);
      expect(wo.aggregatedSchedule[monthKey].totalPlanCost).toBe(100);
      expect(wo.aggregatedSchedule[monthKey].totalActualCost).toBe(200);
      expect(wo.aggregatedSchedule[monthKey].count).toBe(2);
    }
  });

  it('applies taskClassification filter to drop non-matching WorkOrders', () => {
    const workOrders = [
      makeWorkOrder('wo-1', { ClassificationId: 'cls-A' }),
      makeWorkOrder('wo-2', { ClassificationId: 'cls-B' }),
    ];
    const m = new ViewModeManager([], [], emptyHierarchy(), workOrders);
    m.applyFilters({ taskClassification: 'cls-A' });
    const rows = m.getWorkOrderBasedData();
    const woIds = rows.filter(r => r.type === 'workOrder').map(r => r.type === 'workOrder' ? r.workOrderId : null);
    expect(woIds).toEqual(['wo-1']);
  });
});

describe('ViewModeManager.getDisplaySymbol', () => {
  const status = (planned: boolean, actual: boolean): AggregatedStatus => ({
    planned,
    actual,
    totalPlanCost: 0,
    totalActualCost: 0,
    count: 1,
  });

  it('returns ◎ when both planned and actual', () => {
    expect(new ViewModeManager([], [], emptyHierarchy()).getDisplaySymbol(status(true, true))).toBe('◎');
  });

  it('returns ○ when only planned', () => {
    expect(new ViewModeManager([], [], emptyHierarchy()).getDisplaySymbol(status(true, false))).toBe('○');
  });

  it('returns ● when only actual', () => {
    expect(new ViewModeManager([], [], emptyHierarchy()).getDisplaySymbol(status(false, true))).toBe('●');
  });

  it('returns empty string when neither planned nor actual', () => {
    expect(new ViewModeManager([], [], emptyHierarchy()).getDisplaySymbol(status(false, false))).toBe('');
  });
});

describe('ViewModeManager.getTimeHeaders', () => {
  // 実装は currentYear / +1 / +2 を常に含み、加えてラインの PlanScheduleStart の年も追加して sort する。
  // (将来計画立案 UX のため明示的にスキャフォルドされている)
  const currentYear = new Date().getFullYear();

  it('always contains the current year and the next two years even with no lines', () => {
    const m = new ViewModeManager([], [], emptyHierarchy());
    const headers = m.getTimeHeaders('year');
    expect(headers).toEqual([
      String(currentYear),
      String(currentYear + 1),
      String(currentYear + 2),
    ]);
  });

  it('adds historical years pulled from line PlanScheduleStart entries', () => {
    const lines = [
      makeLine('wol-1', 'wo-1', 'a-1', { PlanScheduleStart: new Date('2020-01-01') }),
      makeLine('wol-2', 'wo-1', 'a-1', { PlanScheduleStart: new Date('2022-06-01') }),
    ];
    const m = new ViewModeManager([], lines, emptyHierarchy());
    const headers = m.getTimeHeaders('year');
    expect(headers).toContain('2020');
    expect(headers).toContain('2022');
    expect(headers).toContain(String(currentYear));
    // 2021 は line に無いため挿入されない (range fill ではなく union)
    expect(headers).not.toContain('2021');
  });
});

describe('ViewModeManager.updateData', () => {
  it('replaces internal state and reflects new assets in subsequent calls', () => {
    const m = new ViewModeManager([makeAsset('a-1')], [], twoLevelHierarchy());
    expect(m.getAssetBasedData().filter(r => r.type === 'asset')).toHaveLength(1);

    m.updateData([makeAsset('a-2'), makeAsset('a-3')], [], twoLevelHierarchy());
    expect(m.getAssetBasedData().filter(r => r.type === 'asset')).toHaveLength(2);
  });

  it('clears memoized aggregations when data is replaced', () => {
    const lines1 = [makeLine('wol-1', 'wo-1', 'a-1', { PlanCost: 100 })];
    const lines2 = [makeLine('wol-2', 'wo-1', 'a-1', { PlanCost: 999 })];
    const workOrders = [makeWorkOrder('wo-1')];
    const m = new ViewModeManager([makeAsset('a-1')], lines1, emptyHierarchy(), workOrders);

    const before = m.getWorkOrderBasedData('month');
    const beforeWo = before.find(r => r.type === 'workOrder');
    if (beforeWo?.type === 'workOrder' && beforeWo.aggregatedSchedule) {
      expect(beforeWo.aggregatedSchedule['2024-04'].totalPlanCost).toBe(100);
    }

    m.updateData([makeAsset('a-1')], lines2, emptyHierarchy(), workOrders);

    const after = m.getWorkOrderBasedData('month');
    const afterWo = after.find(r => r.type === 'workOrder');
    if (afterWo?.type === 'workOrder' && afterWo.aggregatedSchedule) {
      expect(afterWo.aggregatedSchedule['2024-04'].totalPlanCost).toBe(999);
    }
  });
});
