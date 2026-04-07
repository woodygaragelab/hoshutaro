/**
 * DataStore - JSONデータの読み込みと書き込みを管理
 *
 * データモデル v3.0.0（WorkOrder + COM統合モデル）をサポート
 */

import type {
  DataModel,
  Asset,
  WorkOrder,
  WorkOrderLine,
  HierarchyDefinition,
  WorkOrderClassification,
  AssetClassificationDefinition,
} from '../types/maintenanceTask';
import { dataIntegrityChecker } from '../utils/dataIntegrityChecker';

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * データストアクラス
 */
export class DataStore {
  private data: DataModel | null = null;

  /**
   * JSONデータを読み込む
   */
  loadData(jsonData: string | object): DataModel {
    try {
      const parsedData = typeof jsonData === 'string'
        ? JSON.parse(jsonData)
        : jsonData;

      this.validateDataModel(parsedData);

      const normalizedData = this.normalizeDates(parsedData);

      // データ整合性チェック
      const integrityResult = dataIntegrityChecker.checkDataModel(normalizedData);

      if (!integrityResult.isValid) {
        const errorMessages = integrityResult.errors.map(e => e.message).join('\n');
        throw new ValidationError(`データ整合性エラー:\n${errorMessages}`);
      }

      if (integrityResult.warnings.length > 0) {
                integrityResult.warnings.forEach(w => {
                  });
      }

      this.data = normalizedData;
      return normalizedData;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`データの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * JSONデータを書き込む
   */
  saveData(data: DataModel): string {
    try {
      this.validateDataModel(data);

      const integrityResult = dataIntegrityChecker.checkDataModel(data);

      if (!integrityResult.isValid) {
        const errorMessages = integrityResult.errors.map(e => e.message).join('\n');
        throw new ValidationError(`データ整合性エラー:\n${errorMessages}`);
      }

      if (integrityResult.warnings.length > 0) {
                integrityResult.warnings.forEach(w => {
                  });
      }

      const dataToSave: DataModel = {
        ...data,
        metadata: {
          ...data.metadata,
          lastModified: new Date(),
        },
      };

      return JSON.stringify(dataToSave, null, 2);
    } catch (error) {
      throw new ValidationError(`データの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 現在のデータを取得
   */
  getData(): DataModel | null {
    return this.data;
  }

  /**
   * 現在のデータを書き出し・加工用にディープコピーして取得
   */
  exportData(): DataModel {
    if (!this.data) {
      throw new ValidationError('データがロードされていません');
    }
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * 機器分類マスタを取得
   */
  getAssetClassification(): AssetClassificationDefinition {
    return this.data?.assetClassification || { levels: [] };
  }

  /**
   * 作業分類マスタを取得
   */
  getWorkOrderClassifications(): WorkOrderClassification[] {
    return this.data?.workOrderClassifications || [];
  }

  /**
   * データモデルのバリデーション
   */
  private validateDataModel(data: any): asserts data is DataModel {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('データが無効です');
    }

    if (!data.version) {
      throw new ValidationError('バージョン情報が必要です');
    }

    if (data.version !== '3.0.0') {
      throw new ValidationError(`サポートされていないバージョンです: ${data.version}。v3.0.0が必要です。`);
    }

    if (!data.assets || typeof data.assets !== 'object') {
      throw new ValidationError('assetsフィールドが必要です');
    }

    if (!data.workOrders || typeof data.workOrders !== 'object') {
      throw new ValidationError('workOrdersフィールドが必要です');
    }

    if (!data.workOrderLines || typeof data.workOrderLines !== 'object') {
      throw new ValidationError('workOrderLinesフィールドが必要です');
    }

    if (!data.hierarchy || typeof data.hierarchy !== 'object') {
      throw new ValidationError('hierarchyフィールドが必要です');
    }

    if (!data.metadata || typeof data.metadata !== 'object') {
      throw new ValidationError('metadataフィールドが必要です');
    }

    // workOrderClassifications is optional but validate if present
    if (data.workOrderClassifications && !Array.isArray(data.workOrderClassifications)) {
      throw new ValidationError('workOrderClassificationsは配列である必要があります');
    }

    // Validate each entity type
    this.validateAssets(data.assets);
    this.validateWorkOrders(data.workOrders);
    this.validateWorkOrderLines(data.workOrderLines, data.workOrders, data.assets);
    this.validateHierarchy(data.hierarchy);

    if (data.workOrderClassifications) {
      this.validateWorkOrderClassifications(data.workOrderClassifications);
    }
    if (data.assetClassification) {
      this.validateAssetClassification(data.assetClassification);
    }
  }

  /**
   * 機器分類マスタのバリデーション
   */
  private validateAssetClassification(classification: any): asserts classification is AssetClassificationDefinition {
    if (!classification.levels || !Array.isArray(classification.levels)) {
      throw new ValidationError('機器分類のlevelsが必要です');
    }
    if (classification.levels.length > 10) {
      throw new ValidationError(`機器分類のレベル数は10以下の範囲である必要があります: ${classification.levels.length}`);
    }
    const seenKeys = new Set<string>();
    const seenOrders = new Set<number>();
    for (const level of classification.levels) {
      if (!level || typeof level !== 'object') {
        throw new ValidationError('機器分類のレベルが無効です');
      }
      if (!level.key || typeof level.key !== 'string') {
        throw new ValidationError('機器分類レベルのキーが必要です');
      }
      if (seenKeys.has(level.key)) {
        throw new ValidationError(`重複した機器分類レベルキー: ${level.key}`);
      }
      seenKeys.add(level.key);
      if (typeof level.order !== 'number' || level.order < 1) {
        throw new ValidationError(`機器分類レベル ${level.key} の順序が無効です`);
      }
      if (seenOrders.has(level.order)) {
        throw new ValidationError(`重複した機器分類レベル順序: ${level.order}`);
      }
      seenOrders.add(level.order);
      if (!Array.isArray(level.values)) {
        throw new ValidationError(`機器分類レベル ${level.key} の値が配列である必要があります`);
      }
    }
  }

  /**
   * 機器のバリデーション
   */
  private validateAssets(assets: any): asserts assets is { [id: string]: Asset } {
    for (const [assetId, asset] of Object.entries(assets)) {
      if (!asset || typeof asset !== 'object') {
        throw new ValidationError(`機器 ${assetId} が無効です`);
      }

      const a = asset as any;

      if (!a.id || typeof a.id !== 'string') {
        throw new ValidationError(`機器 ${assetId} のIDが無効です`);
      }

      if (a.id !== assetId) {
        throw new ValidationError(`機器のIDがキーと一致しません: ${assetId} !== ${a.id}`);
      }

      if (!a.name || typeof a.name !== 'string') {
        throw new ValidationError(`機器 ${assetId} の名前が必要です`);
      }

      if (!a.hierarchyPath || typeof a.hierarchyPath !== 'object') {
        throw new ValidationError(`機器 ${assetId} の階層パスが必要です`);
      }

      if (Object.keys(a.hierarchyPath).length === 0) {
        throw new ValidationError(`機器 ${assetId} の階層パスが空です`);
      }
    }
  }

  /**
   * WorkOrderのバリデーション
   */
  private validateWorkOrders(workOrders: any): asserts workOrders is { [id: string]: WorkOrder } {
    for (const [woId, wo] of Object.entries(workOrders)) {
      if (!wo || typeof wo !== 'object') {
        throw new ValidationError(`WorkOrder ${woId} が無効です`);
      }

      const w = wo as any;

      if (!w.id || typeof w.id !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} のIDが無効です`);
      }

      if (w.id !== woId) {
        throw new ValidationError(`WorkOrderのIDがキーと一致しません: ${woId} !== ${w.id}`);
      }

      if (!w.name || typeof w.name !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} の名前が必要です`);
      }

      // Allow multiple variations for compatibility
      const classId = w.ClassificationId || w.classificationId || w.classificationID || w.Classification || w.classification || w.taskClassificationId || w.TaskClassificationId;
      
      if (!classId || typeof classId !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} の作業分類IDが必要です (見つかったキー: ${Object.keys(w).join(', ')})`);
      }
      
      // Normalize to upper case standard if not present
      if (!w.ClassificationId && classId) {
        w.ClassificationId = classId;
      }
    }
  }

  /**
   * WorkOrderLineのバリデーション（参照整合性を含む）
   */
  private validateWorkOrderLines(
    lines: any,
    workOrders: { [id: string]: WorkOrder },
    assets: { [id: string]: Asset }
  ): asserts lines is { [id: string]: WorkOrderLine } {
    for (const [lineId, line] of Object.entries(lines)) {
      if (!line || typeof line !== 'object') {
        throw new ValidationError(`WorkOrderLine ${lineId} が無効です`);
      }

      const l = line as any;

      if (!l.id || typeof l.id !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} のIDが無効です`);
      }

