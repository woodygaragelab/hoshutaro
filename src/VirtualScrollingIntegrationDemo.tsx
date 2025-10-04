import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import VirtualScrollingDemo from './components/ExcelLikeGrid/VirtualScrollingDemo';

const VirtualScrollingIntegrationDemo: React.FC = () => {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 1 }}>
        <Typography variant="h5" gutterBottom>
          Virtual Scrolling & Performance Optimization Demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This demo showcases the virtual scrolling implementation with performance optimizations:
        </Typography>
        <Box component="ul" sx={{ mt: 1, mb: 0 }}>
          <li>React-Window based virtual scrolling for large datasets</li>
          <li>Dynamic row height support with caching</li>
          <li>Performance monitoring and metrics</li>
          <li>Memoization and render optimization</li>
          <li>Split display mode with independent scrolling</li>
          <li>60FPS smooth scrolling experience</li>
        </Box>
      </Paper>
      
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <VirtualScrollingDemo />
      </Box>
    </Box>
  );
};

export default VirtualScrollingIntegrationDemo;