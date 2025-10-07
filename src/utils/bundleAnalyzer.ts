/**
 * Bundle size analysis utilities
 */

interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  loadTime: number;
  isLazy: boolean;
}

class BundleAnalyzer {
  private bundles: Map<string, BundleInfo> = new Map();

  constructor() {
    this.initializeAnalysis();
  }

  private initializeAnalysis() {
    // Monitor script loading
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource' && entry.name.includes('.js')) {
            const resourceEntry = entry as PerformanceResourceTiming;
            const bundleName = this.extractBundleName(resourceEntry.name);
            
            this.bundles.set(bundleName, {
              name: bundleName,
              size: resourceEntry.transferSize || 0,
              gzipSize: resourceEntry.encodedBodySize || 0,
              loadTime: resourceEntry.responseEnd - resourceEntry.startTime,
              isLazy: resourceEntry.name.includes('chunk') || resourceEntry.name.includes('lazy'),
            });
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Resource timing not supported for bundle analysis');
      }
    }
  }

  private extractBundleName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0] || 'unknown';
  }

  getBundleInfo(): BundleInfo[] {
    return Array.from(this.bundles.values());
  }

  getTotalBundleSize(): number {
    return Array.from(this.bundles.values()).reduce((total, bundle) => total + bundle.size, 0);
  }

  getLargestBundles(count: number = 5): BundleInfo[] {
    return Array.from(this.bundles.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, count);
  }

  getSlowestBundles(count: number = 5): BundleInfo[] {
    return Array.from(this.bundles.values())
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, count);
  }

  getCompressionRatio(): number {
    const totalSize = this.getTotalBundleSize();
    const totalGzipSize = Array.from(this.bundles.values())
      .reduce((total, bundle) => total + (bundle.gzipSize || 0), 0);
    
    return totalGzipSize > 0 ? totalSize / totalGzipSize : 1;
  }

  generateReport(): string {
    const bundles = this.getBundleInfo();
    const totalSize = this.getTotalBundleSize();
    const compressionRatio = this.getCompressionRatio();
    
    let report = '=== Bundle Analysis Report ===\n\n';
    report += `Total Bundle Size: ${(totalSize / 1024).toFixed(2)} KB\n`;
    report += `Compression Ratio: ${compressionRatio.toFixed(2)}:1\n\n`;
    
    report += 'Largest Bundles:\n';
    this.getLargestBundles().forEach((bundle, index) => {
      report += `${index + 1}. ${bundle.name}: ${(bundle.size / 1024).toFixed(2)} KB\n`;
    });
    
    report += '\nSlowest Loading Bundles:\n';
    this.getSlowestBundles().forEach((bundle, index) => {
      report += `${index + 1}. ${bundle.name}: ${bundle.loadTime.toFixed(2)} ms\n`;
    });
    
    return report;
  }

  logReport() {
    console.log(this.generateReport());
  }
}

export const bundleAnalyzer = new BundleAnalyzer();

// Development helper to log bundle analysis
try {
  if (import.meta.env?.DEV) {
    // Log bundle analysis after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        bundleAnalyzer.logReport();
      }, 2000);
    });
  }
} catch {
  // Ignore if environment variables are not available
}