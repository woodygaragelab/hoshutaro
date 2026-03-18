# SpecificationEditDialog - Data Model Compatibility

## Overview

The `SpecificationEditDialog` component has been updated to support both the legacy data model and the new task-based data model introduced in the maintenance-task-management feature.

## Data Model Compatibility

### Legacy Data Model
The dialog originally worked with `SpecificationValue` from `CommonEdit/types.ts`:

```typescript
interface SpecificationValue {
  key: string;
  value: string;
  order: number;
}
```

### New Data Model
The new data model uses `Specification` from `types/maintenanceTask.ts`:

```typescript
interface Specification {
  key: string;
  value: string;
  order: number;
}

interface Asset {
  id: string;
  name: string;
  hierarchyPath: HierarchyPath;
  specifications: Specification[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Adapter Functions

The `dataModelAdapter.ts` module provides conversion functions:

### specificationToValue / valueToSpecification
Convert between formats (note: these are structurally identical):

```typescript
const value = specificationToValue(specification);
const spec = valueToSpecification(value);
```

### specificationsToValues / valuesToSpecifications
Convert arrays between formats:

```typescript
const values = specificationsToValues(asset.specifications);
const specs = valuesToSpecifications(values);
```

### updateAssetSpecifications
Update an asset's specifications:

```typescript
const updatedAsset = updateAssetSpecifications(asset, newSpecifications);
```

### validateSpecifications
Validate specifications array:

```typescript
const validation = validateSpecifications(specifications);
if (!validation.isValid) {
  console.error(validation.errors);
}
```

### sortSpecificationsByOrder / reorderSpecifications
Manage specification ordering:

```typescript
// Sort by existing order
const sorted = sortSpecificationsByOrder(specifications);

// Reorder sequentially (1, 2, 3, ...)
const reordered = reorderSpecifications(specifications);
```

## Usage Examples

### With Legacy Data Model
```typescript
<SpecificationEditDialog
  open={open}
  specifications={specifications}
  onSave={(newSpecs) => {
    // Handle specification changes
    onSpecificationEdit(rowId, newSpecs);
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

### With New Data Model
```typescript
import { 
  specificationsToValues, 
  updateAssetSpecifications 
} from './dataModelAdapter';

// Convert asset specifications to values for display
const specValues = specificationsToValues(asset.specifications);

<SpecificationEditDialog
  open={open}
  specifications={specValues}
  onSave={(newSpecs) => {
    // Update asset with new specifications
    const updatedAsset = updateAssetSpecifications(asset, newSpecs);
    
    // Save through AssetManager
    assetManager.updateAsset(asset.id, { specifications: updatedAsset.specifications });
  }}
  onClose={onClose}
  anchorEl={anchorEl}
/>
```

## Key Features

### Automatic Reordering
When specifications are saved, they are automatically reordered:

```typescript
// Input: [{ order: 5 }, { order: 2 }, { order: 8 }]
// Output: [{ order: 1 }, { order: 2 }, { order: 3 }]
const reordered = reorderSpecifications(specifications);
```

### Validation
The adapter validates:
- No empty keys or values
- No duplicate keys (case-insensitive)
- Order values are positive integers
- All required fields are present

### Timestamp Management
When updating assets, the `updatedAt` timestamp is automatically set:

```typescript
const updatedAsset = updateAssetSpecifications(asset, newSpecs);
// updatedAsset.updatedAt is set to current time
```

## Structural Compatibility

Note that `Specification` and `SpecificationValue` have identical structures. The adapter functions exist primarily for:

1. **Consistency**: Maintaining a consistent API across all dialog adapters
2. **Future-proofing**: If the structures diverge in the future, the adapter layer is already in place
3. **Validation**: Providing centralized validation logic
4. **Transformation**: Handling ordering and sorting operations

## Backward Compatibility

The dialog component itself remains unchanged and continues to work with `SpecificationValue`. The adapter functions provide a clean interface for working with the new data model without modifying the dialog's internal logic.

## Migration Path

1. **Immediate**: Use adapter functions when integrating with new data model
2. **Future**: Consider creating a wrapper component that handles conversion automatically
3. **Long-term**: Potentially refactor dialog to work directly with Asset.specifications

## Testing

The existing tests for SpecificationEditDialog continue to work without modification. Additional tests should be added for the adapter functions to ensure correct conversion and validation.
