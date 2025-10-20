import { DataIntegrityCheck, DataValidationRule, DataConsistencyCheck } from './types';
import { HierarchicalData } from '../../types';

/**
 * データ整合性チェッカー
 * データの整合性、一貫性、妥当性を検証
 */
export class DataIntegrityChecker {
  private validationRules: Map<string, DataValidationRule[]> = new Map();
  private checksumCache: Map<string, string> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * バリデーションルールを初期化
   */
  private initializeValidationRules(): void {
    // セル編集のバリデーションルール
    this.validationRules.set('cell_edit', [
      {
        field: 'rowId',
        type: 'required',
        message: 'rowId is required',
      },
      {
        field: 'columnId',
        type: 'required',
        message: 'columnId is required',
      },
      {
        field: 'value',
        type: 'required',
        message: 'value is required',
      },
      {
        field: 'timestamp',
        type: 'type',
        value: 'number',
        message: 'timestamp must be a number',
      },
      {
        field: 'timestamp',
        type: 'range',
        value: { min: 0, max: Date.now() + 86400000 }, // 24時間先まで許可
        message: 'timestamp must be within valid range',
      },
    ]);

    // 機器仕様編集のバリデーションルール
    this.validationRules.set('specification_edit', [
      {
        field: 'rowId',
        type: 'required',
        message: 'rowId is required',
      },
      {
        field: 'specIndex',
        type: 'type',
        value: 'number',
        message: 'specIndex must be a number',
      },
      {
        field: 'key',
        type: 'required',
        message: 'key is required',
      },
      {
        field: 'key',
        type: 'pattern',
        value: /^[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/,
        message: 'key contains invalid characters',
      },
      {
        field: 'value',
        type: 'required',
        message: 'value is required',
      },
    ]);

    // 星取表データのバリデーションルール
    this.validationRules.set('status_data', [
      {
        field: 'planned',
        type: 'type',
        value: 'boolean',
        message: 'planned must be boolean',
      },
      {
        field: 'actual',
        type: 'type',
        value: 'boolean',
        message: 'actual must be boolean',
      },
    ]);

    // コストデータのバリデーションルール
    this.validationRules.set('cost_data', [
      {
        field: 'planCost',
        type: 'type',
        value: 'number',
        message: 'planCost must be a number',
      },
      {
        field: 'actualCost',
        type: 'type',
        value: 'number',
        message: 'actualCost must be a number',
      },
      {
        field: 'planCost',
        type: 'range',
        value: { min: 0, max: 999999999 },
        message: 'planCost must be within valid range',
      },
      {
        field: 'actualCost',
        type: 'range',
        value: { min: 0, max: 999999999 },
        message: 'actualCost must be within valid range',
      },
    ]);

    // アイテムデータのバリデーションルール
    this.validationRules.set('item_data', [
      {
        field: 'id',
        type: 'required',
        message: 'id is required',
      },
      {
        field: 'task',
        type: 'required',
        message: 'task is required',
      },
      {
        field: 'level',
        type: 'type',
        value: 'number',
        message: 'level must be a number',
      },
      {
        field: 'level',
        type: 'range',
        value: { min: 1, max: 10 },
        message: 'level must be between 1 and 10',
      },
    ]);
  }

  /**
   * データ整合性チェックを実行
   */
  performIntegrityCheck(data: any, dataType?: string): DataIntegrityCheck {
    const violations: string[] = [];

    try {
      // データタイプを推定
      const type = dataType || this.inferDataType(data);
      
      // バリデーションルールを取得
      const rules = this.validationRules.get(type) || [];
      
      // 各ルールをチェック
      for (const rule of rules) {
        const violation = this.checkRule(data, rule);
        if (violation) {
          violations.push(violation);
        }
      }

      // 特別なチェック
      violations.push(...this.performSpecialChecks(data, type));

    } catch (error) {
      violations.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      timestamp: Date.now(),
    };
  }

  /**
   * データタイプを推定
   */
  private inferDataType(data: any): string {
    if (data.type) {
      return data.type;
    }

    if (data.rowId && data.columnId && data.value !== undefined) {
      return 'cell_edit';
    }

    if (data.rowId && data.specIndex !== undefined && data.key && data.value) {
      return 'specification_edit';
    }

    if (data.planned !== undefined && data.actual !== undefined) {
      return 'status_data';
    }

    if (data.planCost !== undefined || data.actualCost !== undefined) {
      return 'cost_data';
    }

    if (data.id && data.task && data.level !== undefined) {
      return 'item_data';
    }

    return 'unknown';
  }

  /**
   * 単一ルールをチェック
   */
  private checkRule(data: any, rule: DataValidationRule): string | null {
    const value = this.getNestedValue(data, rule.field);

    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return rule.message;
        }
        break;

      case 'type':
        if (value !== undefined && typeof value !== rule.value) {
          return rule.message;
        }
        break;

      case 'range':
        if (typeof value === 'number' && rule.value) {
          const { min, max } = rule.value;
          if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
            return rule.message;
          }
        }
        break;

