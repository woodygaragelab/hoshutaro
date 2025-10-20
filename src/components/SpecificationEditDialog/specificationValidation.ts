import { SpecificationValue } from '../CommonEdit/types';

// バリデーションルール
export interface SpecificationValidationOptions {
  maxKeyLength: number;
  maxValueLength: number;
  maxItems: number;
  allowedKeyPattern?: RegExp;
  allowedValuePattern?: RegExp;
  requiredFields: boolean;
  allowDuplicateKeys: boolean;
}

// デフォルトのバリデーションルール
export const DEFAULT_SPECIFICATION_VALIDATION_RULES: SpecificationValidationOptions = {
  maxKeyLength: 50,
  maxValueLength: 200,
  maxItems: 20,
  allowedKeyPattern: /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-_()（）]+$/,
  allowedValuePattern: /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-_()（）.,、。]+$/,
  requiredFields: true,
  allowDuplicateKeys: false,
};

// バリデーション結果
export interface SpecificationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  itemErrors: { [index: number]: SpecificationItemValidationResult };
}

export interface SpecificationItemValidationResult {
  keyErrors: string[];
  valueErrors: string[];
  keyWarnings: string[];
  valueWarnings: string[];
  isValid: boolean;
}

/**
 * 機器仕様の項目名をバリデーション
 */
export const validateSpecificationKey = (
  key: string,
  options: SpecificationValidationOptions = DEFAULT_SPECIFICATION_VALIDATION_RULES
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const trimmedKey = key.trim();
  
  // 必須チェック
  if (options.requiredFields && !trimmedKey) {
    errors.push('項目名は必須です');
    return { errors, warnings };
  }
  
  // 長さチェック
  if (trimmedKey.length > options.maxKeyLength) {
    errors.push(`項目名は${options.maxKeyLength}文字以内で入力してください`);
  }
  
  // パターンチェック
  if (options.allowedKeyPattern && !options.allowedKeyPattern.test(trimmedKey)) {
    errors.push('項目名に使用できない文字が含まれています');
  }
  
  // 警告レベルのチェック
  if (trimmedKey.length > options.maxKeyLength * 0.8) {
    warnings.push('項目名が長すぎる可能性があります');
  }
  
  // 特殊文字の警告
  if (/[<>\"'&]/.test(trimmedKey)) {
    warnings.push('項目名に特殊文字が含まれています');
  }
  
  return { errors, warnings };
};

/**
 * 機器仕様の値をバリデーション
 */
export const validateSpecificationValue = (
  value: string,
  options: SpecificationValidationOptions = DEFAULT_SPECIFICATION_VALIDATION_RULES
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const trimmedValue = value.trim();
  
  // 必須チェック
  if (options.requiredFields && !trimmedValue) {
    errors.push('値は必須です');
    return { errors, warnings };
  }
  
  // 長さチェック
  if (trimmedValue.length > options.maxValueLength) {
    errors.push(`値は${options.maxValueLength}文字以内で入力してください`);
  }
  
  // パターンチェック
  if (options.allowedValuePattern && !options.allowedValuePattern.test(trimmedValue)) {
    errors.push('値に使用できない文字が含まれています');
  }
  
  // 警告レベルのチェック
  if (trimmedValue.length > options.maxValueLength * 0.8) {
    warnings.push('値が長すぎる可能性があります');
  }
  
  // 特殊文字の警告
  if (/[<>\"'&]/.test(trimmedValue)) {
    warnings.push('値に特殊文字が含まれています');
  }
  
  return { errors, warnings };
};

/**
 * 機器仕様全体をバリデーション
 */
export const validateSpecifications = (
  specifications: SpecificationValue[],
  options: SpecificationValidationOptions = DEFAULT_SPECIFICATION_VALIDATION_RULES
): SpecificationValidationResult => {
  const result: SpecificationValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    itemErrors: {},
  };
  
  // 項目数チェック
  if (specifications.length > options.maxItems) {
    result.errors.push(`項目数が上限（${options.maxItems}個）を超えています`);
    result.isValid = false;
  }
  
  // 重複キーチェック用のマップ
  const keyMap = new Map<string, number[]>();
  
  // 各項目のバリデーション
  specifications.forEach((spec, index) => {
    const keyValidation = validateSpecificationKey(spec.key, options);
    const valueValidation = validateSpecificationValue(spec.value, options);
    
    const itemResult: SpecificationItemValidationResult = {
      keyErrors: keyValidation.errors,
      valueErrors: valueValidation.errors,
      keyWarnings: keyValidation.warnings,
      valueWarnings: valueValidation.warnings,
      isValid: keyValidation.errors.length === 0 && valueValidation.errors.length === 0,
    };
    
    result.itemErrors[index] = itemResult;
    
    if (!itemResult.isValid) {
      result.isValid = false;
    }
    
    // 重複チェック用にキーを記録
    if (spec.key.trim()) {
      const normalizedKey = spec.key.trim().toLowerCase();
      if (!keyMap.has(normalizedKey)) {
        keyMap.set(normalizedKey, []);
      }
      keyMap.get(normalizedKey)!.push(index);
    }
    
    // エラーと警告を全体に追加
    result.errors.push(...keyValidation.errors.map(err => `${index + 1}行目 項目名: ${err}`));
    result.errors.push(...valueValidation.errors.map(err => `${index + 1}行目 値: ${err}`));
    result.warnings.push(...keyValidation.warnings.map(warn => `${index + 1}行目 項目名: ${warn}`));
    result.warnings.push(...valueValidation.warnings.map(warn => `${index + 1}行目 値: ${warn}`));
  });
  
  // 重複キーのチェック
  if (!options.allowDuplicateKeys) {
    keyMap.forEach((indices, key) => {
      if (indices.length > 1) {
        const duplicateError = `項目名「${key}」が重複しています（${indices.map(i => i + 1).join('、')}行目）`;
        result.errors.push(duplicateError);
        result.isValid = false;
        
        // 各重複項目にエラーを追加
        indices.forEach(index => {
          if (result.itemErrors[index]) {
            result.itemErrors[index].keyErrors.push('項目名が重複しています');
            result.itemErrors[index].isValid = false;
          }
        });
      }
    });
  }
  
  // 警告レベルのチェック
  if (specifications.length > options.maxItems * 0.8) {
    result.warnings.push('項目数が多すぎる可能性があります');
  }
  
  // 空の項目の警告
  const emptyItems = specifications.filter(spec => !spec.key.trim() || !spec.value.trim());
  if (emptyItems.length > 0) {
    result.warnings.push(`${emptyItems.length}個の空の項目があります`);
  }
  
  return result;
};

/**
 * 機器仕様のフォーマット（正規化）
 */
export const formatSpecifications = (specifications: SpecificationValue[]): SpecificationValue[] => {
  return specifications
    .map((spec, index) => ({
      key: spec.key.trim(),
      value: spec.value.trim(),
      order: index + 1,
    }))
    .filter(spec => spec.key || spec.value); // 完全に空の項目は除外
};

/**
 * 機器仕様のサニタイズ（危険な文字の除去）
 */
export const sanitizeSpecifications = (specifications: SpecificationValue[]): SpecificationValue[] => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/[<>]/g, '') // HTMLタグの除去
      .replace(/[\"']/g, '') // クォートの除去
      .replace(/&/g, '&amp;') // アンパサンドのエスケープ
      .trim();
  };
  
  return specifications.map((spec, index) => ({
    key: sanitizeString(spec.key),
    value: sanitizeString(spec.value),
    order: index + 1,
  }));
};

