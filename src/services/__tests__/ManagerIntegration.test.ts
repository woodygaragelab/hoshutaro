/**
 * Integration tests for UndoRedoManager with all managers
 * 
 * Tests that all managers properly push state to the UndoRedoManager
 * when performing operations.
 */

import { TaskManager } from '../TaskManager';
import { AssetManager } from '../AssetManager';
import { AssociationManager } from '../AssociationManager';
import { HierarchyManager } from '../HierarchyManager';
import { UndoRedoManager } from '../UndoRedoManager';

describe('Manager Integration with UndoRedoManager', () => {
  let undoRedoManager: UndoRedoManager;
  let taskManager: TaskManager;
  let assetManager: AssetManager;
  let associationManager: AssociationManager;
  let hierarchyManager: HierarchyManager;

  beforeEach(() => {
    undoRedoManager = new UndoRedoManager();
    taskManager = new TaskManager([], undoRedoManager);
    assetManager = new AssetManager(undoRedoManager);
    associationManager = new AssociationManager(undoRedoManager);
    hierarchyManager = new HierarchyManager(assetManager, undefined, undoRedoManager);
  });

  describe('TaskManager Integration', () => {
    it('should push state when creating a task', () => {
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('CREATE_TASK');
      expect(state.data.task.name).toBe('Test Task');
    });

    it('should push state when updating a task', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      taskManager.updateTask(task.id, { name: 'Updated Task' });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_TASK');
      expect(state.data.previousTask.name).toBe('Test Task');
      expect(state.data.updatedTask.name).toBe('Updated Task');
    });

    it('should push state when deleting a task', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      taskManager.deleteTask(task.id);

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('DELETE_TASK');
      expect(state.data.task.id).toBe(task.id);
    });
  });

  describe('AssetManager Integration', () => {
    it('should push state when creating an asset', () => {
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_ASSET');
      expect(state.data.asset.id).toBe('P-101');
      expect(state.data.isCreate).toBe(true);
    });

    it('should push state when updating an asset', () => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      assetManager.updateAsset('P-101', { name: 'Updated Pump' });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_ASSET');
      expect(state.data.previousAsset.name).toBe('Test Pump');
      expect(state.data.updatedAsset.name).toBe('Updated Pump');
    });

    it('should push state when deleting an asset', () => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      assetManager.deleteAsset('P-101');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_ASSET');
      expect(state.data.asset.id).toBe('P-101');
      expect(state.data.isDelete).toBe(true);
    });

    it('should push state when updating specifications', () => {
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [{ key: 'Type', value: 'Centrifugal', order: 1 }],
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      assetManager.updateSpecifications('P-101', [
        { key: 'Type', value: 'Rotary', order: 1 },
      ]);

      expect(undoRedoManager.getUndoStackSize()).toBe(2); // UPDATE_ASSET + UPDATE_SPECIFICATION
      const specState = undoRedoManager.getUndoStack()[1];
      expect(specState.action).toBe('UPDATE_SPECIFICATION');
      expect(specState.data.assetId).toBe('P-101');
    });
  });

  describe('AssociationManager Integration', () => {
    it('should push state when creating an association', () => {
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      associationManager.createAssociation({
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {},
      });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('CREATE_ASSOCIATION');
      expect(state.data.association.assetId).toBe('P-101');
    });

    it('should push state when updating an association', () => {
      const assoc = associationManager.createAssociation({
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {},
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      associationManager.updateAssociation(assoc.id, {
        schedule: { '2025-01': { planned: true, actual: false, planCost: 1000, actualCost: 0 } },
      });

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_ASSOCIATION');
    });

    it('should push state when deleting an association', () => {
      const assoc = associationManager.createAssociation({
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {},
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      associationManager.deleteAssociation(assoc.id);

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('DELETE_ASSOCIATION');
      expect(state.data.association.id).toBe(assoc.id);
    });
  });

  describe('HierarchyManager Integration', () => {
    it('should push state when adding a hierarchy level', () => {
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.addHierarchyLevel('製油所', 1);

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('ADD_LEVEL');
      expect(state.data.levelKey).toBe('製油所');
    });

    it('should push state when removing a hierarchy level', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyLevel('エリア', 2);

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.removeHierarchyLevel('エリア');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('REMOVE_LEVEL');
      expect(state.data.levelKey).toBe('エリア');
    });

    it('should push state when reordering a hierarchy level', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.reorderHierarchyLevel('製油所', 2);

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('REORDER_LEVEL');
      expect(state.data.oldOrder).toBe(1);
      expect(state.data.newOrder).toBe(2);
    });

    it('should push state when updating a hierarchy level key', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.updateHierarchyLevelKey('製油所', 'Refinery');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('UPDATE_LEVEL_KEY');
      expect(state.data.oldKey).toBe('製油所');
      expect(state.data.newKey).toBe('Refinery');
    });

    it('should push state when adding a hierarchy value', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('ADD_VALUE');
      expect(state.data.value).toBe('第一製油所');
    });

    it('should push state when updating a hierarchy value', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.updateHierarchyValue('製油所', '第一製油所', '第二製油所');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('UPDATE_VALUE');
      expect(state.data.oldValue).toBe('第一製油所');
      expect(state.data.newValue).toBe('第二製油所');
    });

    it('should push state when deleting a hierarchy value', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.deleteHierarchyValue('製油所', '第一製油所');

      expect(undoRedoManager.getUndoStackSize()).toBe(1);
      const state = undoRedoManager.getUndoStack()[0];
      expect(state.action).toBe('UPDATE_HIERARCHY');
      expect(state.data.action).toBe('DELETE_VALUE');
      expect(state.data.value).toBe('第一製油所');
    });

    it('should push state when reassigning asset hierarchy', () => {
      hierarchyManager.addHierarchyLevel('製油所', 1);
      hierarchyManager.addHierarchyValue('製油所', '第一製油所');
      hierarchyManager.addHierarchyValue('製油所', '第二製油所');

      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      undoRedoManager.clear();
      expect(undoRedoManager.getUndoStackSize()).toBe(0);

      hierarchyManager.reassignAssetHierarchy('P-101', { '製油所': '第二製油所' });

      // Should have 2 states: UPDATE_ASSET from AssetManager + REASSIGN_HIERARCHY from HierarchyManager
      expect(undoRedoManager.getUndoStackSize()).toBe(2);
      const reassignState = undoRedoManager.getUndoStack()[1];
      expect(reassignState.action).toBe('REASSIGN_HIERARCHY');
      expect(reassignState.data.assetId).toBe('P-101');
      expect(reassignState.data.oldHierarchyPath['製油所']).toBe('第一製油所');
      expect(reassignState.data.newHierarchyPath['製油所']).toBe('第二製油所');
    });
  });

  describe('Multiple Operations', () => {
    it('should track multiple operations across different managers', () => {
      // Create a task
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      // Create an asset
      assetManager.createAsset({
        id: 'P-101',
        name: 'Test Pump',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [],
      });

      // Create an association
      associationManager.createAssociation({
        assetId: 'P-101',
        taskId: task.id,
        schedule: {},
      });

      // Should have 3 operations in the undo stack
      expect(undoRedoManager.getUndoStackSize()).toBe(3);
      
      const states = undoRedoManager.getUndoStack();
      expect(states[0].action).toBe('CREATE_TASK');
      expect(states[1].action).toBe('UPDATE_ASSET');
      expect(states[2].action).toBe('CREATE_ASSOCIATION');
    });

    it('should clear redo stack when new operation is performed', () => {
      const task = taskManager.createTask({
        name: 'Test Task',
        description: 'Test Description',
        classification: '01',
      });

      // Undo the creation
      undoRedoManager.undo();
      expect(undoRedoManager.canRedo()).toBe(true);

      // Perform a new operation
      taskManager.createTask({
        name: 'Another Task',
        description: 'Another Description',
        classification: '02',
      });

      // Redo stack should be cleared
      expect(undoRedoManager.canRedo()).toBe(false);
    });
  });
});
