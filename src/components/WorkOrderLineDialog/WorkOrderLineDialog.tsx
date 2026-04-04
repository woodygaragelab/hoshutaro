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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  CurrencyYen as YenIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import {
  WorkOrder,
  WorkOrderLine,
  Asset,
  WorkOrderLineUpdate,
} from '../../types/maintenanceTask';
import { getClassificationOptions } from '../../config/classificationMaster';
import { AssetSelectionDialog } from '../AssetSelectionDialog/AssetSelectionDialog';

export interface WorkOrderLineDialogProps {
  open: boolean;
  assetId: string;
  dateKey: string;              // Date key being edited (e.g., "2025-02-01" or "2025-02")
  workOrderId?: string;         // If opened from a specific task row
  associations: WorkOrderLine[]; // All work order lines for this asset
  allWorkOrders: WorkOrder[];             // All available tasks
  allAssets: Asset[];           // All assets (for related assets feature)
  allWorkOrderLines: WorkOrderLine[]; // All work order lines across all assets
  onSave: (updates: WorkOrderLineUpdate[]) => void;
  onUpdateWorkOrder?: (workOrderId: string, updates: Partial<WorkOrder>) => void; // Optional callback to update definitions
  onClose: () => void;
  readOnly?: boolean;
  editScope?: 'single-asset' | 'all-assets';
  dataViewMode?: 'asset-based' | 'workorder-based';
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

interface MaintenanceRecord {
  id: string;                 // Unique ID for this record
  workOrderId: string;        // Selected WorkOrder ID
  assetId?: string;           // Track the original Asset ID if editing globally
  lineName: string;           // WorkOrderLine name
  planned: boolean;           // Is planned?
  planStartDate: string;      // YYYY-MM-DD
  planEndDate: string;        // YYYY-MM-DD
  planCost: number;           // Cost
  actual: boolean;            // Is actual?
  actualStartDate: string;    // YYYY-MM-DD
  actualEndDate: string;      // YYYY-MM-DD
  actualCost: number;         // Cost
  isNew: boolean;             // Is this a new record?
  isDeleted: boolean;         // Is this record marked for deletion?
  isModified: boolean;        // Has this record been modified?
  associationId?: string;     // Original association ID (if exists)
}

export interface WorkOrderDraft {
  id: string;
  name: string;
  classificationId: string;
  isNew: boolean;
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
  workOrderId: contextWorkOrderId,
  associations,
  allWorkOrders,
  allAssets,
  allWorkOrderLines,
  onSave,
  onUpdateWorkOrder,
  onClose,
  readOnly = false,
  editScope = 'single-asset',
  dataViewMode = 'asset-based',
}) => {
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string | null>(null);
  const [workOrderDrafts, setWorkOrderDrafts] = useState<Record<string, WorkOrderDraft>>({});

  const [editItems, setEditItems] = useState<TaskEditItem[]>([]); // Legacy - kept for compatibility
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedPatternIndex, setExpandedPatternIndex] = useState<number | null>(null);
  const [assetSelectorState, setAssetSelectorState] = useState<{ open: boolean; recordIndex: number | null }>({ open: false, recordIndex: null });

  // Available classifications (01-20) with names
  const availableClassifications = getClassificationOptions();

  // Get current asset info
  const currentAsset = useMemo(() => {
    return allAssets.find(a => a.id === assetId);
  }, [allAssets, assetId]);

  // Initialize maintenance records from associations
  useEffect(() => {
    if (open) {
      
      const records: MaintenanceRecord[] = [];
      const uniqueWoIds = new Set<string>();

      // Convert associations to maintenance records
      associations.forEach(assoc => {
        // In context mode, skip records not matching the context WorkOrder
        if (contextWorkOrderId && assoc.WorkOrderId !== contextWorkOrderId) return;

        const formatDate = (dateValue: any) => {
          if (!dateValue) return '';
          const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
          if (isNaN(d.getTime())) return '';
          return d.toISOString().split('T')[0];
        };

        const planStart = formatDate(assoc.PlanScheduleStart);
        const actualStart = formatDate(assoc.ActualScheduleStart);

        // Check prefix match for aggregated periods against either start date
        const matchesDateKey = (dateStr: string) => dateStr === dateKey || dateStr.startsWith(dateKey + '-');
        const hasDateMatch = matchesDateKey(planStart) || matchesDateKey(actualStart);

        if (!hasDateMatch) {
          return; // Skip if it doesn't match the cell's dateKey
        }

        if (assoc.WorkOrderId) uniqueWoIds.add(assoc.WorkOrderId);

        const mergedPlanned = !!assoc.Planned;
        const mergedActual = !!assoc.Actual;
        const mergedPlanCost = assoc.PlanCost || 0;
        const mergedActualCost = assoc.ActualCost || 0;

        records.push({
          id: assoc.id,
          workOrderId: assoc.WorkOrderId || '',
          assetId: assoc.AssetId,
          lineName: assoc.name || '',
          planned: mergedPlanned,
          planStartDate: planStart,
          planEndDate: formatDate(assoc.PlanScheduleEnd) || planStart,
          planCost: mergedPlanCost,
          actual: mergedActual,
          actualStartDate: actualStart,
          actualEndDate: formatDate(assoc.ActualScheduleEnd) || actualStart,
          actualCost: mergedActualCost,
          isNew: false,
          isDeleted: false,
          isModified: false,
          associationId: assoc.id,
        });
      });

      if (contextWorkOrderId) {
        uniqueWoIds.add(contextWorkOrderId);
      }

      const drafts: Record<string, WorkOrderDraft> = {};
      let initialActiveId: string | null = null;

      if (uniqueWoIds.size === 0) {
        // If empty (e.g. clicking an empty cell in asset-view), create a default new Draft
        const newId = `NEW_${Date.now()}`;
        drafts[newId] = {
           id: newId,
           name: '',
           classificationId: '01',
           isNew: true
        };
        initialActiveId = newId;
      } else {
        uniqueWoIds.forEach(id => {
          const wo = allWorkOrders.find(w => w.id === id);
          drafts[id] = {
            id,
            name: wo?.name || '',
            classificationId: wo?.ClassificationId || '01',
            isNew: false
          };
        });
        
        if (contextWorkOrderId && drafts[contextWorkOrderId]) {
           initialActiveId = contextWorkOrderId;
        } else {
           initialActiveId = Array.from(uniqueWoIds)[0];
        }
      }

      setWorkOrderDrafts(drafts);
      setActiveWorkOrderId(initialActiveId);
      setMaintenanceRecords(records);
      setHasChanges(false);
    }
     
  }, [open, assetId, dateKey, contextWorkOrderId, associations, allWorkOrders]);

  // Handle adding a new maintenance record
  const handleAddRecord = useCallback((draftId: string) => {
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
      workOrderId: draftId,
      lineName: '',
      planned: true,
      planStartDate: defaultDate,
      planEndDate: defaultDate,
      planCost: 0,
      actual: false,
      actualStartDate: defaultDate,
      actualEndDate: defaultDate,
      actualCost: 0,
      isNew: true,
      isDeleted: false,
      isModified: false,
    };

    setMaintenanceRecords([...maintenanceRecords, newRecord]);
    setHasChanges(true);
  }, [maintenanceRecords, dateKey]);

  // Handle Draft Master info editing
  const handleEditDraft = useCallback((draftId: string, field: keyof WorkOrderDraft, value: string) => {
    setWorkOrderDrafts(prev => ({
      ...prev,
      [draftId]: {
        ...prev[draftId],
        [field]: value
      }
    }));
    setHasChanges(true);
  }, []);

  // Handle adding a brand new WorkOrder draft
  const handleAddNewWorkOrder = useCallback(() => {
    const newId = `NEW_${Date.now()}`;
    setWorkOrderDrafts(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        name: '',
        classificationId: '01',
        isNew: true
      }
    }));
    setActiveWorkOrderId(newId);
    setHasChanges(true);
  }, []);

  // Handle deleting a maintenance record
  const handleDeleteRecord = useCallback((index: number) => {
    const newRecords = [...maintenanceRecords];
    newRecords[index] = { ...newRecords[index], isDeleted: true };
    setMaintenanceRecords(newRecords);
    setHasChanges(true);
  }, [maintenanceRecords]);

  // Handle duplicating a maintenance record
  const handleDuplicateRecord = useCallback((index: number) => {
    const original = maintenanceRecords[index];
    const newRecord: MaintenanceRecord = {
      ...original,
      id: `new-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      isNew: true,
      isModified: true,
      associationId: undefined
    };
    const newRecords = [...maintenanceRecords];
    newRecords.splice(index + 1, 0, newRecord);
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
  const handleAddTask = useCallback((wo: WorkOrder | null) => {
    if (!wo) return;

    // Check if task already exists
    const exists = editItems.some(item => item.taskId === wo.id && !item.isDeleted);
    if (exists) {
      alert('この作業は既に追加されています');
      return;
    }

    // Apply default options
    const defaultPlanned = false;
    const defaultPlanCost = 0;

    const newItem: TaskEditItem = {
      associationId: `new-${Date.now()}`,
      taskId: wo.id,
      taskName: wo.name,
      classification: wo.ClassificationId,
      planned: defaultPlanned,
      actual: false,
      planCost: defaultPlanCost,
      actualCost: 0,
      isNew: true,
      isDeleted: false,
      isModified: false,
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

  const generateUpdates = useCallback(() => {
    const updates: WorkOrderLineUpdate[] = [];

    const processedAssocIds = new Set<string>();

    maintenanceRecords.forEach(record => {
      // Skip new records that were immediately deleted
      if (record.isNew && record.isDeleted) return;
      if (!record.workOrderId) return; // Skip if no WorkOrder selected

      if (record.isDeleted && record.associationId) {
        updates.push({ lineId: record.associationId, action: 'delete' });
        processedAssocIds.add(record.associationId);
        return;
      }

      const toDate = (dateStr: string) => {
        let normalized = dateStr;
        if (normalized.length === 7) normalized = `${normalized}-01`;
        if (normalized.length === 4) normalized = `${normalized}-01-01`;
        return new Date(`${normalized}T00:00:00`);
      };

      const draft = workOrderDrafts[record.workOrderId!];

      const lineData: Partial<WorkOrderLine> & { __workOrderDraft?: any } = {
         WorkOrderId: record.workOrderId,
         name: record.lineName, 
         AssetId: record.assetId || assetId,
         PlanScheduleStart: toDate(record.planStartDate),
         PlanScheduleEnd: toDate(record.planEndDate),
         ActualScheduleStart: toDate(record.actualStartDate),
         ActualScheduleEnd: toDate(record.actualEndDate),
         Planned: record.planned,
         Actual: record.actual,
         PlanCost: record.planCost,
         ActualCost: record.actualCost,
         __workOrderDraft: draft
      };

      if (record.associationId) {
        updates.push({ lineId: record.associationId, action: 'update', data: { ...lineData, UpdatedAt: new Date() } });
        processedAssocIds.add(record.associationId);
      } else {
        updates.push({ lineId: `assoc-${Date.now()}-${Math.random()}`, action: 'create', data: { ...lineData, CreatedAt: new Date(), UpdatedAt: new Date() } as any });
      }
    });
    return updates;
  }, [maintenanceRecords, assetId, dateKey, associations, contextWorkOrderId, workOrderDrafts]);

  // Handle save - execute flat record updates directly
  const handleSave = useCallback(() => {
    const updates = generateUpdates();
        onSave(updates);
    onClose();
  }, [generateUpdates, onSave, onClose]);

  // Render Master-Detail Area
  const renderMasterDetailArea = (draftId: string) => {
    const activeDraft = workOrderDrafts[draftId];
    if (!activeDraft) return null;

    const activeRecords = maintenanceRecords.filter(
      record => record.workOrderId === draftId && !record.isDeleted
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {!contextWorkOrderId && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="作業名 (任意)"
              value={activeDraft.name}
              onChange={(e) => handleEditDraft(draftId, 'name', e.target.value)}
              size="small"
              fullWidth
              disabled={readOnly}
              placeholder="例: ボイラー設備年次点検整備"
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>分類</InputLabel>
              <Select
                value={activeDraft.classificationId}
                label="分類"
                onChange={(e) => handleEditDraft(draftId, 'classificationId', e.target.value)}
                disabled={readOnly}
              >
                {availableClassifications.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        {/* Lines Area */}
        <Box>
          {activeRecords.length === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              この作業には明細レコードがありません。「明細を追加」ボタンから追加してください。
            </Alert>
          ) : (
            <List sx={{ p: 0 }}>
              {maintenanceRecords.map((record, index) => {
                if (record.workOrderId !== activeWorkOrderId || record.isDeleted) return null;
                const actualIndex = index;
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
                      {/* Row 1: Line name and delete button */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {record.isNew && (
                          <Chip label="新規" size="small" color="primary" variant="outlined" sx={{ height: 24 }} />
                        )}
                        <Chip 
                          label={allAssets.find(a => a.id === (record.assetId || assetId))?.name || '機器未指定'} 
                          size="small" 
                          color="default" 
                          variant="filled" 
                          onDoubleClick={() => !readOnly && setAssetSelectorState({ open: true, recordIndex: actualIndex })}
                          sx={{ height: 24, flexShrink: 0, bgcolor: '#333', cursor: readOnly ? 'default' : 'pointer' }} 
                        />
                        <TextField
                          label="作業明細名 (Line Name - 任意)"
                          value={record.lineName}
                          onChange={(e) => handleEditRecord(actualIndex, 'lineName', e.target.value)}
                          disabled={readOnly}
                          size="small"
                          fullWidth
                          placeholder="例: ボイラードラム分解清掃"
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicateRecord(actualIndex)}
                          disabled={readOnly}
                          color="primary"
                          sx={{ ml: 1 }}
                          title="明細をコピー"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteRecord(actualIndex)}
                          disabled={readOnly}
                          color="error"
                          title="明細を削除"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      {/* Row 2: Planned schedule */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, pl: 1 }}>
                        <FormControlLabel
                          control={<Checkbox checked={record.planned} onChange={(e) => handleEditRecord(actualIndex, 'planned', e.target.checked)} disabled={readOnly} size="small" color="primary" />}
                          label={<Typography variant="body2" sx={{ fontWeight: 500, width: 40, color: record.planned ? 'text.primary' : 'text.disabled' }}>計画</Typography>}
                          sx={{ m: 0 }}
                        />
                        <TextField
                          type="date"
                          label="開始日"
                          value={record.planStartDate}
                          onChange={(e) => handleEditRecord(actualIndex, 'planStartDate', e.target.value)}
                          disabled={readOnly || !record.planned}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          variant="standard"
                          sx={{ width: 130 }}
                        />
                        <Typography variant="body2" color="text.secondary">～</Typography>
                        <TextField
                          type="date"
                          label="終了日"
                          value={record.planEndDate}
                          onChange={(e) => handleEditRecord(actualIndex, 'planEndDate', e.target.value)}
                          disabled={readOnly || !record.planned}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          variant="standard"
                          sx={{ width: 130 }}
                        />
                        <TextField
                          type="number"
                          label="計画コスト"
                          value={record.planCost || ''}
                          onChange={(e) => handleEditRecord(actualIndex, 'planCost', Number(e.target.value))}
                          disabled={readOnly || !record.planned}
                          size="small"
                          variant="standard"
                          InputProps={{
                            startAdornment: <InputAdornment position="start"><YenIcon fontSize="small" /></InputAdornment>,
                          }}
                          sx={{ width: 130, ml: 'auto', mr: 2 }}
                        />
                      </Box>

                      {/* Row 3: Actual schedule */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pl: 1 }}>
                        <FormControlLabel
                          control={<Checkbox checked={record.actual} onChange={(e) => handleEditRecord(actualIndex, 'actual', e.target.checked)} disabled={readOnly} size="small" color="success" />}
                          label={<Typography variant="body2" sx={{ fontWeight: 500, width: 40, color: record.actual ? 'text.primary' : 'text.disabled' }}>実績</Typography>}
                          sx={{ m: 0 }}
                        />
                        <TextField
                          type="date"
                          label="開始日"
                          value={record.actualStartDate}
                          onChange={(e) => handleEditRecord(actualIndex, 'actualStartDate', e.target.value)}
                          disabled={readOnly || !record.actual}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          variant="standard"
                          sx={{ width: 130 }}
                        />
                        <Typography variant="body2" color="text.secondary">～</Typography>
                        <TextField
                          type="date"
                          label="終了日"
                          value={record.actualEndDate}
                          onChange={(e) => handleEditRecord(actualIndex, 'actualEndDate', e.target.value)}
                          disabled={readOnly || !record.actual}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          variant="standard"
                          sx={{ width: 130 }}
                        />
                        <TextField
                          type="number"
                          label="実績コスト"
                          value={record.actualCost || ''}
                          onChange={(e) => handleEditRecord(actualIndex, 'actualCost', Number(e.target.value))}
                          disabled={readOnly || !record.actual}
                          size="small"
                          variant="standard"
                          InputProps={{
                            startAdornment: <InputAdornment position="start"><YenIcon fontSize="small" /></InputAdornment>,
                          }}
                          sx={{ width: 130, ml: 'auto', mr: 2 }}
                        />
                      </Box>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}

          {!readOnly && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Typography sx={{ fontSize: '1.2rem', mt: -0.2 }}>+</Typography>}
                onClick={() => handleAddRecord(draftId)}
              >
                明細を追加
              </Button>
            </Box>
          )}

        </Box>
      </Box>
    );
  };

  // Inline Editable Title Component
  const renderEditableTitle = () => {
    if (!contextWorkOrderId || !activeWorkOrderId || !workOrderDrafts[activeWorkOrderId]) {
      return <Typography variant="h6">{currentAsset?.name || '作業編集'}</Typography>;
    }

    const activeDraft = workOrderDrafts[activeWorkOrderId];

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {readOnly ? (
          <Typography variant="h6">{activeDraft.name}</Typography>
        ) : (
          <TextField
            value={activeDraft.name}
            onChange={(e) => handleEditDraft(activeWorkOrderId, 'name', e.target.value)}
            placeholder="作業名をクリックして編集"
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: { 
                fontSize: '1.25rem', 
                fontWeight: 500, 
                width: { xs: '100%', sm: 400 },
                transition: 'background-color 0.2s',
                '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
                '&.Mui-focused': { bgcolor: 'action.hover', borderRadius: 1 }
              }
            }}
          />
        )}
        
        <FormControl variant="standard" size="small" sx={{ minWidth: 150 }}>
          <Select
            value={activeDraft.classificationId}
            onChange={(e) => handleEditDraft(activeWorkOrderId, 'classificationId', e.target.value)}
            disabled={readOnly}
            sx={{ fontSize: '0.9rem', color: 'text.secondary', '&:before': { borderBottom: 'none' } }}
          >
            {availableClassifications.map(option => (
              <MenuItem key={option.value} value={option.value}>
                分類: {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
          height: '85vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flexGrow: 1 }}>
            {renderEditableTitle()}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ mt: -0.5, mr: -1 }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, flexGrow: 1, overflowY: 'auto', bgcolor: 'grey.50', display: 'flex', flexDirection: 'column' }}>
        {contextWorkOrderId ? (
            // Workorder-based mode: directly render the single WorkOrder Master-Detail without Accordion
            activeWorkOrderId && renderMasterDetailArea(activeWorkOrderId)
          ) : (
            // Asset-based mode: Accordion layout for multiple WorkOrders
            <Box>
              
              {Object.values(workOrderDrafts).map(draft => (
                <Accordion 
                  key={draft.id} 
                  expanded={activeWorkOrderId === draft.id} 
                  onChange={() => setActiveWorkOrderId(activeWorkOrderId === draft.id ? null : draft.id)}
                  sx={{ mb: 2, '&:before': { display: 'none' }, boxShadow: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'background.paper', borderBottom: activeWorkOrderId === draft.id ? 1 : 0, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {draft.name || '(新規作業)'}
                      </Typography>
                      {draft.isNew && (
                        <Chip label="新規" size="small" color="primary" variant="outlined" sx={{ height: 20 }} />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ bgcolor: 'grey.50', pt: 3 }}>
                    {renderMasterDetailArea(draft.id)}
                  </AccordionDetails>
                </Accordion>
              ))}

              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={handleAddNewWorkOrder}
                  startIcon={<Typography sx={{ fontSize: '1.2rem' }}>+</Typography>}
                  disabled={readOnly}
                >
                  新しい作業を追加
                </Button>
              </Box>
            </Box>
          )}
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
      <AssetSelectionDialog
        open={assetSelectorState.open}
        assets={allAssets}
        currentAssetId={assetSelectorState.recordIndex !== null ? (maintenanceRecords[assetSelectorState.recordIndex].assetId || assetId) : undefined}
        onSelect={(newAssetId) => {
          if (assetSelectorState.recordIndex !== null) {
            handleEditRecord(assetSelectorState.recordIndex, 'assetId', newAssetId);
          }
        }}
        onClose={() => setAssetSelectorState({ open: false, recordIndex: null })}
      />
    </Dialog>
  );
};

export default WorkOrderLineDialog;
