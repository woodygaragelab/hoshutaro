import { transformData } from '../dataTransformer';
import type { RawEquipment } from '../../types';

const sampleEquipment = (): { [id: string]: RawEquipment } => ({
  'eq-1': {
    id: 'eq-1',
    hierarchy: { plant: 'P1', area: 'A1' },
    specifications: [{ key: '機器名称', value: 'Boiler #1', order: 1 }],
    maintenances: {
      '2024-04-15': { planned: true, actual: false, cost: 100 },
      '2024-08-20': { planned: false, actual: true, cost: 200 },
    },
  },
  'eq-2': {
    id: 'eq-2',
    hierarchy: { plant: 'P1', area: 'A2' },
    specifications: [{ key: '機器名称', value: 'Pump #2', order: 1 }],
    maintenances: {
      '2024-06-01': { planned: true, actual: true, cost: 50 },
    },
  },
});

describe('transformData (legacy / equipment dictionary input)', () => {
  it('returns empty result for null', () => {
    const [list, headers, tree] = transformData(null as unknown as Record<string, unknown>, 'year');
    expect(list).toEqual([]);
    expect(headers).toEqual([]);
    expect(tree).toEqual({ name: 'root', children: {} });
  });

  it('returns empty result for non-object input', () => {
    const [list, headers, tree] = transformData(undefined as unknown as Record<string, unknown>, 'year');
    expect(list).toEqual([]);
    expect(headers).toEqual([]);
    expect(tree.name).toBe('root');
  });

  it('produces a flat list with one node per equipment', () => {
    const [list] = transformData(sampleEquipment(), 'year');
    expect(list).toHaveLength(2);
    expect(list.map(n => n.id).sort()).toEqual(['eq-1', 'eq-2']);
  });

  it('uses the 機器名称 specification as the task label', () => {
    const [list] = transformData(sampleEquipment(), 'year');
    expect(list.find(n => n.id === 'eq-1')?.task).toBe('Boiler #1');
    expect(list.find(n => n.id === 'eq-2')?.task).toBe('Pump #2');
  });

  it('falls back to the id when 機器名称 is missing', () => {
    const data: { [id: string]: RawEquipment } = {
      'eq-x': {
        id: 'eq-x',
        hierarchy: { plant: 'P1' },
        specifications: [],
        maintenances: {},
      },
    };
    const [list] = transformData(data, 'year');
    expect(list[0].task).toBe('eq-x');
  });

  it('builds a hierarchical filter tree from the equipment hierarchy paths', () => {
    // hierarchy keys are sorted alphabetically before walking, so 'area' comes before 'plant'.
    const [, , tree] = transformData(sampleEquipment(), 'year');
    expect(Object.keys(tree.children).sort()).toEqual(['A1', 'A2']);
    expect(tree.children.A1.children.P1).toBeDefined();
    expect(tree.children.A2.children.P1).toBeDefined();
  });

  it('skips equipment with missing or invalid hierarchy', () => {
    const data: { [id: string]: RawEquipment } = {
      'eq-broken': {
        id: 'eq-broken',
        hierarchy: null as unknown as { [key: string]: string },
        specifications: [],
        maintenances: {},
      },
      'eq-ok': {
        id: 'eq-ok',
        hierarchy: { plant: 'P1' },
        specifications: [],
        maintenances: {},
      },
    };
    const [list] = transformData(data, 'year');
    expect(list.map(n => n.id)).toEqual(['eq-ok']);
  });

  it('aggregates maintenance results into the year time key', () => {
    const [list] = transformData(sampleEquipment(), 'year');
    const eq1 = list.find(n => n.id === 'eq-1')!;
    expect(eq1.results['2024']).toBeDefined();
    expect(eq1.results['2024'].planned).toBe(true);
    expect(eq1.results['2024'].actual).toBe(true);
    expect(eq1.results['2024'].actualCost).toBe(200);
  });

  it('aggregates maintenance results into month time keys', () => {
    const [list] = transformData(sampleEquipment(), 'month');
    const eq1 = list.find(n => n.id === 'eq-1')!;
    expect(eq1.results['2024-04']).toMatchObject({ planned: true, actual: false });
    expect(eq1.results['2024-08']).toMatchObject({ planned: false, actual: true, actualCost: 200 });
  });

  it('generates yearly time headers spanning min/max maintenance dates', () => {
    const [, headers] = transformData(sampleEquipment(), 'year');
    expect(headers).toEqual(['2024']);
  });

  it('generates monthly time headers spanning min/max maintenance dates', () => {
    const [, headers] = transformData(sampleEquipment(), 'month');
    expect(headers).toContain('2024-04');
    expect(headers).toContain('2024-08');
  });

  it('sorts the flat list by task name for stable ordering', () => {
    const [list] = transformData(sampleEquipment(), 'year');
    expect(list.map(n => n.task)).toEqual(['Boiler #1', 'Pump #2']);
  });
});

describe('transformData (V2 wrapper input)', () => {
  const sampleV2 = () => ({
    version: '2.0.0' as const,
    assets: {
      'a-1': {
        id: 'a-1',
        name: 'Asset One',
        hierarchyPath: { plant: 'P1', area: 'A1' },
        specifications: [],
      },
    },
    associations: {
      'assoc-1': {
        assetId: 'a-1',
        schedule: {
          '2024-04-15': { planned: true, actual: false, planCost: 100, actualCost: 0 },
          '2024-09-10': { planned: true, actual: true, planCost: 200, actualCost: 180 },
        },
      },
    },
  });

  it('detects V2 data via version + assets and routes through transformV2Data', () => {
    const [list] = transformData(sampleV2(), 'year');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('a-1');
    expect(list[0].task).toBe('Asset One');
  });

  it('aggregates V2 association schedule into year time keys', () => {
    const [list] = transformData(sampleV2(), 'year');
    const node = list[0];
    expect(node.results['2024']).toBeDefined();
    expect(node.results['2024'].planCost).toBe(300);
    expect(node.results['2024'].actualCost).toBe(180);
  });

  it('synthesizes a 3-year header range when no schedule data is present', () => {
    const v2 = sampleV2();
    v2.associations = {};
    const [, headers] = transformData(v2, 'year');
    expect(headers).toHaveLength(3);
  });

  it('skips V2 assets with missing hierarchyPath', () => {
    const v2 = sampleV2();
    v2.assets['a-broken'] = {
      id: 'a-broken',
      name: 'No Path',
      hierarchyPath: undefined,
      specifications: [],
    };
    const [list] = transformData(v2, 'year');
    expect(list.map(n => n.id)).toEqual(['a-1']);
  });
});
