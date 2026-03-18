# System Architecture

## 🏗️ Overview

HOSHUTARO is a desktop-optimized maintenance management system built with modern web technologies. The system follows a component-based architecture with centralized state management through service managers.

## 🛠️ Technology Stack

### Frontend Framework
- **React 19** with TypeScript for type-safe component development
- **Vite** as the build tool and development server  
- **Material-UI v7** for UI components with custom theming
- **Framer Motion** for animations and transitions

### State Management & Data
- **React Query (@tanstack/react-query)** for server state management and caching
- **Zustand** for client-side state management
- **React Router v7** for navigation
- **XLSX** library for Excel file processing

### Performance & Optimization
- **React Window** for virtual scrolling in large datasets
- **Code splitting** with React.lazy for bundle optimization
- **Service Worker** for offline support and caching

### Backend Integration (Prepared)
- **AWS Amplify** for backend services (configured but not active)
- **AWS CDK** for infrastructure as code
- **Axios** for HTTP client

### Testing & Quality
- **Jest** with React Testing Library for unit and integration tests
- **ESLint** with TypeScript rules for code quality
- **TypeScript** with strict configuration

## 🏛️ Architecture Patterns

### Manager Pattern (Core Architecture)

All business logic uses manager classes in `src/services/`:

- `DataStore.ts` - Central data management and state (primary data source)
- `HierarchyManager.ts` - Equipment hierarchy operations
- `TaskManager.ts` - Maintenance task operations
- `AssetManager.ts` - Asset/equipment operations
- `AssociationManager.ts` - Equipment-task associations
- `ViewModeManager.ts` - View mode switching (Status/Cost)
- `UndoRedoManager.ts` - Undo/redo functionality
- `EditHandlers.ts` - Centralized edit operation handlers
- `ErrorHandler.ts` - Error handling and recovery

**Manager Usage Rules:**
1. Always check manager initialization before use
2. Use refs for manager instances: `const dataStoreRef = useRef<DataStore>()`
3. Managers are singleton-like classes - one instance per app
4. All data mutations MUST go through managers, never direct state updates
5. Include error handling for all manager operations

### Component Architecture

**Data Flow Pattern:**
```
App.tsx → EnhancedMaintenanceGrid → IntegratedToolbar/ModernHeader → Dialog Components
```

**Component Organization:**
- Feature-based structure with co-located tests, types, and utilities
- Barrel exports for clean imports
- Standardized props patterns for dialogs
- Memoization for performance optimization

### Data Model

**Core Domain Model:**

#### Star Chart (星取表) Display
- **Rows**: Equipment/assets in hierarchical structure
- **Columns**: Time periods (days/weeks/months)
- **Cells**: Maintenance status with visual indicators (○ planned, ● actual, ◎ both planned and actual)
- **View Modes**: Status View and Cost View

#### Equipment Hierarchy (Dynamic Structure)
- **Flexible 1-10 levels** with customizable level names
- **Example structure**: Plant/Facility → Area/Section → Equipment Group → Individual Equipment → Components/Specifications
- **Configurable**: Level names and structure can be customized per installation

## 🔄 Data Flow

### Equipment-Based Mode
```
Hierarchy Row (type: 'hierarchy')
└─ Asset Row (type: 'asset')
   └─ tasks: [{ taskId, taskName, schedule }]  // Embedded
```

### Task-Based Mode
```
Hierarchy Row (type: 'hierarchy')
└─ Asset Row (type: 'asset')
   └─ Task Row (type: 'task', schedule)  // Separate row
   └─ Task Row (type: 'task', schedule)
```

## 🎯 Performance Architecture

### Virtual Scrolling
- **React Window** for handling 10,000+ rows and 365+ columns
- **Memoization** with React.memo, useMemo, and useCallback
- **Data indexing** for O(1) lookups in large datasets

### Memory Management
- **Cleanup patterns** in useEffect hooks
- **Manager lifecycle** management
- **Cache strategies** for data transformations

### Bundle Optimization
- **Manual chunking** for vendor libraries (React, MUI, utilities)
- **Code splitting** with React.lazy for large components
- **Tree shaking** for unused code elimination

## 🔐 Security Architecture

### Frontend Security
- **Input sanitization** for XSS prevention
- **Type validation** with TypeScript
- **Error boundaries** for graceful failure handling

### Future Backend Integration
- **AWS Cognito** for authentication (prepared)
- **API security** patterns ready for implementation
- **Data encryption** strategies defined

## 📊 Monitoring & Observability

### Performance Monitoring
- **Render time tracking** with performance.now()
- **Memory usage monitoring** 
- **Bundle size analysis** with Vite analyzer
- **User interaction metrics**

### Error Handling
- **Centralized error handling** via ErrorHandler service
- **User-friendly error messages** in Japanese
- **Console logging** for development debugging
- **Error boundaries** for component isolation

## 🏗️ Build System

### Development
```bash
npm run dev          # Start development server with HMR
npm run preview      # Preview production build locally
```

### Testing
```bash
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode  
npm run test:coverage # Generate coverage report
```

### Build & Deploy
```bash
npm run build        # TypeScript compilation + Vite build
npm run lint         # Run ESLint checks
npm run prepare:deploy # Run tests, lint, and build
```

### Configuration Files
- `vite.config.ts` - Build configuration with manual chunk splitting
- `tsconfig.json` - Base TypeScript configuration
- `tsconfig.app.json` - App-specific TypeScript config
- `tsconfig.node.json` - Build tools TypeScript config
- `tsconfig.test.json` - Test TypeScript config
- `eslint.config.js` - Linting rules
- `jest.config.js` - Test configuration

## 🎯 Design Constraints

### Desktop-Only Design
- **Minimum viewport**: 1280px width
- **No responsive code**: Desktop browsers only (Chrome, Edge, Firefox)
- **Mouse/keyboard optimized**: No touch interactions

### Language & Localization
- **UI Language**: Japanese (星取表, 保全管理, etc.)
- **Code/Comments**: English only
- **Error Messages**: Japanese for user-facing, English for console

### Data Storage
- **Client-side storage**: localStorage for persistence
- **Mock backend**: AWS Amplify prepared but not active
- **Data format**: JSON with strict type validation

## 🔮 Future Architecture

### Phase 1: Backend Integration
- AWS API Gateway integration
- Real-time data synchronization
- Authentication & authorization system

### Phase 2: AI Features
- AWS Bedrock Agent integration
- Real AI response functionality
- Advanced analytics features

### Phase 3: Advanced Features
- Real-time collaboration
- Advanced analytics & reporting
- Mobile app support

## 📋 Architecture Validation

### Performance Benchmarks
- **Grid rendering**: <100ms for 10,000 rows
- **Cell editing**: <50ms response time
- **Data operations**: <200ms for CRUD operations
- **Memory usage**: <500MB for large datasets

### Quality Metrics
- **Test coverage**: >95% for core functionality
- **TypeScript strict mode**: Enabled
- **Bundle size**: Individual chunks <500KB
- **Accessibility**: WCAG 2.1 compliance ready