import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { ViewList, TableChart, ViewModule } from '@mui/icons-material';
import { DisplayAreaConfig } from '../ExcelLikeGrid/types';

interface DisplayAreaControlProps {
  config: DisplayAreaConfig;
  onChange: (config: DisplayAreaConfig) => void;
}

export const DisplayAreaControl: React.FC<DisplayAreaControlProps> = ({
  config,
  onChange
}) => {
  const handleModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: 'specifications' | 'maintenance' | 'both' | null
  ) => {
    if (newMode === null) return;
    
    const newConfig: DisplayAreaConfig = {
      ...config,
      mode: newMode,
      scrollableAreas: {
        ...config.scrollableAreas,
        specifications: {
          visible: newMode === 'specifications' || newMode === 'both',
          width: config.scrollableAreas.specifications?.width || 400,
          columns: config.scrollableAreas.specifications?.columns || []
        },
        maintenance: {
          visible: newMode === 'maintenance' || newMode === 'both',
          width: config.scrollableAreas.maintenance?.width || 800,
          columns: config.scrollableAreas.maintenance?.columns || []
        }
      }
    };
    
    onChange(newConfig);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        表示エリア切り替え
      </Typography>
      
      <ToggleButtonGroup
        value={config.mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        sx={{ '& .MuiToggleButton-root': { px: 2 } }}
      >
        <ToggleButton value="specifications">
          <Tooltip title="機器仕様のみ表示">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ViewList fontSize="small" />
              <Typography variant="caption">仕様</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="maintenance">
          <Tooltip title="計画実績のみ表示">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TableChart fontSize="small" />
              <Typography variant="caption">計画実績</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="both">
          <Tooltip title="両方表示（分割表示）">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ViewModule fontSize="small" />
              <Typography variant="caption">両方</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};

export default DisplayAreaControl;