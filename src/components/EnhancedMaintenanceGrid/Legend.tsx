import React from 'react';
import { Box, Typography } from '@mui/material';

interface LegendProps {
  viewMode: 'status' | 'cost';
  className?: string;
}

export const Legend: React.FC<LegendProps> = ({ viewMode, className = '' }) => {
  return (
    <Box 
      className={`legend-container ${className}`}
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: 'transparent',
        border: 'none'
      }}
    >
      {viewMode === 'status' ? (
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <strong>凡例:</strong>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ fontSize: '1rem' }}>○</Box>
            <span>: 計画</span>
          </Box>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'secondary.main', fontWeight: 'bold' }}>
            <Box component="span" sx={{ fontSize: '1rem' }}>●</Box>
            <span>: 実績</span>
          </Box>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ fontSize: '1rem' }}>◎</Box>
            <span>: 計画と実績</span>
          </Box>
        </Typography>
      ) : (
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <strong>凡例 (単位: 千円):</strong>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'primary.main' }}>
            <span>123</span>
            <span>: 計画</span>
          </Box>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'secondary.main', fontWeight: 'bold' }}>
            <span>456</span>
            <span>: 実績</span>
          </Box>
        </Typography>
      )}
    </Box>
  );
};

export default Legend;