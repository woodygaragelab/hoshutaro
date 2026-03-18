/**
 * ViewModeManager State Preservation Tests
 * 
 * Requirements:
 * - 6.2: フィルターと選択状態の保持
 * 
 * Tests verify that filters and selection state are preserved when switching
 * between equipment-based and task-based view modes.
 */

import { ViewModeManager } from '../ViewModeManager';
import {
  Task,
  Asset,
  TaskAssociation,
  HierarchyDefinition,
  HierarchyPath,
} from '../../types/maintenanceTask';

describe('ViewModeManager - State Preservation', () => {
  let viewModeManager: ViewModeManager;
  let tasks: Task[];
  let assets: Asset[];
  let associations: TaskAssociation[];
  let hierarchy: HierarchyDefinition;

  beforeEach(() => {
    // Setup test data
    tasks = [
      {
        id: 'task-001',
        name: '年次点検',
        description: '年次定期点検作業',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'task-002',
        name: 'オーバーホール',
        description: '設備の全面的な分解点検と修理',
        classification: '01',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    const hierarchyPath1: HierarchyPath = {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    };

    const hierarchyPath2: HierarchyPath = {
      '製油所': '第一製油所',
      'エリア': 'Bエリア',
      'ユニット': '接触改質ユニット',
    };

    assets = [
      {
        id: 'P-101',
        name: '原油供給ポンプ',
        hierarchyPath: hierarchyPath1,
        specifications: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'E-201',
        name: '熱交換器',
        hierarchyPath: hierarchyPath2,
        specifications: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    associations = [
      {
        id: 'assoc-001',
        assetId: 'P-101',
        taskId: 'task-001',
        schedule: {
          '2024-05-15': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'assoc-002',
        assetId: 'E-201',
        taskId: 'task-002',
        schedule: {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    hierarchy = {
      levels: [
        {
          key: '製油所',
          order: 1,
          values: ['第一製油所', '第二製油所'],
        },
        {
          key: 'エリア',
          order: 2,
          values: ['Aエリア', 'Bエリア', 'Cエリア'],
        },
        {
          key: 'ユニット',
          order: 3,
          values: ['原油蒸留ユニット', '接触改質ユニット'],
        },
      ],
    };

    viewModeManager = new ViewModeManager(tasks, assets, associations, hierarchy);
  });

  describe('Filter Preservation', () => {
    test('should preserve hierarchy path filter when switching modes', () => {
      // Start in equipment-based mode
      expect(viewModeManager.getCurrentMode()).toBe('equipment-based');

      // Apply hierarchy filter
      viewModeManager.applyFilters({
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
        },
      });

      // Get current state
      const stateBefore = viewModeManager.getCurrentState();
      expect(stateBefore.filters.hierarchyPath).toEqual({
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
      });

      // Switch to task-based mode with state preservation
      viewModeManager.switchMode('task-based', true);

      // Verify filter is preserved
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.mode).toBe('task-based');
      expect(stateAfter.filters.hierarchyPath).toEqual({
        '製油所': '第一製油所',
        'エリア': 'Aエリア',
      });
    });

    test('should preserve date range filter when switching modes', () => {
      // Apply date range filter
      viewModeManager.applyFilters({
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31',
        },
      });

      // Get current state
      const stateBefore = viewModeManager.getCurrentState();
      expect(stateBefore.filters.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31',
      });

      // Switch to task-based mode with state preservation
      viewModeManager.switchMode('task-based', true);

      // Verify filter is preserved
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.filters.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31',
      });
    });

    test('should preserve task classification filter when switching modes', () => {
      // Switch to task-based mode first
      viewModeManager.switchMode('task-based', false);

      // Apply task classification filter
      viewModeManager.applyFilters({
        taskClassification: '01',
      });

      // Get current state
      const stateBefore = viewModeManager.getCurrentState();
      expect(stateBefore.filters.taskClassification).toBe('01');

      // Switch back to equipment-based mode with state preservation
      viewModeManager.switchMode('equipment-based', true);

      // Verify filter is preserved
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.filters.taskClassification).toBe('01');
    });

    test('should clear filters when switching without state preservation', () => {
      // Apply filters
      viewModeManager.applyFilters({
        hierarchyPath: {
          '製油所': '第一製油所',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31',
        },
      });

      // Verify filters are applied
      const stateBefore = viewModeManager.getCurrentState();
      expect(stateBefore.filters.hierarchyPath).toBeDefined();
      expect(stateBefore.filters.dateRange).toBeDefined();

      // Switch mode without state preservation
      viewModeManager.switchMode('task-based', false);

      // Verify filters are cleared
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.filters).toEqual({});
    });
  });

  describe('Selection Preservation', () => {
    test('should preserve selection when switching from equipment-based to task-based', () => {
      // Start in equipment-based mode
      expect(viewModeManager.getCurrentMode()).toBe('equipment-based');

      // Set selection on an asset by directly modifying internal state
      // Note: In real usage, selection would be set through UI interactions
      (viewModeManager as any).currentState.selection = {
        rowId: 'P-101',
        columnId: '2024-05',
      };

      // Switch to task-based mode
      viewModeManager.switchMode('task-based', true);
      viewModeManager.preserveSelection();

      // Verify selection is preserved (converted to task-based format)
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.selection).toBeDefined();
      expect(stateAfter.selection?.rowId).toContain('P-101');
      expect(stateAfter.selection?.columnId).toBe('2024-05');
    });

    test('should preserve selection when switching from task-based to equipment-based', () => {
      // Switch to task-based mode
      viewModeManager.switchMode('task-based', false);

      // Set selection on an asset in task-based view
      (viewModeManager as any).currentState.selection = {
        rowId: 'asset_P-101_task_task-001',
        columnId: '2024-05',
      };

      // Switch to equipment-based mode
      viewModeManager.switchMode('equipment-based', true);
      viewModeManager.preserveSelection();

      // Verify selection is preserved (converted to equipment-based format)
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.selection).toBeDefined();
      expect(stateAfter.selection?.rowId).toBe('P-101');
      expect(stateAfter.selection?.columnId).toBe('2024-05');
    });

    test('should clear selection if asset not found in new mode', () => {
      // Start in equipment-based mode
      (viewModeManager as any).currentState.selection = {
        rowId: 'NONEXISTENT-ASSET',
        columnId: '2024-05',
      };

      // Switch to task-based mode
      viewModeManager.switchMode('task-based', true);
      viewModeManager.preserveSelection();

      // Verify selection is cleared
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.selection).toBeUndefined();
    });

    test('should clear selection if asset has no tasks in task-based mode', () => {
      // Add an asset with no associations
      const assetWithNoTasks: Asset = {
        id: 'ORPHAN-001',
        name: '孤立機器',
        hierarchyPath: {
          '製油所': '第一製油所',
          'エリア': 'Aエリア',
          'ユニット': '原油蒸留ユニット',
        },
        specifications: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // Recreate manager with orphan asset
      viewModeManager = new ViewModeManager(
        tasks,
        [...assets, assetWithNoTasks],
        associations,
        hierarchy
      );

      // Set selection on orphan asset
      (viewModeManager as any).currentState.selection = {
        rowId: 'ORPHAN-001',
        columnId: '2024-05',
      };

      // Switch to task-based mode
      viewModeManager.switchMode('task-based', true);
      viewModeManager.preserveSelection();

      // Verify selection is cleared (no tasks for this asset)
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.selection).toBeUndefined();
    });
  });

  describe('Combined Filter and Selection Preservation', () => {
    test('should preserve both filters and selection when switching modes', () => {
      // Apply filters
      viewModeManager.applyFilters({
        hierarchyPath: {
          '製油所': '第一製油所',
        },
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31',
        },
      });

      // Set selection
      (viewModeManager as any).currentState.selection = {
        rowId: 'P-101',
        columnId: '2024-05',
      };

      // Switch to task-based mode
      viewModeManager.switchMode('task-based', true);
      viewModeManager.preserveSelection();

      // Verify both filters and selection are preserved
      const stateAfter = viewModeManager.getCurrentState();
      expect(stateAfter.mode).toBe('task-based');
      expect(stateAfter.filters.hierarchyPath).toEqual({
        '製油所': '第一製油所',
      });
      expect(stateAfter.filters.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31',
      });
      expect(stateAfter.selection).toBeDefined();
      expect(stateAfter.selection?.rowId).toContain('P-101');
    });
  });

  describe('Data Filtering with Preserved State', () => {
    test('should apply preserved filters to equipment-based data', () => {
      // Apply hierarchy filter
      viewModeManager.applyFilters({
        hierarchyPath: {
          'エリア': 'Aエリア',
        },
      });

      // Get equipment data
      const equipmentData = viewModeManager.getEquipmentBasedData();

      // Verify only assets in Aエリア are included
      const assetRows = equipmentData.filter(row => row.type === 'asset');
      expect(assetRows.length).toBe(1);
      expect(assetRows[0].assetId).toBe('P-101');
    });

    test('should apply preserved filters to task-based data', () => {
      // Switch to task-based mode
      viewModeManager.switchMode('task-based', false);

      // Apply hierarchy filter
      viewModeManager.applyFilters({
        hierarchyPath: {
          'エリア': 'Bエリア',
        },
      });

      // Get task data
      const taskData = viewModeManager.getTaskBasedData();

      // Verify only assets in Bエリア are included
      const assetRows = taskData.filter(row => row.type === 'asset');
      expect(assetRows.length).toBe(1);
      expect(assetRows[0].assetId).toBe('E-201');
    });

    test('should apply preserved date range filter to equipment-based data', () => {
      // Apply date range filter that excludes 2025 dates
      viewModeManager.applyFilters({
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31',
        },
      });

      // Get equipment data
      const equipmentData = viewModeManager.getEquipmentBasedData();

      // Verify only assets with schedules in 2024 are included
      const assetRows = equipmentData.filter(row => row.type === 'asset');
      expect(assetRows.length).toBe(1);
      expect(assetRows[0].assetId).toBe('P-101');
    });
  });
});
