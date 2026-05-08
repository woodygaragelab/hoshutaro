import { DataStore, ValidationError } from '../DataStore';

const validV3Json = () => ({
  version: '3.0.0',
  assets: {
    'asset-1': {
      id: 'asset-1',
      name: 'Boiler #1',
      hierarchyPath: { plant: 'P1', area: 'A1' },
      classificationPath: {},
      specifications: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    },
  },
  workOrders: {
    'wo-1': {
      id: 'wo-1',
      name: 'Annual Inspection',
      ClassificationId: 'cls-1',
      CreatedAt: '2024-01-01T00:00:00Z',
      UpdatedAt: '2024-06-01T00:00:00Z',
    },
  },
  workOrderLines: {
    'wol-1': {
      id: 'wol-1',
      name: 'Inspect drum',
      WorkOrderId: 'wo-1',
      AssetId: 'asset-1',
      PlanScheduleStart: '2024-04-01T00:00:00Z',
      PlanScheduleEnd: '2024-04-02T00:00:00Z',
      ActualScheduleStart: '2024-04-01T00:00:00Z',
      ActualScheduleEnd: '2024-04-02T00:00:00Z',
      Planned: true,
      Actual: false,
      PlanCost: 1000,
      ActualCost: 0,
      CreatedAt: '2024-01-01T00:00:00Z',
      UpdatedAt: '2024-06-01T00:00:00Z',
    },
  },
  hierarchy: {
    levels: [
      { key: 'plant', values: ['P1', 'P2'] },
      { key: 'area', values: ['A1', 'A2'] },
    ],
  },
  workOrderClassifications: [
    { id: 'cls-1', name: '点検', order: 1 },
  ],
  assetClassification: {
    levels: [
      { key: 'category', values: ['boiler', 'pump'] },
    ],
  },
  metadata: {
    lastModified: '2024-06-01T00:00:00Z',
    projectName: 'Test Project',
  },
});

describe('DataStore.loadData', () => {
  let store: DataStore;

  beforeEach(() => {
    store = new DataStore();
  });

  describe('valid input', () => {
    it('accepts a valid v3.0.0 DataModel object', () => {
      const result = store.loadData(validV3Json());
      expect(result.version).toBe('3.0.0');
      expect(Object.keys(result.assets)).toEqual(['asset-1']);
      expect(Object.keys(result.workOrders)).toEqual(['wo-1']);
      expect(Object.keys(result.workOrderLines)).toEqual(['wol-1']);
    });

    it('accepts a valid v3.0.0 DataModel as JSON string', () => {
      const result = store.loadData(JSON.stringify(validV3Json()));
      expect(result.version).toBe('3.0.0');
    });

    it('normalizes Asset.createdAt / updatedAt strings to Date objects', () => {
      const result = store.loadData(validV3Json());
      const asset = result.assets['asset-1'];
      expect(asset.createdAt).toBeInstanceOf(Date);
      expect(asset.updatedAt).toBeInstanceOf(Date);
      expect(asset.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('normalizes WorkOrder.CreatedAt / UpdatedAt strings to Date objects (uppercase, post-Phase1 bugfix)', () => {
      const result = store.loadData(validV3Json());
      const wo = result.workOrders['wo-1'];
      expect(wo.CreatedAt).toBeInstanceOf(Date);
      expect(wo.UpdatedAt).toBeInstanceOf(Date);
    });

    it('normalizes WorkOrderLine.CreatedAt / UpdatedAt strings to Date objects (uppercase, post-Phase1 bugfix)', () => {
      const result = store.loadData(validV3Json());
      const wol = result.workOrderLines['wol-1'];
      expect(wol.CreatedAt).toBeInstanceOf(Date);
      expect(wol.UpdatedAt).toBeInstanceOf(Date);
    });

    it('normalizes metadata.lastModified string to Date object', () => {
      const result = store.loadData(validV3Json());
      expect(result.metadata.lastModified).toBeInstanceOf(Date);
    });

    it('makes the loaded data accessible via getData', () => {
      const result = store.loadData(validV3Json());
      expect(store.getData()).toBe(result);
    });
  });

  describe('structural validation errors', () => {
    it('rejects null', () => {
      expect(() => store.loadData(null as unknown as object)).toThrow(ValidationError);
    });

    it('rejects an object missing version', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).version;
      expect(() => store.loadData(data as object)).toThrow(/バージョン情報/);
    });

    it('rejects unsupported versions', () => {
      const data = { ...validV3Json(), version: '2.0.0' };
      expect(() => store.loadData(data)).toThrow(/サポートされていない/);
    });

    it('rejects missing assets field', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).assets;
      expect(() => store.loadData(data as object)).toThrow(/assets/);
    });

    it('rejects missing workOrders field', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).workOrders;
      expect(() => store.loadData(data as object)).toThrow(/workOrders/);
    });

    it('rejects missing workOrderLines field', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).workOrderLines;
      expect(() => store.loadData(data as object)).toThrow(/workOrderLines/);
    });

    it('rejects missing hierarchy field', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).hierarchy;
      expect(() => store.loadData(data as object)).toThrow(/hierarchy/);
    });

    it('rejects missing metadata field', () => {
      const data = validV3Json();
      delete (data as Partial<typeof data>).metadata;
      expect(() => store.loadData(data as object)).toThrow(/metadata/);
    });

    it('rejects workOrderClassifications when not an array', () => {
      const data = validV3Json();
      (data as { workOrderClassifications: unknown }).workOrderClassifications = { invalid: true };
      expect(() => store.loadData(data)).toThrow(/配列/);
    });
  });

  describe('entity-level validation errors', () => {
    it('rejects an Asset whose id does not match its key', () => {
      const data = validV3Json();
      data.assets['asset-1'].id = 'mismatched';
      expect(() => store.loadData(data)).toThrow(/IDがキーと一致/);
    });

    it('rejects an Asset with empty hierarchyPath', () => {
      const data = validV3Json();
      data.assets['asset-1'].hierarchyPath = {};
      expect(() => store.loadData(data)).toThrow(/階層パス/);
    });

    it('rejects a WorkOrder missing classification ids', () => {
      const data = validV3Json();
      delete (data.workOrders['wo-1'] as Partial<typeof data.workOrders['wo-1']>).ClassificationId;
      expect(() => store.loadData(data)).toThrow(/作業分類ID/);
    });

    it('rejects a WorkOrderLine that references a missing WorkOrder', () => {
      const data = validV3Json();
      data.workOrderLines['wol-1'].WorkOrderId = 'missing-wo';
      expect(() => store.loadData(data)).toThrow(/存在しないWorkOrder/);
    });

    it('rejects a WorkOrderLine that references a missing Asset', () => {
      const data = validV3Json();
      data.workOrderLines['wol-1'].AssetId = 'missing-asset';
      expect(() => store.loadData(data)).toThrow(/存在しない機器/);
    });

    it('rejects a hierarchy with more than 10 levels', () => {
      const data = validV3Json();
      data.hierarchy.levels = Array.from({ length: 11 }, (_, i) => ({
        key: `level-${i}`,
        values: [],
      }));
      expect(() => store.loadData(data)).toThrow(/10以下/);
    });

    it('rejects a hierarchy with duplicate level keys', () => {
      const data = validV3Json();
      data.hierarchy.levels = [
        { key: 'plant', values: ['P1'] },
        { key: 'plant', values: ['P2'] },
      ];
      expect(() => store.loadData(data)).toThrow(/重複/);
    });
  });
});

