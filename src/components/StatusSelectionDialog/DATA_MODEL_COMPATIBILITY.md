# StatusSelectionDialog - Data Model Compatibility

## Overview

The `StatusSelectionDialog` component has been updated to support both the legacy data model and the new task-based data model introduced in the maintenance-task-management feature.

## Data Model Compatibility

### Legacy Data Model
The dialog originally worked with `StatusValue` from `CommonEdit/types.ts`:

```typescript
interface StatusValue {
  planned: boolean;
  actual: boolean;
  displaySymbol: '○' | '●' | '◎' | '';
  label: '未計画' | '計画' | '実績' | '両方';
}
```

### New Data Model
The new data model uses `AssociationSchedule` from `types/maintenanceTask.ts`:

```typescript
interface AssociationSchedule {
  [dateKey: string]: {
    planned: boolean;
    actual: boolean;
    planCost: number;
    actualCost: number;
  };
}
```

## Adapter Functions

The `dataModelAdapter.ts` module provides conversion functions:

### scheduleToStatusValue
Converts a schedule entry to StatusValue format:

```typescript
const statusValue = scheduleToStatusValue(schedule['2025-02-01']);
```

### statusValueToSchedule
Converts StatusValue back to schedule entry format, preserving cost data:

```typescript
const scheduleEntry = statusValueToSchedule(statusValue, originalEntry);
```

### updateScheduleStatus
Updates a specific date in an AssociationSchedule:

```typescript
const updatedSchedule = updateScheduleStatus(
  schedule,
  '2025-02-01',
  newStatusValue
);
```

## Usage Examples

### With Legacy Data Model
```typescript
<StatusSelectionDialog
  open={open}
  currentStatus={statusValue}
  onSelect={(newStatus) => {
    // Handle status change
    onCellEdit(rowId, columnId, newStatus);
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

### With New Data Model
```typescript
import { scheduleToStatusValue, updateScheduleStatus } from './dataModelAdapter';

// Convert schedule to status for display
const currentStatus = scheduleToStatusValue(association.schedule[dateKey]);

<StatusSelectionDialog
  open={open}
  currentStatus={currentStatus}
  onSelect={(newStatus) => {
    // Convert back to schedule format
    const updatedSchedule = updateScheduleStatus(
      association.schedule,
      dateKey,
      newStatus
    );
    
    // Update association
    associationManager.updateSchedule(association.id, dateKey, updatedSchedule[dateKey]);
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

## Backward Compatibility

The dialog component itself remains unchanged and continues to work with `StatusValue`. The adapter functions provide a clean interface for working with the new data model without modifying the dialog's internal logic.

## Migration Path

1. **Immediate**: Use adapter functions when integrating with new data model
2. **Future**: Consider creating a wrapper component that handles conversion automatically
3. **Long-term**: Potentially refactor dialog to work directly with AssociationSchedule

## Testing

The existing tests for StatusSelectionDialog continue to work without modification. Additional tests should be added for the adapter functions to ensure correct conversion between data models.
