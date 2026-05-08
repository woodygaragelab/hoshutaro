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
  private validateDataModel(data: unknown): asserts data is DataModel {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('データが無効です');
    }

    const d = data as Record<string, unknown>;

    if (!d.version) {
      throw new ValidationError('バージョン情報が必要です');
    }

    if (d.version !== '3.0.0') {
      throw new ValidationError(`サポートされていないバージョンです: ${String(d.version)}。v3.0.0が必要です。`);
    }

    if (!d.assets || typeof d.assets !== 'object') {
      throw new ValidationError('assetsフィールドが必要です');
    }

    if (!d.workOrders || typeof d.workOrders !== 'object') {
      throw new ValidationError('workOrdersフィールドが必要です');
    }

    if (!d.workOrderLines || typeof d.workOrderLines !== 'object') {
      throw new ValidationError('workOrderLinesフィールドが必要です');
    }

    if (!d.hierarchy || typeof d.hierarchy !== 'object') {
      throw new ValidationError('hierarchyフィールドが必要です');
    }

    if (!d.metadata || typeof d.metadata !== 'object') {
      throw new ValidationError('metadataフィールドが必要です');
    }

    if (d.workOrderClassifications && !Array.isArray(d.workOrderClassifications)) {
      throw new ValidationError('workOrderClassificationsは配列である必要があります');
    }

    this.validateAssets(d.assets);
    this.validateWorkOrders(d.workOrders);
    this.validateWorkOrderLines(d.workOrderLines, d.workOrders as { [id: string]: WorkOrder }, d.assets as { [id: string]: Asset });
    this.validateHierarchy(d.hierarchy);

    if (d.workOrderClassifications) {
      this.validateWorkOrderClassifications(d.workOrderClassifications);
    }
    if (d.assetClassification) {
      this.validateAssetClassification(d.assetClassification);
    }
  }

  /**
   * 機器分類マスタのバリデーション
   */
  private validateAssetClassification(classification: unknown): asserts classification is AssetClassificationDefinition {
    if (!classification || typeof classification !== 'object') {
      throw new ValidationError('機器分類が無効です');
    }
    const c = classification as Record<string, unknown>;
    if (!c.levels || !Array.isArray(c.levels)) {
      throw new ValidationError('機器分類のlevelsが必要です');
    }
    if (c.levels.length > 10) {
      throw new ValidationError(`機器分類のレベル数は10以下の範囲である必要があります: ${c.levels.length}`);
    }
    const seenKeys = new Set<string>();
    for (const level of c.levels as unknown[]) {
      if (!level || typeof level !== 'object') {
        throw new ValidationError('機器分類のレベルが無効です');
      }
      const lv = level as Record<string, unknown>;
      if (!lv.key || typeof lv.key !== 'string') {
        throw new ValidationError('機器分類レベルのキーが必要です');
      }
      if (seenKeys.has(lv.key)) {
        throw new ValidationError(`重複した機器分類レベルキー: ${lv.key}`);
      }
      seenKeys.add(lv.key);
      if (!Array.isArray(lv.values)) {
        throw new ValidationError(`機器分類レベル ${lv.key} の値が配列である必要があります`);
      }
    }
  }

  /**
   * 機器のバリデーション
   */
  private validateAssets(assets: unknown): asserts assets is { [id: string]: Asset } {
    if (!assets || typeof assets !== 'object') {
      throw new ValidationError('assetsが無効です');
    }
    for (const [assetId, asset] of Object.entries(assets as Record<string, unknown>)) {
      if (!asset || typeof asset !== 'object') {
        throw new ValidationError(`機器 ${assetId} が無効です`);
      }

      const a = asset as Record<string, unknown>;

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

      if (Object.keys(a.hierarchyPath as object).length === 0) {
        throw new ValidationError(`機器 ${assetId} の階層パスが空です`);
      }
    }
  }

  /**
   * WorkOrderのバリデーション
   */
  private validateWorkOrders(workOrders: unknown): asserts workOrders is { [id: string]: WorkOrder } {
    if (!workOrders || typeof workOrders !== 'object') {
      throw new ValidationError('workOrdersが無効です');
    }
    for (const [woId, wo] of Object.entries(workOrders as Record<string, unknown>)) {
      if (!wo || typeof wo !== 'object') {
        throw new ValidationError(`WorkOrder ${woId} が無効です`);
      }

      const w = wo as Record<string, unknown>;

      if (!w.id || typeof w.id !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} のIDが無効です`);
      }

      if (w.id !== woId) {
        throw new ValidationError(`WorkOrderのIDがキーと一致しません: ${woId} !== ${w.id}`);
      }

      if (!w.name || typeof w.name !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} の名前が必要です`);
      }

      // 互換性のため複数のキー形式を許容
      const classId = w.ClassificationId || w.classificationId || w.classificationID || w.Classification || w.classification || w.taskClassificationId || w.TaskClassificationId;

      if (!classId || typeof classId !== 'string') {
        throw new ValidationError(`WorkOrder ${woId} の作業分類IDが必要です (見つかったキー: ${Object.keys(w).join(', ')})`);
      }

      if (!w.ClassificationId && classId) {
        w.ClassificationId = classId;
      }
    }
  }

  /**
   * WorkOrderLineのバリデーション（参照整合性を含む）
   */
  private validateWorkOrderLines(
    lines: unknown,
    workOrders: { [id: string]: WorkOrder },
    assets: { [id: string]: Asset }
  ): asserts lines is { [id: string]: WorkOrderLine } {
    if (!lines || typeof lines !== 'object') {
      throw new ValidationError('workOrderLinesが無効です');
    }
    for (const [lineId, line] of Object.entries(lines as Record<string, unknown>)) {
      if (!line || typeof line !== 'object') {
        throw new ValidationError(`WorkOrderLine ${lineId} が無効です`);
      }

      const l = line as Record<string, unknown>;

      if (!l.id || typeof l.id !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} のIDが無効です`);
      }

      if (l.id !== lineId) {
        throw new ValidationError(`WorkOrderLineのIDがキーと一致しません: ${lineId} !== ${l.id}`);
      }

      // 互換性のため複数のキー形式を許容
      const rawWoId = l.WorkOrderId || l.workOrderId || l.workOrderID;
      if (!rawWoId || typeof rawWoId !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} のWorkOrder IDが必要です (見つかったキー: ${Object.keys(l).join(', ')})`);
      }
      const woId: string = rawWoId;
      if (!l.WorkOrderId) {
        l.WorkOrderId = woId;
      }

      const rawAstId = l.AssetId || l.assetId || l.assetID;
      if (!rawAstId || typeof rawAstId !== 'string') {
        throw new ValidationError(`WorkOrderLine ${lineId} の機器IDが必要です (見つかったキー: ${Object.keys(l).join(', ')})`);
      }
      const astId: string = rawAstId;
      if (!l.AssetId) {
        l.AssetId = astId;
      }

      if (!workOrders[woId]) {
        throw new ValidationError(`WorkOrderLine ${lineId} が存在しないWorkOrderを参照しています: ${woId}`);
      }

      if (!assets[astId]) {
        throw new ValidationError(`WorkOrderLine ${lineId} が存在しない機器を参照しています: ${astId}`);
      }

      const plannedValue = typeof l.Planned !== 'undefined' ? l.Planned : l.planned;
      l.Planned = plannedValue === true || plannedValue === 'true' || plannedValue === 1;

      const actualValue = typeof l.Actual !== 'undefined' ? l.Actual : l.actual;
      l.Actual = actualValue === true || actualValue === 'true' || actualValue === 1;
    }
  }

  /**
   * 作業分類マスターのバリデーション
   */
  private validateWorkOrderClassifications(
    classifications: unknown
  ): asserts classifications is WorkOrderClassification[] {
    if (!Array.isArray(classifications)) {
      throw new ValidationError('workOrderClassificationsは配列である必要があります');
    }

    const seenIds = new Set<string>();
    for (const cls of classifications as unknown[]) {
      if (!cls || typeof cls !== 'object') {
        throw new ValidationError('作業分類が無効です');
      }
      const c = cls as Record<string, unknown>;
      if (!c.id || typeof c.id !== 'string') {
        throw new ValidationError('作業分類のIDが必要です');
      }
      if (seenIds.has(c.id)) {
        throw new ValidationError(`重複した作業分類ID: ${c.id}`);
      }
      seenIds.add(c.id);
      if (!c.name || typeof c.name !== 'string') {
        throw new ValidationError(`作業分類 ${c.id} の名前が必要です`);
      }
      if (typeof c.order !== 'number') {
        throw new ValidationError(`作業分類 ${c.id} の順序が必要です`);
      }
    }
  }

  /**
   * 階層のバリデーション
   */
  private validateHierarchy(hierarchy: unknown): asserts hierarchy is HierarchyDefinition {
    if (!hierarchy || typeof hierarchy !== 'object') {
      throw new ValidationError('hierarchyが無効です');
    }
    const h = hierarchy as Record<string, unknown>;
    if (!h.levels || !Array.isArray(h.levels)) {
      throw new ValidationError('階層のlevelsが必要です');
    }

    if (h.levels.length > 10) {
      throw new ValidationError(`階層レベル数は10以下の範囲である必要があります: ${h.levels.length}`);
    }

    const seenKeys = new Set<string>();

    for (const level of h.levels as unknown[]) {
      if (!level || typeof level !== 'object') {
        throw new ValidationError('階層レベルが無効です');
      }

      const lv = level as Record<string, unknown>;
      if (!lv.key || typeof lv.key !== 'string') {
        throw new ValidationError('階層レベルのキーが必要です');
      }

      if (seenKeys.has(lv.key)) {
        throw new ValidationError(`重複した階層レベルキー: ${lv.key}`);
      }
      seenKeys.add(lv.key);

      if (!Array.isArray(lv.values)) {
        throw new ValidationError(`階層レベル ${lv.key} の値が配列である必要があります`);
      }
    }
  }

  /**
   * 日付文字列をDateオブジェクトに変換
   *
   * JSON.parse 直後は Date フィールドが string のままなので、
   * 構造が DataModel として検証済みでも実値の型は不一致。
   * ここでは unknown 経由で string を Date に詰め替える。
   */
  private normalizeDates(data: DataModel): DataModel {
    const toDate = (value: unknown): Date | undefined =>
      typeof value === 'string' ? new Date(value) : undefined;

    const normalized = { ...data };

    if (normalized.assets) {
      for (const assetId in normalized.assets) {
        const asset = normalized.assets[assetId];
        const created = toDate(asset.createdAt as unknown);
        if (created) asset.createdAt = created;
        const updated = toDate(asset.updatedAt as unknown);
        if (updated) asset.updatedAt = updated;
      }
    }

    if (normalized.workOrders) {
      for (const woId in normalized.workOrders) {
        const wo = normalized.workOrders[woId];
        const created = toDate(wo.CreatedAt as unknown);
        if (created) wo.CreatedAt = created;
        const updated = toDate(wo.UpdatedAt as unknown);
        if (updated) wo.UpdatedAt = updated;
      }
    }

    if (normalized.workOrderLines) {
      for (const lineId in normalized.workOrderLines) {
        const line = normalized.workOrderLines[lineId];
        const created = toDate(line.CreatedAt as unknown);
        if (created) line.CreatedAt = created;
        const updated = toDate(line.UpdatedAt as unknown);
        if (updated) line.UpdatedAt = updated;
      }
    }

    if (normalized.metadata) {
      const lastModified = toDate(normalized.metadata.lastModified as unknown);
      if (lastModified) normalized.metadata.lastModified = lastModified;
    }

    return normalized;
  }
}

// シングルトンインスタンスをエクスポート
export const dataStore = new DataStore();
