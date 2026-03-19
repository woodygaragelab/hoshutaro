import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CircleIcon from '@mui/icons-material/Circle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
  const statusTooltipContent = (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5 }}>
        保全ステータス凡例
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <RadioButtonUncheckedIcon sx={{ fontSize: '1.2rem', color: 'primary.main' }} />
        <Typography variant="body2">計画 (予定されている作業)</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircleIcon sx={{ fontSize: '1.2rem', color: 'secondary.main' }} />
        <Typography variant="body2">実績 (完了した作業)</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <RadioButtonCheckedIcon sx={{ fontSize: '1.2rem', color: 'text.primary' }} />
        <Typography variant="body2">計画と実績 (完了済み)</Typography>
      </Box>
      {dataViewMode === 'equipment-based' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <RadioButtonCheckedIcon sx={{ fontSize: '1.2rem', color: 'text.primary' }} />
            <span style={{ fontSize: '0.85rem', marginLeft: '2px' }}>(2)</span>
          </Box>
          <Typography variant="body2">複数作業 (同月に複数あり)</Typography>
        </Box>
      )}
    </Box>
  );

  const costTooltipContent = (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', pb: 0.5 }}>
        コスト凡例 (単位: 千円)
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', width: '28px', textAlign: 'right', color: 'primary.main' }}>123</Typography>
        <Typography variant="body2">計画 (予定されているコスト)</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', width: '28px', textAlign: 'right', color: 'secondary.main' }}>456</Typography>
        <Typography variant="body2">実績 (完了したコスト)</Typography>
      </Box>
      {dataViewMode === 'equipment-based' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic', width: '28px', textAlign: 'right' }}>123<span style={{ fontSize: '0.75rem' }}>(2)</span></Typography>
          <Typography variant="body2">複数作業のコスト合計表示</Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Box 
      className={`legend-container ${className}`}
      sx={{ 
        display: 'flex', 
        alignItems: 'center',
        padding: '0 8px',
      }}
    >
      <Tooltip 
        title={viewMode === 'status' ? statusTooltipContent : costTooltipContent} 
        arrow 
        placement="bottom"
        PopperProps={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 8],
              },
            },
          ],
        }}
        componentsProps={{
          tooltip: {
            sx: {
              backgroundColor: '#333',
              color: '#fff',
              boxShadow: 3,
              border: '1px solid rgba(255,255,255,0.1)',
              maxWidth: 300
            }
          },
          arrow: {
            sx: { color: '#333' }
          }
        }}
      >
        <IconButton 
          size="small"
          sx={{ 
            color: 'text.secondary', 
            '&:hover': { color: 'text.primary' } 
          }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default Legend;