import { DataIntegrityChecker } from '../dataIntegrityChecker';
import type { DataModel, Asset, WorkOrder, WorkOrderLine } from '../../types/maintenanceTask';

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

const makeModel = (overrides: Partial<DataModel> = {}): DataModel => ({
  version: '3.0.0',
  assets: { 'a-1': makeAsset('a-1') },
  workOrders: { 'wo-1': makeWorkOrder('wo-1') },
  workOrderLines: { 'wol-1': makeLine('wol-1', 'wo-1', 'a-1') },
  hierarchy: {
    levels: [
      { key: 'plant', values: [{ value: 'P1' }, { value: 'P2' }] },
      { key: 'area', values: [{ value: 'A1' }, { value: 'A2' }] },
    ],
  },
  workOrderClassifications: [],
  assetClassification: { levels: [] },
  metadata: { lastModified: new Date('2024-06-01'), projectName: 'test' },
  ...overrides,
});

describe('DataIntegrityChecker.checkDataModel', () => {
  let checker: DataIntegrityChecker;

  beforeEach(() => {
    checker = new DataIntegrityChecker();
  });

  it('reports a valid model as isValid with no errors', () => {
    const result = checker.checkDataModel(makeModel());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('produces summary counts of all entities', () => {
    const result = checker.checkDataModel(makeModel());
    expect(result.summary.totalAssets).toBe(1);
    expect(result.summary.totalWorkOrders).toBe(1);
    expect(result.summary.totalWorkOrderLines).toBe(1);
  });

  describe('orphaned WorkOrderLines', () => {
    it('flags a WorkOrderLine that points at a missing Asset', () => {
      const model = makeModel({
        workOrderLines: { 'wol-1': makeLine('wol-1', 'wo-1', 'missing-asset') },
      });
      const result = checker.checkDataModel(model);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'ORPHANED_WORK_ORDER_LINE' && e.message.includes('機器'))).toBe(true);
      expect(result.summary.orphanedWorkOrderLines).toBeGreaterThan(0);
    });

    it('flags a WorkOrderLine that points at a missing WorkOrder', () => {
      const model = makeModel({
        workOrderLines: { 'wol-1': makeLine('wol-1', 'missing-wo', 'a-1') },
      });
      const result = checker.checkDataModel(model);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'ORPHANED_WORK_ORDER_LINE' && e.message.includes('WorkOrder'))).toBe(true);
    });
  });

  describe('invalid references / id mismatches', () => {
    it('flags an Asset whose id does not match its key', () => {
      const model = makeModel({
        assets: { 'a-1': makeAsset('a-1', { id: 'mismatched' }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.type === 'INVALID_REFERENCE' && e.entityType === 'asset')).toBe(true);
    });

    it('flags a WorkOrder whose id does not match its key', () => {
      const model = makeModel({
        workOrders: { 'wo-1': makeWorkOrder('wo-1', { id: 'mismatched' }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.type === 'INVALID_REFERENCE' && e.entityType === 'workOrder')).toBe(true);
    });

    it('flags a WorkOrderLine whose id does not match its key', () => {
      const model = makeModel({
        workOrderLines: { 'wol-1': makeLine('wol-1', 'wo-1', 'a-1', { id: 'mismatched' }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.type === 'INVALID_REFERENCE' && e.entityType === 'workOrderLine')).toBe(true);
    });
  });

  describe('Planned / Actual normalization', () => {
    it('normalizes string "true"/"false" Planned to boolean without erroring', () => {
      const line = makeLine('wol-1', 'wo-1', 'a-1');
      (line as unknown as Record<string, unknown>).Planned = 'true';
      const model = makeModel({ workOrderLines: { 'wol-1': line } });
      const result = checker.checkDataModel(model);
      expect(result.errors.filter(e => e.message.includes('Planned'))).toHaveLength(0);
      expect((line as unknown as Record<string, unknown>).Planned).toBe(true);
    });

    it('normalizes numeric 1/0 Actual to boolean without erroring', () => {
      const line = makeLine('wol-1', 'wo-1', 'a-1');
      (line as unknown as Record<string, unknown>).Actual = 1;
      const model = makeModel({ workOrderLines: { 'wol-1': line } });
      const result = checker.checkDataModel(model);
      expect(result.errors.filter(e => e.message.includes('Actual'))).toHaveLength(0);
      expect((line as unknown as Record<string, unknown>).Actual).toBe(true);
    });

    it('flags a Planned value that cannot be coerced', () => {
      const line = makeLine('wol-1', 'wo-1', 'a-1');
      (line as unknown as Record<string, unknown>).Planned = { weird: 'object' };
      const model = makeModel({ workOrderLines: { 'wol-1': line } });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.message.includes('Planned'))).toBe(true);
    });
  });

  describe('hierarchy path validation', () => {
    it('flags an Asset using a hierarchy level not declared in the definition', () => {
      const model = makeModel({
        assets: { 'a-1': makeAsset('a-1', { hierarchyPath: { unknownLevel: 'X' } }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.type === 'INVALID_HIERARCHY_PATH')).toBe(true);
    });

    it('flags an Asset using a value not present in the hierarchy level values', () => {
      const model = makeModel({
        assets: { 'a-1': makeAsset('a-1', { hierarchyPath: { plant: 'UNKNOWN_PLANT' } }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.errors.some(e => e.type === 'INVALID_HIERARCHY_PATH' && e.message.includes('値'))).toBe(true);
    });
  });

  describe('consistency warnings', () => {
    it('warns when an Asset is not referenced by any WorkOrderLine', () => {
      const model = makeModel({
        assets: {
          'a-1': makeAsset('a-1'),
          'a-2': makeAsset('a-2'),
        },
        workOrderLines: { 'wol-1': makeLine('wol-1', 'wo-1', 'a-1') },
      });
      const result = checker.checkDataModel(model);
      expect(result.warnings.some(w => w.entityId === 'a-2' && w.entityType === 'asset')).toBe(true);
    });

    it('warns when a WorkOrder is not referenced by any WorkOrderLine', () => {
      const model = makeModel({
        workOrders: {
          'wo-1': makeWorkOrder('wo-1'),
          'wo-2': makeWorkOrder('wo-2'),
        },
        workOrderLines: { 'wol-1': makeLine('wol-1', 'wo-1', 'a-1') },
      });
      const result = checker.checkDataModel(model);
      expect(result.warnings.some(w => w.entityId === 'wo-2' && w.entityType === 'workOrder')).toBe(true);
    });

    it('warns when an Asset has an empty name', () => {
      const model = makeModel({
        assets: { 'a-1': makeAsset('a-1', { name: '   ' }) },
      });
      const result = checker.checkDataModel(model);
      expect(result.warnings.some(w => w.type === 'MISSING_DATA' && w.entityId === 'a-1')).toBe(true);
    });
  });

  describe('formatCheckResult', () => {
    it('produces a multi-line summary string', () => {
      const result = checker.checkDataModel(makeModel());
      const formatted = checker.formatCheckResult(result);
      expect(formatted).toContain('データ整合性チェック');
      expect(formatted).toContain('機器数: 1');
      expect(formatted).toContain('WorkOrder数: 1');
    });
  });
});
