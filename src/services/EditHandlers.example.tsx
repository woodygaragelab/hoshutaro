/**
 * EditHandlers Integration Example
 * 
 * This example demonstrates how to integrate EditHandlers with UI components
 * to provide view mode-aware editing behavior.
 */

import React, { useState } from 'react';
import { EditHandlers } from './EditHandlers';
import { ViewModeManager } from './ViewModeManager';
import { AssociationManager } from './AssociationManager';
import { TaskManager } from './TaskManager';
import { AssetManager } from './AssetManager';
import { HierarchyManager } from './HierarchyManager';
import {
  ViewMode,
  AssociationSchedule,
  EditContext,
} from '../types/maintenanceTask';

// ============================================================================
// Example 1: Basic Schedule Edit Dialog
// ============================================================================

interface ScheduleEditDialogProps {
  associationId: string;
  dateKey: string;
  currentSchedule: AssociationSchedule[string];
  onSave: (updatedCount: number) => void;
  onCancel: () => void;
}

function ScheduleEditDialog({
  associationId,
  dateKey,
  currentSchedule,
  onSave,
  onCancel,
}: ScheduleEditDialogProps) {
  // Get services from context or props
  const editHandlers = useEditHandlers();
  const viewModeManager = useViewModeManager();

  const [planned, setPlanned] = useState(currentSchedule.planned);
  const [actual, setActual] = useState(currentSchedule.actual);
  const [planCost, setPlanCost] = useState(currentSchedule.planCost);
  const [actualCost, setActualCost] = useState(currentSchedule.actualCost);

  // Get edit context
  const context = viewModeManager.getEditContext();

  // Get affected association count
  const affectedCount = editHandlers.getAffectedAssociationCount(
    associationId,
    context
  );

  // Get edit scope description
  const scopeDescription = editHandlers.getEditScopeDescription(context);

  const handleSave = () => {
    // Confirm if multiple associations will be affected
    if (affectedCount > 1) {
      const confirmed = window.confirm(
        `${affectedCount}件の機器のスケジュールが更新されます。続行しますか？`
      );
      if (!confirmed) return;
    }

    // Perform the edit
    const updatedCount = editHandlers.handleScheduleEdit({
      associationId,
      dateKey,
      scheduleEntry: {
        planned,
        actual,
        planCost,
        actualCost,
      },
      context,
    });

    onSave(updatedCount);
  };

  return (
    <div className="schedule-edit-dialog">
      <h2>スケジュール編集</h2>

      <div className="edit-scope-info">
        <p>{scopeDescription}</p>
        {affectedCount > 1 && (
          <p className="warning">
            {affectedCount}件の機器が影響を受けます
          </p>
        )}
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={planned}
            onChange={(e) => setPlanned(e.target.checked)}
          />
          計画
        </label>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={actual}
            onChange={(e) => setActual(e.target.checked)}
          />
          実績
        </label>
      </div>

      <div className="form-group">
        <label>
          計画コスト:
          <input
            type="number"
            value={planCost}
            onChange={(e) => setPlanCost(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-group">
        <label>
          実績コスト:
          <input
            type="number"
            value={actualCost}
            onChange={(e) => setActualCost(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="button-group">
        <button onClick={handleSave}>保存</button>
        <button onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: View Mode Switcher with Edit Scope Indicator
// ============================================================================

interface ViewModeSwitcherProps {
  onModeChange: (mode: ViewMode) => void;
}

function ViewModeSwitcher({ onModeChange }: ViewModeSwitcherProps) {
  const viewModeManager = useViewModeManager();
  const currentMode = viewModeManager.getCurrentMode();
  const context = viewModeManager.getEditContext();

  const handleModeChange = (newMode: ViewMode) => {
    viewModeManager.switchMode(newMode, true);
    onModeChange(newMode);
  };

  return (
    <div className="view-mode-switcher">
      <div className="mode-buttons">
        <button
          className={currentMode === 'equipment-based' ? 'active' : ''}
          onClick={() => handleModeChange('equipment-based')}
        >
          機器ベース
        </button>
        <button
          className={currentMode === 'task-based' ? 'active' : ''}
          onClick={() => handleModeChange('task-based')}
        >
          作業ベース
        </button>
      </div>

      <div className="edit-scope-indicator">
        <span className="label">編集スコープ:</span>
        <span className="value">
          {context.editScope === 'single-asset'
            ? '単一機器'
            : 'すべての関連機器'}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Grid Cell with Edit Handler
// ============================================================================

interface GridCellProps {
  associationId: string;
  dateKey: string;
  schedule: AssociationSchedule[string];
  onEdit: () => void;
}

function GridCell({ associationId, dateKey, schedule, onEdit }: GridCellProps) {
  const editHandlers = useEditHandlers();
  const viewModeManager = useViewModeManager();

  const context = viewModeManager.getEditContext();
  const willAffectMultiple = editHandlers.willAffectMultipleAssociations(
    associationId,
    context
  );

  const getSymbol = () => {
    if (schedule.planned && schedule.actual) return '◎';
    if (schedule.planned && !schedule.actual) return '○';
    if (!schedule.planned && schedule.actual) return '●';
    return '';
  };

  return (
    <div
      className={`grid-cell ${willAffectMultiple ? 'linked-edit' : ''}`}
      onClick={onEdit}
      title={
        willAffectMultiple
          ? '編集すると複数の機器が影響を受けます'
          : 'この機器のみ編集されます'
      }
    >
      <span className="symbol">{getSymbol()}</span>
      {willAffectMultiple && <span className="link-indicator">🔗</span>}
    </div>
  );
}

// ============================================================================
// Example 4: Complete Integration with Services
// ============================================================================

function MaintenanceGridWithEditHandlers() {
  // Initialize services
  const taskManager = new TaskManager();
  const assetManager = new AssetManager();
  const associationManager = new AssociationManager();
  const hierarchyManager = new HierarchyManager();

  // Create sample data
  const task1 = taskManager.createTask({
    name: '年次点検',
    description: '年次定期点検',
    classification: '01',
  });

  const asset1 = assetManager.createAsset({
    id: 'P-101',
    name: 'ポンプ1',
    hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
    specifications: [],
  });

  const asset2 = assetManager.createAsset({
    id: 'P-102',
    name: 'ポンプ2',
    hierarchyPath: { '製油所': '第一製油所', 'エリア': 'Aエリア' },
    specifications: [],
  });

  const assoc1 = associationManager.createAssociation({
    assetId: asset1.id,
    taskId: task1.id,
    schedule: {
      '2025-02-01': {
        planned: true,
        actual: false,
        planCost: 100000,
        actualCost: 0,
      },
    },
  });

  const assoc2 = associationManager.createAssociation({
    assetId: asset2.id,
    taskId: task1.id,
    schedule: {
      '2025-02-01': {
        planned: true,
        actual: false,
        planCost: 100000,
        actualCost: 0,
      },
    },
  });

  // Initialize ViewModeManager and EditHandlers
  const viewModeManager = new ViewModeManager(
    taskManager.getAllTasks(),
    assetManager.getAllAssets(),
    associationManager.getAllAssociations(),
    hierarchyManager.getHierarchyDefinition()
  );

  const editHandlers = new EditHandlers(associationManager);

  const [viewMode, setViewMode] = useState<ViewMode>('equipment-based');

  const handleModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
  };

  const handleScheduleEdit = (
    associationId: string,
    dateKey: string,
    scheduleEntry: AssociationSchedule[string]
  ) => {
    const context = viewModeManager.getEditContext();

    const updatedCount = editHandlers.handleScheduleEdit({
      associationId,
      dateKey,
      scheduleEntry,
      context,
    });

    console.log(`${updatedCount}件の関連付けが更新されました`);

    // Refresh data
    viewModeManager.updateData(
      taskManager.getAllTasks(),
      assetManager.getAllAssets(),
      associationManager.getAllAssociations(),
      hierarchyManager.getHierarchyDefinition()
    );
  };

  return (
    <div className="maintenance-grid">
      <ViewModeSwitcher onModeChange={handleModeChange} />

      <div className="grid-content">
        {/* Grid rendering logic here */}
        <p>Current mode: {viewMode}</p>
        <p>Edit scope: {viewModeManager.getEditContext().editScope}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Custom Hooks for Service Access
// ============================================================================

// These hooks would typically be implemented using React Context
// to provide services throughout the component tree

function useEditHandlers(): EditHandlers {
  // Implementation would use React Context
  throw new Error('Not implemented - use React Context');
}

function useViewModeManager(): ViewModeManager {
  // Implementation would use React Context
  throw new Error('Not implemented - use React Context');
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  ScheduleEditDialog,
  ViewModeSwitcher,
  GridCell,
  MaintenanceGridWithEditHandlers,
};
