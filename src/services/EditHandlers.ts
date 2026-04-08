/**
 * EditHandlers - Handles grid-level event block actions (Copy, Paste, Delete)
 *
 * v3.0.0: Adopts the Event Record model where a single grid cell
 * represents a block of WorkOrderLines sharing the same Asset+Time (and WO).
 */

import {
  EditContext,
  WorkOrderLine,
  SpecificationChange,
} from '../types/maintenanceTask';
import { WorkOrderLineManager } from './WorkOrderLineManager';
import { AssetManager } from './AssetManager';

export class EditHandlers {
  private workOrderLineManager: WorkOrderLineManager;

  constructor(workOrderLineManager: WorkOrderLineManager) {
    this.workOrderLineManager = workOrderLineManager;
  }

  /**
   * Paste a block of WorkOrderLines into a new cell context.
   * This clones the source lines but assigns them the target's AssetId and Time.
   */
  pasteEventBlock(
    sourceLines: WorkOrderLine[],
    targetAssetId: string,
    targetDate: Date
  ): number {
    let createdCount = 0;

    sourceLines.forEach(srcLine => {
      // Create a cloned line with the new target context
      this.workOrderLineManager.createWorkOrderLine({
        name: srcLine.name,
        WorkOrderId: srcLine.WorkOrderId,
        AssetId: targetAssetId,
        PlanScheduleStart: targetDate,
        PlanScheduleEnd: targetDate,
        ActualScheduleStart: targetDate,
        ActualScheduleEnd: targetDate,
        Planned: srcLine.Planned,
        Actual: srcLine.Actual,
        PlanCost: srcLine.PlanCost,
        ActualCost: srcLine.ActualCost,
        PlannedManhours: srcLine.PlannedManhours,
        ActualManhours: srcLine.ActualManhours,
      });
      createdCount++;
    });

    return createdCount;
  }

  /**
   * Delete an entire block of WorkOrderLines from a cell context.
   */
  deleteEventBlock(lineIds: string[]): number {
    let deletedCount = 0;
    lineIds.forEach(id => {
      if (this.workOrderLineManager.hasLine(id)) {
        this.workOrderLineManager.deleteWorkOrderLine(id);
        deletedCount++;
      }
    });
    return deletedCount;
  }

  /**
   * Get edit scope description for UI display
   */
  getEditScopeDescription(context: EditContext): string {
    if (context.viewMode === 'workorder-based') {
      return 'イベント（複数作業のまとまり）がWorkOrder単位で処理されます';
    } else {
      return 'この機器の指定日時の全作業が処理されます';
    }
  }

  /**
   * Handle specification edit for an asset
   */
  handleSpecificationEdit(
    assetManager: AssetManager,
    assetId: string,
    specIndex: number,
    field: 'key' | 'value',
    value: string,
    undoRedoManager?: any
  ): void {
    const asset = assetManager.getAsset(assetId);
    if (!asset) {
      throw new Error(`Asset with id ${assetId} not found`);
    }

    if (undoRedoManager) {
      undoRedoManager.pushState('UPDATE_SPECIFICATION', {
        assetId,
        previousSpecifications: [...asset.specifications],
      });
    }

    const updatedSpecs = [...asset.specifications];

    while (updatedSpecs.length <= specIndex) {
      updatedSpecs.push({
        key: `spec_${updatedSpecs.length}`,
        value: '-',
        order: updatedSpecs.length,
      });
    }

    if (field === 'key') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], key: value };
    } else if (field === 'value') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], value: value };
    }

    assetManager.updateAsset(assetId, { specifications: updatedSpecs });
  }

  /**
   * Handle batch specification update for multiple assets
   * This ensures a single undo/redo action for operations like paste or cut.
   */
  handleBatchSpecificationUpdate(
    assetManager: AssetManager,
    changes: SpecificationChange[],
    undoRedoManager?: any
  ): void {
    if (changes.length === 0) return;

    if (undoRedoManager) {
      // Record previous states for all affected assets
      const previousStates = changes.map(change => {
        const asset = assetManager.getAsset(change.assetId);
        return {
          assetId: change.assetId,
          previousSpecifications: asset ? [...asset.specifications] : [],
        };
      });

      undoRedoManager.pushState('UPDATE_SPECIFICATIONS_BATCH', {
        changes: previousStates,
      });
    }

    // Apply updates
    changes.forEach(change => {
      if (assetManager.hasAsset(change.assetId)) {
        assetManager.updateAsset(change.assetId, { specifications: change.specifications });
      }
    });
  }
}

export default EditHandlers;
