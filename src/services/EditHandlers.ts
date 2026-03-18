/**
 * EditHandlers - Handles schedule editing with view mode awareness
 *
 * v3.0.0: Uses WorkOrderLineManager instead of AssociationManager
 *
 * - Equipment-based mode: Edits affect only the single WorkOrderLine
 * - Task-based mode: Edits affect all WorkOrderLines with the same task (linked updates)
 *
 * Requirement 5.7: Distinguish between equipment-based and task-based edit scopes
 */

import {
  EditContext,
  WorkOrderSchedule,
  ScheduleEditRequest,
} from '../types/maintenanceTask';
import { WorkOrderLineManager } from './WorkOrderLineManager';

export class EditHandlers {
  private workOrderLineManager: WorkOrderLineManager;

  constructor(workOrderLineManager: WorkOrderLineManager) {
    this.workOrderLineManager = workOrderLineManager;
  }

  /**
   * Handle schedule edit with view mode awareness
   *
   * @param request - Schedule edit request with context
   * @returns Number of WorkOrderLines updated
   */
  handleScheduleEdit(request: ScheduleEditRequest): number {
    const { workOrderLineId, dateKey, scheduleEntry, context } = request;

    const line = this.workOrderLineManager.getLine(workOrderLineId);
    if (!line) {
      throw new Error(`WorkOrderLine with id ${workOrderLineId} not found`);
    }

    if (context.editScope === 'all-assets' || context.viewMode === 'task-based') {
      // Task-based mode: Update all lines with the same task
      return this.workOrderLineManager.updateScheduleForAllLines(
        line.taskId,
        dateKey,
        scheduleEntry
      );
    } else {
      // Equipment-based mode: Update only the single line
      this.workOrderLineManager.updateSchedule(workOrderLineId, dateKey, scheduleEntry);
      return 1;
    }
  }

  /**
   * Handle schedule edit for a specific WorkOrderLine (equipment-based mode)
   */
  handleSingleLineEdit(
    lineId: string,
    dateKey: string,
    scheduleEntry: WorkOrderSchedule[string]
  ): void {
    this.workOrderLineManager.updateSchedule(lineId, dateKey, scheduleEntry);
  }

  /**
   * Handle schedule edit for all lines with a task (task-based mode)
   *
   * @returns Number of lines updated
   */
  handleLinkedLineEdit(
    taskId: string,
    dateKey: string,
    scheduleEntry: WorkOrderSchedule[string]
  ): number {
    return this.workOrderLineManager.updateScheduleForAllLines(
      taskId,
      dateKey,
      scheduleEntry
    );
  }

  /**
   * Get edit scope description for UI display
   */
  getEditScopeDescription(context: EditContext): string {
    if (context.viewMode === 'task-based' || context.editScope === 'all-assets') {
      return '同じ作業を持つすべての機器のスケジュールが連動して更新されます';
    } else {
      return 'この機器のスケジュールのみが更新されます';
    }
  }

  /**
   * Check if edit will affect multiple lines
   */
  willAffectMultipleLines(
    lineId: string,
    context: EditContext
  ): boolean {
    if (context.editScope === 'single-asset' && context.viewMode === 'equipment-based') {
      return false;
    }

    const line = this.workOrderLineManager.getLine(lineId);
    if (!line) {
      return false;
    }

    const relatedLines = this.workOrderLineManager.getLinesByTask(line.taskId);
    return relatedLines.length > 1;
  }

  /**
   * Get count of lines that will be affected by an edit
   */
  getAffectedLineCount(
    lineId: string,
    context: EditContext
  ): number {
    if (context.editScope === 'single-asset' && context.viewMode === 'equipment-based') {
      return 1;
    }

    const line = this.workOrderLineManager.getLine(lineId);
    if (!line) {
      return 0;
    }

    const relatedLines = this.workOrderLineManager.getLinesByTask(line.taskId);
    return relatedLines.length;
  }

  /**
   * Handle specification edit for an asset
   *
   * Specification editing always affects only the single asset,
   * regardless of view mode.
   */
  handleSpecificationEdit(
    assetManager: any,
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

    // Save current state for undo if manager is provided
    if (undoRedoManager) {
      undoRedoManager.pushState('UPDATE_SPECIFICATION', {
        assetId,
        previousSpecifications: [...asset.specifications],
      });
    }

    const updatedSpecs = [...asset.specifications];

    // Ensure the specification exists
    while (updatedSpecs.length <= specIndex) {
      updatedSpecs.push({
        key: `spec_${updatedSpecs.length}`,
        value: '-',
        order: updatedSpecs.length,
      });
    }

    // Update the specification
    if (field === 'key') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], key: value };
    } else if (field === 'value') {
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], value: value };
    }

    // Update through manager
    assetManager.updateAsset(assetId, { specifications: updatedSpecs });
  }
}

export default EditHandlers;
