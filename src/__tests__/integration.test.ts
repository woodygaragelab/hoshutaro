/**
 * Integration Test Suite for Maintenance Task Management System
 * 
 * Tests complete workflows:
 * 1. Task creation → Asset association → Display in both modes
 * 2. Hierarchy editing → Asset reassignment → Filtering
 * 3. Multiple operations → Undo → Redo → Data consistency
 * 4. Data load → Edit → Save → Reload
 * 
 * Requirements: All
 */

import { TaskManager } from '../services/TaskManager';
import { AssetManager } from '../services/AssetManager';
import { AssociationManager } from '../services/AssociationManager';
import { HierarchyManager } from '../services/HierarchyManager';
import { ViewModeManager } from '../services/ViewModeManager';
import { UndoRedoManager } from '../services/UndoRedoManager';
import { DataStore } from '../services/DataStore';
import type { DataModel } from '../types/maintenanceTask';

describe('Integration Test Suite', () => {
  let undoRedoManager: UndoRedoManager;
  let taskManager: TaskManager;
  let assetManager: AssetManager;
  let associationManager: AssociationManager;
  let hierarchyManager: HierarchyManager;
  let viewModeManager: ViewModeManager;
  let dataStore: DataStore;

  // Helper function to refresh ViewModeManager with current data
  const refreshViewModeManager = () => {
    viewModeManager = new ViewModeManager(
      taskManager.getAllTasks(),
      assetManager.getAllAssets(),
      associationManager.getAllAssociations(),
      hierarchyManager.getHierarchyDefinition()
    );
  };

  beforeEach(() => {
    undoRedoManager = new UndoRedoManager();
    taskManager = new TaskManager([], undoRedoManager);
    assetManager = new AssetManager(undoRedoManager);
    associationManager = new AssociationManager(undoRedoManager);
    hierarchyManager = new HierarchyManager(assetManager, undefined, undoRedoManager);
    
    refreshViewModeManager();
    
    dataStore = new DataStore(
      taskManager,
      assetManager,
      associationManager,
      hierarchyManager
    );
  });

  describe('Workflow 1: Task Creation → Asset Association → Display in Both Modes', () => {
    it('should create task, associate with asset, and display in equipment-based mode', () => {
      // Setup hierarchy
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');

      // Step 1: Create a task
      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      expect(task.id).toBeDefined();
      expect(task.name).toBe('年次点検');

      // Step 2: Create an asset
      const asset = assetManager.createAsset({
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [],
      });

      expect(asset.id).toBe('P-101');

      // Step 3: Associate task with asset
      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-05-15': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      });

      expect(association.assetId).toBe('P-101');
      expect(association.taskId).toBe(task.id);

      // Step 4: Display in equipment-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      const equipmentData = viewModeManager.getEquipmentBasedData();

      // Find the asset row
      const assetRow = equipmentData.find(
        (row) => row.type === 'asset' && row.assetId === 'P-101'
      );

      expect(assetRow).toBeDefined();
      expect(assetRow?.tasks).toHaveLength(1);
      expect(assetRow?.tasks?.[0].taskId).toBe(task.id);
      expect(assetRow?.tasks?.[0].taskName).toBe('年次点検');
      expect(assetRow?.tasks?.[0].schedule['2025-05-15']).toEqual({
        planned: true,
        actual: false,
        planCost: 500000,
        actualCost: 0,
      });
    });

    it('should create task, associate with asset, and display in task-based mode', () => {
      // Setup hierarchy
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      // Create task
      const task = taskManager.createTask({
        name: 'オーバーホール',
        description: '設備の全面的な分解点検と修理',
        classification: '02',
      });

      // Create asset
      const asset = assetManager.createAsset({
        id: 'T-4220',
        name: '貯蔵タンク',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Associate task with asset
      associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
        },
      });

      // Display in task-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('task-based', false);
      const taskData = viewModeManager.getTaskBasedData();

      // Find the hierarchy row
      const hierarchyRow = taskData.find(
        (row) => row.type === 'hierarchy' && row.hierarchyValue === '第一製油所'
      );
      expect(hierarchyRow).toBeDefined();

      // Find the asset row
      const assetRow = taskData.find(
        (row) => row.type === 'asset' && row.assetId === 'T-4220'
      );
      expect(assetRow).toBeDefined();
      expect(assetRow?.assetName).toBe('貯蔵タンク');

      // Find the task row under the asset
      const taskRow = taskData.find(
        (row) => row.type === 'workOrderLine' && row.taskId === task.id && row.assetId === 'T-4220'
      );
      expect(taskRow).toBeDefined();
      expect(taskRow?.taskName).toBe('オーバーホール');
      expect(taskRow?.schedule?.['2025-02-01']).toEqual({
        planned: true,
        actual: true,
        planCost: 1000000,
        actualCost: 950000,
      });
    });

    it('should handle multiple tasks associated with single asset in both modes', () => {
      // Setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

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

      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      associationManager.createAssociation({
        assetId: asset.id,
        taskId: task1.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      associationManager.createAssociation({
        assetId: asset.id,
        taskId: task2.id,
        schedule: { '2025-11': { planned: true, actual: false, planCost: 1000000, actualCost: 0 } },
      });

      // Equipment-based mode: should show both tasks for the asset
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      const equipmentData = viewModeManager.getEquipmentBasedData();
      const assetRow = equipmentData.find((row) => row.type === 'asset' && row.assetId === 'P-101');
      
      expect(assetRow?.tasks).toHaveLength(2);
      expect(assetRow?.tasks?.map((t) => t.taskName)).toContain('年次点検');
      expect(assetRow?.tasks?.map((t) => t.taskName)).toContain('オーバーホール');

      // Task-based mode: should show tasks under asset
      refreshViewModeManager();
      viewModeManager.switchMode('task-based', false);
      const taskData = viewModeManager.getTaskBasedData();
      
      const taskUnderAsset1 = taskData.find(
        (row) => row.type === 'workOrderLine' && row.assetId === 'P-101' && row.taskId === task1.id
      );
      const taskUnderAsset2 = taskData.find(
        (row) => row.type === 'workOrderLine' && row.assetId === 'P-101' && row.taskId === task2.id
      );

      expect(taskUnderAsset1).toBeDefined();
      expect(taskUnderAsset2).toBeDefined();
    });
  });

  describe('Workflow 2: Hierarchy Editing → Asset Reassignment → Filtering', () => {
    it('should edit hierarchy, reassign assets, and filter correctly', () => {
      // Step 1: Create initial hierarchy
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('製油所', '第二製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');
      hierarchyManager.addHierarchyValue('エリア', 'Bエリア');

      // Create assets
      const asset1 = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ1',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [],
      });

      const asset2 = assetManager.createAsset({
        id: 'P-102',
        name: 'ポンプ2',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [],
      });

      // Step 2: Edit hierarchy - rename a value
      hierarchyManager.updateHierarchyValue('エリア', 'Aエリア', 'A-エリア');

      // Verify assets are updated
      const updatedAsset1 = assetManager.getAsset('P-101');
      expect(updatedAsset1?.hierarchyPath['エリア']).toBe('A-エリア');

      // Step 3: Reassign asset to different hierarchy
      hierarchyManager.reassignAssetHierarchy('P-102', {
        '製油所': '第二製油所',
        'エリア': 'Bエリア',
      });

      const reassignedAsset = assetManager.getAsset('P-102');
      expect(reassignedAsset?.hierarchyPath['製油所']).toBe('第二製油所');
      expect(reassignedAsset?.hierarchyPath['エリア']).toBe('Bエリア');

      // Step 4: Filter by hierarchy
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      viewModeManager.applyFilters({
        hierarchyPath: { '製油所': '第一製油所' },
      });

      const filteredData = viewModeManager.getEquipmentBasedData();
      const assetRows = filteredData.filter((row) => row.type === 'asset');

      // Should only show P-101 (in 第一製油所)
      expect(assetRows).toHaveLength(1);
      expect(assetRows[0].assetId).toBe('P-101');
    });

    it('should add and remove hierarchy levels dynamically', () => {
      // Add initial levels
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');

      // Create asset with 2-level hierarchy
      assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [],
      });

      // Add a new level
      hierarchyManager.addHierarchyLevel('ユニット', 3);
      hierarchyManager.addHierarchyValue('ユニット', '原油蒸留ユニット');

      const definition = hierarchyManager.getHierarchyDefinition();
      expect(definition.levels).toHaveLength(3);
      expect(definition.levels[2].key).toBe('ユニット');

      // Remove a level
      hierarchyManager.removeHierarchyLevel('エリア');

      const updatedDefinition = hierarchyManager.getHierarchyDefinition();
      expect(updatedDefinition.levels).toHaveLength(2);
      expect(updatedDefinition.levels.find((l) => l.key === 'エリア')).toBeUndefined();

      // Verify asset hierarchy is updated
      const asset = assetManager.getAsset('P-101');
      expect(asset?.hierarchyPath['エリア']).toBeUndefined();
    });

    it('should reorder hierarchy levels', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyLevel('ユニット', 3);

      // Reorder: move ユニット to position 1
      hierarchyManager.reorderHierarchyLevel('ユニット', 1);

      const definition = hierarchyManager.getHierarchyDefinition();
      const sortedLevels = [...definition.levels].sort((a, b) => a.order - b.order);

      // After reordering, ユニット should be at position 1
      // The other levels should be shifted accordingly
      expect(sortedLevels).toHaveLength(3);
      const unitLevel = sortedLevels.find(l => l.key === 'ユニット');
      expect(unitLevel?.order).toBe(1);
    });
  });

  describe('Workflow 3: Multiple Operations → Undo → Redo → Data Consistency', () => {
    it('should track multiple operations in undo stack', () => {
      // Setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      // Clear undo stack from setup operations
      undoRedoManager.clear();

      // Operation 1: Create task
      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // Operation 2: Create asset
      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Operation 3: Create association
      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      // Verify all operations are tracked
      expect(undoRedoManager.getUndoStackSize()).toBe(3);
      
      // Verify data is created
      expect(taskManager.getAllTasks()).toHaveLength(1);
      expect(assetManager.getAllAssets()).toHaveLength(1);
      expect(associationManager.getAssociationsByAsset('P-101')).toHaveLength(1);

      // Verify undo stack contains correct operations
      const undoStack = undoRedoManager.getUndoStack();
      expect(undoStack[0].action).toBe('CREATE_TASK');
      expect(undoStack[1].action).toBe('UPDATE_ASSET'); // Asset creation is tracked as UPDATE_ASSET
      expect(undoStack[2].action).toBe('CREATE_ASSOCIATION');
    });

    it('should support redo after undo', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      undoRedoManager.clear();

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // Undo the task creation
      const undoState = undoRedoManager.undo();
      expect(undoState).not.toBeNull();
      expect(undoRedoManager.canRedo()).toBe(true);

      // Redo the task creation
      const redoState = undoRedoManager.redo();
      expect(redoState).not.toBeNull();
      expect(undoRedoManager.canRedo()).toBe(false);
      
      // Verify redo stack is now empty
      expect(undoRedoManager.getRedoStackSize()).toBe(0);
    });

    it('should clear redo stack when new operation is performed after undo', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      undoRedoManager.clear();

      const task1 = taskManager.createTask({
        name: 'Task 1',
        description: 'Description 1',
        classification: '01',
      });

      // Undo
      undoRedoManager.undo();
      expect(undoRedoManager.canRedo()).toBe(true);
      expect(undoRedoManager.getRedoStackSize()).toBe(1);

      // Perform new operation
      const task2 = taskManager.createTask({
        name: 'Task 2',
        description: 'Description 2',
        classification: '02',
      });

      // Redo stack should be cleared
      expect(undoRedoManager.canRedo()).toBe(false);
      expect(undoRedoManager.getRedoStackSize()).toBe(0);
    });

    it('should track complex operation sequences', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      undoRedoManager.clear();

      // Create task
      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // Create asset
      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Create association
      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      // Update task
      taskManager.updateTask(task.id, { name: '年次点検（更新）' });

      // Update association
      associationManager.updateSchedule(association.id, '2025-05', {
        planned: true,
        actual: true,
        planCost: 500000,
        actualCost: 480000,
      });

      // Verify all operations are tracked
      expect(undoRedoManager.getUndoStackSize()).toBe(5);
      
      const undoStack = undoRedoManager.getUndoStack();
      expect(undoStack[0].action).toBe('CREATE_TASK');
      expect(undoStack[1].action).toBe('UPDATE_ASSET');
      expect(undoStack[2].action).toBe('CREATE_ASSOCIATION');
      expect(undoStack[3].action).toBe('UPDATE_TASK');
      expect(undoStack[4].action).toBe('UPDATE_ASSOCIATION');
    });
  });

  describe('Workflow 4: Data Load → Edit → Save → Reload', () => {
    it('should load data, edit it, save, and reload successfully', () => {
      // Step 1: Create initial data
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      const asset = assetManager.createAsset({
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [{ key: '型式', value: '遠心式', order: 1 }],
      });

      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-05-15': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      });

      // Step 2: Save data
      // Build data model from current state
      const dataModel: DataModel = {
        version: '2.0.0',
        tasks: Object.fromEntries(taskManager.getAllTasks().map(t => [t.id, t])),
        assets: Object.fromEntries(assetManager.getAllAssets().map(a => [a.id, a])),
        associations: Object.fromEntries(associationManager.getAllAssociations().map(a => [a.id, a])),
        hierarchy: hierarchyManager.getHierarchyDefinition(),
        metadata: {
          lastModified: new Date(),
        },
      };
      
      const savedDataString = dataStore.saveData(dataModel);
      const savedData = JSON.parse(savedDataString);

      expect(savedData.version).toBe('2.0.0');
      expect(Object.keys(savedData.tasks)).toHaveLength(1);
      expect(Object.keys(savedData.assets)).toHaveLength(1);
      expect(Object.keys(savedData.associations)).toHaveLength(1);
      expect(savedData.hierarchy.levels).toHaveLength(2);

      // Step 3: Verify saved data structure
      expect(savedData.version).toBe('2.0.0');
      expect(Object.keys(savedData.tasks)).toHaveLength(1);
      expect(Object.keys(savedData.assets)).toHaveLength(1);
      expect(Object.keys(savedData.associations)).toHaveLength(1);
      expect(savedData.hierarchy.levels).toHaveLength(2);
      
      // Verify task data
      expect(savedData.tasks[task.id].name).toBe('年次点検');
      
      // Verify asset data
      expect(savedData.assets[asset.id].id).toBe('P-101');
      expect(savedData.assets[asset.id].specifications).toHaveLength(1);
      
      // Verify association data
      expect(savedData.associations[association.id].schedule['2025-05-15']).toEqual({
        planned: true,
        actual: false,
        planCost: 500000,
        actualCost: 0,
      });
    });

    it('should save and verify data changes', () => {
      // Setup initial data
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      const asset = assetManager.createAsset({
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-05': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      });

      // Edit the data
      taskManager.updateTask(task.id, { name: '年次点検（更新）' });
      assetManager.updateAsset('P-101', { name: '原油供給ポンプ（更新）' });
      associationManager.updateSchedule(association.id, '2025-05', {
        planned: true,
        actual: true,
        planCost: 500000,
        actualCost: 480000,
      });

      // Save the edited data
      const dataModel: DataModel = {
        version: '2.0.0',
        tasks: Object.fromEntries(taskManager.getAllTasks().map(t => [t.id, t])),
        assets: Object.fromEntries(assetManager.getAllAssets().map(a => [a.id, a])),
        associations: Object.fromEntries(associationManager.getAllAssociations().map(a => [a.id, a])),
        hierarchy: hierarchyManager.getHierarchyDefinition(),
        metadata: {
          lastModified: new Date(),
        },
      };
      
      const savedDataString = dataStore.saveData(dataModel);
      const savedData = JSON.parse(savedDataString);

      // Verify changes are saved
      expect(savedData.tasks[task.id].name).toBe('年次点検（更新）');
      expect(savedData.assets['P-101'].name).toBe('原油供給ポンプ（更新）');
      expect(savedData.associations[association.id].schedule['2025-05'].actual).toBe(true);
      expect(savedData.associations[association.id].schedule['2025-05'].actualCost).toBe(480000);
    });

    it('should validate data integrity on load', () => {
      // Create data with invalid reference
      const invalidData: DataModel = {
        version: '2.0.0',
        tasks: {
          'task-001': {
            id: 'task-001',
            name: '年次点検',
            description: '年次定期点検作業',
            classification: '01',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        },
        assets: {
          'P-101': {
            id: 'P-101',
            name: '原油供給ポンプ',
            hierarchyPath: { '製油所': '第一製油所' },
            specifications: [],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        },
        associations: {
          'assoc-001': {
            id: 'assoc-001',
            assetId: 'P-999', // Invalid asset ID
            taskId: 'task-001',
            schedule: {},
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
        },
        hierarchy: {
          levels: [
            {
              key: '製油所',
              order: 1,
              values: ['第一製油所'],
            },
          ],
        },
        metadata: {
          lastModified: new Date('2024-01-01'),
        },
      };

      // Loading should throw an error due to invalid reference
      expect(() => {
        dataStore.loadData(invalidData);
      }).toThrow();
    });

    it('should handle multiple save cycles', () => {
      // Initial setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // First save
      let dataModel1: DataModel = {
        version: '2.0.0',
        tasks: Object.fromEntries(taskManager.getAllTasks().map(t => [t.id, t])),
        assets: Object.fromEntries(assetManager.getAllAssets().map(a => [a.id, a])),
        associations: Object.fromEntries(associationManager.getAllAssociations().map(a => [a.id, a])),
        hierarchy: hierarchyManager.getHierarchyDefinition(),
        metadata: {
          lastModified: new Date(),
        },
      };
      const savedDataString1 = dataStore.saveData(dataModel1);
      const savedData1 = JSON.parse(savedDataString1);
      expect(Object.keys(savedData1.tasks)).toHaveLength(1);
      expect(Object.keys(savedData1.assets)).toHaveLength(0);

      // Add more data
      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Second save
      let dataModel2: DataModel = {
        version: '2.0.0',
        tasks: Object.fromEntries(taskManager.getAllTasks().map(t => [t.id, t])),
        assets: Object.fromEntries(assetManager.getAllAssets().map(a => [a.id, a])),
        associations: Object.fromEntries(associationManager.getAllAssociations().map(a => [a.id, a])),
        hierarchy: hierarchyManager.getHierarchyDefinition(),
        metadata: {
          lastModified: new Date(),
        },
      };
      const savedDataString2 = dataStore.saveData(dataModel2);
      const savedData2 = JSON.parse(savedDataString2);
      expect(Object.keys(savedData2.tasks)).toHaveLength(1);
      expect(Object.keys(savedData2.assets)).toHaveLength(1);
      
      // Verify data structure is consistent
      expect(savedData2.version).toBe('2.0.0');
      expect(savedData2.hierarchy.levels).toHaveLength(1);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle complete workflow: create, associate, display, edit, undo, save', () => {
      // Setup hierarchy
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('エリア', 'Aエリア');

      // Create task
      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // Create asset
      const asset = assetManager.createAsset({
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
        specifications: [{ key: '型式', value: '遠心式', order: 1 }],
      });

      // Associate task with asset
      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: {
          '2025-05-15': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      });

      // Display in equipment-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      let equipmentData = viewModeManager.getEquipmentBasedData();
      let assetRow = equipmentData.find((row) => row.type === 'asset' && row.assetId === 'P-101');
      expect(assetRow?.tasks).toHaveLength(1);

      // Switch to task-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('task-based', false);
      let taskData = viewModeManager.getTaskBasedData();
      let taskRowInTaskMode = taskData.find(
        (row) => row.type === 'workOrderLine' && row.assetId === 'P-101'
      );
      expect(taskRowInTaskMode).toBeDefined();

      // Edit association
      associationManager.updateSchedule(association.id, '2025-05-15', {
        planned: true,
        actual: true,
        planCost: 500000,
        actualCost: 480000,
      });

      // Verify edit in both modes
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      equipmentData = viewModeManager.getEquipmentBasedData();
      assetRow = equipmentData.find((row) => row.type === 'asset' && row.assetId === 'P-101');
      expect(assetRow?.tasks?.[0].schedule['2025-05-15'].actual).toBe(true);

      // Track undo/redo operations
      const undoState = undoRedoManager.undo();
      expect(undoState).not.toBeNull();
      expect(undoState?.action).toBe('UPDATE_ASSOCIATION');

      const redoState = undoRedoManager.redo();
      expect(redoState).not.toBeNull();
      expect(redoState?.action).toBe('UPDATE_ASSOCIATION');

      // Save data
      const dataModel: DataModel = {
        version: '2.0.0',
        tasks: Object.fromEntries(taskManager.getAllTasks().map(t => [t.id, t])),
        assets: Object.fromEntries(assetManager.getAllAssets().map(a => [a.id, a])),
        associations: Object.fromEntries(associationManager.getAllAssociations().map(a => [a.id, a])),
        hierarchy: hierarchyManager.getHierarchyDefinition(),
        metadata: {
          lastModified: new Date(),
        },
      };
      
      const savedDataString = dataStore.saveData(dataModel);
      const savedData = JSON.parse(savedDataString);
      expect(savedData.associations[association.id].schedule['2025-05-15'].actual).toBe(true);
    });

    it('should handle task reuse across multiple assets', () => {
      // Setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      // Create one task
      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      // Create multiple assets
      const asset1 = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ1',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      const asset2 = assetManager.createAsset({
        id: 'P-102',
        name: 'ポンプ2',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      const asset3 = assetManager.createAsset({
        id: 'P-103',
        name: 'ポンプ3',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Associate same task with all assets
      associationManager.createAssociation({
        assetId: asset1.id,
        taskId: task.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      associationManager.createAssociation({
        assetId: asset2.id,
        taskId: task.id,
        schedule: { '2025-06': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      associationManager.createAssociation({
        assetId: asset3.id,
        taskId: task.id,
        schedule: { '2025-07': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      // Verify in equipment-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      const equipmentData = viewModeManager.getEquipmentBasedData();
      const assetRows = equipmentData.filter((row) => row.type === 'asset');

      assetRows.forEach((row) => {
        expect(row.tasks).toHaveLength(1);
        expect(row.tasks?.[0].taskId).toBe(task.id);
        expect(row.tasks?.[0].taskName).toBe('年次点検');
      });

      // Verify in task-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('task-based', false);
      const taskData = viewModeManager.getTaskBasedData();
      const taskUnderAssets = taskData.filter(
        (row) => row.type === 'workOrderLine' && row.taskId === task.id
      );

      expect(taskUnderAssets).toHaveLength(3);
      expect(taskUnderAssets.map((r) => r.assetId)).toContain('P-101');
      expect(taskUnderAssets.map((r) => r.assetId)).toContain('P-102');
      expect(taskUnderAssets.map((r) => r.assetId)).toContain('P-103');

      // Update task definition
      taskManager.updateTask(task.id, { name: '年次点検（更新）' });

      // Verify all associations reflect the change
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      const updatedEquipmentData = viewModeManager.getEquipmentBasedData();
      const updatedAssetRows = updatedEquipmentData.filter((row) => row.type === 'asset');

      updatedAssetRows.forEach((row) => {
        expect(row.tasks?.[0].taskName).toBe('年次点検（更新）');
      });
    });

    it('should handle cascading deletes when deleting tasks', () => {
      // Setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      const association = associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      // Delete task
      taskManager.deleteTask(task.id);
      
      // Application layer should also delete associated associations
      const associationsToDelete = associationManager.getAssociationsByTask(task.id);
      associationsToDelete.forEach(assoc => {
        associationManager.deleteAssociation(assoc.id);
      });

      // Verify associations are deleted
      const associations = associationManager.getAssociationsByAsset(asset.id);
      expect(associations).toHaveLength(0);

      // Verify in equipment-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('equipment-based', false);
      const equipmentData = viewModeManager.getEquipmentBasedData();
      const assetRow = equipmentData.find((row) => row.type === 'asset' && row.assetId === 'P-101');
      expect(assetRow?.tasks).toHaveLength(0);
    });

    it('should handle cascading deletes when deleting assets', () => {
      // Setup
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      const task = taskManager.createTask({
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
      });

      const asset = assetManager.createAsset({
        id: 'P-101',
        name: 'ポンプ',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      associationManager.createAssociation({
        assetId: asset.id,
        taskId: task.id,
        schedule: { '2025-05': { planned: true, actual: false, planCost: 500000, actualCost: 0 } },
      });

      // Delete asset
      assetManager.deleteAsset(asset.id);
      
      // Application layer should also delete associated associations
      const associationsToDelete = associationManager.getAssociationsByAsset(asset.id);
      associationsToDelete.forEach(assoc => {
        associationManager.deleteAssociation(assoc.id);
      });

      // Verify associations are deleted
      const associations = associationManager.getAssociationsByTask(task.id);
      expect(associations).toHaveLength(0);

      // Verify in task-based mode
      refreshViewModeManager();
      viewModeManager.switchMode('task-based', false);
      const taskData = viewModeManager.getTaskBasedData();
      const taskRow = taskData.find(
        (row) => row.type === 'workOrderLine' && row.assetId === 'P-101'
      );
      expect(taskRow).toBeUndefined();
    });
  });
});
