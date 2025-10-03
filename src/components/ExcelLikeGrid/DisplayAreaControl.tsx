import React from 'react';
import { 
  Box, 
  ToggleButton, 
  ToggleButtonGroup, 
  Tooltip, 
  Typography 
} from '@mui/material';
import { 
  ViewList as SpecificationsIcon,
  Schedule as MaintenanceIcon,
  ViewModule as BothIcon
} from '@mui/icons-material';
import { DisplayAreaConfig } from './types';

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
        specifications: {
          visible: newMode === 'specifications' || newMode === 'both',
          width: newMode === 'both' ? 400 : 800,
          columns: config.scrollableAreas.specifications?.columns || []
        },
        maintenance: {
          visible: newMode === 'maintenance' || newMode === 'both',
          width: newMode === 'both' ? 600 : 800,
          columns: config.scrollableAreas.maintenance?.columns || []
        }
      }
    };
    
    onChange(newConfig);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2, 
      p: 1,
      borderBottom: 1,
      borderColor: 'divider',
      backgroundColor: 'background.paper'
    }}>
      <Typography variant="body2" color="text.secondary">
        表示エリア:
      </Typography>
      
      <ToggleButtonGroup
        value={config.mode}
        exclusive
        onChange={handleModeChange}
        size="small"
        sx={{ height: 32 }}
      >
        <ToggleButton value="specifications">
          <Tooltip title="機器仕様のみ表示">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <SpecificationsIcon fontSize="small" />
              <Typography variant="caption">機器仕様</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="maintenance">
          <Tooltip title="計画実績のみ表示">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MaintenanceIcon fontSize="small" />
              <Typography variant="caption">計画実績</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="both">
          <Tooltip title="両方表示（分割表示）">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BothIcon fontSize="small" />
              <Typography variant="caption">両方表示</Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      
      {config.mode === 'both' && (
        <Typography variant="caption" color="text.secondary">
          機器リスト固定、各エリア独立スクロール
        </Typography>
      )}
    </Box>
  );
};

export default DisplayAreaControl;