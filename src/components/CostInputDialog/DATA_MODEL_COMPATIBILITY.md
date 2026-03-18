# CostInputDialog - Data Model Compatibility

## Overview

The `CostInputDialog` component has been updated to support both the legacy data model and the new task-based data model introduced in the maintenance-task-management feature.

## Data Model Compatibility

### Legacy Data Model
The dialog originally worked with `CostValue` from `CommonEdit/types.ts`:

```typescript
interface CostValue {
  planCost: number;
  actualCost: number;
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

### scheduleToCostValue
Converts a schedule entry to CostValue format:

```typescript
const costValue = scheduleToCostValue(schedule['2025-02-01']);
```

### costValueToSchedule
Converts CostValue back to schedule entry format, preserving status flags:

```typescript
const scheduleEntry = costValueToSchedule(costValue, originalEntry);
```

### updateScheduleCost
Updates cost data for a specific date in an AssociationSchedule:

```typescript
const updatedSchedule = updateScheduleCost(
  schedule,
  '2025-02-01',
  newCostValue
);
```

### validateCostValue
Validates cost values are within acceptable ranges:

```typescript
const validation = validateCostValue(costValue);
if (!validation.isValid) {
  console.error(validation.errors);
}
```

## Usage Examples

### With Legacy Data Model
```typescript
<CostInputDialog
  open={open}
  currentCost={costValue}
  onSave={(newCost) => {
    // Handle cost change
    onCellEdit(rowId, columnId, newCost);
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

### With New Data Model
```typescript
import { scheduleToCostValue, updateScheduleCost } from './dataModelAdapter';

// Convert schedule to cost for display
const currentCost = scheduleToCostValue(association.schedule[dateKey]);

<CostInputDialog
  open={open}
  currentCost={currentCost}
  onSave={(newCost) => {
    // Convert back to schedule format
    const updatedSchedule = updateScheduleCost(
      association.schedule,
      dateKey,
      newCost
    );
    
    // Update association
    associationManager.updateSchedule(association.id, dateKey, updatedSchedule[dateKey]);
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

## Key Features

### Cost Preservation
When updating status through StatusSelectionDialog, cost data is preserved:

```typescript
// Status update preserves costs
const scheduleEntry = statusValueToSchedule(newStatus, originalEntry);
// scheduleEntry.planCost and scheduleEntry.actualCost remain unchanged
```

### Status Preservation
When updating costs through CostInputDialog, status flags are preserved:

```typescript
// Cost update preserves status
const scheduleEntry = costValueToSchedule(newCost, originalEntry);
// scheduleEntry.planned and scheduleEntry.actual remain unchanged
```

## Backward Compatibility

The dialog component itself remains unchanged and continues to work with `CostValue`. The adapter functions provide a clean interface for working with the new data model without modifying the dialog's internal logic.

## Validation

The adapter includes validation to ensure:
- Cost values are non-negative
- Cost values don't exceed maximum limits (999,999,999,999)
- Data integrity is maintained during conversion

## Migration Path

1. **Immediate**: Use adapter functions when integrating with new data model
2. **Future**: Consider creating a wrapper component that handles conversion automatically
3. **Long-term**: Potentially refactor dialog to work directly with AssociationSchedule

## Testing

The existing tests for CostInputDialog continue to work without modification. Additional tests should be added for the adapter functions to ensure correct conversion between data models.
