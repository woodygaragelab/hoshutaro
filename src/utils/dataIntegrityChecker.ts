/**
 * データ整合性チェッカー
 * 保全管理システムのデータモデル v3.0.0 の整合性を検証
 */

import {
  DataModel,
  Asset,
  WorkOrder,
  WorkOrderLine,
  HierarchyDefinition,
  HierarchyPath,
} from '../types/maintenanceTask';

/**
 * 整合性チェック結果
 */
export interface IntegrityCheckResult {
  isValid: boolean;
  errors: IntegrityError[];
  warnings: IntegrityWarning[];
  summary: {
    totalAssets: number;
    totalWorkOrders: number;
    totalWorkOrderLines: number;
    orphanedWorkOrderLines: number;
    invalidReferences: number;
    duplicateIds: number;
    invalidHierarchyPaths: number;
  };
}

/**
 * 整合性エラー
 */
export interface IntegrityError {
  type: 'ORPHANED_WORK_ORDER_LINE' | 'INVALID_REFERENCE' | 'DUPLICATE_ID' | 'INVALID_HIERARCHY_PATH';
  message: string;
  entityType: 'asset' | 'workOrder' | 'workOrderLine' | 'hierarchy';
  entityId?: string;
  details?: any;
}

/**
 * 整合性警告
 */
export interface IntegrityWarning {
  type: 'MISSING_DATA' | 'INCONSISTENT_DATA' | 'DEPRECATED_FORMAT';
  message: string;
  entityType: 'asset' | 'workOrder' | 'workOrderLine' | 'hierarchy';
  entityId?: string;
  details?: any;
}

/**
 * データ整合性チェッカークラス
 */
