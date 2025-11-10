# Project Structure & Organization

## Root Directory Structure

```
├── amplify/                 # AWS Amplify backend configuration
├── data/                    # Static data files (test.xlsx)
├── docs/                    # Project documentation
├── public/                  # Static assets (service worker, icons)
├── scripts/                 # Build and deployment scripts
├── source_files/            # Original HTML/CSS/JS files
├── src/                     # Main application source code
└── test-specifications.html # Test specifications
```

## Source Code Organization (`src/`)

### Component Architecture
```
src/
├── components/
│   ├── EnhancedMaintenanceGrid/    # Main grid component with subcomponents
│   │   ├── EnhancedMaintenanceGrid.tsx
│   │   ├── EnhancedMaintenanceGrid.css
│   │   ├── GroupHeaderRow.tsx
│   │   ├── MaintenanceGridLayout.tsx
│   │   ├── MobileGridView.tsx
│   │   ├── TabletGridView.tsx
│   │   ├── copyPasteManager.ts
│   │   ├── keyboardNavigation.ts
│   │   ├── scrollManager.ts
│   │   └── __tests__/              # Component-specific tests
│   ├── ModernHeader/               # Header with integrated controls
│   ├── AIAssistant/                # AI assistant panel (mock)
│   ├── DataSync/                   # Data synchronization components
│   ├── ErrorHandling/              # Error boundaries and recovery
│   ├── ResponsiveGridManager/      # Responsive grid management
│   ├── VirtualScrolling/           # Virtual scrolling implementation
│   ├── SpecificationEditDialog/   # Equipment specification editing
│   ├── CostInputDialog/            # Cost input dialogs
│   ├── StatusSelectionDialog/      # Status selection dialogs
│   └── CommonEdit/                 # Shared editing logic
```

### Supporting Directories
```
├── hooks/                   # Custom React hooks
├── utils/                   # Utility functions and helpers
├── providers/               # Context providers (Theme, etc.)
├── styles/                  # Global styles and CSS modules
├── theme/                   # Material-UI theme configuration
├── config/                  # Application configuration
├── data/                    # Static data and mock data
└── docs/                    # Component documentation
```

## File Naming Conventions

### Components
- **PascalCase** for component files: `EnhancedMaintenanceGrid.tsx`
- **camelCase** for utility files: `copyPasteManager.ts`
- **kebab-case** for CSS files: `enhanced-maintenance-grid.css`

### Test Files
- Co-located with components in `__tests__/` directories
- Named with `.test.tsx` or `.test.ts` suffix
- Match the component name: `EnhancedMaintenanceGrid.test.tsx`

### Utility Files
- Grouped by functionality in `utils/` directory
- Named descriptively: `dataTransformer.ts`, `performanceMonitor.ts`

## Component Organization Patterns

### Feature-Based Structure
Each major feature (like EnhancedMaintenanceGrid) contains:
- Main component file
- Supporting subcomponents
- Utility functions specific to the feature
- CSS/styling files
- Test files in `__tests__/` subdirectory

### Desktop-Only Components
All components are optimized for desktop use only.

### Manager Pattern
Complex functionality is organized using manager classes:
- `copyPasteManager.ts` - Handles clipboard operations
- `scrollManager.ts` - Manages scrolling behavior
- `keyboardNavigation.ts` - Keyboard interaction handling

## Import/Export Conventions

### Barrel Exports
Use index files for clean imports from directories:
```typescript
// components/index.ts
export { default as EnhancedMaintenanceGrid } from './EnhancedMaintenanceGrid';
export { default as ModernHeader } from './ModernHeader';
```

### Relative Imports
- Use relative imports for local files
- Use absolute imports from `src/` for cross-feature imports
- Group imports: external libraries, internal modules, relative imports

## Configuration Files Location

### Root Level
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Build configuration
- `tsconfig.*.json` - TypeScript configurations
- `eslint.config.js` - Linting rules
- `jest.config.js` - Test configuration

### Deployment
- `vercel.json` - Vercel deployment config
- `netlify.toml` - Netlify deployment config
- `amplify/` - AWS Amplify backend configuration

## Data Management

### Static Data
- Equipment data in `src/data/equipments.json`
- Test data in `data/test.xlsx`

### Type Definitions
- Centralized in `src/types.ts`
- Feature-specific types co-located with components

This structure supports scalability, maintainability, and clear separation of concerns while following React and TypeScript best practices.