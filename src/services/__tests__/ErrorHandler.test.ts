/**
 * ErrorHandler Service Tests
 */

import {
  ErrorHandler,
  errorHandler,
  createValidationError,
  createReferenceError,
  createMigrationError,
  createPerformanceError,
  ValidationError,
  ReferenceError,
  MigrationError,
  PerformanceError
} from '../ErrorHandler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
    // Clear console spies
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleValidationError', () => {
    it('should handle validation error and log it', () => {
      const error = createValidationError('name', 'Name is required', null);
      
      handler.handleValidationError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(error);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should generate user-friendly message for required field', () => {
      const error = createValidationError('name', 'Name is required', null);
      
      handler.handleValidationError(error);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('名前は必須項目です')
      );
    });

    it('should generate user-friendly message for invalid value', () => {
      const error = createValidationError('classification', 'Invalid classification', '99');
      
      handler.handleValidationError(error);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('作業分類の値が無効です')
      );
    });

    it('should generate user-friendly message for duplicate value', () => {
      const error = createValidationError('taskId', 'Duplicate task ID', 'task-001');
      
      handler.handleValidationError(error);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('作業IDが重複しています')
      );
    });
  });

  describe('handleReferenceError', () => {
    it('should handle reference error and log it', () => {
      const error = createReferenceError(
        'association',
        'assoc-001',
        'task-999',
        'Task not found'
      );
      
      handler.handleReferenceError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(error);
      expect(console.error).toHaveBeenCalled();
    });

    it('should generate user-friendly message for reference error', () => {
      const error = createReferenceError(
        'association',
        'assoc-001',
        'task-999',
        'Task not found'
      );
      
      handler.handleReferenceError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('データ整合性エラー')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('関連付け')
      );
    });

    it('should handle different entity types', () => {
      const taskError = createReferenceError('task', 'task-001', 'invalid', 'Invalid reference');
      const assetError = createReferenceError('asset', 'P-101', 'invalid', 'Invalid reference');
      
      handler.handleReferenceError(taskError);
      handler.handleReferenceError(assetError);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(2);
    });
  });

  describe('handleMigrationError', () => {
    it('should handle migration error and log it', () => {
      const error = createMigrationError(
        'equipments.json v1.0',
        'Failed to convert asset',
        { id: 'P-101' }
      );
      
      handler.handleMigrationError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(error);
      expect(console.error).toHaveBeenCalled();
    });

    it('should generate user-friendly message for migration error', () => {
      const error = createMigrationError(
        'equipments.json v1.0',
        'Invalid data format',
        { corrupted: true }
      );
      
      handler.handleMigrationError(error);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('データ移行エラー')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('equipments.json v1.0')
      );
    });
  });

  describe('handlePerformanceError', () => {
    it('should handle performance error and log it', () => {
      const error = createPerformanceError('render', 250, 200);
      
      handler.handlePerformanceError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(error);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should generate user-friendly message for performance error', () => {
      const error = createPerformanceError('viewModeSwitch', 1500, 1000);
      
      handler.handlePerformanceError(error);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('パフォーマンス警告')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('表示モード切り替え')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('1500ms')
      );
    });

    it('should handle different operation types', () => {
      const operations = ['render', 'filter', 'search', 'undo', 'redo'];
      
      operations.forEach(op => {
        const error = createPerformanceError(op, 300, 200);
        handler.handlePerformanceError(error);
      });
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(operations.length);
    });
  });

  describe('handleError', () => {
    it('should route validation errors correctly', () => {
      const error = createValidationError('name', 'Required', null);
      
      handler.handleError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('VALIDATION_ERROR');
    });

    it('should route reference errors correctly', () => {
      const error = createReferenceError('task', 'task-001', 'invalid', 'Not found');
      
      handler.handleError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('REFERENCE_ERROR');
    });

    it('should route migration errors correctly', () => {
      const error = createMigrationError('source', 'Failed', {});
      
      handler.handleError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('MIGRATION_ERROR');
    });

    it('should route performance errors correctly', () => {
      const error = createPerformanceError('render', 300, 200);
      
      handler.handleError(error);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('PERFORMANCE_ERROR');
    });
  });

  describe('Error Log Management', () => {
    it('should maintain error log', () => {
      const error1 = createValidationError('field1', 'Error 1', null);
      const error2 = createValidationError('field2', 'Error 2', null);
      
      handler.handleValidationError(error1);
      handler.handleValidationError(error2);
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(2);
    });

    it('should limit log size to max', () => {
      // Create more than 100 errors
      for (let i = 0; i < 150; i++) {
        const error = createValidationError(`field${i}`, `Error ${i}`, null);
        handler.handleValidationError(error);
      }
      
      const log = handler.getErrorLog();
      expect(log.length).toBeLessThanOrEqual(100);
    });

    it('should clear error log', () => {
      const error = createValidationError('field', 'Error', null);
      handler.handleValidationError(error);
      
      expect(handler.getErrorLog()).toHaveLength(1);
      
      handler.clearErrorLog();
      
      expect(handler.getErrorLog()).toHaveLength(0);
    });

    it('should filter errors by type', () => {
      handler.handleValidationError(createValidationError('f1', 'E1', null));
      handler.handleValidationError(createValidationError('f2', 'E2', null));
      handler.handleReferenceError(createReferenceError('task', 't1', 'r1', 'E3'));
      handler.handlePerformanceError(createPerformanceError('op', 300, 200));
      
      const validationErrors = handler.getErrorsByType('VALIDATION_ERROR');
      const referenceErrors = handler.getErrorsByType('REFERENCE_ERROR');
      const performanceErrors = handler.getErrorsByType('PERFORMANCE_ERROR');
      
      expect(validationErrors).toHaveLength(2);
      expect(referenceErrors).toHaveLength(1);
      expect(performanceErrors).toHaveLength(1);
    });

    it('should export error log as JSON', () => {
      const error = createValidationError('field', 'Error', 'value');
      handler.handleValidationError(error);
      
      const exported = handler.exportErrorLog();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual(error);
    });
  });

  describe('Helper Functions', () => {
    it('should create validation error correctly', () => {
      const error = createValidationError('name', 'Required', null);
      
      expect(error.type).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('name');
      expect(error.message).toBe('Required');
      expect(error.value).toBeNull();
    });

    it('should create reference error correctly', () => {
      const error = createReferenceError('task', 'task-001', 'ref-001', 'Not found');
      
      expect(error.type).toBe('REFERENCE_ERROR');
      expect(error.entityType).toBe('task');
      expect(error.entityId).toBe('task-001');
      expect(error.referencedId).toBe('ref-001');
      expect(error.message).toBe('Not found');
    });

    it('should create migration error correctly', () => {
      const data = { id: 'test' };
      const error = createMigrationError('source', 'Failed', data);
      
      expect(error.type).toBe('MIGRATION_ERROR');
      expect(error.source).toBe('source');
      expect(error.message).toBe('Failed');
      expect(error.data).toEqual(data);
    });

    it('should create performance error correctly', () => {
      const error = createPerformanceError('render', 300, 200);
      
      expect(error.type).toBe('PERFORMANCE_ERROR');
      expect(error.operation).toBe('render');
      expect(error.duration).toBe(300);
      expect(error.threshold).toBe(200);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide singleton instance', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should maintain state across calls', () => {
      errorHandler.clearErrorLog();
      
      const error = createValidationError('field', 'Error', null);
      errorHandler.handleValidationError(error);
      
      expect(errorHandler.getErrorLog()).toHaveLength(1);
    });
  });

  describe('Field Name Localization', () => {
    it('should localize common field names', () => {
      const fields = [
        { field: 'name', expected: '名前' },
        { field: 'description', expected: '説明' },
        { field: 'classification', expected: '作業分類' },
        { field: 'hierarchyPath', expected: '階層パス' },
        { field: 'taskId', expected: '作業ID' },
        { field: 'assetId', expected: '機器ID' },
        { field: 'schedule', expected: 'スケジュール' },
        { field: 'cost', expected: 'コスト' }
      ];

      fields.forEach(({ field, expected }) => {
        const error = createValidationError(field, 'required', null);
        handler.handleValidationError(error);
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(expected)
        );
      });
    });
  });

  describe('Operation Name Localization', () => {
    it('should localize common operation names', () => {
      const operations = [
        { op: 'render', expected: 'レンダリング' },
        { op: 'filter', expected: 'フィルタリング' },
        { op: 'search', expected: '検索' },
        { op: 'viewModeSwitch', expected: '表示モード切り替え' },
        { op: 'undo', expected: '元に戻す' },
        { op: 'redo', expected: 'やり直し' },
        { op: 'save', expected: '保存' },
        { op: 'load', expected: '読み込み' }
      ];

      operations.forEach(({ op, expected }) => {
        const error = createPerformanceError(op, 300, 200);
        handler.handlePerformanceError(error);
        
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(expected)
        );
      });
    });
  });
});
