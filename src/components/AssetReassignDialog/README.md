# AssetReassignDialog Component

## Overview

The `AssetReassignDialog` component provides a user interface for reassigning equipment (assets) to a new hierarchy path. It supports both single and bulk reassignment operations with validation.

## Features

- **Current Path Display**: Shows the current hierarchy path(s) of selected assets
- **New Path Selection**: Provides dropdown selectors for each hierarchy level
- **Path Validation**: Validates that all required hierarchy levels are filled
- **Bulk Reassignment**: Supports reassigning multiple assets at once
- **Visual Feedback**: Shows preview of the new path before confirmation
- **Error Handling**: Displays validation errors and warnings

## Requirements

This component implements requirements:
- **3.2**: Move assets between hierarchy paths
- **3.6**: Reassign assets to new hierarchy with validation

## Props

```typescript
interface AssetReassignDialogProps {
  open: boolean;                    // Controls dialog visibility
  assets: Asset[];                  // Selected assets to reassign
  hierarchy: HierarchyDefinition;   // Current hierarchy definition
  onReassign: (assetIds: string[], newHierarchyPath: HierarchyPath) => void;
  onClose: () => void;              // Called when dialog is closed
}
```

## Usage

### Basic Usage

```typescript
import { AssetReassignDialog } from './components/AssetReassignDialog';
import { hierarchyManager, assetManager } from './services';

function MyComponent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);

  const handleReassign = (assetIds: string[], newPath: HierarchyPath) => {
    // Reassign each asset
    assetIds.forEach(assetId => {
      hierarchyManager.reassignAssetHierarchy(assetId, newPath);
    });
    
    console.log(`Reassigned ${assetIds.length} assets to new path`);
  };

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        機器の付け替え
      </Button>
      
      <AssetReassignDialog
        open={dialogOpen}
        assets={selectedAssets}
        hierarchy={hierarchyManager.getHierarchyDefinition()}
        onReassign={handleReassign}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
```

### Single Asset Reassignment

```typescript
// Reassign a single asset
const asset = assetManager.getAsset('P-101');
if (asset) {
  <AssetReassignDialog
    open={true}
    assets={[asset]}
    hierarchy={hierarchyManager.getHierarchyDefinition()}
    onReassign={(assetIds, newPath) => {
      hierarchyManager.reassignAssetHierarchy(assetIds[0], newPath);
    }}
    onClose={() => {}}
  />
}
```

### Bulk Reassignment

```typescript
// Reassign multiple assets at once
const selectedAssets = [
  assetManager.getAsset('P-101'),
  assetManager.getAsset('P-102'),
  assetManager.getAsset('E-201'),
].filter(Boolean) as Asset[];

<AssetReassignDialog
  open={true}
  assets={selectedAssets}
  hierarchy={hierarchyManager.getHierarchyDefinition()}
  onReassign={(assetIds, newPath) => {
    assetIds.forEach(id => {
      hierarchyManager.reassignAssetHierarchy(id, newPath);
    });
  }}
  onClose={() => {}}
/>
```

## Behavior

### Single Asset Mode

When a single asset is selected:
- The dialog pre-fills the new path with the asset's current path
- User can modify individual hierarchy levels
- Validation ensures the new path is different from the current path

### Bulk Mode

When multiple assets are selected:
- Shows all unique current paths of the selected assets
- Starts with an empty new path
- All selected assets will be moved to the same new path
- Displays a warning about bulk operation

### Validation

The dialog validates:
1. All hierarchy levels must have a value selected
2. Values must exist in the hierarchy definition
3. For single assets, the new path must be different from current
4. Path must conform to the hierarchy structure

### Error Messages

- "階層レベル「{level}」の値を選択してください" - Missing level value
- "階層レベル「{level}」の値「{value}」は無効です" - Invalid value
- "新しい階層パスは現在のパスと同じです" - No change for single asset

## Integration with HierarchyManager

The component works with the `HierarchyManager` service:

```typescript
// In the parent component
const handleReassign = (assetIds: string[], newPath: HierarchyPath) => {
  try {
    assetIds.forEach(assetId => {
      hierarchyManager.reassignAssetHierarchy(assetId, newPath);
    });
    
    // Show success message
    showNotification('機器の付け替えが完了しました');
    
    // Refresh data
    refreshAssetList();
  } catch (error) {
    // Handle errors
    showError(`付け替えに失敗しました: ${error.message}`);
  }
};
```

## Styling

The component uses Material-UI components with custom styling:
- Paper components for visual grouping
- Color-coded chips for current/new path indicators
- Success background for path preview
- Warning alerts for bulk operations

## Accessibility

- Proper ARIA labels on form controls
- Keyboard navigation support
- Clear visual hierarchy
- Error messages are announced

## Related Components

- `HierarchyEditDialog` - For editing the hierarchy structure
- `HierarchyManager` - Service for managing hierarchy operations
- `AssetManager` - Service for managing assets

## Notes

- The component does not directly modify data; it calls the `onReassign` callback
- Parent component is responsible for error handling and data persistence
- Undo/redo support should be handled by the parent through `UndoRedoManager`
- The dialog automatically closes on successful reassignment
