/**
 * Edit Scope Management Tests
 * 
 * Tests for Requirements 4.8, 5.7: User-controllable edit scope
 * Verifies that edit scope (single-asset vs all-assets) is properly managed
 */

import { EditHandlers } from '../EditHandlers';
import { AssociationManager } from '../AssociationManager';
import { UndoRedoManager } from '../UndoRedoManager';
import { EditContext, AssociationSchedule } from '../../types/maintenanceTask';

describe('EditHandlers - Edit Scope Management', () => {
  let associationManager: AssociationManager;
  let editHandlers: EditHandlers;
  let undoRedoManager: UndoRedoManager;

  beforeEach(() => {
    undoRedoManager = new UndoRedoManager();
    associationManager = new AssociationManager(undoRedoManager);
    editHandlers = new EditHandlers(associationManager);

    // Create test associations
    // Task 1 is associated with Asset A and Asset B
    associationManager.createAssociation({
      assetId: 'asset-a',
      taskId: 'task-1',
      schedule: {
        '2025-01': { planned: true, actual: false, planCost: 1000, actualCost: 0 }
      }
    });

    associationManager.createAssociation({
      assetId: 'asset-b',
      taskId: 'task-1',
      schedule: {
        '2025-01': { planned: true, actual: false, planCost: 1000, actualCost: 0 }
      }
    });

    // Task 2 is only associated with Asset A
    associationManager.createAssociation({
      assetId: 'asset-a',
      taskId: 'task-2',
      schedule: {
        '2025-01': { planned: true, actual: false, planCost: 500, actualCost: 0 }
      }
    });
  });

  describe('Equipment-based mode with single-asset scope', () => {
    it('should update only the single association', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset'
      };

      const updatedSchedule: AssociationSchedule[string] = {
        planned: true,
        actual: true,
        planCost: 1000,
        actualCost: 950
      };

      const count = editHandlers.handleScheduleEdit({
        associationId: task1Association.id,
        dateKey: '2025-01',
        scheduleEntry: updatedSchedule,
        context
      });

      // Should update only 1 association
      expect(count).toBe(1);

      // Asset A's association should be updated
      const assetAAssoc = associationManager.getAssociation(task1Association.id)!;
      expect(assetAAssoc.schedule['2025-01'].actual).toBe(true);
      expect(assetAAssoc.schedule['2025-01'].actualCost).toBe(950);

      // Asset B's association should NOT be updated
      const assetBAssocs = associationManager.getAssociationsByAsset('asset-b');
      const assetBTask1 = assetBAssocs.find(a => a.taskId === 'task-1')!;
      expect(assetBTask1.schedule['2025-01'].actual).toBe(false);
      expect(assetBTask1.schedule['2025-01'].actualCost).toBe(0);
    });
  });

  describe('Equipment-based mode with all-assets scope', () => {
    it('should update all associations with the same task', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const updatedSchedule: AssociationSchedule[string] = {
        planned: true,
        actual: true,
        planCost: 1000,
        actualCost: 950
      };

      const count = editHandlers.handleScheduleEdit({
        associationId: task1Association.id,
        dateKey: '2025-01',
        scheduleEntry: updatedSchedule,
        context
      });

      // Should update 2 associations (both Asset A and Asset B with Task 1)
      expect(count).toBe(2);

      // Asset A's association should be updated
      const assetAAssoc = associationManager.getAssociation(task1Association.id)!;
      expect(assetAAssoc.schedule['2025-01'].actual).toBe(true);
      expect(assetAAssoc.schedule['2025-01'].actualCost).toBe(950);

      // Asset B's association should ALSO be updated
      const assetBAssocs = associationManager.getAssociationsByAsset('asset-b');
      const assetBTask1 = assetBAssocs.find(a => a.taskId === 'task-1')!;
      expect(assetBTask1.schedule['2025-01'].actual).toBe(true);
      expect(assetBTask1.schedule['2025-01'].actualCost).toBe(950);
    });
  });

  describe('Task-based mode', () => {
    it('should always update all associations regardless of editScope', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      // Even with single-asset scope, task-based mode should update all
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'single-asset' // This should be ignored in task-based mode
      };

      const updatedSchedule: AssociationSchedule[string] = {
        planned: true,
        actual: true,
        planCost: 1000,
        actualCost: 950
      };

      const count = editHandlers.handleScheduleEdit({
        associationId: task1Association.id,
        dateKey: '2025-01',
        scheduleEntry: updatedSchedule,
        context
      });

      // Should update 2 associations (both Asset A and Asset B with Task 1)
      expect(count).toBe(2);

      // Both associations should be updated
      const assetAAssoc = associationManager.getAssociation(task1Association.id)!;
      expect(assetAAssoc.schedule['2025-01'].actual).toBe(true);

      const assetBAssocs = associationManager.getAssociationsByAsset('asset-b');
      const assetBTask1 = assetBAssocs.find(a => a.taskId === 'task-1')!;
      expect(assetBTask1.schedule['2025-01'].actual).toBe(true);
    });
  });

  describe('Edit scope description', () => {
    it('should return correct description for single-asset scope', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset'
      };

      const description = editHandlers.getEditScopeDescription(context);
      expect(description).toBe('この機器のスケジュールのみが更新されます');
    });

    it('should return correct description for all-assets scope', () => {
      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const description = editHandlers.getEditScopeDescription(context);
      expect(description).toBe('同じ作業を持つすべての機器のスケジュールが連動して更新されます');
    });

    it('should return correct description for task-based mode', () => {
      const context: EditContext = {
        viewMode: 'task-based',
        editScope: 'single-asset' // Ignored in task-based mode
      };

      const description = editHandlers.getEditScopeDescription(context);
      expect(description).toBe('同じ作業を持つすべての機器のスケジュールが連動して更新されます');
    });
  });

  describe('Affected association count', () => {
    it('should return 1 for single-asset scope', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset'
      };

      const count = editHandlers.getAffectedAssociationCount(task1Association.id, context);
      expect(count).toBe(1);
    });

    it('should return correct count for all-assets scope', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const count = editHandlers.getAffectedAssociationCount(task1Association.id, context);
      expect(count).toBe(2); // Asset A and Asset B both have Task 1
    });

    it('should return correct count for task with single association', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task2Association = associations.find(a => a.taskId === 'task-2')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const count = editHandlers.getAffectedAssociationCount(task2Association.id, context);
      expect(count).toBe(1); // Only Asset A has Task 2
    });
  });

  describe('Will affect multiple associations check', () => {
    it('should return false for single-asset scope', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'single-asset'
      };

      const willAffectMultiple = editHandlers.willAffectMultipleAssociations(
        task1Association.id,
        context
      );
      expect(willAffectMultiple).toBe(false);
    });

    it('should return true for all-assets scope with multiple associations', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task1Association = associations.find(a => a.taskId === 'task-1')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const willAffectMultiple = editHandlers.willAffectMultipleAssociations(
        task1Association.id,
        context
      );
      expect(willAffectMultiple).toBe(true);
    });

    it('should return false for all-assets scope with single association', () => {
      const associations = associationManager.getAssociationsByAsset('asset-a');
      const task2Association = associations.find(a => a.taskId === 'task-2')!;

      const context: EditContext = {
        viewMode: 'equipment-based',
        editScope: 'all-assets'
      };

      const willAffectMultiple = editHandlers.willAffectMultipleAssociations(
        task2Association.id,
        context
      );
      expect(willAffectMultiple).toBe(false);
    });
  });
});
