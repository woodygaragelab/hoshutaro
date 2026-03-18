/**
 * Performance Monitor Component
 * Display performance metrics for debugging
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

export interface PerformanceMonitorProps {
  enabled?: boolean;
  metrics?: {
    renderTime?: number;
    updateTime?: number;
    scrollTime?: number;
    fps?: number;
  };
}

/**
 * Performance Monitor Component
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = false,
  metrics = {},
}) => {
  if (!enabled) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#00ff00',
        padding: 1,
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
      }}
    >
      <Typography variant="caption" component="div">
        Performance Metrics
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
    </Box>
  );
};
