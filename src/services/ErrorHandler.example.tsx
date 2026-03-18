/**
 * ErrorHandler Service - Usage Examples
 * 
 * This file demonstrates how to use the ErrorHandler service
 * in various scenarios within the maintenance task management system.
 */

import React, { useState } from 'react';
import {
  errorHandler,
  createValidationError,
  createReferenceError,
  createMigrationError,
  createPerformanceError
} from './ErrorHandler';
import { TaskManager } from './TaskManager';
import { AssociationManager } from './AssociationManager';

/**
 * Example 1: Validation Error Handling in Form Submission
 */
export function TaskFormExample() {
  const [taskName, setTaskName] = useState('');
  const [classification, setClassification] = useState('');
  const taskManager = new TaskManager();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate task name
    if (!taskName.trim()) {
      const error = createValidationError('name', 'Name is required', taskName);
      errorHandler.handleValidationError(error);
      return;
    }

    // Validate classification
    const classNum = parseInt(classification);
    if (isNaN(classNum) || classNum < 1 || classNum > 20) {
      const error = createValidationError(
        'classification',
        'Invalid classification range',
        classification
      );
      errorHandler.handleValidationError(error);
      return;
    }

    // Create task
    try {
      taskManager.createTask({
        name: taskName,
        description: '',
        classification: classification.padStart(2, '0')
      });
      console.log('Task created successfully');
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        placeholder="作業名"
      />
      <input
        type="text"
        value={classification}
        onChange={(e) => setClassification(e.target.value)}
        placeholder="作業分類 (01-20)"
      />
      <button type="submit">作業を作成</button>
    </form>
  );
}

/**
 * Example 2: Reference Error Handling in Association Creation
 */
export function AssociationCreationExample() {
  const associationManager = new AssociationManager();

  const createAssociation = (assetId: string, taskId: string) => {
    // Check if task exists (simulated)
    const taskExists = false; // In real code, check with TaskManager

    if (!taskExists) {
      const error = createReferenceError(
        'association',
        'new-association',
        taskId,
        'Referenced task does not exist'
      );
      errorHandler.handleReferenceError(error);
      return null;
    }

    // Create association
    return associationManager.createAssociation({
      assetId,
      taskId,
      schedule: {}
    });
  };

  return (
    <div>
      <button onClick={() => createAssociation('P-101', 'task-999')}>
        関連付けを作成
      </button>
    </div>
  );
}

/**
 * Example 3: Migration Error Handling
 */
export function DataMigrationExample() {
  const [migrationStatus, setMigrationStatus] = useState<string>('');

  const migrateData = async () => {
    try {
      setMigrationStatus('移行中...');

      // Simulate migration
      const legacyData = {
        'P-101': {
          id: 'P-101',
          hierarchy: { plant: '第一製油所' },
          maintenances: {}
        }
      };

      // Simulate migration error
      const hasError = true;
      if (hasError) {
        const error = createMigrationError(
          'equipments.json v1.0',
          'Failed to convert asset P-101: Invalid hierarchy structure',
          legacyData['P-101']
        );
        errorHandler.handleMigrationError(error);
        setMigrationStatus('移行失敗');
        return;
      }

      setMigrationStatus('移行完了');
    } catch (error) {
      setMigrationStatus('エラーが発生しました');
    }
  };

  return (
    <div>
      <button onClick={migrateData}>データを移行</button>
      <p>{migrationStatus}</p>
    </div>
  );
}

/**
 * Example 4: Performance Error Monitoring
 */
export function PerformanceMonitoringExample() {
  const [renderTime, setRenderTime] = useState<number>(0);

  const performSlowOperation = () => {
    const startTime = performance.now();

    // Simulate slow operation
    const data = Array.from({ length: 50000 }, (_, i) => ({
      id: `asset-${i}`,
      name: `Asset ${i}`
    }));

    // Process data
    const filtered = data.filter(item => item.id.includes('1'));
    console.log(`Filtered ${filtered.length} items`);

    const duration = performance.now() - startTime;
    setRenderTime(duration);

    // Check performance threshold
    const threshold = 500; // 500ms
    if (duration > threshold) {
      const error = createPerformanceError('filter', duration, threshold);
      errorHandler.handlePerformanceError(error);
    }
  };

  return (
    <div>
      <button onClick={performSlowOperation}>フィルタリング実行</button>
      <p>処理時間: {renderTime.toFixed(2)}ms</p>
    </div>
  );
}

