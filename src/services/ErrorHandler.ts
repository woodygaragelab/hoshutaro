/**
 * ErrorHandler Service
 * 
 * Centralized error handling service for the maintenance task management system.
 * Handles validation errors, reference errors, migration errors, and performance errors.
 * Provides user-friendly error messages and logs errors for debugging.
 */

/**
 * Validation Error
 * Occurs when input data fails validation rules
 */
export interface ValidationError {
  type: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value: any;
}

/**
 * Reference Error
 * Occurs when data references non-existent entities
 */
export interface ReferenceError {
  type: 'REFERENCE_ERROR';
  entityType: 'task' | 'asset' | 'association';
  entityId: string;
  referencedId: string;
  message: string;
}

/**
 * Migration Error
 * Occurs during data migration from legacy format
 */
export interface MigrationError {
  type: 'MIGRATION_ERROR';
  source: string;
  message: string;
  data: any;
}

/**
 * Performance Error
 * Occurs when operations exceed performance thresholds
 */
export interface PerformanceError {
  type: 'PERFORMANCE_ERROR';
  operation: string;
  duration: number;
  threshold: number;
}

/**
 * Union type for all error types
 */
export type AppError = ValidationError | ReferenceError | MigrationError | PerformanceError;

/**
 * Error Handler Interface
 */
export interface IErrorHandler {
  handleValidationError(error: ValidationError): void;
  handleReferenceError(error: ReferenceError): void;
  handleMigrationError(error: MigrationError): void;
  handlePerformanceError(error: PerformanceError): void;
  handleError(error: AppError): void;
}

/**
 * Error Handler Implementation
 */
export class ErrorHandler implements IErrorHandler {
  private errorLog: AppError[] = [];
  private maxLogSize: number = 100;
  private displayCallback?: (message: string, severity: 'error' | 'warning' | 'info') => void;

  /**
   * Set display callback for showing errors to users
   * @param callback Function to display error messages
   */
  setDisplayCallback(callback: (message: string, severity: 'error' | 'warning' | 'info') => void): void {
    this.displayCallback = callback;
  }

  /**
   * Handle validation errors
   * @param error Validation error details
   */
  handleValidationError(error: ValidationError): void {
    this.logError(error);
    
    // Generate user-friendly message
    const userMessage = this.getValidationErrorMessage(error);
    
    // Display error to user
    this.displayError(userMessage, 'warning');
    
    // Log for debugging
      }

