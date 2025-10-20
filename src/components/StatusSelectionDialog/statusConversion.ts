import { StatusValue } from '../CommonEdit/types';
import { 
  createStatusValue, 
  extractPlannedActual, 
  isValidStatusTransition,
  requiresConfirmation,
  getConfirmationMessage 
} from '../CommonEdit/statusLogic';

/**
 * 状態変換の結果
 */
export interface StatusConversionResult {
  success: boolean;
  newStatus: StatusValue;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  errors: string[];
  warnings: string[];
}

/**
 * 状態遷移のバリデーション
 */
export interface StatusTransitionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

/**
 * 状態変換オプション
 */
export interface StatusConversionOptions {
  allowInvalidTransitions?: boolean;
  skipConfirmation?: boolean;
  validateBusinessRules?: boolean;
  preserveTimestamp?: boolean;
}

/**
 * planned/actual値から StatusValue への変換
 */
export const convertToStatusValue = (
  planned: boolean,
  actual: boolean,
  options: StatusConversionOptions = {}
): StatusConversionResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const newStatus = createStatusValue(planned, actual);
    
    // ビジネスルールの検証
    if (options.validateBusinessRules) {
      // 実績ありで計画なしの場合は警告
      if (actual && !planned) {
        warnings.push('計画なしで実績が記録されています。計画の追加を検討してください。');
      }
    }

    return {
      success: true,
      newStatus,
      requiresConfirmation: false,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`状態変換エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    
    return {
      success: false,
      newStatus: createStatusValue(false, false), // デフォルト値
      requiresConfirmation: false,
      errors,
      warnings,
    };
  }
};

/**
 * StatusValue から planned/actual値への変換
 */
export const convertFromStatusValue = (
  status: StatusValue,
  options: StatusConversionOptions = {}
): { planned: boolean; actual: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { planned, actual } = extractPlannedActual(status);
    
    return {
      planned,
      actual,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(`状態変換エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    
    return {
      planned: false,
      actual: false,
      errors,
      warnings,
    };
  }
};

/**
 * 状態遷移のバリデーション
 */
export const validateStatusTransition = (
  fromStatus: StatusValue,
  toStatus: StatusValue,
  options: StatusConversionOptions = {}
): StatusTransitionValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本的な遷移チェック
  const isValid = options.allowInvalidTransitions || isValidStatusTransition(fromStatus, toStatus);
  
  if (!isValid) {
    errors.push(`無効な状態遷移: ${fromStatus.label} → ${toStatus.label}`);
  }

  // 確認が必要かチェック
  const needsConfirmation = !options.skipConfirmation && requiresConfirmation(fromStatus, toStatus);
  const confirmationMessage = needsConfirmation ? getConfirmationMessage(fromStatus, toStatus) : undefined;

  // ビジネスルールの検証
  if (options.validateBusinessRules) {
    // 実績から計画なしへの変更
    if (fromStatus.actual && !toStatus.actual && !toStatus.planned) {
      warnings.push('実績データが削除されます。この操作は慎重に行ってください。');
    }

    // 計画から未計画への変更
    if (fromStatus.planned && !toStatus.planned && !toStatus.actual) {
      warnings.push('計画データが削除されます。');
    }

    // 実績ありから実績なしへの変更（計画は残る）
    if (fromStatus.actual && !toStatus.actual && toStatus.planned) {
      warnings.push('実績データのみが削除され、計画データは保持されます。');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresConfirmation: needsConfirmation,
    confirmationMessage,
  };
};

/**
 * 状態変更の実行
 */
export const executeStatusChange = (
  fromStatus: StatusValue,
  toStatus: StatusValue,
  options: StatusConversionOptions = {}
): StatusConversionResult => {
  // バリデーション実行
  const validation = validateStatusTransition(fromStatus, toStatus, options);
  
  if (!validation.isValid) {
    return {
      success: false,
      newStatus: fromStatus, // 元の状態を保持
      requiresConfirmation: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  return {
    success: true,
    newStatus: toStatus,
    requiresConfirmation: validation.requiresConfirmation,
    confirmationMessage: validation.confirmationMessage,
    errors: validation.errors,
    warnings: validation.warnings,
  };
};

/**
 * 複数の状態変更をバッチ処理
 */
export interface BatchStatusChange {
  id: string;
  fromStatus: StatusValue;
  toStatus: StatusValue;
}

export interface BatchStatusChangeResult {
  success: boolean;
  results: Array<{
    id: string;
    success: boolean;
    newStatus: StatusValue;
    errors: string[];
    warnings: string[];
  }>;
  totalErrors: number;
  totalWarnings: number;
}

export const executeBatchStatusChange = (
  changes: BatchStatusChange[],
  options: StatusConversionOptions = {}
): BatchStatusChangeResult => {
  const results = changes.map(change => {
    const result = executeStatusChange(change.fromStatus, change.toStatus, options);
    
    return {
      id: change.id,
      success: result.success,
      newStatus: result.newStatus,
      errors: result.errors,
      warnings: result.warnings,
    };
  });

  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
  const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);
  const success = results.every(result => result.success);

  return {
    success,
    results,
    totalErrors,
    totalWarnings,
  };
};

/**
 * 状態変更履歴の記録
 */
export interface StatusChangeHistory {
  timestamp: Date;
  fromStatus: StatusValue;
  toStatus: StatusValue;
  user: string;
  reason?: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

/**
 * 状態変更履歴を作成
 */
export const createStatusChangeHistory = (
  fromStatus: StatusValue,
  toStatus: StatusValue,
  user: string,
  deviceType: 'desktop' | 'tablet' | 'mobile',
  reason?: string
): StatusChangeHistory => {
  return {
    timestamp: new Date(),
    fromStatus,
    toStatus,
    user,
    reason,
    deviceType,
  };
};

/**
 * データ整合性チェック
 */
export interface DataIntegrityCheck {
  isConsistent: boolean;
  issues: Array<{
    type: 'error' | 'warning';
    message: string;
    field: string;
  }>;
}

/**
 * 状態データの整合性をチェック
 */
export const checkStatusDataIntegrity = (
  statusValue: StatusValue,
  plannedValue: boolean,
  actualValue: boolean
): DataIntegrityCheck => {
  const issues: Array<{ type: 'error' | 'warning'; message: string; field: string }> = [];

  // StatusValue と planned/actual値の整合性チェック
  if (statusValue.planned !== plannedValue) {
    issues.push({
      type: 'error',
      message: `計画状態の不整合: StatusValue.planned=${statusValue.planned}, planned=${plannedValue}`,
      field: 'planned',
    });
  }

  if (statusValue.actual !== actualValue) {
    issues.push({
      type: 'error',
      message: `実績状態の不整合: StatusValue.actual=${statusValue.actual}, actual=${actualValue}`,
      field: 'actual',
    });
  }

  // 表示記号の整合性チェック
  const expectedStatus = createStatusValue(plannedValue, actualValue);
  if (statusValue.displaySymbol !== expectedStatus.displaySymbol) {
    issues.push({
      type: 'warning',
      message: `表示記号の不整合: 期待値=${expectedStatus.displaySymbol}, 実際値=${statusValue.displaySymbol}`,
      field: 'displaySymbol',
    });
  }

  return {
    isConsistent: issues.filter(issue => issue.type === 'error').length === 0,
    issues,
  };
};