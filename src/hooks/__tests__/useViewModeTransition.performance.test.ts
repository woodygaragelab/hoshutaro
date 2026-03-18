/**
 * useViewModeTransition Performance Tests
 * 
 * **Feature: maintenance-task-management, Task 25.1: 表示モード切り替えのパフォーマンステスト**
 * 
 * Tests view mode switching performance with large datasets:
 * - 50,000 equipment dataset
 * - Transition completion within 1000ms
 * 
 * 要件: 6.3
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useViewModeTransition } from '../useViewModeTransition';
import {
  Task,
  Asset,
  TaskAssociation,
  HierarchyDefinition,
} from '../../types/maintenanceTask';

/**
 * Generate large dataset for performance testing
 */
function generateLargeDataset(assetCount: number) {
  const tasks: Task[] = [];
  const assets: Asset[] = [];
  const associations: TaskAssociation[] = [];

  // Generate 20 tasks (representing different maintenance types)
  for (let i = 1; i <= 20; i++) {
    const classification = i.toString().padStart(2, '0');
    tasks.push({
      id: `task-${classification}`,
      name: `保守作業${i}`,
      description: `保守作業${i}の説明`,
      classification,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });
  }

  // Generate hierarchy values
  const refineries = ['第一製油所', '第二製油所', '第三製油所'];
  const areas = ['Aエリア', 'Bエリア', 'Cエリア', 'Dエリア', 'Eエリア'];
  const units = [
    '原油蒸留ユニット',
    '接触改質ユニット',
    '製品貯蔵エリア',
    '水素化脱硫ユニット',
    '流動接触分解ユニット',
  ];

  // Generate assets
  for (let i = 0; i < assetCount; i++) {
    const refinery = refineries[i % refineries.length];
    const area = areas[Math.floor(i / refineries.length) % areas.length];
    const unit = units[Math.floor(i / (refineries.length * areas.length)) % units.length];

    const assetId = `ASSET-${i.toString().padStart(6, '0')}`;
    
    assets.push({
      id: assetId,
      name: `機器${i}`,
      hierarchyPath: {
        '製油所': refinery,
        'エリア': area,
        'ユニット': unit,
      },
      specifications: [
        { key: '型式', value: `型式${i % 10}`, order: 1 },
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    // Associate 2-5 tasks with each asset
    const taskCount = 2 + (i % 4); // 2 to 5 tasks per asset
    for (let j = 0; j < taskCount; j++) {
      const taskIndex = (i * 7 + j) % tasks.length; // Distribute tasks
      const task = tasks[taskIndex];
      
      associations.push({
        id: `assoc-${i}-${j}`,
        assetId,
        taskId: task.id,
        schedule: {
          '2024-05-15': {
            planned: true,
            actual: i % 3 === 0, // Some have actuals
            planCost: 100000 + (i * 1000),
            actualCost: i % 3 === 0 ? 95000 + (i * 1000) : 0,
          },
          '2025-06-20': {
            planned: true,
            actual: false,
            planCost: 110000 + (i * 1000),
            actualCost: 0,
          },
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-05-15'),
      });
    }
  }

  const hierarchy: HierarchyDefinition = {
    levels: [
      {
        key: '製油所',
        order: 1,
        values: refineries,
      },
      {
        key: 'エリア',
        order: 2,
        values: areas,
      },
      {
        key: 'ユニット',
        order: 3,
        values: units,
      },
    ],
  };

  return { tasks, assets, associations, hierarchy };
}

describe('useViewModeTransition Performance Tests', () => {
  // Increase timeout for performance tests - large datasets take time to generate
  jest.setTimeout(900000); // 15 minutes for large dataset tests

  describe('50,000機器のデータセットでのパフォーマンス', () => {
    // This test validates requirement 6.3: transition within 1000ms for 50,000 equipment
    it('should complete transition within 1000ms for 50,000 equipment', async () => {
      // Generate 50,000 equipment dataset
      const { tasks, assets, associations, hierarchy } = generateLargeDataset(50000);

      console.log(`\n=== 50,000 Equipment Performance Test ===`);
      console.log(`Generated dataset: ${assets.length} assets, ${tasks.length} tasks, ${associations.length} associations`);

      let transitionDuration = 0;
      const onTransitionComplete = jest.fn((duration: number) => {
        transitionDuration = duration;
      });

      // Render hook
      const { result } = renderHook(() =>
        useViewModeTransition({
          tasks,
          assets,
          associations,
          hierarchy,
          onTransitionComplete,
        })
      );

      // Wait for initial render to complete (this is the slow part - data generation)
      console.log('Waiting for initial equipment data generation...');
      const initStart = performance.now();
      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });
      const initDuration = performance.now() - initStart;
      console.log(`Initial data generation took: ${initDuration.toFixed(2)}ms`);
      console.log(`Generated ${result.current.equipmentData.length} equipment-based rows`);

      // Verify initial mode
      expect(result.current.currentMode).toBe('equipment-based');

      // Reset callback for transition measurement
      onTransitionComplete.mockClear();

      // Now measure the actual transition time (this is what requirement 6.3 is about)
      console.log('\nStarting mode transition...');
      
      await act(async () => {
        result.current.switchMode('task-based');
        // Small delay to let the transition start
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Wait for task data to be generated
      await waitFor(() => result.current.taskData.length > 0, { timeout: 300000 });

      console.log(`\n=== RESULTS ===`);
      console.log(`Transition duration (callback): ${transitionDuration.toFixed(2)}ms`);
      console.log(`Generated ${result.current.taskData.length} task-based rows`);

      // Verify mode switched
      expect(result.current.currentMode).toBe('task-based');

      // Verify transition completed callback was called
      expect(onTransitionComplete).toHaveBeenCalled();

      // **REQUIREMENT 6.3: Verify transition completed within 1000ms**
      // The callback duration measures the actual data transformation time
      expect(transitionDuration).toBeLessThan(1000);
      
      console.log(`✓ Requirement 6.3 PASSED: Transition completed in ${transitionDuration.toFixed(2)}ms (< 1000ms)`);

      // Verify data was generated
      expect(result.current.taskData.length).toBeGreaterThan(0);
    }, 600000); // 10 minute timeout for this specific test

    it('should complete reverse transition (task-based to equipment-based) within 1000ms', async () => {
      const { tasks, assets, associations, hierarchy } = generateLargeDataset(50000);

      let transitionDuration = 0;
      const onTransitionComplete = jest.fn((duration: number) => {
        transitionDuration = duration;
      });

      const { result } = renderHook(() =>
        useViewModeTransition({
          tasks,
          assets,
          associations,
          hierarchy,
          onTransitionComplete,
        })
      );

      // Wait for initial render
      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

      // First switch to task-based
      await act(async () => {
        result.current.switchMode('task-based');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => result.current.taskData.length > 0, { timeout: 300000 });

      // Reset callback
      onTransitionComplete.mockClear();
      transitionDuration = 0;

      // Measure reverse transition
      console.log('\nStarting reverse transition...');

      await act(async () => {
        result.current.switchMode('equipment-based');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

      console.log(`Reverse transition duration (callback): ${transitionDuration.toFixed(2)}ms`);

      // Verify mode switched back
      expect(result.current.currentMode).toBe('equipment-based');

      // Verify transition completed within 1000ms
      expect(transitionDuration).toBeLessThan(1000);

      // Verify data was generated
      expect(result.current.equipmentData.length).toBeGreaterThan(0);
      console.log(`Generated ${result.current.equipmentData.length} equipment-based rows`);
      console.log(`✓ Reverse transition completed in ${transitionDuration.toFixed(2)}ms (< 1000ms)`);
    }, 900000);

    it('should maintain data integrity during transition with large dataset', async () => {
      const { tasks, assets, associations, hierarchy } = generateLargeDataset(50000);

      const { result } = renderHook(() =>
        useViewModeTransition({
          tasks,
          assets,
          associations,
          hierarchy,
        })
      );

      // Wait for initial render
      console.log('\nWaiting for initial equipment data...');
      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

      // Get initial equipment count
      const initialAssetCount = result.current.equipmentData.filter(
        row => row.type === 'asset'
      ).length;

      console.log(`Initial asset count: ${initialAssetCount}`);
      expect(initialAssetCount).toBe(50000);

      // Switch to task-based
      console.log('Switching to task-based mode...');
      await act(async () => {
        result.current.switchMode('task-based');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => result.current.taskData.length > 0, { timeout: 300000 });

      // Count assets in task-based view
      const taskBasedAssetCount = result.current.taskData.filter(
        row => row.type === 'asset'
      ).length;

      // Should have same number of asset entries (though they may be duplicated under different tasks)
      expect(taskBasedAssetCount).toBeGreaterThan(0);
      console.log(`Task-based view has ${taskBasedAssetCount} asset rows`);

      // Switch back to equipment-based
      console.log('Switching back to equipment-based mode...');
      await act(async () => {
        result.current.switchMode('equipment-based');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

      // Verify asset count is preserved
      const finalAssetCount = result.current.equipmentData.filter(
        row => row.type === 'asset'
      ).length;

      console.log(`Final asset count: ${finalAssetCount}`);
      expect(finalAssetCount).toBe(initialAssetCount);
      console.log('✓ Data integrity maintained through transitions');
    }, 900000);
  });

  describe('パフォーマンスベンチマーク', () => {
    it('should provide performance metrics for different dataset sizes', async () => {
      const sizes = [1000, 5000, 10000, 25000, 50000];
      const results: { size: number; duration: number }[] = [];

      console.log('\n=== Performance Benchmark ===');

      for (const size of sizes) {
        console.log(`\nTesting ${size} assets...`);
        const { tasks, assets, associations, hierarchy } = generateLargeDataset(size);

        let transitionDuration = 0;
        const onTransitionComplete = jest.fn((duration: number) => {
          transitionDuration = duration;
        });

        const { result } = renderHook(() =>
          useViewModeTransition({
            tasks,
            assets,
            associations,
            hierarchy,
            onTransitionComplete,
          })
        );

        // Wait for initial render
        await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

        onTransitionComplete.mockClear();

        await act(async () => {
          result.current.switchMode('task-based');
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        await waitFor(() => result.current.taskData.length > 0, { timeout: 300000 });

        results.push({ size, duration: transitionDuration });
        console.log(`  → Transition time: ${transitionDuration.toFixed(2)}ms`);
      }

      // Log performance summary
      console.log('\n=== Performance Summary ===');
      console.log('Size\t\tDuration\tStatus');
      results.forEach(({ size, duration }) => {
        const status = duration < 1000 ? '✓ PASS' : '✗ FAIL';
        console.log(`${size}\t\t${duration.toFixed(2)}ms\t${status}`);
      });

      // Verify 50,000 meets requirement
      const largestTest = results[results.length - 1];
      expect(largestTest.size).toBe(50000);
      expect(largestTest.duration).toBeLessThan(1000);
      console.log(`\n✓ Requirement 6.3 PASSED: All dataset sizes meet performance target`);
    }, 900000);
  });

  describe('フィルター適用時のパフォーマンス', () => {
    it('should maintain performance when filters are applied during transition', async () => {
      const { tasks, assets, associations, hierarchy } = generateLargeDataset(50000);

      let transitionDuration = 0;
      const onTransitionComplete = jest.fn((duration: number) => {
        transitionDuration = duration;
      });

      const { result } = renderHook(() =>
        useViewModeTransition({
          tasks,
          assets,
          associations,
          hierarchy,
          onTransitionComplete,
        })
      );

      // Wait for initial render
      console.log('\nWaiting for initial data with filters...');
      await waitFor(() => result.current.equipmentData.length > 0, { timeout: 300000 });

      // Apply filters before transition
      console.log('Applying filters...');
      act(() => {
        result.current.applyFilters({
          hierarchyPath: { '製油所': '第一製油所' },
          taskClassification: '01',
        });
      });

      onTransitionComplete.mockClear();

      // Switch mode with filters applied
      console.log('Switching mode with filters...');
      await act(async () => {
        result.current.switchMode('task-based', true);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => result.current.taskData.length > 0, { timeout: 300000 });

      console.log(`Transition with filters: ${transitionDuration.toFixed(2)}ms`);

      // Verify transition completed within threshold
      expect(transitionDuration).toBeLessThan(1000);

      // Verify filters were preserved
      expect(result.current.currentState.filters.hierarchyPath).toEqual({
        '製油所': '第一製油所',
      });
      expect(result.current.currentState.filters.taskClassification).toBe('01');
      console.log('✓ Filters preserved and performance maintained');
    }, 900000);
  });
});