/**
 * 機器仕様の差分検出
 */
export const detectSpecificationChanges = (
  original: SpecificationValue[],
  modified: SpecificationValue[]
): {
  added: SpecificationValue[];
  removed: SpecificationValue[];
  modified: { original: SpecificationValue; modified: SpecificationValue }[];
  reordered: boolean;
} => {
  const result = {
    added: [] as SpecificationValue[],
    removed: [] as SpecificationValue[],
    modified: [] as { original: SpecificationValue; modified: SpecificationValue }[],
    reordered: false,
  };
  
  // 追加された項目
  modified.forEach(modSpec => {
    const found = original.find(origSpec => 
      origSpec.key === modSpec.key && origSpec.value === modSpec.value
    );
    if (!found) {
      const existingKey = original.find(origSpec => origSpec.key === modSpec.key);
      if (existingKey) {
        result.modified.push({ original: existingKey, modified: modSpec });
      } else {
        result.added.push(modSpec);
      }
    }
  });
  
  // 削除された項目
  original.forEach(origSpec => {
    const found = modified.find(modSpec => 
      modSpec.key === origSpec.key && modSpec.value === origSpec.value
    );
    if (!found) {
      const existingKey = modified.find(modSpec => modSpec.key === origSpec.key);
      if (!existingKey) {
        result.removed.push(origSpec);
      }
    }
  });
  
  // 順序変更の検出
  if (original.length === modified.length && result.added.length === 0 && result.removed.length === 0) {
    for (let i = 0; i < original.length; i++) {
      if (original[i].key !== modified[i].key || original[i].value !== modified[i].value) {
        result.reordered = true;
        break;
      }
    }
  }
  
  return result;
};