# Technology Stack & Build System

## Core Technologies

- **Frontend Framework**: React 19.0.0 with TypeScript
- **Build Tool**: Vite 6.2.0 with esbuild minification
- **UI Library**: Material-UI (MUI) 7.3.2 with Emotion styling
- **State Management**: Zustand 5.0.8 for global state
- **Data Fetching**: TanStack React Query 5.90.2
- **Backend**: AWS Amplify with CDK for infrastructure
- **Testing**: Jest 30.2.0 with React Testing Library
- **Linting**: ESLint 9.21.0 with TypeScript ESLint

## Key Libraries

- **Excel Processing**: xlsx 0.18.5 for file import/export
- **Virtualization**: react-window 2.2.0 for performance
- **Animation**: Framer Motion 12.23.22
- **Date Handling**: Day.js 1.11.19 with MUI Date Pickers
- **Property Testing**: fast-check 4.3.0 for robust testing

## Build Commands

```bash
# Development
npm run dev                 # Start development server
npm run build              # Production build (TypeScript + Vite)
npm run preview            # Preview production build

# Testing
npm run test               # Run Jest tests
npm run test:watch         # Watch mode testing
npm run test:coverage      # Generate coverage report

# Code Quality
npm run lint               # ESLint checking
npm run prepare:deploy     # Full pre-deployment check (test + lint + build)

# Deployment
npm run deploy:check       # Validate deployment readiness
npm run deploy:vercel      # Deploy to Vercel
npm run deploy:netlify     # Deploy to Netlify
npm run build:analyze      # Bundle size analysis
```

## Performance Optimizations

- **Bundle Splitting**: Manual chunks for vendor libraries (react, mui, utils, query)
- **Tree Shaking**: ES modules with esbuild optimization
- **Virtual Scrolling**: react-window for large datasets
- **Memoization**: Custom memoization utilities for O(1) lookups
- **Data Indexing**: Optimized data structures for 50,000+ assets

## Code Style Guidelines

- **TypeScript**: Strict mode enabled, explicit return types required
- **Components**: Functional components with hooks, no class components
- **File Organization**: Feature-based folder structure with co-located tests
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Imports**: Absolute imports from src/, relative for local files
- **Testing**: Property-based testing with fast-check for complex logic