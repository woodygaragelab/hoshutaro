/**
 * コスト入力のバリデーション機能
 */

export interface CostValidationRule {
  minValue?: number;
  maxValue?: number;
  required?: boolean;
  allowZero?: boolean;
  maxDecimalPlaces?: number;
}

export interface CostValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedValue?: number;
}

export interface CostValidationOptions {
  planCostRules?: CostValidationRule;
  actualCostRules?: CostValidationRule;
  crossValidation?: {
    actualShouldNotExceedPlan?: boolean;
    planRequiredIfActual?: boolean;
  };
}

/**
 * 通貨フォーマットされた文字列を数値に変換
 */
export const parseCurrency = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  // カンマ、円記号、全角数字を除去・変換して数値に変換
  const cleanValue = value
    .replace(/[,¥円]/g, '') // カンマ、円記号を除去
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角数字を半角に変換
    .trim();
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * 数値を通貨フォーマット（3桁区切りカンマ）に変換
 */
export const formatCurrency = (value: number): string => {
  if (isNaN(value) || value === 0) return '';
  return new Intl.NumberFormat('ja-JP').format(value);
};

/**
 * 入力値の基本バリデーション
 */
export const validateCostValue = (
  value: string,
  fieldName: string,
  rules?: CostValidationRule
): CostValidationResult => {
  const result: CostValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!rules) {
    result.normalizedValue = parseCurrency(value);
    return result;
  }

  const trimmedValue = value.trim();
  
  // 必須チェック
  if (rules.required && (!trimmedValue || trimmedValue === '')) {
    result.errors.push(`${fieldName}は必須です`);
    result.isValid = false;
    return result;
  }

  // 空値の場合（必須でない場合）
  if (!trimmedValue || trimmedValue === '') {
    result.normalizedValue = 0;
    return result;
  }

  // 数値変換
  const numericValue = parseCurrency(trimmedValue);
  
  // 数値チェック
  if (isNaN(numericValue)) {
    result.errors.push(`${fieldName}は有効な数値を入力してください`);
    result.isValid = false;
    return result;
  }

  // 小数点以下の桁数チェック
  if (rules.maxDecimalPlaces !== undefined) {
    const decimalPlaces = (numericValue.toString().split('.')[1] || '').length;
    if (decimalPlaces > rules.maxDecimalPlaces) {
      result.errors.push(`${fieldName}は小数点以下${rules.maxDecimalPlaces}桁以内で入力してください`);
      result.isValid = false;
    }
  }

  // ゼロ値チェック
  if (!rules.allowZero && numericValue === 0) {
    result.warnings.push(`${fieldName}が0円です。意図した値でしょうか？`);
  }

  // 負の値チェック
  if (numericValue < 0) {
    result.errors.push(`${fieldName}は0以上の値を入力してください`);
    result.isValid = false;
  }

  // 最小値チェック
  if (rules.minValue !== undefined && numericValue < rules.minValue) {
    result.errors.push(`${fieldName}は${formatCurrency(rules.minValue)}円以上で入力してください`);
    result.isValid = false;
  }

  // 最大値チェック
  if (rules.maxValue !== undefined && numericValue > rules.maxValue) {
    result.errors.push(`${fieldName}は${formatCurrency(rules.maxValue)}円以下で入力してください`);
    result.isValid = false;
  }

  // 大きな値の警告
  if (numericValue > 1000000000) { // 10億円以上
    result.warnings.push(`${fieldName}が非常に大きな値です。入力内容を確認してください`);
  }

  result.normalizedValue = numericValue;
  return result;
};

/**
 * 計画コストと実績コストの相互バリデーション
 */
