/**
 * ViewModeManager Property-Based Tests
 * 
 * **Feature: maintenance-task-management**
 * 
 * These tests use fast-check to verify universal properties that should hold
 * across all valid inputs for the ViewModeManager.
 * 
 * Requirements: 6.1, 6.2, 6.4
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { ViewModeManager } from '../ViewModeManager';
import {
  Task,
  Asset,
  TaskAssociation,
  HierarchyDefinition,
  AssociationSchedule,
  ViewMode,
  TimeScale,
} from '../../types/maintenanceTask';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generator for valid task classification codes (01-20)
 */
const classificationGenerator = fc.integer({ min: 1, max: 20 }).map(n => 
  n.toString().padStart(2, '0')
);

/**
 * Generator for valid task names (non-empty strings)
 */
const taskNameGenerator = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/**
 * Generator for valid task descriptions
 */
const taskDescriptionGenerator = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

/**
 * Generator for Task objects
 */
const taskGenerator = fc.record({
  id: fc.uuid(),
  name: taskNameGenerator,
  description: taskDescriptionGenerator,
  classification: classificationGenerator,
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

/**
 * Generator for hierarchy path values
 */
const hierarchyValueGenerator = fc.constantFrom(
  '第一製油所', '第二製油所',
  'Aエリア', 'Bエリア', 'Cエリア',
  '原油蒸留ユニット', '接触改質ユニット', '製品貯蔵エリア'
);

/**
 * Generator for Asset objects
 */
const assetGenerator = fc.record({
  id: fc.uuid(), // Use UUID to ensure uniqueness
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  hierarchyPath: fc.record({
    '製油所': hierarchyValueGenerator,
    'エリア': hierarchyValueGenerator,
    'ユニット': hierarchyValueGenerator,
  }),
  specifications: fc.array(
    fc.record({
      key: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.string({ minLength: 1, maxLength: 100 }),
      order: fc.integer({ min: 1, max: 100 }),
    }),
    { maxLength: 5 }
  ),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

/**
 * Generator for schedule entry
 */
const scheduleEntryGenerator = fc.record({
  planned: fc.boolean(),
  actual: fc.boolean(),
  planCost: fc.integer({ min: 0, max: 10000000 }),
  actualCost: fc.integer({ min: 0, max: 10000000 }),
});

/**
 * Generator for date strings in YYYY-MM-DD format
 */
const dateStringGenerator = fc.integer({ min: 2020, max: 2030 })
  .chain(year => 
    fc.integer({ min: 1, max: 12 }).chain(month =>
      fc.integer({ min: 1, max: 28 }).map(day => {
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
      })
    )
  );

/**
 * Generator for AssociationSchedule
 */
const scheduleGenerator = fc.dictionary(
  dateStringGenerator,
  scheduleEntryGenerator,
  { minKeys: 1, maxKeys: 10 }
);

/**
 * Generator for TaskAssociation objects
 * Requires existing task and asset IDs
 */
const associationGeneratorFor = (taskIds: string[], assetIds: string[]) => {
  if (taskIds.length === 0 || assetIds.length === 0) {
    return fc.constant([] as TaskAssociation[]);
  }
  
  return fc.array(
    fc.record({
      id: fc.uuid(),
      assetId: fc.constantFrom(...assetIds),
      taskId: fc.constantFrom(...taskIds),
      schedule: scheduleGenerator,
      createdAt: fc.date(),
      updatedAt: fc.date(),
    }),
    { minLength: 0, maxLength: Math.min(taskIds.length * assetIds.length, 20) }
  );
};

/**
 * Generator for HierarchyDefinition
 */
const hierarchyGenerator: fc.Arbitrary<HierarchyDefinition> = fc.constant({
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
      values: ['原油蒸留ユニット', '接触改質ユニット', '製品貯蔵エリア'],
    },
  ],
});

/**
 * Generator for ViewMode
 */
const viewModeGenerator = fc.constantFrom<ViewMode>('equipment-based', 'task-based');

/**
 * Generator for TimeScale
 */
const timeScaleGenerator = fc.constantFrom<TimeScale>('day', 'month', 'year');

/**
 * Generator for complete ViewModeManager data
 */
const viewModeManagerDataGenerator = fc.tuple(
  fc.array(taskGenerator, { minLength: 1, maxLength: 10 }),
  fc.array(assetGenerator, { minLength: 1, maxLength: 10 }),
  hierarchyGenerator
).chain(([tasks, assets, hierarchy]) => {
  const taskIds = tasks.map(t => t.id);
  const assetIds = assets.map(a => a.id);
  
  return fc.tuple(
    fc.constant(tasks),
    fc.constant(assets),
    associationGeneratorFor(taskIds, assetIds),
    fc.constant(hierarchy)
  );
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('ViewModeManager Property-Based Tests', () => {
  /**
   * **Feature: maintenance-task-management, Property 14: 表示モード切り替えのデータ一貫性**
   * 
   * For any view mode combination, after switching modes, the data content should not change.
   * 
   * **Validates: Requirements 6.1, 6.4**
   */
  describe('Property 14: 表示モード切り替えのデータ一貫性', () => {
    it('should maintain data consistency when switching view modes', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          viewModeGenerator,
          viewModeGenerator,
          ([tasks, assets, associations, hierarchy], mode1, mode2) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Switch to first mode
            manager.switchMode(mode1);
            
            // Get data in first mode
            const data1 = mode1 === 'equipment-based' 
              ? manager.getEquipmentBasedData()
              : manager.getTaskBasedData();
            
            // Count the actual data entities (not hierarchy headers)
            const countAssets1 = data1.filter(row => row.type === 'asset').length;
            
            // Switch to second mode
            manager.switchMode(mode2);
            
            // Get data in second mode
            const data2 = mode2 === 'equipment-based'
              ? manager.getEquipmentBasedData()
              : manager.getTaskBasedData();
            
            // Count the actual data entities
            const countAssets2 = data2.filter(row => row.type === 'asset').length;
            
            // The number of asset rows should be consistent
            // In equipment-based mode: one row per asset (regardless of associations)
            // In task-based mode: one row per association (asset-task pair)
            if (mode1 === mode2) {
              // Same mode: should have identical data
              expect(countAssets1).toBe(countAssets2);
            } else {
              // Different modes: verify relationship between assets and associations
              const numAssociations = associations.length;
              const numAssets = assets.length;
              
              // Both modes now show all assets
              expect(countAssets1).toBe(numAssets);
              expect(countAssets2).toBe(numAssets);
              
              // Count associations in each mode
              // Equipment-based: tasks are in asset.tasks array
              // Task-based: tasks are separate rows
              let countAssociations1 = 0;
              let countAssociations2 = 0;
              
              if (mode1 === 'equipment-based') {
                data1.forEach(row => {
                  if (row.type === 'asset' && 'tasks' in row && Array.isArray(row.tasks)) {
                    countAssociations1 += row.tasks.length;
                  }
                });
              } else {
                countAssociations1 = data1.filter(row => row.type === 'workOrderLine').length;
              }
              
              if (mode2 === 'equipment-based') {
                data2.forEach(row => {
                  if (row.type === 'asset' && 'tasks' in row && Array.isArray(row.tasks)) {
                    countAssociations2 += row.tasks.length;
                  }
                });
              } else {
                countAssociations2 = data2.filter(row => row.type === 'workOrderLine').length;
              }
              
              // Both modes should show the same number of associations
              expect(countAssociations1).toBe(numAssociations);
              expect(countAssociations2).toBe(numAssociations);
            }
            
            // Verify that all original assets are still accessible
            const allAssetIds = new Set(assets.map(a => a.id));
            const assetIdsInData1 = new Set(
              data1.filter(row => row.type === 'asset' && row.assetId).map(row => row.assetId!)
            );
            const assetIdsInData2 = new Set(
              data2.filter(row => row.type === 'asset' && row.assetId).map(row => row.assetId!)
            );
            
            // All assets that appear in data should be from the original set
            assetIdsInData1.forEach(id => {
              expect(allAssetIds.has(id)).toBe(true);
            });
            assetIdsInData2.forEach(id => {
              expect(allAssetIds.has(id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve task-asset associations across mode switches', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          ([tasks, assets, associations, hierarchy]) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Get associations from equipment-based mode
            manager.switchMode('equipment-based');
            const equipmentData = manager.getEquipmentBasedData();
            const associationsFromEquipment = new Set<string>();
            
            equipmentData.forEach(row => {
              if (row.type === 'asset' && row.tasks) {
                row.tasks.forEach(task => {
                  associationsFromEquipment.add(`${row.assetId}-${task.taskId}`);
                });
              }
            });
            
            // Get associations from task-based mode
            manager.switchMode('task-based');
            const taskData = manager.getTaskBasedData();
            const associationsFromTask = new Set<string>();
            
            taskData.forEach(row => {
              if (row.type === 'workOrderLine' && row.assetId && row.taskId) {
                associationsFromTask.add(`${row.assetId}-${row.taskId}`);
              }
            });
            
            // Both modes should show the same associations
            expect(associationsFromEquipment.size).toBe(associationsFromTask.size);
            associationsFromEquipment.forEach(assoc => {
              expect(associationsFromTask.has(assoc)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 15: 表示モード切り替えの状態保持**
   * 
   * For any filters, date range, and selection state, after switching view modes with
   * preserveState=true, the applicable state should be retained.
   * 
   * **Validates: Requirements 6.2**
   */
  describe('Property 15: 表示モード切り替えの状態保持', () => {
    it('should preserve filters when switching modes with preserveState=true', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          viewModeGenerator,
          viewModeGenerator,
          hierarchyValueGenerator,
          classificationGenerator,
          ([tasks, assets, associations, hierarchy], mode1, mode2, hierarchyValue, classification) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Set initial mode
            manager.switchMode(mode1);
            
            // Apply filters
            manager.applyFilters({
              hierarchyPath: { '製油所': hierarchyValue },
              taskClassification: classification,
            });
            
            // Get state before switch
            const stateBefore = manager.getCurrentState();
            
            // Switch mode with preserveState=true
            manager.switchMode(mode2, true);
            
            // Get state after switch
            const stateAfter = manager.getCurrentState();
            
            // Verify mode changed
            expect(stateAfter.mode).toBe(mode2);
            
            // Verify filters preserved
            expect(stateAfter.filters.hierarchyPath).toEqual(stateBefore.filters.hierarchyPath);
            expect(stateAfter.filters.taskClassification).toBe(stateBefore.filters.taskClassification);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reset filters when switching modes with preserveState=false', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          viewModeGenerator,
          viewModeGenerator,
          hierarchyValueGenerator,
          ([tasks, assets, associations, hierarchy], mode1, mode2, hierarchyValue) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Set initial mode
            manager.switchMode(mode1);
            
            // Apply filters
            manager.applyFilters({
              hierarchyPath: { '製油所': hierarchyValue },
            });
            
            // Switch mode with preserveState=false
            manager.switchMode(mode2, false);
            
            // Get state after switch
            const stateAfter = manager.getCurrentState();
            
            // Verify mode changed
            expect(stateAfter.mode).toBe(mode2);
            
            // Verify filters reset
            expect(stateAfter.filters.hierarchyPath).toBeUndefined();
            expect(stateAfter.filters.taskClassification).toBeUndefined();
            expect(stateAfter.filters.dateRange).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve date range filters across mode switches', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          viewModeGenerator,
          dateStringGenerator,
          dateStringGenerator,
          ([tasks, assets, associations, hierarchy], targetMode, date1, date2) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Ensure start <= end
            const start = date1 < date2 ? date1 : date2;
            const end = date1 < date2 ? date2 : date1;
            
            // Apply date range filter
            manager.applyFilters({
              dateRange: { start, end },
            });
            
            // Switch mode
            manager.switchMode(targetMode, true);
            
            // Get state after switch
            const state = manager.getCurrentState();
            
            // Verify date range preserved
            expect(state.filters.dateRange).toEqual({ start, end });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 30: 時間スケール集約の一貫性**
   * 
   * For any association schedule and time scale, the aggregated data's planned/actual flags
   * should be the logical OR of the original data.
   * 
   * **Validates: Requirements 6.4**
   */
  describe('Property 30: 時間スケール集約の一貫性', () => {
    it('should correctly apply OR logic to planned/actual flags during aggregation', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          scheduleGenerator,
          timeScaleGenerator,
          ([tasks, assets, associations, hierarchy], schedule, timeScale) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Aggregate the schedule
            const aggregated = manager.aggregateScheduleByTimeScale(schedule, timeScale);
            
            // For each aggregated period, verify OR logic
            Object.entries(aggregated).forEach(([timeKey, aggStatus]) => {
              // Find all original entries that map to this time key
              const originalEntries = Object.entries(schedule).filter(([dateKey]) => {
                if (timeScale === 'year') {
                  return dateKey.slice(0, 4) === timeKey;
                } else if (timeScale === 'month') {
                  return dateKey.slice(0, 7) === timeKey;
                } else {
                  return dateKey === timeKey;
                }
              });
              
              // Verify planned flag: should be true if ANY original entry has planned=true
              const expectedPlanned = originalEntries.some(([, entry]) => entry.planned);
              expect(aggStatus.planned).toBe(expectedPlanned);
              
              // Verify actual flag: should be true if ANY original entry has actual=true
              const expectedActual = originalEntries.some(([, entry]) => entry.actual);
              expect(aggStatus.actual).toBe(expectedActual);
              
              // Verify count matches number of original entries
              expect(aggStatus.count).toBe(originalEntries.length);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency across different time scales', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          scheduleGenerator,
          ([tasks, assets, associations, hierarchy], schedule) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Aggregate at different time scales
            const dayAgg = manager.aggregateScheduleByTimeScale(schedule, 'day');
            const monthAgg = manager.aggregateScheduleByTimeScale(schedule, 'month');
            const yearAgg = manager.aggregateScheduleByTimeScale(schedule, 'year');
            
            // Day aggregation should have >= entries than month
            expect(Object.keys(dayAgg).length).toBeGreaterThanOrEqual(Object.keys(monthAgg).length);
            
            // Month aggregation should have >= entries than year
            expect(Object.keys(monthAgg).length).toBeGreaterThanOrEqual(Object.keys(yearAgg).length);
            
            // Total count should be consistent across all scales
            const totalCountDay = Object.values(dayAgg).reduce((sum, s) => sum + s.count, 0);
            const totalCountMonth = Object.values(monthAgg).reduce((sum, s) => sum + s.count, 0);
            const totalCountYear = Object.values(yearAgg).reduce((sum, s) => sum + s.count, 0);
            
            expect(totalCountDay).toBe(Object.keys(schedule).length);
            expect(totalCountMonth).toBe(Object.keys(schedule).length);
            expect(totalCountYear).toBe(Object.keys(schedule).length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: maintenance-task-management, Property 31: コスト集約の正確性**
   * 
   * For any association schedule and time scale, the aggregated costs should be
   * the sum of the original data's costs.
   * 
   * **Validates: Requirements 6.4**
   */
  describe('Property 31: コスト集約の正確性', () => {
    it('should correctly sum costs during aggregation', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          scheduleGenerator,
          timeScaleGenerator,
          ([tasks, assets, associations, hierarchy], schedule, timeScale) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Aggregate the schedule
            const aggregated = manager.aggregateScheduleByTimeScale(schedule, timeScale);
            
            // For each aggregated period, verify cost sums
            Object.entries(aggregated).forEach(([timeKey, aggStatus]) => {
              // Find all original entries that map to this time key
              const originalEntries = Object.entries(schedule).filter(([dateKey]) => {
                if (timeScale === 'year') {
                  return dateKey.slice(0, 4) === timeKey;
                } else if (timeScale === 'month') {
                  return dateKey.slice(0, 7) === timeKey;
                } else {
                  return dateKey === timeKey;
                }
              });
              
              // Calculate expected costs
              const expectedPlanCost = originalEntries.reduce((sum, [, entry]) => sum + entry.planCost, 0);
              const expectedActualCost = originalEntries.reduce((sum, [, entry]) => sum + entry.actualCost, 0);
              
              // Verify costs match
              expect(aggStatus.totalPlanCost).toBe(expectedPlanCost);
              expect(aggStatus.totalActualCost).toBe(expectedActualCost);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain total cost consistency across time scales', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          scheduleGenerator,
          ([tasks, assets, associations, hierarchy], schedule) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Calculate original total costs
            const originalPlanCost = Object.values(schedule).reduce((sum, entry) => sum + entry.planCost, 0);
            const originalActualCost = Object.values(schedule).reduce((sum, entry) => sum + entry.actualCost, 0);
            
            // Aggregate at different time scales
            const dayAgg = manager.aggregateScheduleByTimeScale(schedule, 'day');
            const monthAgg = manager.aggregateScheduleByTimeScale(schedule, 'month');
            const yearAgg = manager.aggregateScheduleByTimeScale(schedule, 'year');
            
            // Calculate aggregated total costs for each scale
            const dayPlanCost = Object.values(dayAgg).reduce((sum, s) => sum + s.totalPlanCost, 0);
            const dayActualCost = Object.values(dayAgg).reduce((sum, s) => sum + s.totalActualCost, 0);
            
            const monthPlanCost = Object.values(monthAgg).reduce((sum, s) => sum + s.totalPlanCost, 0);
            const monthActualCost = Object.values(monthAgg).reduce((sum, s) => sum + s.totalActualCost, 0);
            
            const yearPlanCost = Object.values(yearAgg).reduce((sum, s) => sum + s.totalPlanCost, 0);
            const yearActualCost = Object.values(yearAgg).reduce((sum, s) => sum + s.totalActualCost, 0);
            
            // All aggregations should sum to the same total as original
            expect(dayPlanCost).toBe(originalPlanCost);
            expect(dayActualCost).toBe(originalActualCost);
            
            expect(monthPlanCost).toBe(originalPlanCost);
            expect(monthActualCost).toBe(originalActualCost);
            
            expect(yearPlanCost).toBe(originalPlanCost);
            expect(yearActualCost).toBe(originalActualCost);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative costs', () => {
      fc.assert(
        fc.property(
          viewModeManagerDataGenerator,
          scheduleGenerator,
          timeScaleGenerator,
          ([tasks, assets, associations, hierarchy], schedule, timeScale) => {
            const manager = new ViewModeManager(tasks, assets, associations, hierarchy);
            
            // Aggregate the schedule
            const aggregated = manager.aggregateScheduleByTimeScale(schedule, timeScale);
            
            // Verify all costs are non-negative
            Object.values(aggregated).forEach(aggStatus => {
              expect(aggStatus.totalPlanCost).toBeGreaterThanOrEqual(0);
              expect(aggStatus.totalActualCost).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