  /**
   * Handle reference integrity errors
   * @param error Reference error details
   */
  handleReferenceError(error: ReferenceError): void {
    this.logError(error);
    
    // Generate user-friendly message
    const userMessage = this.getReferenceErrorMessage(error);
    
    // Display error to user
    this.displayError(userMessage, 'error');
    
    // Log for debugging
    console.error('[Reference Error]', {
      entityType: error.entityType,
      entityId: error.entityId,
      referencedId: error.referencedId,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle migration errors
   * @param error Migration error details
   */
  handleMigrationError(error: MigrationError): void {
    this.logError(error);
    
    // Generate user-friendly message
    const userMessage = this.getMigrationErrorMessage(error);
    
    // Display error to user
    this.displayError(userMessage, 'error');
    
    // Log for debugging
    console.error('[Migration Error]', {
      source: error.source,
      message: error.message,
      data: error.data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle performance errors
   * @param error Performance error details
   */
  handlePerformanceError(error: PerformanceError): void {
    this.logError(error);
    
    // Generate user-friendly message
    const userMessage = this.getPerformanceErrorMessage(error);
    
    // Display warning to user
    this.displayError(userMessage, 'warning');
    
    // Log for debugging
      }

  /**
   * Generic error handler
   * @param error Any application error
   */
  handleError(error: AppError): void {
    switch (error.type) {
      case 'VALIDATION_ERROR':
        this.handleValidationError(error);
        break;
      case 'REFERENCE_ERROR':
        this.handleReferenceError(error);
        break;
      case 'MIGRATION_ERROR':
        this.handleMigrationError(error);
        break;
      case 'PERFORMANCE_ERROR':
        this.handlePerformanceError(error);
        break;
      default:
        console.error('[Unknown Error]', error);
    }
  }

  /**
   * Get user-friendly validation error message
   */
  private getValidationErrorMessage(error: ValidationError): string {
    const fieldMessages: { [key: string]: string } = {
      'name': '名前',
      'description': '説明',
      'classification': '作業分類',
      'hierarchyPath': '階層パス',
      'taskId': '作業ID',
      'assetId': '機器ID',
      'schedule': 'スケジュール',
      'cost': 'コスト'
    };

    const fieldName = fieldMessages[error.field] || error.field;
    const messageLower = error.message.toLowerCase();
    
    // Common validation error patterns (case-insensitive)
    if (messageLower.includes('required')) {
      return `${fieldName}は必須項目です。`;
    }
    if (messageLower.includes('invalid')) {
      return `${fieldName}の値が無効です。`;
    }
    if (messageLower.includes('duplicate')) {
      return `${fieldName}が重複しています。`;
    }
    if (messageLower.includes('range')) {
      return `${fieldName}の値が範囲外です。`;
    }
    
    return `${fieldName}のバリデーションエラー: ${error.message}`;
  }

  /**
   * Get user-friendly reference error message
   */
  private getReferenceErrorMessage(error: ReferenceError): string {
    const entityNames: { [key: string]: string } = {
      'task': '作業',
      'asset': '機器',
      'association': '関連付け'
    };

    const entityName = entityNames[error.entityType] || error.entityType;
    
    return `データ整合性エラー: ${entityName} (ID: ${error.entityId}) が存在しない参照 (ID: ${error.referencedId}) を含んでいます。データを確認してください。`;
  }

  /**
   * Get user-friendly migration error message
   */
  private getMigrationErrorMessage(error: MigrationError): string {
    return `データ移行エラー: ${error.source} からのデータ変換に失敗しました。\n詳細: ${error.message}\n\nデータを確認して再度お試しください。`;
  }

  /**
   * Get user-friendly performance error message
   */
  private getPerformanceErrorMessage(error: PerformanceError): string {
    const operationNames: { [key: string]: string } = {
      'render': 'レンダリング',
      'filter': 'フィルタリング',
      'search': '検索',
      'viewModeSwitch': '表示モード切り替え',
      'undo': '元に戻す',
      'redo': 'やり直し',
      'save': '保存',
      'load': '読み込み'
    };

    const operationName = operationNames[error.operation] || error.operation;
    
    return `パフォーマンス警告: ${operationName}の処理に ${error.duration}ms かかりました（目標: ${error.threshold}ms以内）。\n\nデータ量が多い場合は、フィルタリングを使用してデータを絞り込むことをお勧めします。`;
  }

  /**
   * Display error message to user
   * Integrates with UI notification system via callback
   */
  private displayError(message: string, severity: 'error' | 'warning' | 'info'): void {
    // Use callback if available
    if (this.displayCallback) {
      this.displayCallback(message, severity);
    }
    
    // Always log to console for debugging
    if (severity === 'error') {
      console.error(message);
    } else if (severity === 'warning') {
          } else {
          }
  }

  /**
   * Log error for debugging
   */
  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    // Maintain max log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
  }

  /**
   * Get error log for debugging
   */
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: AppError['type']): AppError[] {
    return this.errorLog.filter(error => error.type === type);
  }

  /**
   * Export error log as JSON
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }
}

/**
 * Singleton instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Helper functions for creating errors
 */

export function createValidationError(
  field: string,
  message: string,
  value: any
): ValidationError {
  return {
    type: 'VALIDATION_ERROR',
    field,
    message,
    value
  };
}

export function createReferenceError(
  entityType: 'task' | 'asset' | 'association',
  entityId: string,
  referencedId: string,
  message: string
): ReferenceError {
  return {
    type: 'REFERENCE_ERROR',
    entityType,
    entityId,
    referencedId,
    message
  };
}

export function createMigrationError(
  source: string,
  message: string,
  data: any
): MigrationError {
  return {
    type: 'MIGRATION_ERROR',
    source,
    message,
    data
  };
}

export function createPerformanceError(
  operation: string,
  duration: number,
  threshold: number
): PerformanceError {
  return {
    type: 'PERFORMANCE_ERROR',
    operation,
    duration,
    threshold
  };
}

/**
 * Handle generic JavaScript errors
 * Converts unknown errors to appropriate AppError types
 */
export function handleGenericError(
  error: unknown,
  context: string,
  errorHandler: ErrorHandler
): void {
  if (error instanceof Error) {
    // Check if it's a validation-related error
    if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('validation')) {
      errorHandler.handleValidationError({
        type: 'VALIDATION_ERROR',
        field: context,
        message: error.message,
        value: null
      });
    } else {
      // Generic error - log and display
      console.error(`[${context}] Error:`, error);
      errorHandler.handleValidationError({
        type: 'VALIDATION_ERROR',
        field: context,
        message: error.message || '予期しないエラーが発生しました',
        value: null
      });
    }
  } else {
    // Unknown error type
    console.error(`[${context}] Unknown error:`, error);
    errorHandler.handleValidationError({
      type: 'VALIDATION_ERROR',
      field: context,
      message: '予期しないエラーが発生しました',
      value: error
    });
  }
}
