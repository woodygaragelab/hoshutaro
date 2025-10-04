import { HierarchicalData } from '../../../types';

export const mockMaintenanceData: HierarchicalData[] = [
  {
    id: 'EQ001',
    task: 'ポンプA-1',
    level: 3,
    bomCode: 'P001',
    cycle: 6,
    specifications: [
      { key: '機器名称', value: 'ポンプA-1', order: 1 },
      { key: '型式', value: 'CP-100', order: 2 },
      { key: 'メーカー', value: '日本ポンプ', order: 3 },
      { key: '設置場所', value: 'プラント1-A棟', order: 4 }
    ],
    children: [],
    results: {
      '2024-01': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: true, actual: false, planCost: 50000, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: true, actual: true, planCost: 50000, actualCost: 48000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: true, actual: false, planCost: 50000, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: true, actual: false, planCost: 50000, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備A > ポンプ系統'
  },
  {
    id: 'EQ002',
    task: 'コンプレッサーB-2',
    level: 3,
    bomCode: 'C002',
    cycle: 12,
    specifications: [
      { key: '機器名称', value: 'コンプレッサーB-2', order: 1 },
      { key: '型式', value: 'AC-200', order: 2 },
      { key: 'メーカー', value: '東京エアー', order: 3 },
      { key: '設置場所', value: 'プラント2-B棟', order: 4 }
    ],
    children: [],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: true, planCost: 120000, actualCost: 115000 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: true, actual: true, planCost: 120000, actualCost: 115000 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備B > コンプレッサー系統'
  },
  {
    id: 'EQ003',
    task: 'モーターC-3',
    level: 3,
    bomCode: 'M003',
    cycle: 3,
    specifications: [
      { key: '機器名称', value: 'モーターC-3', order: 1 },
      { key: '型式', value: 'EM-50', order: 2 },
      { key: 'メーカー', value: '三菱電機', order: 3 },
      { key: '設置場所', value: 'プラント1-C棟', order: 4 }
    ],
    children: [],
    results: {
      '2024-01': { planned: true, actual: true, planCost: 30000, actualCost: 32000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: true, actual: false, planCost: 30000, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: true, actual: true, planCost: 30000, actualCost: 32000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: true, actual: false, planCost: 30000, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備C > モーター系統'
  },
  {
    id: 'EQ004',
    task: 'バルブD-4',
    level: 3,
    bomCode: 'V004',
    cycle: 24,
    specifications: [
      { key: '機器名称', value: 'バルブD-4', order: 1 },
      { key: '型式', value: 'BV-25', order: 2 },
      { key: 'メーカー', value: 'キッツ', order: 3 },
      { key: '設置場所', value: 'プラント3-D棟', order: 4 }
    ],
    children: [],
    results: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備D > バルブ系統'
  },
  {
    id: 'EQ005',
    task: 'ファンE-5',
    level: 3,
    bomCode: 'F005',
    cycle: 6,
    specifications: [
      { key: '機器名称', value: 'ファンE-5', order: 1 },
      { key: '型式', value: 'CF-75', order: 2 },
      { key: 'メーカー', value: '昭和電機', order: 3 },
      { key: '設置場所', value: 'プラント2-E棟', order: 4 }
    ],
    children: [],
    results: {
      '2024-01': { planned: true, actual: true, planCost: 25000, actualCost: 24000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {
      '2024-01': { planned: true, actual: true, planCost: 25000, actualCost: 24000 },
      '2024-02': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-03': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-04': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-05': { planned: false, actual: false, planCost: 0, actualCost: 0 },
      '2024-06': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    hierarchyPath: 'プラント > 設備E > ファン系統'
  }
];