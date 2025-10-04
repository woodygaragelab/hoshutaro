import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Chip, Collapse, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess, Speed } from '@mui/icons-material';

interface PerformanceMetrics {
  renderTime: number;
  updateCount: number;
  lastUpdate: number;
  averageRenderTime: number;
  memoryUsage?: number;
  fps?: number;
}

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
  dataSize: number;
  columnCount: number;
  virtualScrollingEnabled: boolean;
  visible?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  dataSize,
  columnCount,
  virtualScrollingEnabled,
  visible = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [currentFPS, setCurrentFPS] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState(0);

  // FPS monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        setCurrentFPS(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };

    if (visible) {
      animationId = requestAnimationFrame(measureFPS);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [visible]);

  // Memory usage monitoring
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryUsage(Math.round(memory.usedJSHeapSize / 1024 / 1024));
      }
    };

    if (visible) {
      updateMemoryUsage();
      const interval = setInterval(updateMemoryUsage, 1000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  const getPerformanceStatus = useCallback(() => {
    const { averageRenderTime } = metrics;
    
    if (averageRenderTime < 16) return { color: 'success', label: 'Excellent' };
    if (averageRenderTime < 33) return { color: 'warning', label: 'Good' };
    return { color: 'error', label: 'Poor' };
  }, [metrics]);

  const getFPSStatus = useCallback(() => {
    if (currentFPS >= 55) return { color: 'success', label: 'Smooth' };
    if (currentFPS >= 30) return { color: 'warning', label: 'Acceptable' };
    return { color: 'error', label: 'Choppy' };
  }, [currentFPS]);

  if (!visible) return null;

  const performanceStatus = getPerformanceStatus();
  const fpsStatus = getFPSStatus();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
        minWidth: 200,
        zIndex: 1000,
        boxShadow: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Speed fontSize="small" />
        <Typography variant="subtitle2">Performance</Typography>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Chip
          label={`${currentFPS} FPS`}
          color={fpsStatus.color as any}
          size="small"
        />
        <Chip
          label={performanceStatus.label}
          color={performanceStatus.color as any}
          size="small"
        />
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, fontSize: '0.75rem' }}>
          <Typography variant="caption" display="block">
            <strong>Data:</strong> {dataSize.toLocaleString()} rows × {columnCount} cols
          </Typography>
          
          <Typography variant="caption" display="block">
            <strong>Virtual Scrolling:</strong> {virtualScrollingEnabled ? 'Enabled' : 'Disabled'}
          </Typography>
          
          <Typography variant="caption" display="block">
            <strong>Render Time:</strong> {metrics.renderTime.toFixed(2)}ms
          </Typography>
          
          <Typography variant="caption" display="block">
            <strong>Avg Render:</strong> {metrics.averageRenderTime.toFixed(2)}ms
          </Typography>
          
          <Typography variant="caption" display="block">
            <strong>Updates:</strong> {metrics.updateCount}
          </Typography>
          
          {memoryUsage > 0 && (
            <Typography variant="caption" display="block">
              <strong>Memory:</strong> {memoryUsage}MB
            </Typography>
          )}
          
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            <strong>Recommendations:</strong>
          </Typography>
          
          {!virtualScrollingEnabled && dataSize > 100 && (
            <Typography variant="caption" display="block" color="warning.main">
              • Enable virtual scrolling for better performance
            </Typography>
          )}
          
          {metrics.averageRenderTime > 33 && (
            <Typography variant="caption" display="block" color="error.main">
              • Consider reducing data complexity
            </Typography>
          )}
          
          {currentFPS < 30 && (
            <Typography variant="caption" display="block" color="error.main">
              • Performance is below optimal
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default PerformanceMonitor;