import { RawEquipment } from '../types';

/**
 * Demo data generator for comprehensive testing scenarios
 * Creates realistic equipment data for various demo scenarios
 */

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  data: { [id: string]: RawEquipment };
  expectedResults: {
    totalEquipment: number;
    hierarchyLevels: number;
    timeRange: string[];
    features: string[];
  };
}

// Base equipment types and specifications
const equipmentTypes = {
  pumps: {
    prefix: 'P',
    name: 'ポンプ',
    specifications: [
      { key: '機器名称', value: '遠心ポンプ', order: 1 },
      { key: '型式', value: '遠心式', order: 2 },
      { key: '流量', value: '100 m³/h', order: 3 },
      { key: '揚程', value: '50 m', order: 4 }
    ]
  },
  exchangers: {
    prefix: 'E',
    name: '熱交換器',
    specifications: [
      { key: '機器名称', value: '熱交換器', order: 1 },
      { key: '型式', value: '多管円筒式', order: 2 },
      { key: '伝熱面積', value: '200 m²', order: 3 },
      { key: '設計圧力', value: '1.0 MPa', order: 4 }
    ]
  },
  vessels: {
    prefix: 'V',
    name: '容器',
    specifications: [
      { key: '機器名称', value: '貯槽', order: 1 },
      { key: '型式', value: '円筒縦型', order: 2 },
      { key: '容量', value: '1000 m³', order: 3 },
      { key: '設計圧力', value: '0.5 MPa', order: 4 }
    ]
  },
  compressors: {
    prefix: 'C',
    name: 'コンプレッサー',
    specifications: [
      { key: '機器名称', value: 'コンプレッサー', order: 1 },
      { key: '型式', value: '遠心式', order: 2 },
      { key: '吐出量', value: '5000 Nm³/h', order: 3 },
      { key: '吐出圧力', value: '2.0 MPa', order: 4 }
    ]
  }
};

// Plant hierarchy structure
const plantHierarchy = {
  '第一製油所': {
    'Aエリア': ['原油蒸留ユニット', '接触改質ユニット', '水素化脱硫ユニット'],
    'Bエリア': ['流動接触分解ユニット', 'アルキル化ユニット', '重質油分解ユニット'],
    'Cエリア': ['ユーティリティユニット', '排水処理ユニット', '貯蔵タンクエリア']
  },
  '第二製油所': {
    'Dエリア': ['原油蒸留ユニット', '減圧蒸留ユニット', '潤滑油製造ユニット'],
    'Eエリア': ['石油化学ユニット', 'エチレン製造ユニット', 'プロピレン製造ユニット'],
    'Fエリア': ['ユーティリティユニット', '廃棄物処理ユニット', '製品出荷エリア']
  },
  '石油化学工場': {
    'Gエリア': ['エチレンクラッカー', 'ポリエチレン製造ユニット', 'ポリプロピレン製造ユニット'],
    'Hエリア': ['芳香族製造ユニット', 'スチレン製造ユニット', 'PET製造ユニット'],
    'Iエリア': ['研究開発センター', '品質管理センター', '環境管理センター']
  }
};

