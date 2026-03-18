import React from 'react';
import { Box, Typography } from '@mui/material';
import { ViewMode } from '../../types/maintenanceTask';

interface LegendProps {
  viewMode: 'status' | 'cost';
  dataViewMode?: ViewMode;
  className?: string;
}

export const Legend: React.FC<LegendProps> = ({ 
  viewMode, 
  dataViewMode = 'equipment-based',
  className = '' 
}) => {
  return (
    <Box 
      className={`legend-container ${className}`}
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 2,
        padding: '8px 12px',
        backgroundColor: 'transparent',
        border: 'none'
      }}
    >
      {/* Status/Cost legend */}
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
          {/* Show count indicator for equipment-based mode */}
          {dataViewMode === 'equipment-based' && (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
              <Box component="span" sx={{ fontSize: '0.875rem' }}>◎(2)</Box>
              <span>: 複数作業</span>
            </Box>
          )}
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
          {/* Show aggregated cost indicator for equipment-based mode */}
          {dataViewMode === 'equipment-based' && (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, fontStyle: 'italic' }}>
              <span>合計コスト表示</span>
            </Box>
          )}
        </Typography>
      )}
    </Box>
  );
};

export default Legend;