/**
 * Example 5: Error Log Viewer
 */
export function ErrorLogViewerExample() {
  const [errorLog, setErrorLog] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  const refreshLog = () => {
    if (filterType === 'all') {
      setErrorLog(errorHandler.getErrorLog());
    } else {
      setErrorLog(errorHandler.getErrorsByType(filterType as any));
    }
  };

  const clearLog = () => {
    errorHandler.clearErrorLog();
    setErrorLog([]);
  };

  const exportLog = () => {
    const json = errorHandler.exportErrorLog();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'error-log.json';
    a.click();
  };

  return (
    <div>
      <h3>エラーログ</h3>
      <div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">すべて</option>
          <option value="VALIDATION_ERROR">バリデーションエラー</option>
          <option value="REFERENCE_ERROR">参照エラー</option>
          <option value="MIGRATION_ERROR">移行エラー</option>
          <option value="PERFORMANCE_ERROR">パフォーマンスエラー</option>
        </select>
        <button onClick={refreshLog}>更新</button>
        <button onClick={clearLog}>クリア</button>
        <button onClick={exportLog}>エクスポート</button>
      </div>
      <div>
        <p>エラー数: {errorLog.length}</p>
        <ul>
          {errorLog.map((error, index) => (
            <li key={index}>
              <strong>{error.type}</strong>: {JSON.stringify(error)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 6: Integrated Error Handling in Manager
 */
export class TaskManagerWithErrorHandling extends TaskManager {
  createTask(data: any) {
    // Validate name
    if (!data.name || !data.name.trim()) {
      const error = createValidationError('name', 'Name is required', data.name);
      errorHandler.handleValidationError(error);
      throw new Error('Validation failed: name is required');
    }

    // Validate classification
    const classNum = parseInt(data.classification);
    if (isNaN(classNum) || classNum < 1 || classNum > 20) {
      const error = createValidationError(
        'classification',
        'Invalid classification range (must be 01-20)',
        data.classification
      );
      errorHandler.handleValidationError(error);
      throw new Error('Validation failed: invalid classification');
    }

    // Check for duplicate ID (simulated)
    const existingTask = this.getTask(data.id);
    if (existingTask) {
      const error = createValidationError(
        'taskId',
        'Duplicate task ID',
        data.id
      );
      errorHandler.handleValidationError(error);
      throw new Error('Validation failed: duplicate task ID');
    }

    // Create task
    return super.createTask(data);
  }
}

/**
 * Example 7: Performance Wrapper Function
 */
export function withPerformanceMonitoring<T>(
  operation: string,
  threshold: number,
  fn: () => T
): T {
  const startTime = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - startTime;

    if (duration > threshold) {
      const error = createPerformanceError(operation, duration, threshold);
      errorHandler.handlePerformanceError(error);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`Operation ${operation} failed after ${duration}ms:`, error);
    throw error;
  }
}

// Usage of performance wrapper
export function ViewModeSwitchExample() {
  const switchViewMode = () => {
    withPerformanceMonitoring('viewModeSwitch', 1000, () => {
      // Simulate view mode switch
      const data = Array.from({ length: 50000 }, (_, i) => ({
        id: `asset-${i}`,
        name: `Asset ${i}`
      }));

      // Transform data
      return data.map(item => ({
        ...item,
        transformed: true
      }));
    });
  };

  return (
    <div>
      <button onClick={switchViewMode}>表示モード切り替え</button>
    </div>
  );
}

/**
 * Example 8: Complete Application Integration
 */
export function MaintenanceAppWithErrorHandling() {
  return (
    <div>
      <h1>保全管理システム</h1>
      
      <section>
        <h2>作業作成</h2>
        <TaskFormExample />
      </section>

      <section>
        <h2>関連付け作成</h2>
        <AssociationCreationExample />
      </section>

      <section>
        <h2>データ移行</h2>
        <DataMigrationExample />
      </section>

      <section>
        <h2>パフォーマンス監視</h2>
        <PerformanceMonitoringExample />
      </section>

      <section>
        <h2>エラーログ</h2>
        <ErrorLogViewerExample />
      </section>
    </div>
  );
}