      if (l.id !== lineId) {
        throw new ValidationError(`WorkOrderLineのIDがキーと一致しません: ${lineId} !== ${l.id}`);
      }

      // Allow both WorkOrderId and workOrderId
      const woId = l.WorkOrderId || l.workOrderId || l.workOrderID;
      if (!woId || typeof woId !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} のWorkOrder IDが必要です (見つかったキー: ${Object.keys(l).join(', ')})`);
      }
      if (!l.WorkOrderId && woId) {
        l.WorkOrderId = woId;
      }

      // Allow both AssetId and assetId
      const astId = l.AssetId || l.assetId || l.assetID;
      if (!astId || typeof astId !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} の機器IDが必要です (見つかったキー: ${Object.keys(l).join(', ')})`);
      }
      if (!l.AssetId && astId) {
        l.AssetId = astId;
      }

      // 参照整合性チェック
      if (!workOrders[l.WorkOrderId]) {
        throw new ValidationError(`WorkOrderLine ${lineId} が存在しないWorkOrderを参照しています: ${l.WorkOrderId}`);
      }

      if (!assets[l.AssetId]) {
        throw new ValidationError(`WorkOrderLine ${lineId} が存在しない機器を参照しています: ${l.AssetId}`);
      }

      // Normalize Planned to boolean
      const plannedValue = typeof l.Planned !== 'undefined' ? l.Planned : l.planned;
      l.Planned = plannedValue === true || plannedValue === 'true' || plannedValue === 1;

      // Normalize Actual to boolean
      const actualValue = typeof l.Actual !== 'undefined' ? l.Actual : l.actual;
      l.Actual = actualValue === true || actualValue === 'true' || actualValue === 1;
    }
  }

  /**
   * 作業分類マスターのバリデーション
   */
  private validateWorkOrderClassifications(
    classifications: any
  ): asserts classifications is WorkOrderClassification[] {
    if (!Array.isArray(classifications)) {
      throw new ValidationError('workOrderClassificationsは配列である必要があります');
    }

    const seenIds = new Set<string>();
    for (const cls of classifications) {
      if (!cls || typeof cls !== 'object') {
        throw new ValidationError('作業分類が無効です');
      }
      if (!cls.id || typeof cls.id !== 'string') {
        throw new ValidationError('作業分類のIDが必要です');
      }
      if (seenIds.has(cls.id)) {
        throw new ValidationError(`重複した作業分類ID: ${cls.id}`);
      }
      seenIds.add(cls.id);
      if (!cls.name || typeof cls.name !== 'string') {
        throw new ValidationError(`作業分類 ${cls.id} の名前が必要です`);
      }
      if (typeof cls.order !== 'number') {
        throw new ValidationError(`作業分類 ${cls.id} の順序が必要です`);
      }
    }
  }

  /**
   * 階層のバリデーション
   */
  private validateHierarchy(hierarchy: any): asserts hierarchy is HierarchyDefinition {
    if (!hierarchy.levels || !Array.isArray(hierarchy.levels)) {
      throw new ValidationError('階層のlevelsが必要です');
    }

    if (hierarchy.levels.length > 10) {
      throw new ValidationError(`階層レベル数は10以下の範囲である必要があります: ${hierarchy.levels.length}`);
    }

    const seenKeys = new Set<string>();
    const seenOrders = new Set<number>();

    for (const level of hierarchy.levels) {
      if (!level || typeof level !== 'object') {
        throw new ValidationError('階層レベルが無効です');
      }

      if (!level.key || typeof level.key !== 'string') {
        throw new ValidationError('階層レベルのキーが必要です');
      }

      if (seenKeys.has(level.key)) {
        throw new ValidationError(`重複した階層レベルキー: ${level.key}`);
      }
      seenKeys.add(level.key);

      if (typeof level.order !== 'number' || level.order < 1) {
        throw new ValidationError(`階層レベル ${level.key} の順序が無効です`);
      }

      if (seenOrders.has(level.order)) {
        throw new ValidationError(`重複した階層レベル順序: ${level.order}`);
      }
      seenOrders.add(level.order);

      if (!Array.isArray(level.values)) {
        throw new ValidationError(`階層レベル ${level.key} の値が配列である必要があります`);
      }
    }
  }

  /**
   * 日付文字列をDateオブジェクトに変換
   */
  private normalizeDates(data: any): DataModel {
    const normalized = { ...data };

    // 機器の日付を変換
    if (normalized.assets) {
      for (const assetId in normalized.assets) {
        const asset = normalized.assets[assetId];
        if (asset.createdAt && typeof asset.createdAt === 'string') {
          asset.createdAt = new Date(asset.createdAt);
        }
        if (asset.updatedAt && typeof asset.updatedAt === 'string') {
          asset.updatedAt = new Date(asset.updatedAt);
        }
      }
    }

    // WorkOrderの日付を変換
    if (normalized.workOrders) {
      for (const woId in normalized.workOrders) {
        const wo = normalized.workOrders[woId];
        if (wo.createdAt && typeof wo.createdAt === 'string') {
          wo.createdAt = new Date(wo.createdAt);
        }
        if (wo.updatedAt && typeof wo.updatedAt === 'string') {
          wo.updatedAt = new Date(wo.updatedAt);
        }
      }
    }

    // WorkOrderLineの日付を変換
    if (normalized.workOrderLines) {
      for (const lineId in normalized.workOrderLines) {
        const line = normalized.workOrderLines[lineId];
        if (line.createdAt && typeof line.createdAt === 'string') {
          line.createdAt = new Date(line.createdAt);
        }
        if (line.updatedAt && typeof line.updatedAt === 'string') {
          line.updatedAt = new Date(line.updatedAt);
        }
      }
    }

    // メタデータの日付を変換
    if (normalized.metadata) {
      if (normalized.metadata.lastModified && typeof normalized.metadata.lastModified === 'string') {
        normalized.metadata.lastModified = new Date(normalized.metadata.lastModified);
      }
    }

    return normalized;
  }
}

// シングルトンインスタンスをエクスポート
export const dataStore = new DataStore();
