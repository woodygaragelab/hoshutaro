/**
 * ViewModeManager Integration Example
 * 
 * This file demonstrates how ViewModeManager integrates with other managers
 * in the maintenance task management system.
 */

import { TaskManager } from '../TaskManager';
import { AssetManager } from '../AssetManager';
import { AssociationManager } from '../AssociationManager';
import { HierarchyManager } from '../HierarchyManager';
import { ViewModeManager } from '../ViewModeManager';

/**
 * Example: Complete workflow with all managers
 */
export function demonstrateCompleteWorkflow() {
  // 1. Initialize managers
  const taskManager = new TaskManager();
  const assetManager = new AssetManager();
  const associationManager = new AssociationManager();
  const hierarchyManager = new HierarchyManager(assetManager);

  // 2. Set up hierarchy
  hierarchyManager.addHierarchyLevel('製油所', 1);
  hierarchyManager.addHierarchyLevel('エリア', 2);
  hierarchyManager.addHierarchyLevel('ユニット', 3);

  hierarchyManager.addHierarchyValue('製油所', '第一製油所');
  hierarchyManager.addHierarchyValue('エリア', 'Aエリア');
  hierarchyManager.addHierarchyValue('ユニット', '原油蒸留ユニット');

  // 3. Create tasks
  const task1 = taskManager.createTask({
    name: '年次点検',
    description: '年次定期点検作業',
    classification: '01',
  });

  const task2 = taskManager.createTask({
    name: 'オーバーホール',
    description: '設備の全面的な分解点検と修理',
    classification: '01',
  });

  // 4. Create assets
  const asset1 = assetManager.createAsset({
    id: 'P-101',
    name: '原油供給ポンプ',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    },
    specifications: [{ key: '型式', value: '遠心式', order: 1 }],
  });

  const asset2 = assetManager.createAsset({
    id: 'T-4220',
    name: '貯蔵タンク',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    },
    specifications: [{ key: '型式', value: '浮き屋根式', order: 1 }],
  });

  // 5. Create associations
  const assoc1 = associationManager.createAssociation({
    assetId: asset1.id,
    taskId: task1.id,
    schedule: {
      '2025-05-15': {
        planned: true,
        actual: false,
        planCost: 500000,
        actualCost: 0,
      },
    },
  });

  associationManager.createAssociation({
    assetId: asset1.id,
    taskId: task2.id,
    schedule: {
      '2025-03-01': {
        planned: true,
        actual: false,
        planCost: 1000000,
        actualCost: 0,
      },
    },
  });

  associationManager.createAssociation({
    assetId: asset2.id,
    taskId: task2.id,
    schedule: {
      '2025-02-01': {
        planned: true,
        actual: true,
        planCost: 1000000,
        actualCost: 950000,
      },
    },
  });

  // 6. Initialize ViewModeManager
  const viewModeManager = new ViewModeManager(
    taskManager.getAllTasks(),
    assetManager.getAllAssets(),
    associationManager.getAllAssociations(),
    hierarchyManager.getHierarchyDefinition()
  );

  // 7. Get equipment-based view
  console.log('=== Equipment-Based View ===');
  const equipmentRows = viewModeManager.getEquipmentBasedData();
  equipmentRows.forEach(row => {
    if (row.type === 'asset') {
      console.log(`Asset: ${row.assetName} (${row.assetId})`);
      console.log(`  Tasks: ${row.tasks?.length || 0}`);
      row.tasks?.forEach(task => {
        console.log(`    - ${task.taskName} [${task.classification}]`);
      });
    }
  });

  // 8. Switch to task-based view
  viewModeManager.switchMode('task-based', true);
  console.log('\n=== Task-Based View ===');
  const taskRows = viewModeManager.getTaskBasedData();
  taskRows.forEach(row => {
    if (row.type === 'classification') {
      console.log(`Classification: ${row.classification}`);
    } else if (row.type === 'workOrderLine') {
      console.log(`  Task: ${row.taskName}`);
    } else if (row.type === 'asset') {
      console.log(`    Asset: ${row.assetName} (${row.assetId})`);
    }
  });

  // 9. Apply filters
  console.log('\n=== Filtered View (Classification 01) ===');
  viewModeManager.applyFilters({
    taskClassification: '01',
  });
  const filteredRows = viewModeManager.getTaskBasedData();
  console.log(`Filtered rows: ${filteredRows.length}`);

  // 10. Time scale aggregation
  console.log('\n=== Time Scale Aggregation ===');
  const schedule = assoc1.schedule;
  const monthlyAggregated = viewModeManager.aggregateScheduleByTimeScale(
    schedule,
    'month'
  );
  Object.entries(monthlyAggregated).forEach(([month, status]) => {
    const symbol = viewModeManager.getDisplaySymbol(status);
    console.log(`${month}: ${symbol} (Count: ${status.count})`);
  });

  return {
    taskManager,
    assetManager,
    associationManager,
    hierarchyManager,
    viewModeManager,
  };
}

