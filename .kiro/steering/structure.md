---
inclusion: always
---

# Project Structure & Organization

## Root Structure

```text
├── src/                    # Main application source
├── docs/                   # Comprehensive documentation
├── amplify/                # AWS Amplify backend configuration
├── public/                 # Static assets
├── scripts/                # Deployment and utility scripts
└── data/                   # Sample/test data files
```

## Source Code Organization (`src/`)

### Component Architecture

```text
src/components/
├── EnhancedMaintenanceGrid/    # Main grid component (star chart display)
├── AIAssistant/                # AI-powered data processing
├── ModernHeader/               # Application header
├── [Feature]Dialog/            # Modal dialogs for editing
│   ├── TaskEditDialog/         # Task management
│   ├── HierarchyEditDialog/    # Hierarchy editing
│   ├── AssetReassignDialog/    # Equipment reassignment
│   ├── CostInputDialog/        # Cost data entry
│   ├── StatusSelectionDialog/  # Status changes
│   └── SpecificationEditDialog/ # Equipment specifications
└── [Utility]Components/        # Shared utilities
```

### Service Layer

```text
src/services/
├── TaskManager.ts              # Task CRUD operations
├── AssetManager.ts             # Equipment management
├── AssociationManager.ts       # Task-asset relationships
├── HierarchyManager.ts         # Hierarchy operations
├── ViewModeManager.ts          # Display mode switching
├── UndoRedoManager.ts          # Operation history
├── DataStore.ts                # Data persistence
├── ErrorHandler.ts             # Error management
├── EditHandlers.ts             # Edit operation coordination
└── DataMigrationService.ts     # Legacy data conversion
```

### Utilities & Hooks

```text
src/utils/                      # Pure utility functions
├── dataIndexing.ts             # O(1) lookup optimization
├── memoization.ts              # Performance caching
├── performanceMonitor.ts       # Performance tracking
├── accessibility.ts            # A11y helpers
└── dataTransformer.ts          # Data format conversion

src/hooks/                      # Custom React hooks
├── useViewModeTransition.ts    # Mode switching logic
└── useResponsiveLayout.ts      # Responsive behavior
```

## File Naming Conventions

- **Components**: PascalCase (e.g., `EnhancedMaintenanceGrid.tsx`)
- **Services**: PascalCase (e.g., `TaskManager.ts`)
- **Utilities**: camelCase (e.g., `dataIndexing.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useViewModeTransition.ts`)
- **Types**: camelCase (e.g., `maintenanceTask.ts`)
- **Tests**: Same as source with `.test.` suffix

## Co-location Patterns

Each major component follows this structure:

```text
ComponentName/
├── ComponentName.tsx           # Main component
├── ComponentName.css          # Component styles (if needed)
├── index.ts                   # Barrel export
├── README.md                  # Integration guide
├── types.ts                   # Component-specific types
├── utils/                     # Component utilities
├── hooks/                     # Component hooks
└── __tests__/                 # All test files
    ├── ComponentName.test.tsx
    ├── integration.test.tsx
    └── performance.test.tsx
```

## Import Organization Rules

Follow this exact order when organizing imports:

1. **React imports** first
2. **Third-party libraries**
3. **Internal services** (from `src/services/`)
4. **Internal components** (from `src/components/`)
5. **Internal utilities** (from `src/utils/`)
6. **Types** (from `src/types/`)
7. **Relative imports** last

## Architecture Patterns

### Service Layer Usage
- Use services for all business logic and data operations
- Components should only handle UI state and presentation
- Services are singletons - import and use directly, no dependency injection

### Component Patterns
- Functional components only, no class components
- Use co-located hooks for component-specific logic
- Export components through index.ts barrel files
- Include README.md for complex components with integration examples

### Data Flow
- Services manage all data operations and business rules
- Components consume services directly for data operations
- Use React Query for server state management
- Use Zustand for client-side global state

### Performance Considerations
- Virtual scrolling for large datasets (50,000+ records)
- Memoization utilities for expensive calculations
- O(1) lookup patterns using dataIndexing utilities
- Component-level performance monitoring

## File Creation Guidelines

### When creating new components:
1. Create folder with PascalCase name
2. Add main component file with same name
3. Add index.ts barrel export
4. Add types.ts if component has specific types
5. Add __tests__ folder with test files
6. Add README.md for complex components

### When creating new services:
1. Use PascalCase naming (e.g., `NewManager.ts`)
2. Follow existing service patterns for consistency
3. Add comprehensive test coverage
4. Document public methods and interfaces

### When adding utilities:
1. Use camelCase naming
2. Keep functions pure (no side effects)
3. Add to appropriate category or create new file
4. Include performance tests for critical utilities

## Documentation Structure

- **`docs/README.md`**: Documentation index and navigation
- **Feature docs**: Specifications and requirements
- **Architecture docs**: System design and patterns
- **Integration docs**: Component usage guides
- **Component READMEs**: Specific integration patterns

## Configuration Files

- **TypeScript**: Multiple tsconfig files for different contexts
- **Testing**: Jest configuration with jsdom environment
- **Linting**: ESLint with TypeScript and React rules
- **Build**: Vite with performance optimizations
- **Deployment**: Vercel and Netlify configurations