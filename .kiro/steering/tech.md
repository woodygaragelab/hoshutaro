# Technology Stack & Build System

## Core Technologies

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
- **AWS Amplify** for backend services
- **AWS CDK** for infrastructure as code
- **Axios** for HTTP client

### Testing & Quality
- **Jest** with React Testing Library for unit and integration tests
- **ESLint** with TypeScript rules for code quality
- **TypeScript** with strict configuration

## Build Commands

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
npm run deploy:check # Validate deployment readiness
npm run deploy:vercel # Deploy to Vercel
npm run deploy:netlify # Deploy to Netlify
```

### Analysis
```bash
npm run build:analyze # Analyze bundle size
```

## Project Configuration

### TypeScript
- Strict mode enabled with `noUnusedLocals` and `noUnusedParameters`
- ES2020 target with modern module resolution
- Separate configs for app (`tsconfig.app.json`) and build tools (`tsconfig.node.json`)

### Vite Configuration
- Manual chunk splitting for vendor libraries (React, MUI, utilities)
- Source maps enabled for production debugging
- Optimized dependencies pre-bundling
- CSS code splitting enabled

### Performance Optimizations
- Bundle size limit: 1000kb with warnings
- esbuild minification for faster builds
- HMR overlay disabled for better dev performance
- Vendor chunk separation for better caching