/**
 * Example: Demonstrating data consistency across view modes
 */
export function demonstrateDataConsistency() {
  const managers = demonstrateCompleteWorkflow();
  const { viewModeManager } = managers;

  // Get data in equipment-based mode
  viewModeManager.switchMode('equipment-based', false);
  const equipmentData = viewModeManager.getEquipmentBasedData();
  const equipmentAssetCount = equipmentData.filter(r => r.type === 'asset').length;

  // Get data in task-based mode
  viewModeManager.switchMode('task-based', false);
  const taskData = viewModeManager.getTaskBasedData();
  const taskAssetCount = taskData.filter(r => r.type === 'asset').length;

  console.log('\n=== Data Consistency Check ===');
  console.log(`Equipment-based asset rows: ${equipmentAssetCount}`);
  console.log(`Task-based asset rows: ${taskAssetCount}`);
  console.log(`Consistent: ${equipmentAssetCount === 2 && taskAssetCount === 3}`);
  // Note: Task-based shows 3 because it shows asset-task associations (3 associations)
  // Equipment-based shows 2 because it shows unique assets (2 assets)
}

/**
 * Example: Performance with large dataset
 */
export function demonstratePerformance() {
  const taskManager = new TaskManager();
  const assetManager = new AssetManager();
  const associationManager = new AssociationManager();
  const hierarchyManager = new HierarchyManager(assetManager);

  // Set up hierarchy
  hierarchyManager.addHierarchyLevel('製油所', 1);
  hierarchyManager.addHierarchyValue('製油所', '第一製油所');

  // Create 100 tasks
  const tasks = [];
  for (let i = 1; i <= 100; i++) {
    const task = taskManager.createTask({
      name: `作業${i}`,
      description: `作業${i}の説明`,
      classification: String(Math.floor((i - 1) / 5) + 1).padStart(2, '0'),
    });
    tasks.push(task);
  }

  // Create 1000 assets
  const assets = [];
  for (let i = 1; i <= 1000; i++) {
    const asset = assetManager.createAsset({
      id: `ASSET-${String(i).padStart(4, '0')}`,
      name: `機器${i}`,
      hierarchyPath: { '製油所': '第一製油所' },
      specifications: [],
    });
    assets.push(asset);
  }

  // Create associations (each asset has 5 tasks)
  for (const asset of assets) {
    for (let i = 0; i < 5; i++) {
      const task = tasks[Math.floor(Math.random() * tasks.length)];
      associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-01-01': {
            planned: true,
            actual: false,
            planCost: 100000,
            actualCost: 0,
          },
        },
      });
    }
  }

  // Initialize ViewModeManager
  const viewModeManager = new ViewModeManager(
    taskManager.getAllTasks(),
    assetManager.getAllAssets(),
    associationManager.getAllAssociations(),
    hierarchyManager.getHierarchyDefinition()
  );

  // Measure performance
  console.log('\n=== Performance Test ===');
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Assets: ${assets.length}`);
  console.log(`Associations: ${associationManager.getAllAssociations().length}`);

  // Equipment-based view
  const equipmentStart = performance.now();
  const equipmentRows = viewModeManager.getEquipmentBasedData();
  const equipmentEnd = performance.now();
  console.log(`\nEquipment-based view: ${equipmentRows.length} rows`);
  console.log(`Time: ${(equipmentEnd - equipmentStart).toFixed(2)}ms`);

  // Task-based view
  const taskStart = performance.now();
  const taskRows = viewModeManager.getTaskBasedData();
  const taskEnd = performance.now();
  console.log(`\nTask-based view: ${taskRows.length} rows`);
  console.log(`Time: ${(taskEnd - taskStart).toFixed(2)}ms`);

  // Mode switching
  const switchStart = performance.now();
  viewModeManager.switchMode('equipment-based', true);
  viewModeManager.switchMode('task-based', true);
  const switchEnd = performance.now();
  console.log(`\nMode switching: ${(switchEnd - switchStart).toFixed(2)}ms`);
}

// Uncomment to run examples:
// demonstrateCompleteWorkflow();
// demonstrateDataConsistency();
// demonstratePerformance();
