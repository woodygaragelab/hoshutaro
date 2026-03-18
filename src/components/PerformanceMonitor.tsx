/**
 * Performance Monitor Component
 * Display performance metrics for debugging
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

export interface PerformanceMonitorProps {
  enabled?: boolean;
  visible?: boolean;
  metrics?: {
    renderTime?: number;
    updateTime?: number;
    scrollTime?: number;
    fps?: number;
    memoryUsage?: number;
  };
  dataSize?: number;
  columnCount?: number;
  virtualScrollingEnabled?: boolean;
}

/**
 * Performance Monitor Component
 * Shows real-time performance metrics in development mode
 */
const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = false,
  visible = true,
  metrics = {},
  dataSize,
  columnCount,
  virtualScrollingEnabled,
}) => {
  if (!enabled && !visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: '#00ff00',
        padding: 2,
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 9999,
        minWidth: '180px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <Typography variant="caption" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
        📊 Performance Metrics
      </Typography>
      {metrics.renderTime !== undefined && (
        <Typography variant="caption" component="div">
          Render: {metrics.renderTime.toFixed(2)}ms
        </Typography>
      )}
      {metrics.updateTime !== undefined && (
        <Typography variant="caption" component="div">
          Update: {metrics.updateTime.toFixed(2)}ms
        </Typography>
      )}
      {metrics.scrollTime !== undefined && (
        <Typography variant="caption" component="div">
          Scroll: {metrics.scrollTime.toFixed(2)}ms
        </Typography>
      )}
      {metrics.fps !== undefined && (
        <Typography variant="caption" component="div">
          FPS: {metrics.fps.toFixed(0)}
        </Typography>
      )}
      {metrics.memoryUsage !== undefined && (
        <Typography variant="caption" component="div">
          Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
        </Typography>
      )}
      {dataSize !== undefined && (
        <Typography variant="caption" component="div">
          Rows: {dataSize}
        </Typography>
      )}
      {columnCount !== undefined && (
        <Typography variant="caption" component="div">
          Columns: {columnCount}
        </Typography>
      )}
      {virtualScrollingEnabled !== undefined && (
        <Typography variant="caption" component="div">
          Virtual: {virtualScrollingEnabled ? 'ON' : 'OFF'}
        </Typography>
      )}
    </Box>
  );
};

export default PerformanceMonitor;
