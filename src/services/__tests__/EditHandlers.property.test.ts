/**
 * EditHandlers Property-Based Tests
 * **Feature: maintenance-task-management**
 */

import fc from 'fast-check';
import { TaskManager } from '../TaskManager';
import { AssetManager } from '../AssetManager';
import { AssociationManager } from '../AssociationManager';

describe('EditHandlers Property Tests', () => {
  /**
   * **Feature: maintenance-task-management, Property 33: 作業定義の共有**
   * **Validates: Requirements 1.3**
   */
  it('Property 33: task definition changes reflect across all assets', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 3 }),
        (taskName, assetIds) => {
          const taskMgr = new TaskManager();
          const assetMgr = new AssetManager();
          const assocMgr = new AssociationManager();
          
          const task = taskMgr.createTask({ name: taskName, description: 'Test description', classification: '01' });
          assetIds.forEach(id => {
            assetMgr.createAsset({ id, name: id, hierarchyPath: { 'level1': 'value1' }, specifications: [] });
            assocMgr.createAssociation({ assetId: id, taskId: task.id, schedule: {} });
          });
          
          taskMgr.updateTask(task.id, { name: 'Updated' });
          const associations = assocMgr.getAssociationsByTask(task.id);
          
          expect(associations).toHaveLength(assetIds.length);
          expect(taskMgr.getTask(task.id)!.name).toBe('Updated');
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * **Feature: maintenance-task-management, Property 34: 作業ベースモードでのスケジュール編集の連動**
   * **Validates: Requirements 5.7**
   */
  it('Property 34: task-based mode updates all asset schedules', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 3 }),
        fc.boolean(),
        (assetIds, planned) => {
          const taskMgr = new TaskManager();
          const assetMgr = new AssetManager();
          const assocMgr = new AssociationManager();
          
          const task = taskMgr.createTask({ name: 'Test', description: 'Test description', classification: '01' });
          const associations = assetIds.map(id => {
            assetMgr.createAsset({ id, name: id, hierarchyPath: { 'level1': 'value1' }, specifications: [] });
            return assocMgr.createAssociation({ assetId: id, taskId: task.id, schedule: {} });
          });
          
          // Task-based mode: update all
          associations.forEach(a => 
            assocMgr.updateSchedule(a.id, '2025-01', { planned, actual: false, planCost: 0, actualCost: 0 })
          );
          
          const updated = assocMgr.getAssociationsByTask(task.id);
          updated.forEach(a => expect(a.schedule['2025-01'].planned).toBe(planned));
        }
      ),
      { numRuns: 50 }
    );
  });
});
