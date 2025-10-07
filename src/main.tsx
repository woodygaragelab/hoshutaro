import React, { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/globals.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ThemeProvider from './providers/ThemeProvider';
import { LazyWrapper, SkeletonLoaders } from './utils/loadingOptimization';
import { performanceMonitor } from './utils/performanceMonitor';
import { bundleAnalyzer } from './utils/bundleAnalyzer';
import { accessibilityManager } from './utils/accessibility';
import { registerSW } from './utils/serviceWorker';

// Lazy load components for better performance
const App = LazyWrapper(
  () => import('./App'),
  <SkeletonLoaders.Grid rows={10} columns={6} />
);

const App2 = LazyWrapper(
  () => import('./App2'),
  <SkeletonLoaders.Grid rows={8} columns={5} />
);

const ExcelGridDemo = LazyWrapper(
  () => import('./ExcelGridDemo'),
  <SkeletonLoaders.Table rows={6} columns={4} />
);

const IntegrationDemo = LazyWrapper(
  () => import('./components/demo/IntegrationDemo'),
  <SkeletonLoaders.Card count={3} />
);

const IntegrationTestRunner = LazyWrapper(
  () => import('./components/demo/IntegrationTestRunner'),
  <SkeletonLoaders.Table rows={5} columns={3} />
);

// Performance monitoring
performanceMonitor.recordMetric({
  name: 'app-initialization',
  duration: performance.now(),
  timestamp: Date.now(),
  type: 'bundle-load',
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/app2',
    element: <App2 />,
  },
  {
    path: '/excel-demo',
    element: <ExcelGridDemo />,
  },
  {
    path: '/integration-demo',
    element: <IntegrationDemo />,
  },
  {
    path: '/integration-test',
    element: <IntegrationTestRunner />,
  },
]);

// Error boundary for better error handling
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo);
    performanceMonitor.recordMetric({
      name: 'application-error',
      duration: 0,
      timestamp: Date.now(),
      type: 'render',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          color: '#ffffff',
          backgroundColor: '#000000',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h1>アプリケーションエラーが発生しました</h1>
          <p>ページを再読み込みしてください。</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#333333',
              color: '#ffffff',
              border: '1px solid #555555',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize accessibility features
document.addEventListener('DOMContentLoaded', () => {
  // Set up global accessibility features
  document.body.setAttribute('role', 'application');
  document.body.setAttribute('aria-label', 'HOSHUTARO 保全管理システム');
  
  // Add skip link for keyboard navigation
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'メインコンテンツにスキップ';
  skipLink.style.position = 'absolute';
  skipLink.style.left = '-10000px';
  skipLink.style.top = 'auto';
  skipLink.style.width = '1px';
  skipLink.style.height = '1px';
  skipLink.style.overflow = 'hidden';
  skipLink.addEventListener('focus', () => {
    skipLink.style.position = 'static';
    skipLink.style.width = 'auto';
    skipLink.style.height = 'auto';
    skipLink.style.overflow = 'visible';
  });
  skipLink.addEventListener('blur', () => {
    skipLink.style.position = 'absolute';
    skipLink.style.left = '-10000px';
    skipLink.style.width = '1px';
    skipLink.style.height = '1px';
    skipLink.style.overflow = 'hidden';
  });
  document.body.insertBefore(skipLink, document.body.firstChild);
});

const root = createRoot(document.getElementById('root')!);

// Measure initial render performance
const renderStart = performance.now();

root.render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <Suspense fallback={<SkeletonLoaders.Header />}>
          <div id="main-content" role="main">
            <RouterProvider router={router} />
          </div>
        </Suspense>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Record render performance
setTimeout(() => {
  performanceMonitor.recordMetric({
    name: 'initial-render',
    duration: performance.now() - renderStart,
    timestamp: Date.now(),
    type: 'render',
  });
}, 0);

// Register service worker for caching and offline support
registerSW({
  onSuccess: (registration) => {
    console.log('Service Worker registered successfully:', registration);
  },
  onUpdate: (registration) => {
    console.log('Service Worker update available:', registration);
    // Show update notification to user
    if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
      window.location.reload();
    }
  },
  onOfflineReady: () => {
    console.log('App is ready for offline use');
    accessibilityManager.announce('アプリケーションがオフラインで利用可能になりました');
  },
});
