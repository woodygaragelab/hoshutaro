import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Bundle size optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'utils-vendor': ['axios', 'xlsx', 'framer-motion'],
          'query-vendor': ['@tanstack/react-query', 'zustand'],
          // Track D Sprint 5-D: Cognito 認証 + MFA QR コードを別 chunk に分離
          // → App.tsx の初期ロード時 gzip サイズを ~40 KB 削減 + 認証関連の更新時
          //   キャッシュ無効化が App 本体に波及しない
          'auth-vendor': ['aws-amplify', 'qrcode.react'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: true,
    // Minification settings
    minify: 'esbuild',
    target: 'es2020',
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      'framer-motion',
      'react-window',
      'xlsx',
    ],
  },
  // Development server optimizations
  server: {
    port: 5173,
    open: 'chrome',
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: true,
  },
})