export const validateCostCrossRelation = (
  planCost: number,
  actualCost: number,
  options?: CostValidationOptions['crossValidation']
): CostValidationResult => {
  const result: CostValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // 計画と実績の差が大きい場合の警告（常にチェック）
  if (planCost > 0 && actualCost > 0) {
    const diffRate = Math.abs(actualCost - planCost) / planCost * 100;
    if (diffRate > 50) { // 50%以上の差
      result.warnings.push(`計画コストと実績コストの差が${diffRate.toFixed(1)}%と大きくなっています`);
    }
  }

  if (!options) return result;

  // 実績が計画を超えないかチェック
  if (options.actualShouldNotExceedPlan && actualCost > 0 && planCost > 0) {
    if (actualCost > planCost) {
      const exceedRate = ((actualCost - planCost) / planCost * 100).toFixed(1);
      result.warnings.push(`実績コストが計画コストを${exceedRate}%超過しています`);
    }
  }

  // 実績がある場合は計画も必要かチェック
  if (options.planRequiredIfActual && actualCost > 0 && planCost === 0) {
    result.warnings.push('実績コストが入力されていますが、計画コストが未入力です');
  }

  return result;
};

/**
 * 完全なコスト入力バリデーション
 */
export const validateCostInput = (
  planCostValue: string,
  actualCostValue: string,
  options?: CostValidationOptions
): {
  planCost: CostValidationResult;
  actualCost: CostValidationResult;
  crossValidation: CostValidationResult;
  isValid: boolean;
  allErrors: string[];
  allWarnings: string[];
} => {
  // 個別バリデーション
  const planCostResult = validateCostValue(planCostValue, '計画コスト', options?.planCostRules);
  const actualCostResult = validateCostValue(actualCostValue, '実績コスト', options?.actualCostRules);

  // 相互バリデーション
  const crossValidationResult = validateCostCrossRelation(
    planCostResult.normalizedValue || 0,
    actualCostResult.normalizedValue || 0,
    options?.crossValidation
  );

  // 全体の結果をまとめる
  const allErrors = [
    ...planCostResult.errors,
    ...actualCostResult.errors,
    ...crossValidationResult.errors,
  ];

  const allWarnings = [
    ...planCostResult.warnings,
    ...actualCostResult.warnings,
    ...crossValidationResult.warnings,
  ];

  const isValid = planCostResult.isValid && actualCostResult.isValid && crossValidationResult.isValid;

  return {
    planCost: planCostResult,
    actualCost: actualCostResult,
    crossValidation: crossValidationResult,
    isValid,
    allErrors,
    allWarnings,
  };
};

/**
 * リアルタイム入力フィルタリング（不正な文字の除去）
 */
export const filterCostInput = (value: string): string => {
  // 数値、カンマ、小数点、マイナス記号のみ許可
  return value.replace(/[^\d,.-]/g, '');
};

/**
 * 入力値の自動フォーマット（入力中のリアルタイム整形）
 */
export const formatCostInputRealtime = (value: string): string => {
  if (!value || value.trim() === '') return '';
  
  // 不正な文字を除去
  const filtered = filterCostInput(value);
  
  // 数値に変換してフォーマット
  const numeric = parseCurrency(filtered);
  if (isNaN(numeric) || numeric === 0) return filtered;
  
  return formatCurrency(numeric);
};

/**
 * デフォルトのバリデーションルール
 */
export const DEFAULT_COST_VALIDATION_RULES: CostValidationOptions = {
  planCostRules: {
    minValue: 0,
    maxValue: 999999999999, // 1兆円未満
    allowZero: true,
    maxDecimalPlaces: 0, // 整数のみ
  },
  actualCostRules: {
    minValue: 0,
    maxValue: 999999999999, // 1兆円未満
    allowZero: true,
    maxDecimalPlaces: 0, // 整数のみ
  },
  crossValidation: {
    actualShouldNotExceedPlan: false, // 警告のみ
    planRequiredIfActual: false, // 警告のみ
  },
};

/**
 * 厳格なバリデーションルール（エラーとして扱う）
 */
export const STRICT_COST_VALIDATION_RULES: CostValidationOptions = {
  planCostRules: {
    minValue: 1,
    maxValue: 999999999999,
    required: true,
    allowZero: false,
    maxDecimalPlaces: 0,
  },
  actualCostRules: {
    minValue: 0,
    maxValue: 999999999999,
    allowZero: true,
    maxDecimalPlaces: 0,
  },
  crossValidation: {
    actualShouldNotExceedPlan: true,
    planRequiredIfActual: true,
  },
};