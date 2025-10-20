import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Collapse, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess, Speed } from '@mui/icons-material';
import { performanceMonitor } from '../utils/performanceMonitor';
import { bundleAnalyzer } from '../utils/bundleAnalyzer';

interface PerformanceStats {
  fps: number;
  memoryUsage: number;
  bundleSize: number;
  renderTime: number;
  apiResponseTime: number;
}

const PerformanceMonitor: React.FC<{ enabled?: boolean }> = ({ enabled = false }) => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    memoryUsage: 0,
    bundleSize: 0,
    renderTime: 0,
    apiResponseTime: 0,
  });
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        setStats(prev => ({ ...prev, fps }));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };

    const updateStats = () => {
      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        setStats(prev => ({ ...prev, memoryUsage }));
      }

      // Bundle size
      const bundleSize = Math.round(bundleAnalyzer.getTotalBundleSize() / 1024);
      
      // Average render time
      const renderTime = Math.round(performanceMonitor.getAverageMetric('render'));
      
      // Average API response time
      const apiResponseTime = Math.round(performanceMonitor.getAverageMetric('api'));

      setStats(prev => ({
        ...prev,
        bundleSize,
        renderTime,
        apiResponseTime,
      }));
    };

    // Start FPS monitoring
    measureFPS();
    
    // Update other stats every 5 seconds
    const statsInterval = setInterval(updateStats, 5000);
    updateStats(); // Initial update

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(statsInterval);
    };
  }, [enabled]);

  // Keyboard shortcut to toggle performance monitor (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!visible) return null;

  const getPerformanceColor = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return 'success';
    if (value <= thresholds[1]) return 'warning';
    return 'error';
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'success';
    if (fps >= 30) return 'warning';
    return 'error';
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        borderRadius: 2,
        p: 1,
        minWidth: 200,
        zIndex: 9999,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <Speed fontSize="small" />
          <Typography variant="caption" fontWeight="bold">
            Performance
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ color: 'white', p: 0.5 }}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Box display="flex" gap={1} mt={1}>
        <Chip
          label={`${stats.fps} FPS`}
          size="small"
          color={getFPSColor(stats.fps) as any}
          variant="outlined"
        />
        {stats.memoryUsage > 0 && (
          <Chip
            label={`${stats.memoryUsage}MB`}
            size="small"
            color={getPerformanceColor(stats.memoryUsage, [50, 100]) as any}
            variant="outlined"
          />
        )}
      </Box>

      <Collapse in={expanded}>
        <Box mt={2} display="flex" flexDirection="column" gap={1}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption">Bundle Size:</Typography>
            <Chip
              label={`${stats.bundleSize}KB`}
              size="small"
              color={getPerformanceColor(stats.bundleSize, [500, 1000]) as any}
              variant="outlined"
            />
          </Box>
          
          {stats.renderTime > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">Avg Render:</Typography>
              <Chip
                label={`${stats.renderTime}ms`}
                size="small"
                color={getPerformanceColor(stats.renderTime, [16, 33]) as any}
                variant="outlined"
              />
            </Box>
          )}
          
          {stats.apiResponseTime > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">Avg API:</Typography>
              <Chip
                label={`${stats.apiResponseTime}ms`}
                size="small"
                color={getPerformanceColor(stats.apiResponseTime, [200, 500]) as any}
                variant="outlined"
              />
            </Box>
          )}

          <Typography variant="caption" sx={{ mt: 1, opacity: 0.7 }}>
            Press Ctrl+Shift+P to toggle
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default PerformanceMonitor;