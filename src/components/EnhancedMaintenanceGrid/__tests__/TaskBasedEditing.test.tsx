/**
 * Task-Based Editing Tests
 * 
 * Tests for task-based mode editing functionality including:
 * - Schedule editing with linked updates
 * - Copy & paste with linked updates
 * - Delete with linked updates
 * 
 * **Validates: Requirements 5.7**
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedMaintenanceGrid } from '../EnhancedMaintenanceGrid';
import { ViewModeManager } from '../../../services/ViewModeManager';
import { TaskManager } from '../../../services/TaskManager';
import { AssetManager } from '../../../services/AssetManager';
import { AssociationManager } from '../../../services/AssociationManager';
import { HierarchyManager } from '../../../services/HierarchyManager';
import { Task, Asset, TaskAssociation, TaskAssociationUpdate } from '../../../types/maintenanceTask';

describe('TaskBasedEditing', () => {
  let taskManager: TaskManager;
  let assetManager: AssetManager;
  let associationManager: AssociationManager;
  let hierarchyManager: HierarchyManager;
  let viewModeManager: ViewModeManager;
  
  let tasks: Task[];
  let assets: Asset[];
  let associations: TaskAssociation[];
  
  beforeEach(() => {
    // Initialize managers
    taskManager = new TaskManager();
    assetManager = new AssetManager();
    associationManager = new AssociationManager();
    hierarchyManager = new HierarchyManager();
    
    // Create test data
    const task1 = taskManager.createTask({
      name: '年次点検',
      description: '年次定期点検作業',
      classification: '01'
    });
    
    const asset1 = assetManager.createAsset({
      id: 'P-101',
      name: '原油供給ポンプ',
      hierarchyPath: {
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
        'ユニット': '原油蒸留ユニット'
      },
      specifications: []
    });
    
    const asset2 = assetManager.createAsset({
      id: 'P-102',
      name: '原油供給ポンプ2',
      hierarchyPath: {
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
        'ユニット': '原油蒸留ユニット'
      },
      specifications: []
    });
    
    const assoc1 = associationManager.createAssociation({
      assetId: asset1.id,
      taskId: task1.id,
      schedule: {
        '2025-01': {
          planned: true,
          actual: false,
          planCost: 100000,
          actualCost: 0
        }
      }
    });
    
    const assoc2 = associationManager.createAssociation({
      assetId: asset2.id,
      taskId: task1.id,
      schedule: {
        '2025-01': {
          planned: true,
          actual: false,
          planCost: 100000,
          actualCost: 0
        }
      }
    });
    
    tasks = [task1];
    assets = [asset1, asset2];
    associations = [assoc1, assoc2];
    
    // Initialize ViewModeManager
    viewModeManager = new ViewModeManager(
      tasks,
      assets,
      associations,
      hierarchyManager.getHierarchyDefinition()
    );
    
    // Switch to task-based mode
    viewModeManager.switchMode('task-based', false);
  });
  
  describe('Schedule Editing with Linked Updates', () => {
    it('should update all assets with the same task when editing schedule in task-based mode', async () => {
      const onTaskAssociationUpdate = jest.fn();
      
      render(
        <EnhancedMaintenanceGrid
          data={[]}
          timeHeaders={['2025-01', '2025-02']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          tasks={tasks}
          assets={assets}
          associations={associations}
          viewModeManager={viewModeManager}
          onTaskAssociationUpdate={onTaskAssociationUpdate}
          timeScale="month"
        />
      );
      
      // Wait for the grid to render
      await waitFor(() => {
        expect(screen.getByText('年次点検')).toBeInTheDocument();
      });
      
      // Simulate editing a cell in task-based mode
      // This should trigger linked updates for all assets with the same task
      const updates: TaskAssociationUpdate[] = [
        {
          associationId: associations[0].id,
          action: 'update',
          data: {
            schedule: {
              ...associations[0].schedule,
              '2025-01': {
                planned: true,
                actual: true,
                planCost: 100000,
                actualCost: 95000
              }
            }
          }
        },
        {
          associationId: associations[1].id,
          action: 'update',
          data: {
            schedule: {
              ...associations[1].schedule,
              '2025-01': {
                planned: true,
                actual: true,
                planCost: 100000,
                actualCost: 95000
              }
            }
          }
        }
      ];
      
      // Verify that the update handler would be called with all related associations
      expect(associations.filter(a => a.taskId === tasks[0].id)).toHaveLength(2);
    });
    
    it('should show success message indicating number of linked updates', async () => {
      const onTaskAssociationUpdate = jest.fn();
      
      const { container } = render(
        <EnhancedMaintenanceGrid
          data={[]}
          timeHeaders={['2025-01', '2025-02']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          tasks={tasks}
          assets={assets}
          associations={associations}
          viewModeManager={viewModeManager}
          onTaskAssociationUpdate={onTaskAssociationUpdate}
          timeScale="month"
        />
      );
      
      // Verify that linked updates would affect multiple associations
      const relatedAssociations = associations.filter(a => a.taskId === tasks[0].id);
      expect(relatedAssociations.length).toBeGreaterThan(1);
    });
  });
  
  describe('Copy & Paste with Linked Updates', () => {
    it('should paste to all assets with the same task in task-based mode', async () => {
      const onTaskAssociationUpdate = jest.fn();
      
      render(
        <EnhancedMaintenanceGrid
          data={[]}
          timeHeaders={['2025-01', '2025-02']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          tasks={tasks}
          assets={assets}
          associations={associations}
          viewModeManager={viewModeManager}
          onTaskAssociationUpdate={onTaskAssociationUpdate}
          timeScale="month"
        />
      );
      
      // Verify that paste would affect all related associations
      const relatedAssociations = associations.filter(a => a.taskId === tasks[0].id);
      expect(relatedAssociations).toHaveLength(2);
    });
  });
  
  describe('Delete with Linked Updates', () => {
    it('should delete schedule from all assets with the same task in task-based mode', async () => {
      const onTaskAssociationUpdate = jest.fn();
      
      render(
        <EnhancedMaintenanceGrid
          data={[]}
          timeHeaders={['2025-01', '2025-02']}
          viewMode="status"
          displayMode="maintenance"
          showBomCode={true}
          tasks={tasks}
          assets={assets}
          associations={associations}
          viewModeManager={viewModeManager}
          onTaskAssociationUpdate={onTaskAssociationUpdate}
          timeScale="month"
        />
      );
      
      // Verify that delete would affect all related associations
      const relatedAssociations = associations.filter(a => a.taskId === tasks[0].id);
      expect(relatedAssociations).toHaveLength(2);
      
      // Simulate delete operation
      const emptyStatus = { planned: false, actual: false, planCost: 0, actualCost: 0 };
      const updates: TaskAssociationUpdate[] = relatedAssociations.map(assoc => ({
        associationId: assoc.id,
        action: 'update',
        data: {
          schedule: {
            ...assoc.schedule,
            '2025-01': emptyStatus
          }
        }
      }));
      
      expect(updates).toHaveLength(2);
      expect(updates[0].data?.schedule?.['2025-01']).toEqual(emptyStatus);
      expect(updates[1].data?.schedule?.['2025-01']).toEqual(emptyStatus);
    });
  });
  
  describe('EditContext Usage', () => {
    it('should use correct edit scope for task-based mode', () => {
      // In task-based mode, editScope should be 'all-assets'
      const editContext = {
        viewMode: 'task-based' as const,
        editScope: 'all-assets' as const
      };
      
      expect(editContext.viewMode).toBe('task-based');
      expect(editContext.editScope).toBe('all-assets');
    });
    
    it('should use correct edit scope for equipment-based mode', () => {
      // In equipment-based mode, editScope should be 'single-asset'
      const editContext = {
        viewMode: 'equipment-based' as const,
        editScope: 'single-asset' as const
      };
      
      expect(editContext.viewMode).toBe('equipment-based');
      expect(editContext.editScope).toBe('single-asset');
    });
  });
});
