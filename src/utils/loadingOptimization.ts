/**
 * Loading optimization utilities for better user experience
 */

import React from 'react';

// Simple lazy loading wrapper
export const LazyWrapper = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = React.lazy(importFn);
  
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    return React.createElement(
      React.Suspense,
      { fallback: fallback || 'Loading...' },
      React.createElement(LazyComponent, props)
    );
  };

  WrappedComponent.displayName = 'LazyWrapper';
  return WrappedComponent;
};

// Simple skeleton loaders using div elements
export const SkeletonLoaders = {
  Table: ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => {
    const tableRows = [];
    for (let i = 0; i < rows; i++) {
      const cells = [];
      for (let j = 0; j < columns; j++) {
        cells.push(
          React.createElement('div', {
            key: j,
            style: {
              width: '100%',
              height: '40px',
              backgroundColor: '#333',
              margin: '2px',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          })
        );
      }
      tableRows.push(
        React.createElement('div', {
          key: i,
          style: { display: 'flex', gap: '8px', marginBottom: '8px' }
        }, ...cells)
      );
    }
    return React.createElement('div', {}, ...tableRows);
  },

  Card: ({ count = 3 }: { count?: number }) => {
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push(
        React.createElement('div', {
          key: i,
          style: { marginBottom: '16px' }
        },
          React.createElement('div', {
            style: {
              width: '100%',
              height: '200px',
              backgroundColor: '#333',
              borderRadius: '4px',
              marginBottom: '8px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          }),
          React.createElement('div', {
            style: {
              width: '80%',
              height: '16px',
              backgroundColor: '#333',
              borderRadius: '4px',
              marginBottom: '4px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          }),
          React.createElement('div', {
            style: {
              width: '60%',
              height: '16px',
              backgroundColor: '#333',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          })
        )
      );
    }
    return React.createElement('div', {}, ...cards);
  },

  Header: () => {
    return React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }
    },
      React.createElement('div', {
        style: {
          width: '40px',
          height: '40px',
          backgroundColor: '#333',
          borderRadius: '50%',
          animation: 'pulse 1.5s ease-in-out infinite'
        }
      }),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', {
          style: {
            width: '200px',
            height: '24px',
            backgroundColor: '#333',
            borderRadius: '4px',
            marginBottom: '8px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }
        }),
        React.createElement('div', {
          style: {
            width: '150px',
            height: '16px',
            backgroundColor: '#333',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }
        })
      ),
      React.createElement('div', {
        style: {
          width: '100px',
          height: '36px',
          backgroundColor: '#333',
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }
      })
    );
  },

  Grid: ({ rows = 10, columns = 6 }: { rows?: number; columns?: number }) => {
    const headerCells = [];
    for (let i = 0; i < columns; i++) {
      headerCells.push(
        React.createElement('div', {
          key: i,
          style: {
            width: '100%',
            height: '48px',
            backgroundColor: '#333',
            margin: '2px',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }
        })
      );
    }

    const dataRows = [];
    for (let i = 0; i < rows; i++) {
      const cells = [];
      for (let j = 0; j < columns; j++) {
        cells.push(
          React.createElement('div', {
            key: j,
            style: {
              width: '100%',
              height: '36px',
              backgroundColor: '#333',
              margin: '2px',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }
          })
        );
      }
      dataRows.push(
        React.createElement('div', {
          key: i,
          style: { display: 'flex', gap: '4px', marginBottom: '4px' }
        }, ...cells)
      );
    }

    return React.createElement('div', {},
      React.createElement('div', {
        style: { display: 'flex', gap: '4px', marginBottom: '8px' }
      }, ...headerCells),
      ...dataRows
    );
  },
};

// Progressive loading hook
export const useProgressiveLoading = <T>(
  loadFn: () => Promise<T>,
  dependencies: React.DependencyList = []
) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);

        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 10, 90));
        }, 100);

        const result = await loadFn();
        
        clearInterval(progressInterval);
        
        if (!cancelled) {
          setProgress(100);
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Loading failed'));
          setLoading(false);
          setProgress(0);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error, progress };
};

// Image lazy loading with intersection observer
export const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}> = ({ src, alt, className, placeholder, onLoad, onError }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    onError?.();
  };

  const children: React.ReactNode[] = [];

  if (inView) {
    children.push(
      React.createElement('img', {
        key: 'main-image',
        src,
        alt,
        onLoad: handleLoad,
        onError: handleError,
        style: {
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }
      })
    );
  }

  if (!loaded && placeholder) {
    children.push(
      React.createElement('div', {
        key: 'placeholder',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${placeholder})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(5px)',
        }
      })
    );
  }

  return React.createElement('div', {
    className,
    ref: imgRef
  }, ...children);
};

// Preload critical resources
export const preloadResource = (url: string, type: 'script' | 'style' | 'image' | 'font') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  
  switch (type) {
    case 'script':
      link.as = 'script';
      break;
    case 'style':
      link.as = 'style';
      break;
    case 'image':
      link.as = 'image';
      break;
    case 'font':
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      break;
  }
  
  document.head.appendChild(link);
};

// Prefetch resources for next navigation
export const prefetchResource = (url: string) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
};

// Critical resource loader
export class CriticalResourceLoader {
  private loadedResources = new Set<string>();
  private loadingPromises = new Map<string, Promise<void>>();

  async loadCriticalCSS(urls: string[]): Promise<void> {
    const promises = urls.map(url => this.loadCSS(url));
    await Promise.all(promises);
  }

  async loadCriticalJS(urls: string[]): Promise<void> {
    // Load JS files sequentially to maintain order
    for (const url of urls) {
      await this.loadScript(url);
    }
  }

  private loadCSS(url: string): Promise<void> {
    if (this.loadedResources.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => {
        this.loadedResources.add(url);
        resolve();
      };
      link.onerror = reject;
      document.head.appendChild(link);
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  private loadScript(url: string): Promise<void> {
    if (this.loadedResources.has(url)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        this.loadedResources.add(url);
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }
}

export const criticalResourceLoader = new CriticalResourceLoader();