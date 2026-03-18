import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  Divider,
  Chip,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Alert,
  Autocomplete,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  CurrencyYen as YenIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  Task,
  WorkOrderLine,
  Asset,
  WorkOrderLineUpdate,
} from '../../types/maintenanceTask';
import { getClassificationOptions } from '../../config/classificationMaster';

export interface WorkOrderLineDialogProps {
  open: boolean;
  assetId: string;
  dateKey: string;              // Date key being edited (e.g., "2025-02-01" or "2025-02")
  associations: WorkOrderLine[]; // All work order lines for this asset
  allTasks: Task[];             // All available tasks
  allAssets: Asset[];           // All assets (for related assets feature)
  onSave: (updates: WorkOrderLineUpdate[]) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void; // Optional callback to update task definitions
  onClose: () => void;
  readOnly?: boolean;
  editScope?: 'single-asset' | 'all-assets';
  dataViewMode?: 'equipment-based' | 'task-based';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`wol-dialog-tabpanel-${index}`}
      aria-labelledby={`wol-dialog-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// New simplified data structure for maintenance records
interface MaintenanceRecord {
  id: string;                 // Unique ID for this record
  taskName: string;           // Editable task name
  classification: string;     // Task classification (01-20)
  type: 'planned' | 'actual'; // Planned or Actual
  date: string;               // Date in YYYY-MM-DD format
  cost: number;               // Cost amount
  isNew: boolean;             // Is this a new record?
  isDeleted: boolean;         // Is this record marked for deletion?
  isModified: boolean;        // Has this record been modified?
  associationId?: string;     // Original association ID (if exists)
}

// Legacy interface - kept for backward compatibility
interface TaskEditItem {
  associationId: string;
  taskId: string;
  taskName: string;
  classification: string;
  planned: boolean;
  actual: boolean;
  planCost: number;
  actualCost: number;
  isNew: boolean;
  isDeleted: boolean;
  isModified: boolean;
  defaultSchedulePattern?: {
    frequency: 'yearly' | 'monthly' | 'quarterly' | 'custom';
    interval?: number;
  };
}

interface RelatedAssetItem {
  assetId: string;
  assetName: string;
  hierarchyPath: string;
  hasTask: boolean;
  selected: boolean;
}

/**
 * WorkOrderLineDialog - Dialog for editing work order lines associated with an asset
 * 
 * Features:
 * - Display all work order lines associated with an asset for a specific date
 * - Add new work order lines
 * - Delete work order lines
 * - Edit schedule (planned/actual, costs) for each work order line
 * - Related Assets tab: view and manage other assets with the same tasks
 * - Bulk schedule updates for related assets
 */
export const WorkOrderLineDialog: React.FC<WorkOrderLineDialogProps> = ({
  open,
  assetId,
  dateKey,
  associations,
  allTasks,
  allAssets,
  onSave,
  onUpdateTask,
  onClose,
  readOnly = false,
  editScope = 'single-asset',
  dataViewMode = 'equipment-based',
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [editItems, setEditItems] = useState<TaskEditItem[]>([]); // Legacy - kept for compatibility
  const [selectedTaskForRelated, setSelectedTaskForRelated] = useState<string | null>(null);
  const [relatedAssets, setRelatedAssets] = useState<RelatedAssetItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedPatternIndex, setExpandedPatternIndex] = useState<number | null>(null);

  // Available classifications (01-20) with names
  const availableClassifications = getClassificationOptions();

  // Get current asset info
  const currentAsset = useMemo(() => {
    return allAssets.find(a => a.id === assetId);
  }, [allAssets, assetId]);

  // Initialize maintenance records from associations
  useEffect(() => {
    if (open) {
      console.log('[TaskEditDialog] Initializing with:', {
        assetId,
        dateKey,
        associationsCount: associations.length,
        editScope,
        dataViewMode,
        associations: associations.map(a => ({
          id: a.id,
          taskId: a.taskId,
          hasScheduleForDate: !!a.schedule[dateKey]
        }))
      });

      const records: MaintenanceRecord[] = [];

      // Convert associations to maintenance records
      // Support both exact match and prefix match for aggregated time periods
      associations.forEach(assoc => {
        const task = allTasks.find(t => t.id === assoc.taskId);

        // Find all schedule entries that match the dateKey
        // For year: "2023" matches "2023-01-01", "2023-05-15", etc.
        // For month: "2023-05" matches "2023-05-01", "2023-05-15", etc.
        // For day: "2023-05-15" matches exactly "2023-05-15"
        const matchingEntries = Object.entries(assoc.schedule).filter(([scheduleDate]) => {
          // Exact match
          if (scheduleDate === dateKey) return true;

          // Prefix match for aggregated periods
          // If dateKey is "2023", match all dates starting with "2023-"
          // If dateKey is "2023-05", match all dates starting with "2023-05-"
          return scheduleDate.startsWith(dateKey + '-');
        });

        if (matchingEntries.length === 0) return;

        // Aggregate all matching entries
        let totalPlanned = false;
        let totalActual = false;
        let totalPlanCost = 0;
        let totalActualCost = 0;

        matchingEntries.forEach(([, scheduleEntry]) => {
          totalPlanned = totalPlanned || scheduleEntry.planned;
          totalActual = totalActual || scheduleEntry.actual;
          totalPlanCost += scheduleEntry.planCost;
          totalActualCost += scheduleEntry.actualCost;
        });

        // Create separate records for each date entry
        matchingEntries.forEach(([scheduleDate, scheduleEntry]) => {
          // Normalize date for HTML date input (requires YYYY-MM-DD)
          let normalizedDate = scheduleDate;
          if (/^\d{4}$/.test(scheduleDate)) {
            normalizedDate = `${scheduleDate}-01-01`;
          } else if (/^\d{4}-\d{2}$/.test(scheduleDate)) {
            normalizedDate = `${scheduleDate}-01`;
          }

          // Create a record for planned if exists
          if (scheduleEntry.planned) {
            records.push({
              id: `${assoc.id}-planned-${scheduleDate}`,
              taskName: task?.name || 'Unknown Task',
              classification: task?.classification || '01',
              type: 'planned',
              date: normalizedDate,
              cost: scheduleEntry.planCost,
              isNew: false,
              isDeleted: false,
              isModified: false,
              associationId: assoc.id,
            });
          }

          // Create a record for actual if exists
          if (scheduleEntry.actual) {
            records.push({
              id: `${assoc.id}-actual-${scheduleDate}`,
              taskName: task?.name || 'Unknown Task',
              classification: task?.classification || '01',
              type: 'actual',
              date: normalizedDate,
              cost: scheduleEntry.actualCost,
              isNew: false,
              isDeleted: false,
              isModified: false,
              associationId: assoc.id,
            });
          }
        });
      });

      console.log('[TaskEditDialog] Initialized maintenance records:', records.length);
      console.log('[TaskEditDialog] DEBUG: records with dates:', records.map(r => ({ id: r.id, date: r.date, type: r.type })));

      setMaintenanceRecords(records);
      setHasChanges(false);
      setTabValue(0);
      setSelectedTaskForRelated(null);
    }
    // Only re-run when dialog opens or key identifiers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId, dateKey]);

  // Update related assets when a task is selected
  useEffect(() => {
    if (selectedTaskForRelated) {
      const relatedAssocs = associations.filter(a => a.taskId === selectedTaskForRelated);
      const relatedAssetIds = new Set(relatedAssocs.map(a => a.assetId));

      const items: RelatedAssetItem[] = allAssets
        .filter(asset => asset.id !== assetId) // Exclude current asset
        .map(asset => {
          const hierarchyStr = Object.values(asset.hierarchyPath).join(' > ');

          return {
            assetId: asset.id,
            assetName: asset.name,
            hierarchyPath: hierarchyStr,
            hasTask: relatedAssetIds.has(asset.id),
            selected: false,
          };
        });

      setRelatedAssets(items);
    }
  }, [selectedTaskForRelated, associations, allAssets, assetId]);

  // Handle tab change
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

  // Handle adding a new maintenance record
  const handleAddRecord = useCallback(() => {
    // Determine default date based on dateKey
    let defaultDate = dateKey;
    if (dateKey.length === 4) {
      // Year only: use first day of year
      defaultDate = `${dateKey}-01-01`;
    } else if (dateKey.length === 7) {
      // Year-month: use first day of month
      defaultDate = `${dateKey}-01`;
    }

    const newRecord: MaintenanceRecord = {
      id: `new-${Date.now()}`,
      taskName: '',
      classification: '01',
      type: 'planned',
      date: defaultDate,
      cost: 0,
      isNew: true,
      isDeleted: false,
      isModified: false,
    };

    setMaintenanceRecords([...maintenanceRecords, newRecord]);
    setHasChanges(true);
  }, [maintenanceRecords, dateKey]);

  // Handle deleting a maintenance record
  const handleDeleteRecord = useCallback((index: number) => {
    const newRecords = [...maintenanceRecords];
    newRecords[index] = { ...newRecords[index], isDeleted: true };
    setMaintenanceRecords(newRecords);
    setHasChanges(true);
  }, [maintenanceRecords]);

  // Handle editing a maintenance record field
  const handleEditRecord = useCallback((
    index: number,
    field: keyof MaintenanceRecord,
    value: any
  ) => {
    const newRecords = [...maintenanceRecords];
    newRecords[index] = {
      ...newRecords[index],
      [field]: value,
      isModified: true,
    };
    setMaintenanceRecords(newRecords);
    setHasChanges(true);
  }, [maintenanceRecords]);

  // Handle adding a new task association
  const handleAddTask = useCallback((task: Task | null) => {
    if (!task) return;

    // Check if task already exists
    const exists = editItems.some(item => item.taskId === task.id && !item.isDeleted);
    if (exists) {
      alert('この作業は既に追加されています');
      return;
    }

    // Apply default schedule pattern if available
    let defaultPlanned = false;
    let defaultPlanCost = 0;

    if (task.defaultSchedulePattern) {
      // If task has a default schedule pattern, set planned to true
      defaultPlanned = true;
      // Could set a default cost based on pattern, but for now keep it 0
    }

    const newItem: TaskEditItem = {
      associationId: `new-${Date.now()}`,
      taskId: task.id,
      taskName: task.name,
      classification: task.classification,
      planned: defaultPlanned,
      actual: false,
      planCost: defaultPlanCost,
      actualCost: 0,
      isNew: true,
      isDeleted: false,
      isModified: false,
      defaultSchedulePattern: task.defaultSchedulePattern,
    };

    setEditItems([...editItems, newItem]);
    setHasChanges(true);
  }, [editItems]);

  // Handle deleting a task association
  const handleDeleteTask = useCallback((index: number) => {
    const newItems = [...editItems];
    newItems[index] = { ...newItems[index], isDeleted: true };
    setEditItems(newItems);
    setHasChanges(true);
  }, [editItems]);

  // Handle editing task schedule
  const handleEditSchedule = useCallback((
    index: number,
    field: 'planned' | 'actual' | 'planCost' | 'actualCost',
    value: boolean | number
  ) => {
    const newItems = [...editItems];
    const updatedItem = {
      ...newItems[index],
      [field]: value,
      isModified: true,
    };

    // Auto-set status flags when costs are entered
    // Requirements 4.8: Automatic status setting based on cost input
    if (field === 'planCost' && typeof value === 'number') {
      updatedItem.planned = value > 0;
    } else if (field === 'actualCost' && typeof value === 'number') {
      updatedItem.actual = value > 0;
    }

    newItems[index] = updatedItem;
    setEditItems(newItems);
    setHasChanges(true);
  }, [editItems]);

  // Handle editing default schedule pattern
  const handleEditDefaultPattern = useCallback((
    index: number,
    field: 'frequency' | 'interval',
    value: string | number
  ) => {
    const newItems = [...editItems];
    const currentPattern = newItems[index].defaultSchedulePattern || {
      frequency: 'yearly' as const,
    };

    if (field === 'frequency') {
      newItems[index] = {
        ...newItems[index],
        defaultSchedulePattern: {
          ...currentPattern,
          frequency: value as 'yearly' | 'monthly' | 'quarterly' | 'custom',
        },
        isModified: true,
      };
    } else if (field === 'interval') {
      newItems[index] = {
        ...newItems[index],
        defaultSchedulePattern: {
          ...currentPattern,
          interval: value as number,
        },
        isModified: true,
      };
    }

    setEditItems(newItems);
    setHasChanges(true);
  }, [editItems]);

  // Handle toggling pattern editor
  const handleTogglePatternEditor = useCallback((index: number) => {
    setExpandedPatternIndex(expandedPatternIndex === index ? null : index);
  }, [expandedPatternIndex]);

  // Handle selecting task for related assets view
  const handleSelectTaskForRelated = useCallback((taskId: string) => {
    setSelectedTaskForRelated(taskId);
  }, []);

  // Handle toggling related asset selection
  const handleToggleRelatedAsset = useCallback((index: number) => {
    const newItems = [...relatedAssets];
    newItems[index] = { ...newItems[index], selected: !newItems[index].selected };
    setRelatedAssets(newItems);
  }, [relatedAssets]);

  // Handle bulk schedule update for related assets
  const handleBulkScheduleUpdate = useCallback(() => {
    const selectedAssetIds = relatedAssets
      .filter(item => item.selected)
      .map(item => item.assetId);

    if (selectedAssetIds.length === 0) {
      alert('機器を選択してください');
      return;
    }

    if (!selectedTaskForRelated) return;

    // Find the schedule for the selected task in current asset
    const currentTaskItem = editItems.find(
      item => item.taskId === selectedTaskForRelated && !item.isDeleted
    );

    if (!currentTaskItem) return;

    const message = `選択した${selectedAssetIds.length}件の機器に対して、` +
      `作業「${currentTaskItem.taskName}」のスケジュールを更新しますか？\n\n` +
      `計画: ${currentTaskItem.planned ? '有' : '無'}\n` +
      `実績: ${currentTaskItem.actual ? '有' : '無'}\n` +
      `計画コスト: ¥${currentTaskItem.planCost.toLocaleString()}\n` +
      `実績コスト: ¥${currentTaskItem.actualCost.toLocaleString()}`;

    if (!window.confirm(message)) {
      return;
    }

    // This would trigger updates to related assets
    // For now, just show confirmation
    alert(`${selectedAssetIds.length}件の機器のスケジュールを更新しました`);

    // Reset selection
    setRelatedAssets(relatedAssets.map(item => ({ ...item, selected: false })));
  }, [relatedAssets, selectedTaskForRelated, editItems]);

  // Handle save - convert maintenance records back to task associations
  const handleSave = useCallback(() => {
    const updates: WorkOrderLineUpdate[] = [];

    // Group records by task name, classification, and date
    const recordsByTask = new Map<string, MaintenanceRecord[]>();

    maintenanceRecords.forEach(record => {
      if (record.isDeleted) return;

      const key = `${record.taskName}|||${record.classification}`;
      if (!recordsByTask.has(key)) {
        recordsByTask.set(key, []);
      }
      recordsByTask.get(key)!.push(record);
    });

    // Track which association IDs have been updated
    const updatedAssociationIds = new Set<string>();

    // Process each task group
    recordsByTask.forEach((records, key) => {
      const [taskName, classification] = key.split('|||');

      // Find or create task
      let task = allTasks.find(t => t.name === taskName && t.classification === classification);
      const taskId = task?.id || `task-${Date.now()}-${Math.random()}`;

      // Group records by date to create schedule entries
      const scheduleByDate = new Map<string, { planned: boolean; actual: boolean; planCost: number; actualCost: number }>();

      // Also track which original association these records came from
      // If we find a dominant association ID, we should try to update THAT association
      // instead of creating a new one.
      const sourceAssociationIds = new Map<string, number>();

      records.forEach(record => {
        if (record.associationId) {
          sourceAssociationIds.set(record.associationId, (sourceAssociationIds.get(record.associationId) || 0) + 1);
        }

        if (!scheduleByDate.has(record.date)) {
          scheduleByDate.set(record.date, {
            planned: false,
            actual: false,
            planCost: 0,
            actualCost: 0,
          });
        }

        const entry = scheduleByDate.get(record.date)!;
        if (record.type === 'planned') {
          entry.planned = true;
          entry.planCost += record.cost;
        } else {
          entry.actual = true;
          entry.actualCost += record.cost;
        }
      });

      // Determine target association
      // 1. First check if there is an existing association for the TARGET task
      let targetAssoc = associations.find(a => {
        const t = allTasks.find(task => task.id === a.taskId);
        return t?.name === taskName && t?.classification === classification;
      });

      // 2. If NO existing association for target task, check if we are renaming an existing association
      // If the records overwhelmingly come from one association (and that association isn't already used elsewhere)
      if (!targetAssoc && sourceAssociationIds.size > 0) {
        // Find the most common source association
        let maxCount = 0;
        let bestSourceId: string | null = null;
        sourceAssociationIds.forEach((count, id) => {
          if (count > maxCount) {
            maxCount = count;
            bestSourceId = id;
          }
        });

        if (bestSourceId) {
          const sourceAssoc = associations.find(a => a.id === bestSourceId);
          // Only reuse source association if it hasn't been claimed by another group yet
          // (In a split scenario, the first group wins, or we logic it out. For simple rename, this works)
          if (sourceAssoc && !updatedAssociationIds.has(bestSourceId)) {
            targetAssoc = sourceAssoc;
          }
        }
      }

      if (targetAssoc) {
        // Update existing association (either pre-existing target, or renamed source)
        updatedAssociationIds.add(targetAssoc.id);

        // Build new schedule from records
        const newSchedule: { [key: string]: any } = {};

        // Copy existing schedule entries that are outside the dateKey range
        Object.entries(targetAssoc.schedule).forEach(([scheduleDate, entry]) => {
          // Keep entries that don't match the dateKey
          if (scheduleDate !== dateKey && !scheduleDate.startsWith(dateKey + '-')) {
            newSchedule[scheduleDate] = entry;
          }
        });

        // Add new schedule entries from records
        scheduleByDate.forEach((entry, date) => {
          newSchedule[date] = entry;
        });

        const updateData: Partial<WorkOrderLine> = {
          schedule: newSchedule,
          updatedAt: new Date(),
        };

        // If we are renaming (taskId changed), update taskId as well
        // If we are renaming (taskId changed), update taskId as well
        if (targetAssoc.taskId !== taskId) {
          updateData.taskId = taskId;

          // If new task definition might be needed, pass it in the update object
          // This ensures atomic creation/update in App.tsx
          if (!task) {
            updates.push({
              lineId: targetAssoc.id,
              action: 'update',
              data: updateData,
              newTaskDef: {
                id: taskId,
                name: taskName,
                classification,
                description: taskName, // Default description
                defaultSchedulePattern: { frequency: 'yearly', interval: 1 }
              }
            });
            return; // Skip the push below
          }
        }

        updates.push({
          lineId: targetAssoc.id,
          action: 'update',
          data: updateData,
        });
      } else {
        // Create new association
        const newAssocId = `assoc-${Date.now()}-${Math.random()}`;

        // Build schedule from records
        const newSchedule: { [key: string]: any } = {};
        scheduleByDate.forEach((entry, date) => {
          newSchedule[date] = entry;
        });

        // Inherit workOrderId from source association (for rename scenarios)
        let workOrderId = '';
        if (sourceAssociationIds.size > 0) {
          const firstSourceId = sourceAssociationIds.keys().next().value;
          const sourceAssoc = associations.find(a => a.id === firstSourceId);
          if (sourceAssoc) {
            workOrderId = sourceAssoc.workOrderId;
          }
        }
        // Fallback: use the first association's workOrderId
        if (!workOrderId && associations.length > 0) {
          workOrderId = associations[0].workOrderId;
        }
        // Final fallback: generate a new workOrderId
        if (!workOrderId) {
          workOrderId = `wo-${Date.now()}`;
        }

        updates.push({
          lineId: newAssocId,
          action: 'create',
          data: {
            assetId,
            taskId,
            workOrderId,
            schedule: newSchedule,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // If task doesn't exist, create it via callback
        if (!task && onUpdateTask) {
          onUpdateTask(taskId, {
            name: taskName,
            classification,
            description: '',
          });
        }
      }
    });

    // Handle abandoned associations (renamed or deleted tasks)
    // Any association that was in the original list but NOT updated needs to be processed
    associations.forEach(assoc => {
      if (updatedAssociationIds.has(assoc.id)) return;

      // Safety check: Skip associations where dateKey entries exist but no records
      // were created during initialization (i.e., planned:false/actual:false entries).
      // These "invisible" entries should be preserved unchanged to prevent data loss.
      const hasDateKeyEntries = Object.keys(assoc.schedule).some(
        scheduleDate => scheduleDate === dateKey || scheduleDate.startsWith(dateKey + '-')
      );
      const hadRecordsFromThisAssoc = maintenanceRecords.some(
        r => r.associationId === assoc.id && !r.isDeleted
      );
      if (hasDateKeyEntries && !hadRecordsFromThisAssoc) {
        // This association has invisible entries (planned:false AND actual:false)
        // Preserve them unchanged
        console.log('[TaskEditDialog] Preserving invisible entries for association:', assoc.id);
        return;
      }

      // This association was not updated in the loop above.
      // This means either:
      // 1. All records for this task were deleted.
      // 2. All records for this task were renamed (moved to a new task).

      // We need to strip the current date's records from this association.
      const newSchedule: { [key: string]: any } = {};
      let hasRemainingSchedule = false;

      Object.entries(assoc.schedule).forEach(([scheduleDate, entry]) => {
        // Keep entries that don't match the dateKey
        if (scheduleDate !== dateKey && !scheduleDate.startsWith(dateKey + '-')) {
          newSchedule[scheduleDate] = entry;
          hasRemainingSchedule = true;
        }
      });

      if (hasRemainingSchedule) {
        // If there are records for other dates, update the association to remove current date's records
        updates.push({
          lineId: assoc.id,
          action: 'update',
          data: {
            schedule: newSchedule,
            updatedAt: new Date(),
          },
        });
      } else {
        // If no records remain at all, delete the association
        updates.push({
          lineId: assoc.id,
          action: 'delete',
        });
      }
    });

    console.log('[TaskEditDialog] Saving updates:', updates);
    onSave(updates);
    onClose();
  }, [maintenanceRecords, assetId, dateKey, associations, allTasks, onSave, onUpdateTask, onClose]);

  // Get available tasks for adding (exclude already added tasks)
  const availableTasks = useMemo(() => {
    const addedTaskIds = new Set(
      editItems.filter(item => !item.isDeleted).map(item => item.taskId)
    );
    return allTasks.filter(task => !addedTaskIds.has(task.id));
  }, [allTasks, editItems]);

  // Render maintenance records list
  const renderMaintenanceRecordsList = () => {
    const activeRecords = maintenanceRecords.filter(record => !record.isDeleted);

    if (activeRecords.length === 0) {
      return (
        <Alert severity="info" sx={{ my: 2 }}>
          この日付に保守作業レコードがありません。「+ レコード追加」ボタンから追加してください。
        </Alert>
      );
    }

    return (
      <List>
        {activeRecords.map((record, index) => {
          const actualIndex = maintenanceRecords.indexOf(record);
          return (
            <React.Fragment key={record.id}>
              <ListItem
                sx={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  py: 1.5,
                  px: 2,
                  bgcolor: record.isNew ? 'action.hover' : 'transparent',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                {/* Row 1: Task name and delete button */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {record.isNew && (
                    <Chip label="新規" size="small" color="success" sx={{ height: 24 }} />
                  )}
                  <TextField
                    label="作業名称"
                    value={record.taskName}
                    onChange={(e) => handleEditRecord(actualIndex, 'taskName', e.target.value)}
                    disabled={readOnly}
                    size="small"
                    placeholder="作業名を入力"
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteRecord(actualIndex)}
                    disabled={readOnly}
                    color="error"
                    sx={{ ml: 1 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Row 2: Classification, Type, Date, Cost in one compact row */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '100px 100px 160px 1fr', gap: 1, alignItems: 'center' }}>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={record.classification}
                      onChange={(e) => handleEditRecord(actualIndex, 'classification', e.target.value)}
                      disabled={readOnly}
                      displayEmpty
                    >
                      {availableClassifications.map(cls => (
                        <MenuItem
                          key={cls.value}
                          value={cls.value}
                          title={cls.description}
                        >
                          {cls.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <Select
                      value={record.type}
                      onChange={(e) => handleEditRecord(actualIndex, 'type', e.target.value)}
                      disabled={readOnly}
                      displayEmpty
                    >
                      <MenuItem value="planned">計画</MenuItem>
                      <MenuItem value="actual">実績</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    type="date"
                    value={record.date}
                    onChange={(e) => handleEditRecord(actualIndex, 'date', e.target.value)}
                    disabled={readOnly}
                    size="small"
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />

                  <TextField
                    type="number"
                    value={record.cost}
                    onChange={(e) => handleEditRecord(actualIndex, 'cost', Number(e.target.value))}
                    disabled={readOnly}
                    size="small"
                    placeholder="コスト"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <YenIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
              </ListItem>
              {index < activeRecords.length - 1 && <Divider sx={{ my: 1 }} />}
            </React.Fragment>
          );
        })}
      </List>
    );
  };

  // Legacy render function - kept for backward compatibility
  const renderTaskList = () => {
    return renderMaintenanceRecordsList();
  };

  // Render related assets tab
  const renderRelatedAssetsTab = () => {
    if (!selectedTaskForRelated) {
      return (
        <Alert severity="info">
          作業を選択してください。「作業一覧」タブで作業の「関連機器を表示」ボタンをクリックしてください。
        </Alert>
      );
    }

    const selectedTask = allTasks.find(t => t.id === selectedTaskForRelated);
    const currentTaskItem = editItems.find(
      item => item.taskId === selectedTaskForRelated && !item.isDeleted
    );

    return (
      <Box>
        <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            選択中の作業
          </Typography>
          <Typography variant="h6" gutterBottom>
            {selectedTask?.name}
          </Typography>
          {currentTaskItem && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                計画: {currentTaskItem.planned ? '有' : '無'} /
                実績: {currentTaskItem.actual ? '有' : '無'}
              </Typography>
              <Typography variant="body2">
                計画コスト: ¥{currentTaskItem.planCost.toLocaleString()} /
                実績コスト: ¥{currentTaskItem.actualCost.toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">
            この作業を持つ他の機器 ({relatedAssets.filter(a => a.hasTask).length}件)
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={handleBulkScheduleUpdate}
            disabled={readOnly || relatedAssets.filter(a => a.selected).length === 0}
          >
            選択した機器のスケジュールを更新
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">選択</TableCell>
                <TableCell>機器ID</TableCell>
                <TableCell>機器名</TableCell>
                <TableCell>階層</TableCell>
                <TableCell>状態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relatedAssets.map((asset, index) => (
                <TableRow key={asset.assetId}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={asset.selected}
                      onChange={() => handleToggleRelatedAsset(index)}
                      disabled={readOnly}
                    />
                  </TableCell>
                  <TableCell>{asset.assetId}</TableCell>
                  <TableCell>{asset.assetName}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {asset.hierarchyPath}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {asset.hasTask ? (
                      <Chip label="関連付け済み" size="small" color="success" />
                    ) : (
                      <Chip label="未関連付け" size="small" variant="outlined" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '60vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">
              作業編集
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentAsset?.name} ({assetId}) - {dateKey}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip
                label={dataViewMode === 'equipment-based' ? '機器ベース' : '作業ベース'}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={editScope === 'single-asset' ? '単一機器' : '全機器'}
                size="small"
                color={editScope === 'all-assets' ? 'warning' : 'default'}
              />
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="作業一覧" />
          <Tab label="関連機器" />
        </Tabs>
      </Box>

      <DialogContent>
        <TabPanel value={tabValue} index={0}>
          {renderMaintenanceRecordsList()}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<Typography sx={{ fontSize: '1.2rem' }}>+</Typography>}
              onClick={handleAddRecord}
              disabled={readOnly}
              fullWidth
            >
              レコード追加
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {renderRelatedAssetsTab()}
        </TabPanel>
      </DialogContent>

      <DialogActions>
        {(!hasChanges && maintenanceRecords.length === 0) && !readOnly && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
            作業を追加してから保存してください
          </Typography>
        )}
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={(!hasChanges && maintenanceRecords.length === 0) || readOnly}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkOrderLineDialog;
