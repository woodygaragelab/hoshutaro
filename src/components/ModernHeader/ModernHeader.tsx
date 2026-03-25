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
  Popover,
} from '@mui/material';
import {
  Search as SearchIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Storage as DataIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  Event as EventIcon,
  ViewList as EquipmentIcon,
  Assignment as TaskIcon,
  AccountTree as HierarchyIcon,
  SwapHoriz as ReassignIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { MonthCalendar } from '@mui/x-date-pickers/MonthCalendar';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ja';

dayjs.extend(weekOfYear);
import Legend from '../EnhancedMaintenanceGrid/Legend';
import { ViewMode, HierarchyDefinition, Asset } from '../../types/maintenanceTask';
import HierarchyEditDialog from '../HierarchyEditDialog/HierarchyEditDialog';
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
  
  // Data view mode (equipment-based vs task-based)
  // Requirements 6.1, 6.2, 6.5
  dataViewMode?: ViewMode;
  onDataViewModeChange?: (mode: ViewMode) => void;
  
  // Edit scope (single-asset vs all-assets)
  // Requirements 4.8, 5.7: User-controllable edit scope
  editScope?: 'single-asset' | 'all-assets';
  onEditScopeChange?: (scope: 'single-asset' | 'all-assets') => void;
  
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
  
  // Hierarchy management - Requirements 3.1, 3.2
  hierarchy?: HierarchyDefinition;
  assets?: Asset[];
  selectedAssets?: string[]; // Asset IDs
  onAssetSelectionChange?: (assetIds: string[]) => void;
  onHierarchyEdit?: (hierarchy: HierarchyDefinition) => void;
  onOpenAssetReassignDialog?: () => void;
  
  // Undo/Redo - Requirements 8.1, 8.2, 8.3
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
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
  dataViewMode = 'asset-based',
  onDataViewModeChange,
  editScope = 'single-asset',
  onEditScopeChange,
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
  hierarchy,
  assets = [],
  selectedAssets = [],
  onAssetSelectionChange,
  onHierarchyEdit,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateJumpAnchorEl, setDateJumpAnchorEl] = useState<HTMLElement | null>(null);
  const [hierarchyEditOpen, setHierarchyEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [calendarView, setCalendarView] = useState<'year' | 'month' | 'day'>('day');

  const handleDateJumpClick = (event: React.MouseEvent<HTMLElement>) => {
    setSelectedDate(dayjs());
    // Set initial view based on timeScale
    if (timeScale === 'month') {
      setCalendarView('year'); // Start with year selection for month mode
    } else {
      setCalendarView('day'); // Start with day view for day/week mode
    }
    setDateJumpAnchorEl(event.currentTarget);
  };

  const handleDateJumpClose = () => {
    setDateJumpAnchorEl(null);
  };

  const handleMonthChange = (newDate: Dayjs | null) => {
    if (!newDate || !onJumpToDate) return;
    
    // Only jump when we're in month view (final selection)
    if (calendarView === 'month') {
      const year = newDate.year();
      const month = newDate.month() + 1;
      
      onJumpToDate(year, month);
      handleDateJumpClose();
    } else {
      // Just update the selected date for year selection
      setSelectedDate(newDate);
    }
  };

  const handleDateChange = (newDate: Dayjs | null) => {
    if (!newDate || !onJumpToDate) return;

    const year = newDate.year();
    const month = newDate.month() + 1;
    const day = newDate.date();

    // For day and week mode, only jump when day view is active
    if (calendarView === 'day') {
      if (timeScale === 'week') {
        // Calculate week number for week mode
        const week = newDate.week();
        onJumpToDate(year, month, week, day);
      } else if (timeScale === 'day') {
        onJumpToDate(year, month, undefined, day);
      }
      handleDateJumpClose();
    } else {
      // Just update the selected date for navigation
      setSelectedDate(newDate);
    }
  };

  const handleViewChange = (newView: 'year' | 'month' | 'day') => {
    setCalendarView(newView);
  };

  // Hierarchy management handlers - Requirements 3.1, 3.2
  const handleOpenHierarchyEdit = () => {
    setDrawerOpen(false);
    setTimeout(() => setHierarchyEditOpen(true), 100);
  };

  const handleCloseHierarchyEdit = () => {
    setHierarchyEditOpen(false);
  };

  const handleSaveHierarchy = (newHierarchy: HierarchyDefinition) => {
    if (onHierarchyEdit) {
      onHierarchyEdit(newHierarchy);
    }
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

        {/* Data View Mode Toggle - Requirements 6.1, 6.2, 6.5 */}
        {onDataViewModeChange && (
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
              variant={dataViewMode === 'asset-based' ? 'contained' : 'outlined'}
              onClick={() => onDataViewModeChange('asset-based')}
              startIcon={<EquipmentIcon sx={{ fontSize: '0.875rem !important' }} />}
              sx={{ 
                fontSize: '0.75rem', 
                minWidth: 80,
                height: 28,
                px: 1,
                borderColor: '#333333 !important',
                '&:hover': {
                  borderColor: '#ffffff !important'
                }
              }}
              title="機器ベース表示: 機器を階層別にグループ化して表示。各機器の複数作業を集約して表示します。"
            >
              機器ベース
            </Button>
            <Button
              variant={dataViewMode === 'workorder-based' ? 'contained' : 'outlined'}
              onClick={() => onDataViewModeChange('workorder-based')}
              startIcon={<TaskIcon sx={{ fontSize: '0.875rem !important' }} />}
              sx={{ 
                fontSize: '0.75rem', 
                minWidth: 80,
                height: 28,
                px: 1,
                borderColor: '#333333 !important',
                '&:hover': {
                  borderColor: '#ffffff !important'
                }
              }}
              title="作業ベース表示: 作業分類別にグループ化して表示。各作業に関連する機器を表示します。"
            >
              作業ベース
            </Button>
          </ButtonGroup>
        )}



        {/* Display Mode Tabs - Only show in equipment-based mode */}
        {dataViewMode === 'asset-based' && (
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
        )}

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

        {/* Date Jump Icon - Show only for month/week/day modes */}
        {(timeScale === 'month' || timeScale === 'week' || timeScale === 'day') && onJumpToDate && (
          <IconButton
            size="small"
            onClick={handleDateJumpClick}
            sx={{
              height: 28,
              width: 28,
              ml: 0.5,
              color: dateJumpAnchorEl ? 'primary.main' : 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }
            }}
            title="日付ジャンプ"
          >
            <EventIcon fontSize="small" />
          </IconButton>
        )}

        {/* Legend - Requirements 6.5 */}
        <Box sx={{ ml: 2 }}>
          <Legend viewMode={viewMode} dataViewMode={dataViewMode} />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Undo/Redo Buttons - Requirements 8.1, 8.2, 8.3 */}
        {(onUndo || onRedo) && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
            <IconButton
              size="small"
              onClick={onUndo}
              disabled={!canUndo}
              sx={{
                width: 28,
                height: 28,
                color: canUndo ? 'inherit' : 'action.disabled',
                '&:hover': {
                  backgroundColor: canUndo ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }
              }}
              title="元に戻す (Ctrl+Z)"
            >
              <UndoIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={onRedo}
              disabled={!canRedo}
              sx={{
                width: 28,
                height: 28,
                color: canRedo ? 'inherit' : 'action.disabled',
                '&:hover': {
                  backgroundColor: canRedo ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }
              }}
              title="やり直す (Ctrl+Y)"
            >
              <RedoIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

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
            {/* Data View Mode Info - Requirements 6.5 */}
            {dataViewMode && (
              <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                  現在の表示モード
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  {dataViewMode === 'asset-based' 
                    ? '機器ベース: 機器を階層別にグループ化して表示しています。'
                    : '作業ベース: 作業を分類別にグループ化して表示しています。'}
                </Typography>
              </Box>
            )}

            {/* View Mode */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                データ表示モード
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

            {/* Hierarchy Filters - Requirements 6.5 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                {dataViewMode === 'workorder-based' ? '階層・作業分類フィルター' : '階層フィルター'}
              </Typography>
              
              {/* Show task classification filter in task-based mode */}
              {dataViewMode === 'workorder-based' && (
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>作業分類</InputLabel>
                  <Select
                    value="all"
                    label="作業分類"
                    onChange={() => {}}
                  >
                    <MenuItem value="all">すべて</MenuItem>
                    <MenuItem value="01">01 - 定期点検</MenuItem>
                    <MenuItem value="02">02 - 予防保全</MenuItem>
                    <MenuItem value="03">03 - 修理</MenuItem>
                    <MenuItem value="04">04 - 改造</MenuItem>
                  </Select>
                </FormControl>
              )}
              
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
            
            {/* Hierarchy Management - Requirements 3.1, 3.2 */}
            {onHierarchyEdit && hierarchy && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    階層管理
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {onHierarchyEdit && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleOpenHierarchyEdit}
                        startIcon={<HierarchyIcon />}
                      >
                        階層構造の編集
                      </Button>
                    )}
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
              </>
            )}
            
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

      {/* Date Jump Popover */}
      <Popover
        open={Boolean(dateJumpAnchorEl)}
        anchorEl={dateJumpAnchorEl}
        onClose={handleDateJumpClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {timeScale === 'month' ? '年月選択' : timeScale === 'week' ? '週選択（日付を選択）' : '日付選択'}
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
            {timeScale === 'month' ? (
              <DateCalendar
                value={selectedDate}
                onChange={handleMonthChange}
                views={['year', 'month']}
                openTo={calendarView === 'year' ? 'year' : 'month'}
                onViewChange={handleViewChange}
                sx={{
                  '& .MuiPickersCalendarHeader-root': {
                    paddingLeft: 1,
                    paddingRight: 1,
                  },
                }}
              />
            ) : (
              <DateCalendar
                value={selectedDate}
                onChange={handleDateChange}
                views={['year', 'month', 'day']}
                openTo="day"
                displayWeekNumber={timeScale === 'week'}
                showDaysOutsideCurrentMonth
                sx={{
                  '& .MuiPickersCalendarHeader-root': {
                    paddingLeft: 1,
                    paddingRight: 1,
                  },
                  ...(timeScale === 'week' && {
                    '& .MuiDayCalendar-weekContainer': {
                      '&:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                        cursor: 'pointer',
                      },
                    },
                    '& .MuiDayCalendar-weekNumber': {
                      color: 'primary.main',
                      fontWeight: 'bold',
                    },
                  }),
                }}
              />
            )}
          </LocalizationProvider>
        </Box>
      </Popover>

      {/* Hierarchy Edit Dialog - Requirements 3.1, 3.3, 3.4, 3.5, 3.8 */}
      {hierarchy && onHierarchyEdit && (
        <HierarchyEditDialog
          open={hierarchyEditOpen}
          hierarchy={hierarchy}
          assetCount={assets.length}
          onSave={handleSaveHierarchy}
          onClose={handleCloseHierarchyEdit}
        />
      )}

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