describe('DataStore.saveData', () => {
  it('returns valid JSON containing all top-level fields', () => {
    const store = new DataStore();
    const loaded = store.loadData(validV3Json());
    const json = store.saveData(loaded);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('3.0.0');
    expect(parsed.assets['asset-1']).toBeDefined();
    expect(parsed.workOrders['wo-1']).toBeDefined();
    expect(parsed.workOrderLines['wol-1']).toBeDefined();
  });

  it('updates metadata.lastModified to a fresh timestamp', () => {
    const store = new DataStore();
    const loaded = store.loadData(validV3Json());
    const before = Date.now();
    const json = store.saveData(loaded);
    const after = Date.now();
    const parsed = JSON.parse(json);
    const savedAt = new Date(parsed.metadata.lastModified).getTime();
    expect(savedAt).toBeGreaterThanOrEqual(before);
    expect(savedAt).toBeLessThanOrEqual(after);
  });
});

describe('DataStore.exportData', () => {
  it('throws when no data has been loaded', () => {
    const store = new DataStore();
    expect(() => store.exportData()).toThrow(ValidationError);
  });

  it('returns a deep copy independent from the internal store', () => {
    const store = new DataStore();
    store.loadData(validV3Json());
    const copy = store.exportData();
    copy.assets['asset-1'].name = 'Mutated';
    expect(store.getData()?.assets['asset-1'].name).toBe('Boiler #1');
  });
});

describe('DataStore master accessors', () => {
  it('returns empty asset classification when not loaded', () => {
    const store = new DataStore();
    expect(store.getAssetClassification()).toEqual({ levels: [] });
  });

  it('returns empty workOrder classifications when not loaded', () => {
    const store = new DataStore();
    expect(store.getWorkOrderClassifications()).toEqual([]);
  });

  it('returns the loaded asset classification', () => {
    const store = new DataStore();
    store.loadData(validV3Json());
    expect(store.getAssetClassification().levels[0].key).toBe('category');
  });

  it('returns the loaded workOrder classifications', () => {
    const store = new DataStore();
    store.loadData(validV3Json());
    expect(store.getWorkOrderClassifications()).toHaveLength(1);
    expect(store.getWorkOrderClassifications()[0].id).toBe('cls-1');
  });
});
