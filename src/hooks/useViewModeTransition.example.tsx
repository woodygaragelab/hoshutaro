/**
 * useViewModeTransition Hook Usage Example
 * 
 * This example demonstrates how to use the useViewModeTransition hook
 * to manage view mode transitions in the maintenance grid.
 */

import React from 'react';
import { useViewModeTransition } from './useViewModeTransition';
import {
  Task,
  Asset,
  TaskAssociation,
  HierarchyDefinition,
} from '../types/maintenanceTask';

// Sample data
const sampleTasks: Task[] = [
  {
    id: 'task-001',
    name: '年次点検',
    description: '年次定期点検作業',
    classification: '01',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const sampleAssets: Asset[] = [
  {
    id: 'P-101',
    name: '原油供給ポンプ',
    hierarchyPath: {
      '製油所': '第一製油所',
      'エリア': 'Aエリア',
      'ユニット': '原油蒸留ユニット',
    },
    specifications: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const sampleAssociations: TaskAssociation[] = [
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
    updatedAt: new Date('2024-05-15'),
  },
];

const sampleHierarchy: HierarchyDefinition = {
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

/**
 * Example 1: Basic Usage
 */
export function BasicExample() {
  const {
    currentMode,
    equipmentData,
    taskData,
    switchMode,
  } = useViewModeTransition({
    tasks: sampleTasks,
    assets: sampleAssets,
    associations: sampleAssociations,
    hierarchy: sampleHierarchy,
  });

  return (
    <div>
      <h2>Current Mode: {currentMode}</h2>

      <button onClick={() => switchMode('equipment-based')}>
        Equipment-Based View
      </button>
      <button onClick={() => switchMode('task-based')}>
        Task-Based View
      </button>

      <div>
        {currentMode === 'equipment-based' ? (
          <div>
            <h3>Equipment Data ({equipmentData.length} rows)</h3>
            {equipmentData.map((row, index) => (
              <div key={index}>
                {row.type === 'hierarchy' && (
                  <div style={{ paddingLeft: row.level! * 20 }}>
                    📁 {row.hierarchyValue}
                  </div>
                )}
                {row.type === 'asset' && (
                  <div style={{ paddingLeft: 40 }}>
                    🔧 {row.assetName} ({row.tasks?.length} tasks)
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h3>Task Data ({taskData.length} rows)</h3>
            {taskData.map((row, index) => (
              <div key={index} style={{ paddingLeft: row.level * 20 }}>
                {row.type === 'classification' && `📋 Classification: ${row.classification}`}
                {row.type === 'workOrderLine' && `📝 Task: ${row.taskName}`}
                {row.type === 'asset' && `🔧 Asset: ${row.assetName}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 2: With Filters
 */
export function FilterExample() {
  const {
    currentState,
    equipmentData,
    switchMode,
    applyFilters,
  } = useViewModeTransition({
    tasks: sampleTasks,
    assets: sampleAssets,
    associations: sampleAssociations,
    hierarchy: sampleHierarchy,
  });

  return (
    <div>
      <h2>View Mode with Filters</h2>

      <div>
        <button onClick={() => switchMode('equipment-based')}>
          Equipment View
        </button>
        <button onClick={() => switchMode('task-based')}>
          Task View
        </button>
      </div>

      <div>
        <h3>Filters</h3>
        <button
          onClick={() =>
            applyFilters({
              hierarchyPath: { '製油所': '第一製油所' },
            })
          }
        >
          Filter by 第一製油所
        </button>
        <button
          onClick={() =>
            applyFilters({
              dateRange: { start: '2024-01-01', end: '2024-12-31' },
            })
          }
        >
          Filter by 2024
        </button>
        <button onClick={() => applyFilters({})}>
          Clear Filters
        </button>
      </div>

      <div>
        <h3>Current Filters:</h3>
        <pre>{JSON.stringify(currentState.filters, null, 2)}</pre>
      </div>

      <div>
        <h3>Filtered Data ({equipmentData.length} rows)</h3>
      </div>
    </div>
  );
}

/**
 * Example 3: With Performance Monitoring
 */
export function PerformanceExample() {
  const [transitionLog, setTransitionLog] = React.useState<string[]>([]);

  const {
    currentMode,
    transitionDuration,
    isTransitioning,
    switchMode,
  } = useViewModeTransition({
    tasks: sampleTasks,
    assets: sampleAssets,
    associations: sampleAssociations,
    hierarchy: sampleHierarchy,
    onTransitionStart: () => {
      setTransitionLog(prev => [...prev, 'Transition started...']);
    },
    onTransitionComplete: (duration) => {
      setTransitionLog(prev => [
        ...prev,
        `Transition completed in ${duration.toFixed(2)}ms`,
      ]);
    },
    onModeChange: (mode) => {
      setTransitionLog(prev => [...prev, `Mode changed to: ${mode}`]);
    },
  });

  return (
    <div>
      <h2>Performance Monitoring</h2>

      <div>
        <p>Current Mode: {currentMode}</p>
        <p>Is Transitioning: {isTransitioning ? 'Yes' : 'No'}</p>
        <p>Last Transition Duration: {transitionDuration.toFixed(2)}ms</p>
      </div>

      <div>
        <button onClick={() => switchMode('equipment-based')}>
          Switch to Equipment View
        </button>
        <button onClick={() => switchMode('task-based')}>
          Switch to Task View
        </button>
      </div>

      <div>
        <h3>Transition Log:</h3>
        <ul>
          {transitionLog.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 4: With State Preservation
 */
export function StatePreservationExample() {
  const {
    currentMode,
    currentState,
    switchMode,
    applyFilters,
  } = useViewModeTransition({
    tasks: sampleTasks,
    assets: sampleAssets,
    associations: sampleAssociations,
    hierarchy: sampleHierarchy,
  });

  return (
    <div>
      <h2>State Preservation</h2>

      <div>
        <h3>Apply Filters First:</h3>
        <button
          onClick={() =>
            applyFilters({
              hierarchyPath: { '製油所': '第一製油所' },
              dateRange: { start: '2024-01-01', end: '2024-12-31' },
            })
          }
        >
          Apply Filters
        </button>
      </div>

      <div>
        <h3>Switch Mode:</h3>
        <button onClick={() => switchMode('equipment-based', true)}>
          Switch with State Preservation
        </button>
        <button onClick={() => switchMode('task-based', false)}>
          Switch without State Preservation
        </button>
      </div>

      <div>
        <h3>Current State:</h3>
        <p>Mode: {currentMode}</p>
        <pre>{JSON.stringify(currentState.filters, null, 2)}</pre>
      </div>
    </div>
  );
}

export default BasicExample;
