import React, { useState } from 'react';
import {
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Box,
  Drawer,
  Divider,
  SelectChangeEvent,
  ButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Storage as DataIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import DateJumpDialog from '../DateJumpDialog/DateJumpDialog';
import Legend from '../EnhancedMaintenanceGrid/Legend';
import './ModernHeader.css';



interface ModernHeaderProps {
  // Search functionality
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Hierarchy filtering
  level1Filter: string;
  level2Filter: string;
  level3Filter: string;
  onLevel1FilterChange: (event: SelectChangeEvent) => void;
  onLevel2FilterChange: (event: SelectChangeEvent) => void;
  onLevel3FilterChange: (event: SelectChangeEvent) => void;
  hierarchyFilterTree: any;
  level2Options: string[];
  level3Options: string[];
  
  // View mode and time scale
  viewMode: 'status' | 'cost';
  onViewModeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  timeScale: 'year' | 'month' | 'week' | 'day';
  onTimeScaleChange: (event: SelectChangeEvent) => void;
  
  // Display settings
  showBomCode: boolean;
  onShowBomCodeChange: (checked: boolean) => void;
  displayMode: 'specifications' | 'maintenance' | 'both';
  onDisplayModeChange: (mode: 'specifications' | 'maintenance' | 'both') => void;
  
  // Year operations
  onAddYear: () => void;
  onDeleteYear: () => void;
  
  // Data operations
  onExportData: () => void;
  onImportData: () => void;
  onResetData: () => void;
  
  // AI Assistant
  onAIAssistantToggle: () => void;
  isAIAssistantOpen: boolean;
  
  // Date Jump
  currentYear?: number;
  onJumpToDate?: (year: number, month?: number, week?: number, day?: number) => void;
}

// Create a new integrated toolbar component that will be used within the grid
export const IntegratedToolbar: React.FC<ModernHeaderProps> = ({
  searchTerm,
  onSearchChange,
  level1Filter,
  level2Filter,
  level3Filter,
  onLevel1FilterChange,
  onLevel2FilterChange,
  onLevel3FilterChange,
  hierarchyFilterTree,
  level2Options,
  level3Options,
  viewMode,
  onViewModeChange,
  timeScale,
  onTimeScaleChange,
  showBomCode,
  onShowBomCodeChange,
  displayMode,
  onDisplayModeChange,
  onAddYear,
  onDeleteYear,
  onExportData,
  onImportData,
  onResetData,
  onAIAssistantToggle,
  isAIAssistantOpen,
  currentYear = new Date().getFullYear(),
  onJumpToDate,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateJumpAnchorEl, setDateJumpAnchorEl] = useState<HTMLElement | null>(null);
  const dateJumpOpen = Boolean(dateJumpAnchorEl);

  const handleDateJumpClick = (event: React.MouseEvent<HTMLElement>) => {
    setDateJumpAnchorEl(event.currentTarget);
  };

  const handleDateJumpClose = () => {
    setDateJumpAnchorEl(null);
  };

  const handleJumpToDate = (year: number, month?: number, week?: number, day?: number) => {
    if (onJumpToDate) {
      onJumpToDate(year, month, week, day);
    }
    handleDateJumpClose();
  };

  return (
    <>
      {/* Compact toolbar that sits above the grid */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          minHeight: 40
        }}
      >
        {/* Search */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SearchIcon color="action" fontSize="small" />
          <TextField
            placeholder="検索..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ 
              width: 160,
              '& .MuiOutlinedInput-root': {
                height: 28,
                fontSize: '0.875rem'
              }
            }}
          />
        </Box>

        {/* Display Mode Tabs */}
        <ButtonGroup 
          size="small" 
          sx={{ 
            height: 28,
            '& .MuiButton-outlined': {
              borderColor: '#333333',
              color: '#ffffff',
              '&:hover': {
                borderColor: '#ffffff !important',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                zIndex: 1
              }
            }
          }}
        >
          <Button
            variant={displayMode === 'specifications' ? 'contained' : 'outlined'}
            onClick={() => onDisplayModeChange('specifications')}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 60,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            機器仕様
          </Button>
          <Button
            variant={displayMode === 'maintenance' ? 'contained' : 'outlined'}
            onClick={() => onDisplayModeChange('maintenance')}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 60,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            計画実績
          </Button>
          <Button
            variant={displayMode === 'both' ? 'contained' : 'outlined'}
            onClick={() => onDisplayModeChange('both')}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 40,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            両方
          </Button>
        </ButtonGroup>

        {/* Time Scale Tabs */}
        <ButtonGroup 
          size="small" 
          sx={{ 
            height: 28, 
            ml: 1,
            '& .MuiButton-outlined': {
              borderColor: '#333333',
              color: '#ffffff',
              '&:hover': {
                borderColor: '#ffffff !important',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                zIndex: 1
              }
            }
          }}
        >
          <Button
            variant={timeScale === 'year' ? 'contained' : 'outlined'}
            onClick={() => onTimeScaleChange({ target: { value: 'year' } } as any)}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 30,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            年
          </Button>
          <Button
            variant={timeScale === 'month' ? 'contained' : 'outlined'}
            onClick={() => onTimeScaleChange({ target: { value: 'month' } } as any)}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 30,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            月
          </Button>
          <Button
            variant={timeScale === 'week' ? 'contained' : 'outlined'}
            onClick={() => onTimeScaleChange({ target: { value: 'week' } } as any)}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 30,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            週
          </Button>
          <Button
            variant={timeScale === 'day' ? 'contained' : 'outlined'}
            onClick={() => onTimeScaleChange({ target: { value: 'day' } } as any)}
            sx={{ 
              fontSize: '0.75rem', 
              minWidth: 30,
              height: 28,
              px: 1,
              borderColor: '#333333 !important',
              '&:hover': {
                borderColor: '#ffffff !important'
              }
            }}
          >
            日
          </Button>
        </ButtonGroup>

        {/* Date Jump Icon - Show only for week/day modes */}
        {(timeScale === 'week' || timeScale === 'day' || timeScale === 'month') && onJumpToDate && (
          <IconButton
            size="small"
            onClick={handleDateJumpClick}
            sx={{
              height: 28,
              width: 28,
              ml: 0.5,
              color: dateJumpOpen ? 'primary.main' : 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }
            }}
            title="日付ジャンプ"
          >
            <EventIcon fontSize="small" />
          </IconButton>
        )}

        {/* Legend */}
        <Box sx={{ ml: 2 }}>
          <Legend viewMode={viewMode} />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* AI Assistant */}
        <IconButton
          size="small"
          onClick={onAIAssistantToggle}
          sx={{
            backgroundColor: isAIAssistantOpen ? '#333333' : 'transparent',
            color: isAIAssistantOpen ? '#ffffff' : 'inherit',
            '&:hover': {
              backgroundColor: '#333333',
              color: '#ffffff'
            },
            width: 28,
            height: 28
          }}
        >
          <ChatIcon fontSize="small" />
        </IconButton>

        {/* Settings Menu */}
        <IconButton
          size="small"
          onClick={() => setDrawerOpen(true)}
          sx={{ width: 28, height: 28 }}
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 320 },
            maxWidth: '90vw',
          }
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              設定
            </Typography>
            <IconButton 
              onClick={() => setDrawerOpen(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* View Mode */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                表示モード
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={viewMode === 'cost'}
                    onChange={onViewModeChange}
                    color="primary"
                  />
                }
                label="コスト"
              />
            </Box>

            {/* Hierarchy Filters */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                階層フィルター
              </Typography>
              
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel>レベル1</InputLabel>
                <Select
                  value={level1Filter}
                  label="レベル1"
                  onChange={onLevel1FilterChange}
                >
                  <MenuItem value="all">すべて</MenuItem>
                  {hierarchyFilterTree && Object.keys(hierarchyFilterTree.children).map(name => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small" sx={{ mb: 1 }} disabled={level1Filter === 'all'}>
                <InputLabel>レベル2</InputLabel>
                <Select
                  value={level2Filter}
                  label="レベル2"
                  onChange={onLevel2FilterChange}
                >
                  <MenuItem value="all">すべて</MenuItem>
                  {level2Options.map(name => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small" disabled={level2Filter === 'all'}>
                <InputLabel>レベル3</InputLabel>
                <Select
                  value={level3Filter}
                  label="レベル3"
                  onChange={onLevel3FilterChange}
                >
                  <MenuItem value="all">すべて</MenuItem>
                  {level3Options.map(name => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Divider sx={{ my: 2 }} />
            
            {/* Display Settings */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                列表示設定
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showBomCode}
                    onChange={(e) => onShowBomCodeChange(e.target.checked)}
                  />
                }
                label="TAG No."
                sx={{ display: 'flex' }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />
            
            {/* Operations */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                年度操作
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { 
                    setDrawerOpen(false);
                    setTimeout(() => onAddYear(), 100);
                  }}
                  sx={{ flex: 1 }}
                >
                  年度追加
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { 
                    setDrawerOpen(false);
                    setTimeout(() => onDeleteYear(), 100);
                  }}
                  sx={{ flex: 1 }}
                >
                  年度削除
                </Button>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                データ操作
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { onExportData(); setDrawerOpen(false); }}
                  startIcon={<DataIcon />}
                >
                  データエクスポート
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { onImportData(); setDrawerOpen(false); }}
                  startIcon={<DataIcon />}
                >
                  データインポート
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { onResetData(); setDrawerOpen(false); }}
                  color="error"
                  startIcon={<SettingsIcon />}
                >
                  データ初期化
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Date Jump Dialog */}
      <DateJumpDialog
        open={dateJumpOpen}
        anchorEl={dateJumpAnchorEl}
        onClose={handleDateJumpClose}
        timeScale={timeScale}
        currentYear={currentYear || new Date().getFullYear()}
        onJumpToDate={handleJumpToDate}
      />
    </>
  );
};

// Keep the original ModernHeader as a minimal component for backward compatibility
const ModernHeader: React.FC<ModernHeaderProps> = (props) => {
  return (
    <Box sx={{ minHeight: 0 }}>
      <IntegratedToolbar {...props} />
    </Box>
  );
};

export default ModernHeader;