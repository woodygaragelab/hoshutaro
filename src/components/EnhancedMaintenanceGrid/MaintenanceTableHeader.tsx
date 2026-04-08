import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Box, Typography, Popover, TextField, IconButton, Select, MenuItem, InputLabel, FormControl, Checkbox, FormGroup, FormControlLabel, List, ListItem, Divider, Tabs, Tab } from '@mui/material';
import { DragIndicator as DragIcon, FilterList as FilterIcon, Search as SearchIcon } from '@mui/icons-material';
import { GridColumn, GridState } from './types';
import { useHorizontalVirtualScrolling } from '../VirtualScrolling/useHorizontalVirtualScrolling';

interface MaintenanceTableHeaderProps {
  columns: GridColumn[];
  gridState: GridState;
  onColumnResize: (columnId: string, width: number) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onDragStateChange?: (draggedIndex: number | null, dragOverIndex: number | null) => void;
  enableVirtualScrolling?: boolean;
  containerWidth?: number;
  scrollLeft?: number;
  
  // Filter props
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  level1Filter?: string;
  level2Filter?: string;
  level3Filter?: string;
  onLevel1FilterChange?: (event: any) => void;
  onLevel2FilterChange?: (event: any) => void;
  onLevel3FilterChange?: (event: any) => void;
  hierarchyFilterTree?: any;
  level2Options?: string[];
  level3Options?: string[];
  uniqueTasks?: string[];
  selectedTasks?: string[];
  onSelectedTasksChange?: (tasks: string[]) => void;
  uniqueBomCodes?: string[];
  selectedBomCodes?: string[];
  onSelectedBomCodesChange?: (bomCodes: string[]) => void;
  isTaskBasedMode?: boolean;
  
  // Classification Filter props
  assetClassification?: any;
  workOrderClassifications?: any[];
  classificationFilter?: { [levelKey: string]: string };
  onClassificationFilterChange?: (filter: { [levelKey: string]: string }) => void;
  woClassificationFilter?: string;
  onWoClassificationFilterChange?: (classificationId: string) => void;
  assets?: any[];
}

