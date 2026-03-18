/**
 * EditHandlers Tests
 * 
 * Tests for view mode-aware edit handlers
 */

import { EditHandlers } from '../EditHandlers';
import { AssociationManager } from '../AssociationManager';
import { TaskManager } from '../TaskManager';
import { AssetManager } from '../AssetManager';
import {
  EditContext,
  AssociationSchedule,
  ScheduleEditRequest,
} from '../../types/maintenanceTask';

describe('EditHandlers', () => {
  let editHandlers: EditHandlers;
  let associationManager: AssociationManager;
  let taskManager: TaskManager;
  let assetManager: AssetManager;

  beforeEach(() => {
    taskManager = new TaskManager();
    assetManager = new AssetManager();
    associationManager = new AssociationManager();
    editHandlers = new EditHandlers(associationManager);

    // Create test data
    const task1 = taskManager.createTask({
      name: '年次点検',
      description: '年次定期点検',
      classification: '01',
    });

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

    // Create associations
    associationManager.createAssociation({
      assetId: asset1.id,
      taskId: task1.id,
      schedule: {
        '2025-02-01': {
          planned: true,
          actual: false,
          planCost: 100000,
          actualCost: 0,
        },
      },
    });

    associationManager.createAssociation({
      assetId: asset2.id,
      taskId: task1.id,
      schedule: {
        '2025-02-01': {
          planned: true,
          actual: false,
          planCost: 100000,
          actualCost: 0,
        },
      },
    });
  });

  describe('handleScheduleEdit', () => {
    it('should update only single association in equipment-based mode', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset',
      };

      const associations = associationManager.getAllAssociations();
      const request: ScheduleEditRequest = {
        associationId: associations[0].id,
        dateKey: '2025-02-01',
        scheduleEntry: {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        },
        context,
      };

      const updatedCount = editHandlers.handleScheduleEdit(request);

      expect(updatedCount).toBe(1);

      // Check that only the first association was updated
      const assoc1 = associationManager.getAssociation(associations[0].id);
      expect(assoc1?.schedule['2025-02-01'].actual).toBe(true);
      expect(assoc1?.schedule['2025-02-01'].actualCost).toBe(95000);

      // Check that the second association was NOT updated
      const assoc2 = associationManager.getAssociation(associations[1].id);
      expect(assoc2?.schedule['2025-02-01'].actual).toBe(false);
      expect(assoc2?.schedule['2025-02-01'].actualCost).toBe(0);
    });

    it('should update all associations with same task in task-based mode', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const associations = associationManager.getAllAssociations();
      const request: ScheduleEditRequest = {
        associationId: associations[0].id,
        dateKey: '2025-02-01',
        scheduleEntry: {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        },
        context,
      };

      const updatedCount = editHandlers.handleScheduleEdit(request);

      expect(updatedCount).toBe(2);

      // Check that both associations were updated
      const assoc1 = associationManager.getAssociation(associations[0].id);
      expect(assoc1?.schedule['2025-02-01'].actual).toBe(true);
      expect(assoc1?.schedule['2025-02-01'].actualCost).toBe(95000);

      const assoc2 = associationManager.getAssociation(associations[1].id);
      expect(assoc2?.schedule['2025-02-01'].actual).toBe(true);
      expect(assoc2?.schedule['2025-02-01'].actualCost).toBe(95000);
    });

    it('should throw error for non-existent association', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset',
      };

      const request: ScheduleEditRequest = {
        associationId: 'non-existent',
        dateKey: '2025-02-01',
        scheduleEntry: {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        },
        context,
      };

      expect(() => editHandlers.handleScheduleEdit(request)).toThrow(
        'Association with id non-existent not found'
      );
    });
  });

  describe('handleSingleAssociationEdit', () => {
    it('should update only the specified association', () => {
      const associations = associationManager.getAllAssociations();

      editHandlers.handleSingleAssociationEdit(
        associations[0].id,
        '2025-02-01',
        {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        }
      );

      // Check that only the first association was updated
      const assoc1 = associationManager.getAssociation(associations[0].id);
      expect(assoc1?.schedule['2025-02-01'].actual).toBe(true);

      // Check that the second association was NOT updated
      const assoc2 = associationManager.getAssociation(associations[1].id);
      expect(assoc2?.schedule['2025-02-01'].actual).toBe(false);
    });
  });

  describe('handleLinkedAssociationEdit', () => {
    it('should update all associations with the same task', () => {
      const associations = associationManager.getAllAssociations();
      const taskId = associations[0].taskId;

      const updatedCount = editHandlers.handleLinkedAssociationEdit(
        taskId,
        '2025-02-01',
        {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        }
      );

      expect(updatedCount).toBe(2);

      // Check that both associations were updated
      associations.forEach(assoc => {
        const updated = associationManager.getAssociation(assoc.id);
        expect(updated?.schedule['2025-02-01'].actual).toBe(true);
        expect(updated?.schedule['2025-02-01'].actualCost).toBe(95000);
      });
    });
  });

  describe('getEditScopeDescription', () => {
    it('should return correct description for equipment-based mode', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset',
      };

      const description = editHandlers.getEditScopeDescription(context);
      expect(description).toBe('この機器のスケジュールのみが更新されます');
    });

    it('should return correct description for task-based mode', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const description = editHandlers.getEditScopeDescription(context);
      expect(description).toBe('同じ作業を持つすべての機器のスケジュールが連動して更新されます');
    });
  });

  describe('willAffectMultipleAssociations', () => {
    it('should return false for equipment-based mode with single asset', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset',
      };

      const associations = associationManager.getAllAssociations();
      const result = editHandlers.willAffectMultipleAssociations(
        associations[0].id,
        context
      );

      expect(result).toBe(false);
    });

    it('should return true for task-based mode with multiple assets', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const associations = associationManager.getAllAssociations();
      const result = editHandlers.willAffectMultipleAssociations(
        associations[0].id,
        context
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent association', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const result = editHandlers.willAffectMultipleAssociations(
        'non-existent',
        context
      );

      expect(result).toBe(false);
    });
  });

  describe('getAffectedAssociationCount', () => {
    it('should return 1 for equipment-based mode', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset',
      };

      const associations = associationManager.getAllAssociations();
      const count = editHandlers.getAffectedAssociationCount(
        associations[0].id,
        context
      );

      expect(count).toBe(1);
    });

    it('should return correct count for task-based mode', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const associations = associationManager.getAllAssociations();
      const count = editHandlers.getAffectedAssociationCount(
        associations[0].id,
        context
      );

      expect(count).toBe(2);
    });

    it('should return 0 for non-existent association', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const count = editHandlers.getAffectedAssociationCount(
        'non-existent',
        context
      );

      expect(count).toBe(0);
    });
  });

  describe('Integration with multiple tasks', () => {
    it('should only update associations for the specific task', () => {
      // Create a second task
      const task2 = taskManager.createTask({
        name: 'オーバーホール',
        description: '全面点検',
        classification: '01',
      });

      const asset3 = assetManager.createAsset({
        id: 'P-103',
        name: 'ポンプ3',
        hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Bエリア' },
        specifications: [],
      });

      // Create association with different task
      associationManager.createAssociation({
        assetId: asset3.id,
        taskId: task2.id,
        schedule: {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 200000,
            actualCost: 0,
          },
        },
      });

      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'all-assets',
      };

      const associations = associationManager.getAllAssociations();
      const firstTaskAssoc = associations[0];

      const request: ScheduleEditRequest = {
        associationId: firstTaskAssoc.id,
        dateKey: '2025-02-01',
        scheduleEntry: {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        },
        context,
      };

      editHandlers.handleScheduleEdit(request);

      // Check that only associations with the first task were updated
      const assoc1 = associationManager.getAssociation(associations[0].id);
      const assoc2 = associationManager.getAssociation(associations[1].id);
      const assoc3 = associationManager.getAssociation(associations[2].id);

      expect(assoc1?.schedule['2025-02-01'].actual).toBe(true);
      expect(assoc2?.schedule['2025-02-01'].actual).toBe(true);
      expect(assoc3?.schedule['2025-02-01'].actual).toBe(false); // Different task, not updated
    });
  });

  describe('handleSpecificationEdit', () => {
    it('should update specification key', () => {
      // Create asset with specifications
      const testAsset = assetManager.createAsset({
        id: 'P-201',
        name: 'Test Asset',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 },
          { key: 'Model', value: 'ABC-123', order: 1 }
        ],
      });

      const undoRedoManager = {
        pushState: jest.fn()
      };

      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        0,
        'key',
        'Updated Type',
        undoRedoManager
      );

      const updatedAsset = assetManager.getAsset(testAsset.id);
      expect(updatedAsset?.specifications[0].key).toBe('Updated Type');
      expect(updatedAsset?.specifications[0].value).toBe('Pump'); // Value unchanged
    });

    it('should update specification value', () => {
      const testAsset = assetManager.createAsset({
        id: 'P-202',
        name: 'Test Asset 2',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 },
          { key: 'Model', value: 'ABC-123', order: 1 }
        ],
      });

      const undoRedoManager = {
        pushState: jest.fn()
      };

      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        1,
        'value',
        'XYZ-789',
        undoRedoManager
      );

      const updatedAsset = assetManager.getAsset(testAsset.id);
      expect(updatedAsset?.specifications[1].value).toBe('XYZ-789');
      expect(updatedAsset?.specifications[1].key).toBe('Model'); // Key unchanged
    });

    it('should create new specification if index does not exist', () => {
      const testAsset = assetManager.createAsset({
        id: 'P-203',
        name: 'Test Asset 3',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 }
        ],
      });

      const undoRedoManager = {
        pushState: jest.fn()
      };

      // First set the key to a valid value
      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        5,
        'key',
        'New Spec',
        undoRedoManager
      );

      // Then set the value
      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        5,
        'value',
        'New Value',
        undoRedoManager
      );

      const updatedAsset = assetManager.getAsset(testAsset.id);
      expect(updatedAsset?.specifications.length).toBeGreaterThanOrEqual(6);
      expect(updatedAsset?.specifications[5].key).toBe('New Spec');
      expect(updatedAsset?.specifications[5].value).toBe('New Value');
    });

    it('should throw error for non-existent asset', () => {
      const undoRedoManager = {
        pushState: jest.fn()
      };

      expect(() => {
        editHandlers.handleSpecificationEdit(
          assetManager,
          'non-existent-asset',
          0,
          'key',
          'Test',
          undoRedoManager
        );
      }).toThrow('Asset with id non-existent-asset not found');
    });

    it('should push state to undo manager when provided', () => {
      const testAsset = assetManager.createAsset({
        id: 'P-204',
        name: 'Test Asset 4',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 }
        ],
      });

      const undoRedoManager = {
        pushState: jest.fn()
      };

      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        0,
        'key',
        'Test Key',
        undoRedoManager
      );

      expect(undoRedoManager.pushState).toHaveBeenCalledWith('UPDATE_SPECIFICATION', {
        assetId: testAsset.id,
        previousSpecifications: expect.any(Array)
      });
    });

    it('should work without undo manager', () => {
      const testAsset = assetManager.createAsset({
        id: 'P-205',
        name: 'Test Asset 5',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 }
        ],
      });

      // Should not throw error when undoRedoManager is not provided
      expect(() => {
        editHandlers.handleSpecificationEdit(
          assetManager,
          testAsset.id,
          0,
          'key',
          'Test Key'
        );
      }).not.toThrow();

      const updatedAsset = assetManager.getAsset(testAsset.id);
      expect(updatedAsset?.specifications[0].key).toBe('Test Key');
    });

    it('should preserve other specifications when updating one', () => {
      const testAsset = assetManager.createAsset({
        id: 'P-206',
        name: 'Test Asset 6',
        hierarchyPath: { '製油所': '第一製油所' },
        specifications: [
          { key: 'Type', value: 'Pump', order: 0 },
          { key: 'Model', value: 'ABC-123', order: 1 }
        ],
      });

      const undoRedoManager = {
        pushState: jest.fn()
      };

      editHandlers.handleSpecificationEdit(
        assetManager,
        testAsset.id,
        0,
        'value',
        'Updated Pump',
        undoRedoManager
      );

      const updatedAsset = assetManager.getAsset(testAsset.id);
      expect(updatedAsset?.specifications[0].value).toBe('Updated Pump');
      expect(updatedAsset?.specifications[1].key).toBe('Model'); // Other spec unchanged
      expect(updatedAsset?.specifications[1].value).toBe('ABC-123'); // Other spec unchanged
    });
  });

});