export class DataIntegrityChecker {
  /**
   * データモデル全体の整合性をチェック
   */
  checkDataModel(dataModel: DataModel): IntegrityCheckResult {
    const errors: IntegrityError[] = [];
    const warnings: IntegrityWarning[] = [];

    // 各チェックを実行
    const orphanedErrors = this.checkOrphanedWorkOrderLines(
      dataModel.assets,
      dataModel.workOrders,
      dataModel.workOrderLines
    );
    errors.push(...orphanedErrors);

    const referenceErrors = this.checkInvalidReferences(
      dataModel.assets,
      dataModel.workOrders,
      dataModel.workOrderLines
    );
    errors.push(...referenceErrors);

    const duplicateErrors = this.checkDuplicateIds(
      dataModel.assets,
      dataModel.workOrders,
      dataModel.workOrderLines
    );
    errors.push(...duplicateErrors);

    const hierarchyErrors = this.checkInvalidHierarchyPaths(
      dataModel.assets,
      dataModel.hierarchy
    );
    errors.push(...hierarchyErrors);

    // 一貫性チェック（警告レベル）
    const consistencyWarnings = this.checkDataConsistency(dataModel);
    warnings.push(...consistencyWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalAssets: Object.keys(dataModel.assets).length,
        totalWorkOrders: Object.keys(dataModel.workOrders).length,
        totalWorkOrderLines: Object.keys(dataModel.workOrderLines).length,
        orphanedWorkOrderLines: orphanedErrors.length,
        invalidReferences: referenceErrors.length,
        duplicateIds: duplicateErrors.length,
        invalidHierarchyPaths: hierarchyErrors.length,
      },
    };
  }

  /**
   * 孤立したWorkOrderLineをチェック
   */
  private checkOrphanedWorkOrderLines(
    assets: { [id: string]: Asset },
    workOrders: { [id: string]: WorkOrder },
    workOrderLines: { [id: string]: WorkOrderLine }
  ): IntegrityError[] {
    const errors: IntegrityError[] = [];

    for (const [lineId, line] of Object.entries(workOrderLines)) {
      // 機器が存在するかチェック
      if (!assets[line.AssetId]) {
        errors.push({
          type: 'ORPHANED_WORK_ORDER_LINE',
          message: `WorkOrderLine ${lineId} が存在しない機器を参照しています: ${line.AssetId}`,
          entityType: 'workOrderLine',
          entityId: lineId,
          details: { assetId: line.AssetId },
        });
      }

      // WorkOrderが存在するかチェック
      if (!workOrders[line.WorkOrderId]) {
        errors.push({
          type: 'ORPHANED_WORK_ORDER_LINE',
          message: `WorkOrderLine ${lineId} が存在しないWorkOrderを参照しています: ${line.WorkOrderId}`,
          entityType: 'workOrderLine',
          entityId: lineId,
          details: { workOrderId: line.WorkOrderId },
        });
      }
    }

    return errors;
  }

  /**
   * 無効な参照をチェック
   */
  private checkInvalidReferences(
    assets: { [id: string]: Asset },
    workOrders: { [id: string]: WorkOrder },
    workOrderLines: { [id: string]: WorkOrderLine }
  ): IntegrityError[] {
    const errors: IntegrityError[] = [];

    // Asset IDの形式チェック
    for (const [id, asset] of Object.entries(assets)) {
      if (asset.id !== id) {
        errors.push({
          type: 'INVALID_REFERENCE',
          message: `機器のIDがキーと一致しません: ${id} !== ${asset.id}`,
          entityType: 'asset',
          entityId: id,
        });
      }
    }

    // WorkOrder IDチェック
    for (const [id, wo] of Object.entries(workOrders)) {
      if (wo.id !== id) {
        errors.push({
          type: 'INVALID_REFERENCE',
          message: `WorkOrderのIDがキーと一致しません: ${id} !== ${wo.id}`,
          entityType: 'workOrder',
          entityId: id,
        });
      }
    }

    // WorkOrderLine IDチェック
    for (const [id, line] of Object.entries(workOrderLines)) {
      if (line.id !== id) {
        errors.push({
          type: 'INVALID_REFERENCE',
          message: `WorkOrderLineのIDがキーと一致しません: ${id} !== ${line.id}`,
          entityType: 'workOrderLine',
          entityId: id,
        });
      }

      // 予定などの形式チェック
      // Relax strict typeof check to handle cases where it was natively a string or number, 
      // but gracefully normalize it behind the scenes
      if (typeof line.Planned !== 'boolean') {
        const pval = (line as any).Planned;
        if (pval === 'true' || pval === 'false' || pval === 1 || pval === 0 || pval === undefined) {
           (line as any).Planned = pval === 'true' || pval === 1;
        } else {
           errors.push({
             type: 'INVALID_REFERENCE',
             message: `WorkOrderLine ${id} のPlannedがbooleanではありません (値: ${pval})`,
             entityType: 'workOrderLine',
             entityId: id,
           });
        }
      }
      if (typeof line.Actual !== 'boolean') {
        const aval = (line as any).Actual;
        if (aval === 'true' || aval === 'false' || aval === 1 || aval === 0 || aval === undefined) {
           (line as any).Actual = aval === 'true' || aval === 1;
        } else {
           errors.push({
             type: 'INVALID_REFERENCE',
             message: `WorkOrderLine ${id} のActualがbooleanではありません (値: ${aval})`,
             entityType: 'workOrderLine',
             entityId: id,
           });
        }
      }
    }

    return errors;
  }

  /**
   * 重複IDをチェック
   */
  private checkDuplicateIds(
    assets: { [id: string]: Asset },
    workOrders: { [id: string]: WorkOrder },
    workOrderLines: { [id: string]: WorkOrderLine }
  ): IntegrityError[] {
    const errors: IntegrityError[] = [];
    const allIds = new Map<string, { type: string; id: string }[]>();

    // Collect all IDs
    const addIds = (items: Record<string, any>, type: string) => {
      for (const id of Object.keys(items)) {
        const existing = allIds.get(id) || [];
        existing.push({ type, id });
        allIds.set(id, existing);
      }
    };

    addIds(assets, 'asset');
    addIds(workOrders, 'workOrder');
    addIds(workOrderLines, 'workOrderLine');

    // Check for duplicates across entity types
    for (const [id, entries] of allIds.entries()) {
      if (entries.length > 1) {
        const types = entries.map(e => e.type).join(', ');
        errors.push({
          type: 'DUPLICATE_ID',
          message: `ID ${id} が複数のエンティティタイプで使用されています: ${types}`,
          entityType: entries[0].type as any,
          entityId: id,
          details: { types: entries.map(e => e.type) },
        });
      }
    }

    return errors;
  }

  /**
   * 無効な階層パスをチェック
   */
  private checkInvalidHierarchyPaths(
    assets: { [id: string]: Asset },
    hierarchy: HierarchyDefinition
  ): IntegrityError[] {
    const errors: IntegrityError[] = [];

    // Build lookup map from hierarchy definition
    const hierarchyLevels = new Map<string, Set<string>>();
    for (const level of hierarchy.levels) {
      // level.values is now an array of TreeLevelValue objects: { value: string, parentValue?: string }
      const strings = level.values.map(v => typeof v === 'string' ? v : v.value);
      hierarchyLevels.set(level.key, new Set(strings));
    }

    // Check each asset's hierarchy path
    for (const [assetId, asset] of Object.entries(assets)) {
      for (const [key, value] of Object.entries(asset.hierarchyPath)) {
        // Check if the hierarchy level exists
        const validValues = hierarchyLevels.get(key);
        if (!validValues) {
          errors.push({
            type: 'INVALID_HIERARCHY_PATH',
            message: `機器 ${assetId} の階層レベル "${key}" が階層定義に存在しません`,
            entityType: 'asset',
            entityId: assetId,
            details: { key, value },
          });
          continue;
        }

        // Check if the value is valid for this level
        if (!validValues.has(value)) {
          errors.push({
            type: 'INVALID_HIERARCHY_PATH',
            message: `機器 ${assetId} の階層レベル "${key}" の値 "${value}" が無効です`,
            entityType: 'asset',
            entityId: assetId,
            details: { key, value, validValues: Array.from(validValues) },
          });
        }
      }
    }

    return errors;
  }

  /**
   * データの一貫性をチェック（警告レベル）
   */
  private checkDataConsistency(dataModel: DataModel): IntegrityWarning[] {
    const warnings: IntegrityWarning[] = [];

    // 機器が存在するがWorkOrderLineに参照されていない
    const referencedAssetIds = new Set<string>();
    for (const line of Object.values(dataModel.workOrderLines)) {
      referencedAssetIds.add(line.AssetId);
    }
    for (const assetId of Object.keys(dataModel.assets)) {
      if (!referencedAssetIds.has(assetId)) {
        warnings.push({
          type: 'INCONSISTENT_DATA',
          message: `機器 ${assetId} はどのWorkOrderLineからも参照されていません`,
          entityType: 'asset',
          entityId: assetId,
        });
      }
    }

    // WorkOrderが存在するがWorkOrderLineに参照されていない
    const referencedWoIds = new Set<string>();
    for (const line of Object.values(dataModel.workOrderLines)) {
      referencedWoIds.add(line.WorkOrderId);
    }
    for (const woId of Object.keys(dataModel.workOrders)) {
      if (!referencedWoIds.has(woId)) {
        warnings.push({
          type: 'INCONSISTENT_DATA',
          message: `WorkOrder ${woId} はどのWorkOrderLineからも参照されていません`,
          entityType: 'workOrder',
          entityId: woId,
        });
      }
    }

    // 名前が空のエンティティ
    for (const [id, asset] of Object.entries(dataModel.assets)) {
      if (!asset.name || asset.name.trim() === '') {
        warnings.push({
          type: 'MISSING_DATA',
          message: `機器 ${id} の名前が空です`,
          entityType: 'asset',
          entityId: id,
        });
      }
    }

    return warnings;
  }

  /**
   * 整合性チェック結果をフォーマットして出力
   */
  formatCheckResult(result: IntegrityCheckResult): string {
    const lines: string[] = [];

    lines.push('=== データ整合性チェック結果 ===');
    lines.push(`状態: ${result.isValid ? '✅ 正常' : '❌ エラーあり'}`);
    lines.push('');
    lines.push('--- サマリー ---');
    lines.push(`機器数: ${result.summary.totalAssets}`);
    lines.push(`WorkOrder数: ${result.summary.totalWorkOrders}`);
    lines.push(`WorkOrderLine数: ${result.summary.totalWorkOrderLines}`);
    lines.push(`孤立WorkOrderLine: ${result.summary.orphanedWorkOrderLines}`);
    lines.push(`無効な参照: ${result.summary.invalidReferences}`);
    lines.push(`重複ID: ${result.summary.duplicateIds}`);
    lines.push(`無効な階層パス: ${result.summary.invalidHierarchyPaths}`);

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('--- エラー ---');
      for (const error of result.errors) {
        lines.push(`[${error.type}] ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('--- 警告 ---');
      for (const warning of result.warnings) {
        lines.push(`[${warning.type}] ${warning.message}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * データ整合性チェッカーのシングルトンインスタンス
 */
export const dataIntegrityChecker = new DataIntegrityChecker();