const MaintenanceTableHeaderComponent: React.FC<MaintenanceTableHeaderProps> = ({
  columns,
  gridState,
  onColumnResize,
  onColumnReorder,
  onDragStateChange,
  enableVirtualScrolling = false,
  containerWidth = 1920,
  scrollLeft = 0,
  searchTerm = '',
  onSearchChange,
  level1Filter = 'all',
  level2Filter = 'all',
  level3Filter = 'all',
  onLevel1FilterChange,
  onLevel2FilterChange,
  onLevel3FilterChange,
  hierarchyFilterTree,
  level2Options = [],
  level3Options = [],
  uniqueTasks = [],
  selectedTasks = [],
  onSelectedTasksChange,
  uniqueBomCodes = [],
  selectedBomCodes = [],
  onSelectedBomCodesChange,
  isTaskBasedMode = false,
  assetClassification,
  workOrderClassifications = [],
  classificationFilter = {},
  onClassificationFilterChange,
  woClassificationFilter = 'all',
  onWoClassificationFilterChange,
  assets = [],
}) => {
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [filterTab, setFilterTab] = useState<number>(0);
  
  // Filter popover state
  const [filterAnchorEl, setFilterAnchorEl] = useState<{ [columnId: string]: HTMLElement | null }>({});
  const taskButtonRef = useRef<HTMLButtonElement | null>(null);
  const bomCodeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>, columnId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const btnRef = columnId === 'task' ? taskButtonRef.current : columnId === 'bomCode' ? bomCodeButtonRef.current : event.currentTarget;
    setFilterAnchorEl(prev => ({ ...prev, [columnId]: btnRef || event.currentTarget }));
  };

  const handleFilterClose = (columnId: string) => {
    setFilterAnchorEl(prev => ({ ...prev, [columnId]: null }));
  };

  const handleTaskToggle = (task: string) => {
    if (!onSelectedTasksChange) return;
    const currentIndex = selectedTasks.indexOf(task);
    const newSelected = [...selectedTasks];
    if (currentIndex === -1) {
      newSelected.push(task);
    } else {
      newSelected.splice(currentIndex, 1);
    }
    onSelectedTasksChange(newSelected);
  };

  const handleBomCodeToggle = (bomCode: string) => {
    if (!onSelectedBomCodesChange) return;
    const currentIndex = selectedBomCodes.indexOf(bomCode);
    const newSelected = [...selectedBomCodes];
    if (currentIndex === -1) {
      newSelected.push(bomCode);
    } else {
      newSelected.splice(currentIndex, 1);
    }
    onSelectedBomCodesChange(newSelected);
  };

  // ドラッグ&ドロップの状態管理
  const [dragState, setDragState] = useState<{
    draggedIndex: number | null;
    dragOverIndex: number | null;
    isDragging: boolean;
  }>({
    draggedIndex: null,
    dragOverIndex: null,
    isDragging: false,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Calculate total width of all columns
  const totalColumnsWidth = columns.reduce((sum, col) => {
    return sum + (gridState.columnWidths[col.id] || col.width);
  }, 0);

  // Horizontal virtual scrolling
  const shouldUseVirtualScrolling = enableVirtualScrolling && columns.length > 50;
  
  const virtualScrolling = useHorizontalVirtualScrolling({
    columns,
    columnWidth: (index) => gridState.columnWidths[columns[index].id] || columns[index].width,
    containerWidth,
    scrollLeft,
    overscan: 5,
    enableMemoization: true,
  });

  // Use virtual columns if enabled, otherwise use all columns
  const displayColumns = shouldUseVirtualScrolling ? 
    virtualScrolling.visibleColumns.map(vc => vc.data) : 
    columns;

  const handleMouseDown = useCallback((e: React.MouseEvent, columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.resizable) return;

    e.preventDefault();
    setResizing({
      columnId,
      startX: e.clientX,
      startWidth: gridState.columnWidths[columnId] || column.width
    });
  }, [columns, gridState.columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;

    const deltaX = e.clientX - resizing.startX;
    const newWidth = Math.max(
      columns.find(col => col.id === resizing.columnId)?.minWidth || 50,
      resizing.startWidth + deltaX
    );

    onColumnResize(resizing.columnId, newWidth);
  }, [resizing, columns, onColumnResize]);

  const handleMouseUp = useCallback(() => {
    setResizing(null);
  }, []);

  // 列の並び替え処理
  const handleColumnReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !onColumnReorder) return;
    
    // 機器仕様列のみ並び替え可能
    const specColumns = columns.filter(col => col.id.startsWith('spec_'));
    const fromCol = columns[fromIndex];
    const toCol = columns[toIndex];
    
    if (!fromCol?.id.startsWith('spec_') || !toCol?.id.startsWith('spec_')) {
      return; // 機器仕様列以外は並び替え不可
    }
    
    // 機器仕様列内でのインデックスを計算
    const specFromIndex = specColumns.findIndex(col => col.id === fromCol.id);
    const specToIndex = specColumns.findIndex(col => col.id === toCol.id);
    
    if (specFromIndex !== -1 && specToIndex !== -1) {
      onColumnReorder(specFromIndex, specToIndex);
    }
  }, [columns, onColumnReorder]);

  // 長押し開始
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    const column = columns[index];
    
    // 機器仕様列のみドラッグ可能
    if (!column?.id.startsWith('spec_')) return;
    
    // リサイズハンドルをクリックした場合はドラッグしない
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      const newDragState = {
        draggedIndex: index,
        dragOverIndex: null,
        isDragging: true,
      };
      setDragState(newDragState);
      if (onDragStateChange) {
        onDragStateChange(index, null);
      }
    }, 500);
  }, [columns, onDragStateChange]);

  // マウス移動（ドラッグ中）
  const handleHeaderMouseMove = useCallback((e: React.MouseEvent, index: number) => {
    if (!dragState.isDragging) {
      // 長押し判定中に移動したらキャンセル
      if (longPressTimerRef.current && dragStartPosRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    const column = columns[index];
    // 機器仕様列のみドロップ可能
    if (!column?.id.startsWith('spec_')) return;

    if (dragState.draggedIndex !== null && index !== dragState.dragOverIndex) {
      setDragState(prev => ({
        ...prev,
        dragOverIndex: index,
      }));
      if (onDragStateChange) {
        onDragStateChange(dragState.draggedIndex, index);
      }
    }
  }, [dragState, columns, onDragStateChange]);

  // マウスアップ（ドロップ）
  const handleHeaderMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (dragState.isDragging && dragState.draggedIndex !== null && dragState.dragOverIndex !== null) {
      handleColumnReorder(dragState.draggedIndex, dragState.dragOverIndex);
    }

    setDragState({
      draggedIndex: null,
      dragOverIndex: null,
      isDragging: false,
    });
    dragStartPosRef.current = null;
    
    if (onDragStateChange) {
      onDragStateChange(null, null);
    }
  }, [dragState, handleColumnReorder, onDragStateChange]);

  // マウスリーブ（ドラッグキャンセル）
  const handleHeaderMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // グローバルマウスイベントリスナー（ドラッグ中）
  useEffect(() => {
    if (dragState.isDragging) {
      const handleGlobalMouseUp = () => {
        handleHeaderMouseUp();
      };
      
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragState.isDragging, handleHeaderMouseUp]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Add global mouse event listeners for resizing
  React.useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  // Debug: Force visibility for troubleshooting
  if (columns.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex !important',
          borderBottom: '2px solid red',
          backgroundColor: '#ff0000',
          height: 40,
          alignItems: 'center',
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          justifyContent: 'center'
        }}
      >
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
          ヘッダー: 列がありません
        </Typography>
      </Box>
    );
  }

  // Calculate offset for virtual scrolling
  const virtualOffset = shouldUseVirtualScrolling && virtualScrolling.visibleColumns.length > 0 ?
    virtualScrolling.visibleColumns[0].left : 0;

  return (
    <Box
      sx={{
        display: 'flex !important',
        backgroundColor: '#2a2a2a',
        height: '40px !important',
        minHeight: '40px !important',
        alignItems: 'center',
        width: shouldUseVirtualScrolling ? `${virtualScrolling.totalWidth}px` : `${totalColumnsWidth}px`,
        minWidth: shouldUseVirtualScrolling ? `${virtualScrolling.totalWidth}px` : `${totalColumnsWidth}px`,
        overflow: 'visible',
        flexShrink: 0,
        position: 'relative',
        top: 0,
        zIndex: 100,
        visibility: 'visible !important',
        boxSizing: 'border-box'
      }}
      style={{
        borderBottom: '1px solid #333333'
      }}
    >

      {shouldUseVirtualScrolling && virtualOffset > 0 && (
        <Box sx={{ width: virtualOffset, flexShrink: 0 }} />
      )}
      {displayColumns.map((column, displayIndex) => {
        const actualIndex = shouldUseVirtualScrolling ? 
          columns.findIndex(c => c.id === column.id) : 
          displayIndex;
        const width = gridState.columnWidths[column.id] || column.width;
        const isLastColumn = actualIndex === columns.length - 1;
        const isSpecColumn = column.id.startsWith('spec_');
        const isDragged = dragState.isDragging && dragState.draggedIndex === actualIndex;
        const isDragOver = dragState.isDragging && dragState.dragOverIndex === actualIndex;
        
        return (
          <Box
            key={column.id}
            sx={{
              width,
              minWidth: width,
              maxWidth: width,
              flexShrink: 0,
              display: 'flex !important',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              position: 'relative',
              backgroundColor: '#2a2a2a',
              userSelect: 'none',
              overflow: 'hidden',
              height: '100%',
              boxSizing: 'border-box',
              cursor: isSpecColumn && !resizing ? 'grab' : 'default',
              transform: isDragged ? 'translateY(-4px)' : 'translateY(0)',
              opacity: isDragged ? 0.5 : 1,
              transition: 'all 0.2s ease-in-out',
              boxShadow: isDragged ? '0 4px 8px rgba(0,0,0,0.3)' : 'none',
              borderLeft: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
              borderRight: isDragOver ? '2px solid rgba(255,255,255,0.5)' : 'none',
              outline: 'none',
              '&:focus': {
                outline: 'none',
              },
              '&:active': {
                cursor: isSpecColumn && dragState.isDragging ? 'grabbing' : 'default',
                outline: 'none',
              },
            }}
            style={{
              borderRight: isLastColumn ? 'none' : '1px solid #333333'
            }}
            onMouseDown={(e) => handleHeaderMouseDown(e, actualIndex)}
            onMouseMove={(e) => handleHeaderMouseMove(e, actualIndex)}
            onMouseUp={handleHeaderMouseUp}
            onMouseLeave={handleHeaderMouseLeave}
          >
            {isSpecColumn && (
              <DragIcon 
                sx={{ 
                  mr: 0.5,
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.3)',
                }} 
              />
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0, justifyContent: 'center' }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center'
                }}
              >
                {column.header}
              </Typography>

              {/* Filter Tooltip Icons for task and bomCode */}
              {(column.id === 'task' || column.id === 'bomCode') && (
                <IconButton
                  ref={column.id === 'task' ? taskButtonRef : bomCodeButtonRef}
                  size="small"
                  className="filter-icon-button"
                  onMouseDown={(e) => handleFilterClick(e, column.id)}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  sx={{ 
                    ml: 0.5, 
                    p: 0.25, 
                    color: filterAnchorEl[column.id] || (column.id === 'task' && selectedTasks?.length) || (column.id === 'bomCode' && selectedBomCodes?.length) || searchTerm 
                      ? '#ffffff' 
                      : 'rgba(255, 255, 255, 0.5)',
                    '&:hover': { color: '#ffffff' }
                  }}
                >
                  <FilterIcon fontSize="inherit" sx={{ fontSize: '1rem', pointerEvents: 'none' }} />
                </IconButton>
              )}
            </Box>
            
            {/* Resize handle */}
            {column.resizable && (
              <Box
                data-resize-handle
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  cursor: 'col-resize',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    opacity: 0.3
                  }
                }}
                onMouseDown={(e) => handleMouseDown(e, column.id)}
              />
            )}
          </Box>
        );
      })}
      {shouldUseVirtualScrolling && (
        <Box sx={{ flexGrow: 1, flexShrink: 0 }} />
      )}

      {/* Task Filter Popover */}
      <Popover
        open={Boolean(filterAnchorEl['task'])}
        anchorEl={filterAnchorEl['task']}
        onClose={() => handleFilterClose('task')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { bgcolor: '#242424', color: 'white', border: '1px solid #333' } }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }
          }
        }}
      >
        <Box sx={{ p: 2, minWidth: 280, maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>テキスト検索</Typography>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ '& .MuiInputBase-root': { color: 'white', bgcolor: '#1e1e1e' } }}
          />

          {!isTaskBasedMode ? (
            <>
              <Divider sx={{ borderColor: '#333' }} />
              <Tabs
                value={filterTab}
                onChange={(_, v) => setFilterTab(v)}
                variant="fullWidth"
                sx={{ 
                  minHeight: 36, 
                  borderBottom: '1px solid #333',
                  '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', minHeight: 36, py: 0.5 },
                  '& .Mui-selected': { color: '#ffffff' },
                  '& .MuiTabs-indicator': { backgroundColor: '#ffffff' }
                }}
              >
                <Tab label="階層" />
                <Tab label="機器分類" />
              </Tabs>

              {filterTab === 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>階層フィルタ</Typography>
                  <Select
                    size="small"
                    value={level1Filter}
                    onChange={onLevel1FilterChange}
                    displayEmpty
                    MenuProps={{ slotProps: { backdrop: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } } } }}
                    sx={{ color: 'white', bgcolor: '#1e1e1e', '& .MuiSelect-icon': { color: 'white' } }}
                  >
                    <MenuItem value="all"><em>すべての機器分類</em></MenuItem>
                    {hierarchyFilterTree && hierarchyFilterTree.children && Object.keys(hierarchyFilterTree.children).map((l1) => (
                      <MenuItem key={l1} value={l1}>{l1}</MenuItem>
                    ))}
                  </Select>
                  
                  <Select
                    size="small"
                    value={level2Filter}
                    onChange={onLevel2FilterChange}
                    displayEmpty
                    disabled={level1Filter === 'all'}
                    MenuProps={{ slotProps: { backdrop: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } } } }}
                    sx={{ color: 'white', bgcolor: '#1e1e1e', '& .MuiSelect-icon': { color: 'white' } }}
                  >
                    <MenuItem value="all"><em>すべての大分類</em></MenuItem>
                    {level2Options.map((l2) => (
                      <MenuItem key={l2} value={l2}>{l2}</MenuItem>
                    ))}
                  </Select>
                  
                  <Select
                    size="small"
                    value={level3Filter}
                    onChange={onLevel3FilterChange}
                    displayEmpty
                    disabled={level1Filter === 'all' || level2Filter === 'all'}
                    MenuProps={{ slotProps: { backdrop: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } } } }}
                    sx={{ color: 'white', bgcolor: '#1e1e1e', '& .MuiSelect-icon': { color: 'white' } }}
                  >
                    <MenuItem value="all"><em>すべての詳細分類</em></MenuItem>
                    {level3Options.map((l3) => (
                      <MenuItem key={l3} value={l3}>{l3}</MenuItem>
                    ))}
                  </Select>
                </>
              )}

              {filterTab === 1 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 1 }}>機器分類フィルタ</Typography>
                  {assetClassification && assetClassification.levels && assetClassification.levels.length > 0 ? (
                    assetClassification.levels
                      .slice()
                      .map((level: any, idx: number, sortedLevels: any[]) => {
                        const parentSelected = idx === 0 || sortedLevels.slice(0, idx).every(
                          parentLevel => classificationFilter[parentLevel.key] && classificationFilter[parentLevel.key] !== ''
                        );
                        const currentValue = classificationFilter[level.key] || 'all';
                        
                        // Extract string values, handling both old string array format and new object array {value, parentValue} format
                        let availableValues = (level.values || []).map((v: any) => typeof v === 'string' ? v : v.value);
                        
                        if (idx > 0) {
                          const matchingAssets = assets.filter(asset => {
                            if (!asset.classificationPath) return false;
                            return sortedLevels.slice(0, idx).every(parentLevel => {
                              const parentVal = classificationFilter[parentLevel.key];
                              if (!parentVal || parentVal === 'all') return true;
                              return asset.classificationPath[parentLevel.key] === parentVal;
                            });
                          });
                          const validSet = new Set<string>();
                          matchingAssets.forEach(asset => {
                            if (asset.classificationPath[level.key]) {
                              validSet.add(asset.classificationPath[level.key]);
                            }
                          });
                          availableValues = availableValues.filter((v: string) => validSet.has(v));
                        }
                        
                        return (
                          <Select
                            key={level.key}
                            size="small"
                            value={currentValue}
                            onChange={(e) => {
                              if (!onClassificationFilterChange) return;
                              const newFilter = { ...classificationFilter };
                              const val = e.target.value as string;
                              if (val === 'all') {
                                delete newFilter[level.key];
                                sortedLevels.slice(idx + 1).forEach(child => delete newFilter[child.key]);
                              } else {
                                newFilter[level.key] = val;
                                sortedLevels.slice(idx + 1).forEach(child => delete newFilter[child.key]);
                              }
                              onClassificationFilterChange(newFilter);
                            }}
                            displayEmpty
                            disabled={!parentSelected}
                            MenuProps={{ slotProps: { backdrop: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } } } }}
                            sx={{ color: 'white', bgcolor: '#1e1e1e', '& .MuiSelect-icon': { color: 'white' } }}
                          >
                            <MenuItem value="all"><em>すべての{level.key}</em></MenuItem>
                            {availableValues.map((v: string) => (
                              <MenuItem key={v} value={v}>{v}</MenuItem>
                            ))}
                          </Select>
                        );
                      })
                  ) : (
                    <Typography variant="body2" sx={{ color: '#888' }}>機器分類が定義されていません。</Typography>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Divider sx={{ borderColor: '#333' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>作業分類フィルタ</Typography>
              <Select
                size="small"
                value={woClassificationFilter}
                onChange={(e) => onWoClassificationFilterChange?.(e.target.value as string)}
                displayEmpty
                MenuProps={{ slotProps: { backdrop: { sx: { backgroundColor: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } } } }}
                sx={{ color: 'white', bgcolor: '#1e1e1e', '& .MuiSelect-icon': { color: 'white' } }}
              >
                <MenuItem value="all"><em>すべての作業分類</em></MenuItem>
                {workOrderClassifications.map(wc => (
                  <MenuItem key={wc.id} value={wc.id}>{wc.id} - {wc.name}</MenuItem>
                ))}
              </Select>
            </>
          )}

          <Divider sx={{ borderColor: '#333' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>リスト選択フィルタ</Typography>
          <List
            dense
            sx={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              maxHeight: 200, 
              bgcolor: '#1e1e1e', 
              border: '1px solid #333',
              borderRadius: 1
            }}
          >
            {uniqueTasks.length === 0 && (
               <ListItem><Typography variant="body2" sx={{ color: '#888' }}>データがありません</Typography></ListItem>
            )}
            {uniqueTasks.map((taskStr) => (
              <ListItem key={taskStr} sx={{ p: 0 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedTasks.indexOf(taskStr) !== -1}
                      onChange={() => handleTaskToggle(taskStr)}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#ffffff' } }}
                    />
                  }
                  label={<Typography variant="body2">{taskStr}</Typography>}
                  sx={{ width: '100%', m: 0, pl: 1 }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>

      {/* BomCode Filter Popover */}
      <Popover
        open={Boolean(filterAnchorEl['bomCode'])}
        anchorEl={filterAnchorEl['bomCode']}
        onClose={() => handleFilterClose('bomCode')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { bgcolor: '#242424', color: 'white', border: '1px solid #333' } }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }
          }
        }}
      >
        <Box sx={{ p: 2, minWidth: 280, maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 500 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>テキスト検索</Typography>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ '& .MuiInputBase-root': { color: 'white', bgcolor: '#1e1e1e' } }}
          />

          <Divider sx={{ borderColor: '#333' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>リスト選択フィルタ</Typography>
          <List
            dense
            sx={{ 
              flexGrow: 1, 
              overflowY: 'auto', 
              maxHeight: 250, 
              bgcolor: '#1e1e1e', 
              border: '1px solid #333',
              borderRadius: 1
            }}
          >
            {uniqueBomCodes.length === 0 && (
               <ListItem><Typography variant="body2" sx={{ color: '#888' }}>データがありません</Typography></ListItem>
            )}
            {uniqueBomCodes.map((bomCodeStr) => (
              <ListItem key={bomCodeStr} sx={{ p: 0 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedBomCodes.indexOf(bomCodeStr) !== -1}
                      onChange={() => handleBomCodeToggle(bomCodeStr)}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#ffffff' } }}
                    />
                  }
                  label={<Typography variant="body2">{bomCodeStr}</Typography>}
                  sx={{ width: '100%', m: 0, pl: 1 }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>

    </Box>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MaintenanceTableHeader = React.memo(MaintenanceTableHeaderComponent);

export default MaintenanceTableHeader;