      case 'pattern':
        if (typeof value === 'string' && rule.value instanceof RegExp) {
          if (!rule.value.test(value)) {
            return rule.message;
          }
        }
        break;

      case 'custom':
        if (rule.validator && !rule.validator(value)) {
          return rule.message;
        }
        break;
    }

    return null;
  }

  /**
   * ネストされた値を取得
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 特別なチェックを実行
   */
  private performSpecialChecks(data: any, type: string): string[] {
    const violations: string[] = [];

    switch (type) {
      case 'cell_edit':
        violations.push(...this.checkCellEditSpecial(data));
        break;
      case 'specification_edit':
        violations.push(...this.checkSpecificationEditSpecial(data));
        break;
      case 'status_data':
        violations.push(...this.checkStatusDataSpecial(data));
        break;
      case 'item_data':
        violations.push(...this.checkItemDataSpecial(data));
        break;
    }

    return violations;
  }

  /**
   * セル編集の特別チェック
   */
  private checkCellEditSpecial(data: any): string[] {
    const violations: string[] = [];

    // 星取表セルの場合
    if (data.columnId && data.columnId.startsWith('time_')) {
      if (typeof data.value === 'object') {
        const statusCheck = this.performIntegrityCheck(data.value, 'status_data');
        violations.push(...statusCheck.violations);
      }
    }

    // コストセルの場合
    if (data.columnId && data.columnId.includes('cost')) {
      if (typeof data.value === 'object') {
        const costCheck = this.performIntegrityCheck(data.value, 'cost_data');
        violations.push(...costCheck.violations);
      }
    }

    // タイムスタンプの妥当性
    if (data.timestamp) {
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      const oneDayAhead = now + (24 * 60 * 60 * 1000);

      if (data.timestamp < oneYearAgo) {
        violations.push('timestamp is too old (more than 1 year ago)');
      }
      if (data.timestamp > oneDayAhead) {
        violations.push('timestamp is too far in the future (more than 1 day ahead)');
      }
    }

    return violations;
  }

  /**
   * 機器仕様編集の特別チェック
   */
  private checkSpecificationEditSpecial(data: any): string[] {
    const violations: string[] = [];

    // キーの長さチェック
    if (data.key && data.key.length > 100) {
      violations.push('key is too long (max 100 characters)');
    }

    // 値の長さチェック
    if (data.value && data.value.length > 1000) {
      violations.push('value is too long (max 1000 characters)');
    }

    // 特殊文字チェック
    if (data.key && /[<>\"'&]/.test(data.key)) {
      violations.push('key contains potentially dangerous characters');
    }

    if (data.value && /[<>\"'&]/.test(data.value)) {
      violations.push('value contains potentially dangerous characters');
    }

    return violations;
  }

  /**
   * 星取表データの特別チェック
   */
  private checkStatusDataSpecial(data: any): string[] {
    const violations: string[] = [];

    // 論理的整合性チェック
    if (data.actual === true && data.planned === false) {
      violations.push('actual cannot be true when planned is false');
    }

    return violations;
  }

  /**
   * アイテムデータの特別チェック
   */
  private checkItemDataSpecial(data: any): string[] {
    const violations: string[] = [];

    // 階層構造の整合性
    if (data.children && Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child.level <= data.level) {
          violations.push(`child level (${child.level}) must be greater than parent level (${data.level})`);
        }
      }
    }

    // 必須フィールドの存在チェック
    if (data.results) {
      for (const [timeHeader, result] of Object.entries(data.results)) {
        if (typeof result === 'object' && result !== null) {
          const statusCheck = this.performIntegrityCheck(result, 'status_data');
          violations.push(...statusCheck.violations.map(v => `results.${timeHeader}: ${v}`));
        }
      }
    }

    return violations;
  }

  /**
   * データ一貫性チェックを実行
   */
  performConsistencyCheck(
    itemId: string,
    localData: any,
    remoteData: any
  ): DataConsistencyCheck {
    const localChecksum = this.calculateChecksum(localData);
    const remoteChecksum = this.calculateChecksum(remoteData);
    const isConsistent = localChecksum === remoteChecksum;
    const inconsistencies: string[] = [];

    if (!isConsistent) {
      inconsistencies.push(...this.findInconsistencies(localData, remoteData));
    }

    return {
      checkId: `consistency_${itemId}_${Date.now()}`,
      timestamp: Date.now(),
      itemId,
      localChecksum,
      remoteChecksum,
      isConsistent,
      inconsistencies,
    };
  }

  /**
   * チェックサムを計算
   */
  private calculateChecksum(data: any): string {
    const normalized = this.normalizeData(data);
    const serialized = JSON.stringify(normalized);
    
    // 簡単なハッシュ関数（実際の実装では、より強力なハッシュアルゴリズムを使用）
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    return hash.toString(16);
  }

  /**
   * データを正規化
   */
  private normalizeData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item)).sort();
    }

    const normalized: any = {};
    const keys = Object.keys(data).sort();
    
    for (const key of keys) {
      // タイムスタンプなどの変動する値は除外
      if (key === 'timestamp' || key === 'lastModified' || key === 'version') {
        continue;
      }
      
      normalized[key] = this.normalizeData(data[key]);
    }

    return normalized;
  }

  /**
   * 不整合を検出
   */
  private findInconsistencies(localData: any, remoteData: any, path = ''): string[] {
    const inconsistencies: string[] = [];

    if (typeof localData !== typeof remoteData) {
      inconsistencies.push(`${path}: type mismatch (local: ${typeof localData}, remote: ${typeof remoteData})`);
      return inconsistencies;
    }

    if (localData === null || remoteData === null) {
      if (localData !== remoteData) {
        inconsistencies.push(`${path}: null mismatch`);
      }
      return inconsistencies;
    }

    if (typeof localData !== 'object') {
      if (localData !== remoteData) {
        inconsistencies.push(`${path}: value mismatch (local: ${localData}, remote: ${remoteData})`);
      }
      return inconsistencies;
    }

    if (Array.isArray(localData) && Array.isArray(remoteData)) {
      if (localData.length !== remoteData.length) {
        inconsistencies.push(`${path}: array length mismatch (local: ${localData.length}, remote: ${remoteData.length})`);
      }

      const maxLength = Math.max(localData.length, remoteData.length);
      for (let i = 0; i < maxLength; i++) {
        const localItem = localData[i];
        const remoteItem = remoteData[i];
        inconsistencies.push(...this.findInconsistencies(localItem, remoteItem, `${path}[${i}]`));
      }

      return inconsistencies;
    }

    // オブジェクトの比較
    const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);
    
    for (const key of allKeys) {
      // タイムスタンプなどの変動する値はスキップ
      if (key === 'timestamp' || key === 'lastModified' || key === 'version') {
        continue;
      }

      const localValue = localData[key];
      const remoteValue = remoteData[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in localData)) {
        inconsistencies.push(`${currentPath}: missing in local data`);
      } else if (!(key in remoteData)) {
        inconsistencies.push(`${currentPath}: missing in remote data`);
      } else {
        inconsistencies.push(...this.findInconsistencies(localValue, remoteValue, currentPath));
      }
    }

    return inconsistencies;
  }

  /**
   * バリデーションルールを追加
   */
  addValidationRule(dataType: string, rule: DataValidationRule): void {
    const existingRules = this.validationRules.get(dataType) || [];
    existingRules.push(rule);
    this.validationRules.set(dataType, existingRules);
  }

  /**
   * バリデーションルールを削除
   */
  removeValidationRule(dataType: string, field: string): void {
    const existingRules = this.validationRules.get(dataType) || [];
    const filteredRules = existingRules.filter(rule => rule.field !== field);
    this.validationRules.set(dataType, filteredRules);
  }

  /**
   * 全データの整合性チェック
   */
  performBulkIntegrityCheck(dataArray: HierarchicalData[]): {
    totalItems: number;
    validItems: number;
    invalidItems: number;
    violations: { itemId: string; violations: string[] }[];
  } {
    const results = {
      totalItems: dataArray.length,
      validItems: 0,
      invalidItems: 0,
      violations: [] as { itemId: string; violations: string[] }[],
    };

    for (const item of dataArray) {
      const check = this.performIntegrityCheck(item, 'item_data');
      
      if (check.isValid) {
        results.validItems++;
      } else {
        results.invalidItems++;
        results.violations.push({
          itemId: item.id,
          violations: check.violations,
        });
      }
    }

    return results;
  }
}