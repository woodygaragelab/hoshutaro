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
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: true,
  },
})
