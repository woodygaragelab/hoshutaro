# HierarchyEditDialog Component

## Overview

The `HierarchyEditDialog` component provides a comprehensive interface for editing the equipment hierarchy structure in the HOSHUTARO maintenance management system. It supports dynamic hierarchy level management with validation and user-friendly editing features.

## Features

### Hierarchy Level Management
- **Add new levels**: Create new hierarchy levels (up to 10 levels maximum)
- **Delete levels**: Remove hierarchy levels (minimum 1 level required)
- **Reorder levels**: Change the display order of hierarchy levels
- **Rename levels**: Update hierarchy level keys with automatic asset path updates

### Hierarchy Value Management
- **Add values**: Add new values to any hierarchy level
- **Edit values**: Modify existing hierarchy values
- **Delete values**: Remove values (with validation to prevent deletion if in use)

### Validation
- Enforces 1-10 hierarchy level constraint
- Prevents duplicate level keys
- Prevents duplicate values within a level
- Validates that level keys are not empty
- Warns when changes affect existing assets

## Requirements

Implements requirements:
- **3.3**: Create new hierarchy levels and values
- **3.4**: Delete hierarchy levels and values
- **3.5**: Change hierarchy level order
- **3.8**: Support 1-10 dynamic hierarchy levels

## Props

```typescript
interface HierarchyEditDialogProps {
  open: boolean;                    // Dialog open state
  hierarchy: HierarchyDefinition;   // Current hierarchy definition
  assetCount: number;               // Number of assets using this hierarchy
  onSave: (hierarchy: HierarchyDefinition) => void;  // Save callback
  onClose: () => void;              // Close callback
  readOnly?: boolean;               // Optional read-only mode
}
```

## Usage

```typescript
import { HierarchyEditDialog } from './components/HierarchyEditDialog';
import { HierarchyDefinition } from './types/maintenanceTask';

function MyComponent() {
  const [open, setOpen] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyDefinition>({
    levels: [
      {
        key: '製油所',
        order: 1,
        values: ['第一製油所', '第二製油所'],
      },
      {
        key: 'エリア',
        order: 2,
        values: ['Aエリア', 'Bエリア'],
      },
    ],
  });

  const handleSave = (newHierarchy: HierarchyDefinition) => {
    setHierarchy(newHierarchy);
    // Update backend, etc.
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Edit Hierarchy
      </Button>
      
      <HierarchyEditDialog
        open={open}
        hierarchy={hierarchy}
        assetCount={150}
        onSave={handleSave}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
```

## User Interactions

### Adding a Hierarchy Level
1. Enter a level key in the "新しい階層レベルを追加" input field
2. Click "追加" button or press Enter
3. The new level is added with the next available order number

### Deleting a Hierarchy Level
1. Click the delete icon (trash) next to a level
2. Confirm the deletion if assets are using this level
3. The level is marked for deletion (minimum 1 level enforced)

### Reordering Levels
1. Click the up/down arrow icons to move a level
2. The order is updated immediately
3. Levels are automatically re-sorted by order

### Renaming a Level Key
1. Click the edit icon next to a level key
2. Enter the new key name
3. Click the save icon or press Enter
4. Confirm if assets are using this level

### Adding a Value
1. Enter a value in the input field under a level
2. Click "追加" button or press Enter
3. The value is added and sorted alphabetically

### Editing a Value
1. Click on a value chip
2. Edit the value in the inline text field
3. Click the save icon or press Enter
4. Confirm if assets might be using this value

### Deleting a Value
1. Click the X icon on a value chip
2. Confirm the deletion
3. The value is removed (fails if in use by assets)

## Validation Rules

1. **Level Count**: Must have between 1 and 10 hierarchy levels
2. **Unique Keys**: Level keys must be unique
3. **Non-Empty Keys**: Level keys cannot be empty
4. **Unique Values**: Values within a level must be unique
5. **Value In Use**: Cannot delete values that are in use by assets

## Warnings and Confirmations

The component shows confirmation dialogs when:
- Deleting a level that has values and assets exist
- Renaming a level key when assets exist
- Editing a value when assets exist
- Deleting a value when assets exist

## Integration with HierarchyManager

The dialog works with the `HierarchyManager` service:

```typescript
import { HierarchyManager } from './services/HierarchyManager';

// In your component
const handleSave = (newHierarchy: HierarchyDefinition) => {
  try {
    hierarchyManager.setHierarchyDefinition(newHierarchy);
    // Success
  } catch (error) {
    // Handle error
  }
};
```

## Styling

The component uses Material-UI components and follows the application's theme. Key styling features:
- New levels are highlighted with a background color
- Chips are used for values with inline editing
- Icons provide clear visual cues for actions
- Validation errors are displayed in Alert components

## Accessibility

- Keyboard navigation supported (Tab, Enter, Escape)
- ARIA labels on interactive elements
- Clear visual feedback for all actions
- Confirmation dialogs for destructive actions

## Performance Considerations

- Uses React hooks for efficient state management
- Memoizes computed values (active levels)
- Minimal re-renders through careful state updates
- Efficient validation on save rather than on every change
