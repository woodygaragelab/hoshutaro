import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Menu,
  IconButton,
  Box,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as ViewIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  DateRange as DateRangeIcon,
  Storage as DataIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import './ModernHeader.css';

interface ResponsiveLayout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  getSpacing: (size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => number;
  shouldStackElements: () => boolean;
  shouldHideSecondaryActions: () => boolean;
}

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
  showCycle: boolean;
  onShowBomCodeChange: (checked: boolean) => void;
  onShowCycleChange: (checked: boolean) => void;
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
  
  // Responsive layout
  responsive?: ResponsiveLayout;
}

const ModernHeader: React.FC<ModernHeaderProps> = ({
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
  showCycle,
  onShowBomCodeChange,
  onShowCycleChange,
  displayMode,
  onDisplayModeChange,
  onAddYear,
  onDeleteYear,
  onExportData,
  onImportData,
  onResetData,
  onAIAssistantToggle,
  isAIAssistantOpen,
  responsive,
}) => {
  const theme = useTheme();
  const isMobile = responsive?.isMobile ?? useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = responsive?.isTablet ?? useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const shouldHideSecondaryActions = responsive?.shouldHideSecondaryActions() ?? false;
  
  // Menu states
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [displayMenuAnchor, setDisplayMenuAnchor] = useState<null | HTMLElement>(null);
  const [yearMenuAnchor, setYearMenuAnchor] = useState<null | HTMLElement>(null);
  const [dataMenuAnchor, setDataMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) => {
    setter(event.currentTarget);
  };

  const handleMenuClose = (setter: React.Dispatch<React.SetStateAction<HTMLElement | null>>) => {
    setter(null);
  };

  const renderDesktopControls = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {/* Search */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon color="action" />
        <TextField
          placeholder="機器を検索..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Box>

      {/* Filter Button */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<FilterIcon />}
        onClick={(e) => handleMenuOpen(e, setFilterMenuAnchor)}
      >
        フィルター
      </Button>

      {/* View Mode Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ViewIcon color="action" />
        <FormControlLabel
          control={
            <Switch
              checked={viewMode === 'cost'}
              onChange={onViewModeChange}
              color="primary"
            />
          }
          label={viewMode === 'cost' ? 'コスト' : '星取'}
        />
      </Box>

      {/* Display Mode */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>表示モード</InputLabel>
          <Select
            value={displayMode}
            label="表示モード"
            onChange={(e) => onDisplayModeChange(e.target.value as 'specifications' | 'maintenance' | 'both')}
          >
            <MenuItem value="specifications">機器仕様</MenuItem>
            <MenuItem value="maintenance">計画実績</MenuItem>
            <MenuItem value="both">両方</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Time Scale */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScheduleIcon color="action" />
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>スケール</InputLabel>
          <Select
            value={timeScale}
            label="スケール"
            onChange={onTimeScaleChange}
          >
            <MenuItem value="year">年</MenuItem>
            <MenuItem value="month">月</MenuItem>
            <MenuItem value="week">週</MenuItem>
            <MenuItem value="day">日</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Settings Menu */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<SettingsIcon />}
        onClick={(e) => handleMenuOpen(e, setDisplayMenuAnchor)}
      >
        表示設定
      </Button>

      {/* Year Operations */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<DateRangeIcon />}
        onClick={(e) => handleMenuOpen(e, setYearMenuAnchor)}
        disabled={timeScale !== 'year'}
      >
        年度操作
      </Button>

      {/* Data Operations */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<DataIcon />}
        onClick={(e) => handleMenuOpen(e, setDataMenuAnchor)}
      >
        データ操作
      </Button>

      {/* AI Assistant */}
      <Button
        variant={isAIAssistantOpen ? "contained" : "outlined"}
        size="small"
        startIcon={<ChatIcon />}
        onClick={onAIAssistantToggle}
        sx={{
          backgroundColor: isAIAssistantOpen ? '#333333' : 'transparent',
          borderColor: '#ffffff',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: isAIAssistantOpen ? '#555555' : '#333333',
          },
        }}
      >
        AIアシスタント
      </Button>
    </Box>
  );

  const renderMobileControls = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        placeholder="検索..."
        variant="outlined"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ flexGrow: 1 }}
      />
      <IconButton
        color="inherit"
        onClick={onAIAssistantToggle}
        sx={{
          backgroundColor: isAIAssistantOpen ? '#333333' : 'transparent',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
          },
        }}
      >
        <ChatIcon />
      </IconButton>
      <IconButton
        color="inherit"
        onClick={() => setMobileDrawerOpen(true)}
      >
        <MenuIcon />
      </IconButton>
    </Box>
  );

  const renderMobileDrawer = () => (
    <Drawer
      anchor="right"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
    >
      <Box sx={{ width: 300, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          コントロール
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        {/* View Mode */}
        <FormControlLabel
          control={
            <Switch
              checked={viewMode === 'cost'}
              onChange={onViewModeChange}
              color="primary"
            />
          }
          label={viewMode === 'cost' ? 'コスト表示' : '星取表示'}
          sx={{ mb: 2 }}
        />
        
        {/* Time Scale */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>時間スケール</InputLabel>
          <Select
            value={timeScale}
            label="時間スケール"
            onChange={onTimeScaleChange}
          >
            <MenuItem value="year">年</MenuItem>
            <MenuItem value="month">月</MenuItem>
            <MenuItem value="week">週</MenuItem>
            <MenuItem value="day">日</MenuItem>
          </Select>
        </FormControl>

        {/* Display Mode */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>表示モード</InputLabel>
          <Select
            value={displayMode}
            label="表示モード"
            onChange={(e) => onDisplayModeChange(e.target.value as 'specifications' | 'maintenance' | 'both')}
          >
            <MenuItem value="specifications">機器仕様</MenuItem>
            <MenuItem value="maintenance">計画実績</MenuItem>
            <MenuItem value="both">両方</MenuItem>
          </Select>
        </FormControl>

        {/* Hierarchy Filters */}
        <Typography variant="subtitle2" gutterBottom>
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
        
        <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={level2Filter === 'all'}>
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

        <Divider sx={{ my: 2 }} />
        
        {/* Display Settings */}
        <Typography variant="subtitle2" gutterBottom>
          表示設定
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showBomCode}
              onChange={(e) => onShowBomCodeChange(e.target.checked)}
            />
          }
          label="TAG No."
          sx={{ mb: 1 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showCycle}
              onChange={(e) => onShowCycleChange(e.target.checked)}
            />
          }
          label="周期"
          sx={{ mb: 2 }}
        />

        <Divider sx={{ my: 2 }} />
        
        {/* Operations */}
        <List>
          <ListItem 
            component="button" 
            onClick={onAddYear} 
            disabled={timeScale !== 'year'}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
          >
            <ListItemText primary="年度追加" />
          </ListItem>
          <ListItem 
            component="button" 
            onClick={onDeleteYear} 
            disabled={timeScale !== 'year'}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
          >
            <ListItemText primary="年度削除" />
          </ListItem>
          <Divider />
          <ListItem 
            component="button" 
            onClick={onExportData}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
          >
            <ListItemText primary="データエクスポート" />
          </ListItem>
          <ListItem 
            component="button" 
            onClick={onImportData}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
          >
            <ListItemText primary="データインポート" />
          </ListItem>
          <ListItem 
            component="button" 
            onClick={onResetData}
            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
          >
            <ListItemText primary="データ初期化" />
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );

  return (
    <>
      <AppBar position="static" className="modern-header" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            星取表
          </Typography>
          
          <Box sx={{ flexGrow: 1 }}>
            {isMobile ? renderMobileControls() : renderDesktopControls()}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => handleMenuClose(setFilterMenuAnchor)}
        PaperProps={{ sx: { minWidth: 300 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            階層フィルター
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>階層レベル1</InputLabel>
            <Select
              value={level1Filter}
              label="階層レベル1"
              onChange={onLevel1FilterChange}
            >
              <MenuItem value="all">すべて</MenuItem>
              {hierarchyFilterTree && Object.keys(hierarchyFilterTree.children).map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth size="small" sx={{ mb: 1 }} disabled={level1Filter === 'all'}>
            <InputLabel>階層レベル2</InputLabel>
            <Select
              value={level2Filter}
              label="階層レベル2"
              onChange={onLevel2FilterChange}
            >
              <MenuItem value="all">すべて</MenuItem>
              {level2Options.map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth size="small" disabled={level2Filter === 'all'}>
            <InputLabel>階層レベル3</InputLabel>
            <Select
              value={level3Filter}
              label="階層レベル3"
              onChange={onLevel3FilterChange}
            >
              <MenuItem value="all">すべて</MenuItem>
              {level3Options.map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Menu>

      {/* Display Settings Menu */}
      <Menu
        anchorEl={displayMenuAnchor}
        open={Boolean(displayMenuAnchor)}
        onClose={() => handleMenuClose(setDisplayMenuAnchor)}
        PaperProps={{ sx: { minWidth: 250 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            表示モード
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>モード</InputLabel>
            <Select
              value={displayMode}
              label="モード"
              onChange={(e) => onDisplayModeChange(e.target.value as 'specifications' | 'maintenance' | 'both')}
            >
              <MenuItem value="specifications">機器仕様</MenuItem>
              <MenuItem value="maintenance">計画実績</MenuItem>
              <MenuItem value="both">両方</MenuItem>
            </Select>
          </FormControl>
          
          <Typography variant="subtitle2" gutterBottom>
            列表示設定
          </Typography>
        </Box>
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={showBomCode}
                onChange={(e) => onShowBomCodeChange(e.target.checked)}
              />
            }
            label="TAG No."
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={showCycle}
                onChange={(e) => onShowCycleChange(e.target.checked)}
              />
            }
            label="周期"
          />
        </MenuItem>
      </Menu>

      {/* Year Operations Menu */}
      <Menu
        anchorEl={yearMenuAnchor}
        open={Boolean(yearMenuAnchor)}
        onClose={() => handleMenuClose(setYearMenuAnchor)}
      >
        <MenuItem onClick={() => { onAddYear(); handleMenuClose(setYearMenuAnchor); }}>
          年度追加
        </MenuItem>
        <MenuItem onClick={() => { onDeleteYear(); handleMenuClose(setYearMenuAnchor); }}>
          年度削除
        </MenuItem>
      </Menu>

      {/* Data Operations Menu */}
      <Menu
        anchorEl={dataMenuAnchor}
        open={Boolean(dataMenuAnchor)}
        onClose={() => handleMenuClose(setDataMenuAnchor)}
      >
        <MenuItem onClick={() => { onExportData(); handleMenuClose(setDataMenuAnchor); }}>
          エクスポート (JSON)
        </MenuItem>
        <MenuItem onClick={() => { onImportData(); handleMenuClose(setDataMenuAnchor); }}>
          インポート (JSON)
        </MenuItem>
        <MenuItem divider />
        <MenuItem 
          onClick={() => { onResetData(); handleMenuClose(setDataMenuAnchor); }}
          sx={{ color: 'error.main' }}
        >
          データを初期化
        </MenuItem>
      </Menu>

      {renderMobileDrawer()}
    </>
  );
};

export default ModernHeader;