// Generate time headers for different scales
const generateTimeHeaders = (scale: 'year' | 'month' | 'week' | 'day', count: number = 10): string[] => {
  const headers: string[] = [];
  const baseDate = new Date('2023-01-01');
  
  for (let i = 0; i < count; i++) {
    switch (scale) {
      case 'year':
        headers.push((2023 + i).toString());
        break;
      case 'month':
        const monthDate = new Date(baseDate);
        monthDate.setMonth(i);
        headers.push(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`);
        break;
      case 'week':
        const weekDate = new Date(baseDate);
        weekDate.setDate(baseDate.getDate() + (i * 7));
        headers.push(`${weekDate.getFullYear()}-W${String(Math.ceil(weekDate.getDate() / 7)).padStart(2, '0')}`);
        break;
      case 'day':
        const dayDate = new Date(baseDate);
        dayDate.setDate(baseDate.getDate() + i);
        headers.push(dayDate.toISOString().split('T')[0]);
        break;
    }
  }
  
  return headers;
};

// Generate maintenance data
const generateMaintenanceData = (timeHeaders: string[]): { [key: string]: any } => {
  const maintenances: { [key: string]: any } = {};
  
  timeHeaders.forEach((header) => {
    // Generate realistic maintenance patterns
    const shouldHavePlanned = Math.random() > 0.3; // 70% chance of planned maintenance
    const shouldHaveActual = shouldHavePlanned && Math.random() > 0.2; // 80% completion rate
    
    if (shouldHavePlanned || shouldHaveActual) {
      const baseCost = 100000 + Math.random() * 900000; // 100k - 1M yen
      
      maintenances[header] = {
        planned: shouldHavePlanned,
        actual: shouldHaveActual,
        cost: shouldHaveActual ? Math.round(baseCost) : null,
        planCost: shouldHavePlanned ? Math.round(baseCost * 0.9) : null,
        actualCost: shouldHaveActual ? Math.round(baseCost * (0.8 + Math.random() * 0.4)) : null
      };
    }
  });
  
  return maintenances;
};

// Generate equipment specifications with variations
const generateSpecifications = (equipmentType: keyof typeof equipmentTypes, index: number) => {
  const baseSpecs = equipmentTypes[equipmentType].specifications;
  const variations = {
    pumps: [
      { key: '流量', values: ['50 m³/h', '100 m³/h', '200 m³/h', '500 m³/h'] },
      { key: '揚程', values: ['25 m', '50 m', '75 m', '100 m'] }
    ],
    exchangers: [
      { key: '伝熱面積', values: ['100 m²', '200 m²', '300 m²', '500 m²'] },
      { key: '設計圧力', values: ['0.5 MPa', '1.0 MPa', '1.5 MPa', '2.0 MPa'] }
    ],
    vessels: [
      { key: '容量', values: ['500 m³', '1000 m³', '2000 m³', '5000 m³'] },
      { key: '設計圧力', values: ['0.3 MPa', '0.5 MPa', '0.8 MPa', '1.0 MPa'] }
    ],
    compressors: [
      { key: '吐出量', values: ['2000 Nm³/h', '5000 Nm³/h', '10000 Nm³/h', '20000 Nm³/h'] },
      { key: '吐出圧力', values: ['1.0 MPa', '2.0 MPa', '3.0 MPa', '5.0 MPa'] }
    ]
  };
  
  const specs = [...baseSpecs];
  const typeVariations = variations[equipmentType];
  
  if (typeVariations) {
    typeVariations.forEach(variation => {
      const specIndex = specs.findIndex(spec => spec.key === variation.key);
      if (specIndex !== -1) {
        specs[specIndex] = {
          ...specs[specIndex],
          value: variation.values[index % variation.values.length]
        };
      }
    });
  }
  
  return specs;
};

// Create demo scenarios
export const createDemoScenarios = (): DemoScenario[] => {
  const scenarios: DemoScenario[] = [];
  
  // Scenario 1: Basic functionality demo
  scenarios.push({
    id: 'basic-demo',
    name: '基本機能デモ',
    description: '基本的な星取表機能のデモンストレーション',
    data: generateBasicDemoData(),
    expectedResults: {
      totalEquipment: 20,
      hierarchyLevels: 3,
      timeRange: generateTimeHeaders('year', 5),
      features: ['search', 'filter', 'edit', 'view-mode']
    }
  });
  
  // Scenario 2: Excel-like operations demo
  scenarios.push({
    id: 'excel-demo',
    name: 'Excelライク操作デモ',
    description: 'Excel風の高度な操作機能のデモンストレーション',
    data: generateExcelDemoData(),
    expectedResults: {
      totalEquipment: 50,
      hierarchyLevels: 3,
      timeRange: generateTimeHeaders('month', 12),
      features: ['cell-edit', 'keyboard-nav', 'copy-paste', 'resize']
    }
  });
  
  // Scenario 3: Performance test demo
  scenarios.push({
    id: 'performance-demo',
    name: 'パフォーマンステストデモ',
    description: '大量データでのパフォーマンステスト',
    data: generatePerformanceDemoData(),
    expectedResults: {
      totalEquipment: 1000,
      hierarchyLevels: 3,
      timeRange: generateTimeHeaders('week', 52),
      features: ['virtual-scroll', 'performance', 'large-dataset']
    }
  });
  
  // Scenario 4: AI integration demo
  scenarios.push({
    id: 'ai-demo',
    name: 'AI統合デモ',
    description: 'AIアシスタント機能のデモンストレーション',
    data: generateAIDemoData(),
    expectedResults: {
      totalEquipment: 30,
      hierarchyLevels: 3,
      timeRange: generateTimeHeaders('year', 3),
      features: ['ai-assistant', 'excel-import', 'suggestions']
    }
  });
  
  return scenarios;
};

// Generate basic demo data
function generateBasicDemoData(): { [id: string]: RawEquipment } {
  const data: { [id: string]: RawEquipment } = {};
  let equipmentCounter = 1;
  
  Object.entries(plantHierarchy).forEach(([plant, areas]) => {
    Object.entries(areas).forEach(([area, units]) => {
      units.slice(0, 2).forEach(unit => { // Limit to 2 units per area for basic demo
        Object.entries(equipmentTypes).forEach(([type, config]) => {
          const equipmentId = `${config.prefix}-${String(equipmentCounter).padStart(3, '0')}`;
          
          data[equipmentId] = {
            id: equipmentId,
            hierarchy: { plant, area, unit },
            specifications: generateSpecifications(type as keyof typeof equipmentTypes, equipmentCounter),
            maintenances: generateMaintenanceData(generateTimeHeaders('year', 5))
          };
          
          equipmentCounter++;
          if (equipmentCounter > 20) return; // Limit for basic demo
        });
        if (equipmentCounter > 20) return;
      });
      if (equipmentCounter > 20) return;
    });
    if (equipmentCounter > 20) return;
  });
  
  return data;
}

// Generate Excel demo data
function generateExcelDemoData(): { [id: string]: RawEquipment } {
  const data: { [id: string]: RawEquipment } = {};
  let equipmentCounter = 1;
  
  Object.entries(plantHierarchy).forEach(([plant, areas]) => {
    Object.entries(areas).forEach(([area, units]) => {
      units.forEach(unit => {
        Object.entries(equipmentTypes).forEach(([type, config]) => {
          if (equipmentCounter <= 50) {
            const equipmentId = `${config.prefix}-${String(equipmentCounter).padStart(3, '0')}`;
            
            data[equipmentId] = {
              id: equipmentId,
              hierarchy: { plant, area, unit },
              specifications: generateSpecifications(type as keyof typeof equipmentTypes, equipmentCounter),
              maintenances: generateMaintenanceData(generateTimeHeaders('month', 12))
            };
            
            equipmentCounter++;
          }
        });
      });
    });
  });
  
  return data;
}

// Generate performance demo data
function generatePerformanceDemoData(): { [id: string]: RawEquipment } {
  const data: { [id: string]: RawEquipment } = {};
  let equipmentCounter = 1;
  
  // Generate 1000 equipment items for performance testing
  while (equipmentCounter <= 1000) {
    const plantKeys = Object.keys(plantHierarchy);
    const plant = plantKeys[equipmentCounter % plantKeys.length];
    const areaKeys = Object.keys((plantHierarchy as any)[plant]);
    const area = areaKeys[equipmentCounter % areaKeys.length];
    const units = (plantHierarchy as any)[plant][area];
    const unit = units[equipmentCounter % units.length];
    
    const typeKeys = Object.keys(equipmentTypes) as (keyof typeof equipmentTypes)[];
    const type = typeKeys[equipmentCounter % typeKeys.length];
    const config = equipmentTypes[type];
    
    const equipmentId = `${config.prefix}-${String(equipmentCounter).padStart(4, '0')}`;
    
    data[equipmentId] = {
      id: equipmentId,
      hierarchy: { plant, area, unit },
      specifications: generateSpecifications(type, equipmentCounter),
      maintenances: generateMaintenanceData(generateTimeHeaders('week', 52))
    };
    
    equipmentCounter++;
  }
  
  return data;
}

// Generate AI demo data
function generateAIDemoData(): { [id: string]: RawEquipment } {
  const data: { [id: string]: RawEquipment } = {};
  let equipmentCounter = 1;
  
  // Generate specific scenarios for AI demo
  const aiScenarios = [
    { plant: '第一製油所', area: 'Aエリア', unit: '原油蒸留ユニット' },
    { plant: '第一製油所', area: 'Bエリア', unit: '流動接触分解ユニット' },
    { plant: '第二製油所', area: 'Dエリア', unit: '原油蒸留ユニット' }
  ];
  
  aiScenarios.forEach(scenario => {
    Object.entries(equipmentTypes).forEach(([type, config]) => {
      for (let i = 0; i < 10; i++) {
        const equipmentId = `${config.prefix}-${String(equipmentCounter).padStart(3, '0')}`;
        
        data[equipmentId] = {
          id: equipmentId,
          hierarchy: scenario,
          specifications: generateSpecifications(type as keyof typeof equipmentTypes, equipmentCounter),
          maintenances: generateMaintenanceData(generateTimeHeaders('year', 3))
        };
        
        equipmentCounter++;
      }
    });
  });
  
  return data;
}

// Export demo data for use in components
export const demoScenarios = createDemoScenarios();

// Utility function to get demo data by scenario ID
export const getDemoDataByScenario = (scenarioId: string): { [id: string]: RawEquipment } | null => {
  const scenario = demoScenarios.find(s => s.id === scenarioId);
  return scenario ? scenario.data : null;
};

// Generate sample Excel import data
export const generateSampleExcelData = () => {
  return [
    ['機器ID', '機器名称', '型式', '2024年計画', '2024年実績', '2025年計画'],
    ['P-001', '原油供給ポンプ', '遠心式', 'TRUE', 'TRUE', 'TRUE'],
    ['P-002', 'ナフサ循環ポンプ', '遠心式', 'TRUE', 'FALSE', 'TRUE'],
    ['E-001', '熱交換器(原油予熱)', '多管円筒式', 'TRUE', 'TRUE', 'FALSE'],
    ['V-001', '原油貯槽', '円筒縦型', 'FALSE', 'FALSE', 'TRUE'],
    ['C-001', '水素コンプレッサー', '遠心式', 'TRUE', 'TRUE', 'TRUE']
  ];
};

export default {
  createDemoScenarios,
  getDemoDataByScenario,
  generateSampleExcelData,
  demoScenarios
};