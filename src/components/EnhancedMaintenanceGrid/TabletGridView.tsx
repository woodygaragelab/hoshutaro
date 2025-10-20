import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Typography,
  useTheme,
  alpha,
  Tooltip,
  Collapse,
  Button,
  useMediaQuery,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AttachMoney as AttachMoneyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Circle as CircleIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Adjust as AdjustIcon,
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';
import { ResponsiveLayout } from '../ExcelLikeGrid/types';
import { detectDevice, getOptimalTouchTargetSize, getOptimalSpacing } from '../CommonEdit/deviceDetection';
import { useTouchGestureHandler, smoothScrollTo, ensureHorizontalScroll } from './touchGestureHandler';
import { 
  useScreenRotation, 
  getRotationAdjustedLayout, 
  RotationStateManager, 
  preserveScrollPosition,
  setRotationCSSVariables 
} from './screenRotationHandler';

interface TabletGridViewProps {
  data: HierarchicalData[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  showBomCode: boolean;
  showCycle: boolean;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  responsive: ResponsiveLayout;
  groupedData?: { [key: string]: HierarchicalData[] };
}

interface ExpandedState {
  [key: string]: boolean;
}

interface ColumnVisibility {
  [key: string]: boolean;
}

interface TabletOptimizedState {
  touchTargetSize: number;
  spacing: number;
  isLandscape: boolean;
  scrollPosition: { x: number; y: number };
  expandedState: ExpandedState;
  columnVisibilityState: ColumnVisibility;
}

const TabletGridView: React.FC<TabletGridViewProps> = ({
  data,
  timeHeaders,
  viewMode,
  showBomCode,
  showCycle,
  onCellEdit,
  onSpecificationEdit,
  responsive,
  groupedData
}) => {
  const theme = useTheme();
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const stateManager = RotationStateManager.getInstance();
  
  const [tabletState, setTabletState] = useState<TabletOptimizedState>(() => {
    const savedState = stateManager.restoreState('tabletGridState', {
      touchTargetSize: getOptimalTouchTargetSize('tablet'),
      spacing: getOptimalSpacing('tablet'),
      isLandscape,
      scrollPosition: { x: 0, y: 0 },
      expandedState: {},
      columnVisibilityState: {},
    });
    
    return {
      ...savedState,
      isLandscape, // 現在の向きで上書き
    };
  });

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    // Show more columns in landscape mode
    const maxVisibleColumns = isLandscape ? 8 : 5;
    const initialVisibility: ColumnVisibility = {};
    timeHeaders.forEach((header, index) => {
      initialVisibility[header] = index < maxVisibleColumns;
    });
    return initialVisibility;
  });

  const visibleTimeHeaders = useMemo(() => {
    return timeHeaders.filter(header => columnVisibility[header]);
  }, [timeHeaders, columnVisibility]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // 画面回転の監視
  const rotationState = useScreenRotation({
    onRotationStart: useCallback((newOrientation: 'portrait' | 'landscape') => {
      // 回転開始時に現在の状態を保存
      stateManager.saveState('tabletGridState', {
        ...tabletState,
        expandedState: expanded,
        columnVisibilityState: columnVisibility,
      });
      
      // スクロール位置を保存
      if (tableContainerRef.current) {
        preserveScrollPosition(tableContainerRef.current, tabletState.isLandscape ? 'landscape' : 'portrait');
      }
    }, [tabletState, expanded, columnVisibility, stateManager]),
    
    onRotationEnd: useCallback((newOrientation: 'portrait' | 'landscape') => {
      const newIsLandscape = newOrientation === 'landscape';
      
      // 列の表示/非表示を調整
      const maxVisibleColumns = newIsLandscape ? 8 : 5;
      const newColumnVisibility = { ...columnVisibility };
      timeHeaders.forEach((header, index) => {
        if (index >= maxVisibleColumns && newColumnVisibility[header]) {
          newColumnVisibility[header] = false;
        } else if (index < maxVisibleColumns && !newColumnVisibility[header] && index < timeHeaders.length) {
          newColumnVisibility[header] = true;
        }
      });

      setColumnVisibility(newColumnVisibility);
      setTabletState(prev => ({
        ...prev,
        isLandscape: newIsLandscape,
        touchTargetSize: newIsLandscape ? prev.touchTargetSize * 0.9 : prev.touchTargetSize * 1.1,
        spacing: newIsLandscape ? prev.spacing * 0.8 : prev.spacing * 1.2,
        columnVisibilityState: newColumnVisibility,
        expandedState: expanded,
      }));

      // CSS変数を更新
      setRotationCSSVariables(newOrientation);

      // スクロール位置を復元（少し遅延させる）
      setTimeout(() => {
        if (tableContainerRef.current) {
          const restoreScroll = preserveScrollPosition(tableContainerRef.current, newOrientation);
          restoreScroll();
        }
      }, 100);
    }, [columnVisibility, timeHeaders, tabletState.touchTargetSize, tabletState.spacing, expanded]),
    
    debounceMs: 150,
  });

  // タッチジェスチャーハンドラーの設定
  const touchGestureHandlers = useTouchGestureHandler({
    enablePinchZoom: false, // テーブルではピンチズームは無効
    enableMomentumScrolling: true,
    scrollSensitivity: 1.2,
    onScroll: useCallback((deltaX: number, deltaY: number, velocity: { x: number; y: number }) => {
      if (tableContainerRef.current) {
        const container = tableContainerRef.current;
        const newScrollLeft = Math.max(0, Math.min(
          container.scrollLeft + deltaX,
          container.scrollWidth - container.clientWidth
        ));
        const newScrollTop = Math.max(0, Math.min(
          container.scrollTop + deltaY,
          container.scrollHeight - container.clientHeight
        ));

        container.scrollLeft = newScrollLeft;
        container.scrollTop = newScrollTop;

        setIsScrolling(true);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
          setIsScrolling(false);
        }, 150);
      }
    }, []),
    onDoubleTap: useCallback((x: number, y: number) => {
      // ダブルタップで該当セルの編集ダイアログを開く
      const element = document.elementFromPoint(x, y);
      if (element) {
        const cellElement = element.closest('[data-cell-id]');
        if (cellElement) {
          const cellId = cellElement.getAttribute('data-cell-id');
          if (cellId) {
            const [itemId, timeHeader] = cellId.split('|');
            const item = data.find(d => d.id === itemId);
            if (item) {
              handleCellDoubleClick(item, timeHeader);
            }
          }
        }
      }
    }, [data]),
  });

  // 展開状態の保存と復元
  useEffect(() => {
    const savedExpanded = tabletState.expandedState;
    if (Object.keys(savedExpanded).length > 0) {
      setExpanded(savedExpanded);
    }
  }, [tabletState.expandedState]);

  // 状態変更時の自動保存
  useEffect(() => {
    const saveState = () => {
      stateManager.saveState('tabletGridState', {
        ...tabletState,
        expandedState: expanded,
        columnVisibilityState: columnVisibility,
      });
    };

    const timeoutId = setTimeout(saveState, 500); // デバウンス
    return () => clearTimeout(timeoutId);
  }, [expanded, columnVisibility, tabletState, stateManager]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 横スクロールの正常動作を確保
  useEffect(() => {
    if (tableContainerRef.current) {
      ensureHorizontalScroll(tableContainerRef.current);
    }
  }, [visibleTimeHeaders]);

  const handleExpandToggle = useCallback((itemId: string) => {
    setExpanded(prev => {
      const newExpanded = {
        ...prev,
        [itemId]: !prev[itemId]
      };
      
      // 状態を即座に保存
      setTabletState(current => ({
        ...current,
        expandedState: newExpanded,
      }));
      
      return newExpanded;
    });
  }, []);

  const handleColumnToggle = useCallback((columnId: string) => {
    setColumnVisibility(prev => {
      const newVisibility = {
        ...prev,
        [columnId]: !prev[columnId]
      };
      
      // 状態を即座に保存
      setTabletState(current => ({
        ...current,
        columnVisibilityState: newVisibility,
      }));
      
      return newVisibility;
    });
  }, []);

  const handleCellClick = useCallback((item: HierarchicalData, timeHeader: string, event?: React.MouseEvent) => {
    // Prevent accidental clicks during scrolling
    if (event && event.type === 'click') {
      const timeSinceLastTouch = Date.now() - (event.target as any).lastTouchTime;
      if (timeSinceLastTouch < 300) return; // Ignore clicks within 300ms of touch
    }

    const result = item.results[timeHeader] || {};
    
    if (viewMode === 'status') {
      // Use proper status conversion logic
      const planned = result.planned || false;
      const actual = result.actual || false;
      
      let newValue;
      if (!planned && !actual) {
        newValue = { planned: true, actual: false };
      } else if (planned && !actual) {
        newValue = { planned: true, actual: true };
      } else if (planned && actual) {
        newValue = { planned: false, actual: true };
      } else {
        newValue = { planned: false, actual: false };
      }
      
      onCellEdit(item.id, `time_${timeHeader}`, newValue);
    } else {
      // For cost mode, trigger proper cost input dialog
      const actualCost = result.actualCost || 0;
      const planCost = result.planCost || 0;
      const newValue = {
        planCost: actualCost === 0 ? 10000 : planCost,
        actualCost: actualCost === 0 ? 10000 : actualCost
      };
      onCellEdit(item.id, `time_${timeHeader}`, newValue);
    }
  }, [viewMode, onCellEdit]);

  const handleCellDoubleClick = useCallback((item: HierarchicalData, timeHeader: string) => {
    // Double-tap/click should trigger edit dialog
    onCellEdit(item.id, `time_${timeHeader}`, 'EDIT_DIALOG');
  }, [onCellEdit]);

  const renderStatusCell = (item: HierarchicalData, timeHeader: string) => {
    const result = item.results[timeHeader];
    if (!result) return null;

    const planned = result.planned || false;
    const actual = result.actual || false;
    const { touchTargetSize } = tabletState;

    let icon;
    let color;
    let tooltip;
    let symbol;

    if (planned && actual) {
      icon = <AdjustIcon />;
      color = theme.palette.success.main;
      tooltip = '計画・実績両方';
      symbol = '◎';
    } else if (actual) {
      icon = <FiberManualRecordIcon />;
      color = theme.palette.success.main;
      tooltip = '実績のみ';
      symbol = '●';
    } else if (planned) {
      icon = <CircleIcon />;
      color = theme.palette.primary.main;
      tooltip = '計画のみ';
      symbol = '○';
    } else {
      icon = <RadioButtonUncheckedIcon />;
      color = theme.palette.grey[400];
      tooltip = '未計画';
      symbol = '';
    }

    return (
      <Tooltip title={tooltip} arrow>
        <IconButton
          size="medium"
          onClick={(event) => handleCellClick(item, timeHeader, event)}
          onDoubleClick={() => handleCellDoubleClick(item, timeHeader)}
          onTouchStart={(e) => {
            (e.target as any).lastTouchTime = Date.now();
          }}
          sx={{
            color,
            minWidth: touchTargetSize,
            minHeight: touchTargetSize,
            padding: tabletState.spacing / 8,
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: alpha(color, 0.1),
              transform: 'scale(1.05)',
            },
            '&:active': {
              transform: 'scale(0.95)',
              backgroundColor: alpha(color, 0.2),
            },
            // Improve touch feedback
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    );
  };

  const renderCostCell = (item: HierarchicalData, timeHeader: string) => {
    const result = item.results[timeHeader];
    if (!result) return null;

    const planCost = result.planCost || 0;
    const actualCost = result.actualCost || 0;
    const { touchTargetSize, spacing } = tabletState;

    return (
      <Box
        onClick={(event) => handleCellClick(item, timeHeader, event)}
        onDoubleClick={() => handleCellDoubleClick(item, timeHeader)}
        onTouchStart={(e) => {
          (e.target as any).lastTouchTime = Date.now();
        }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          p: spacing / 8,
          borderRadius: 2,
          minHeight: touchTargetSize,
          minWidth: touchTargetSize * 0.8,
          justifyContent: 'center',
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            borderColor: theme.palette.primary.main,
            transform: 'scale(1.02)',
          },
          '&:active': {
            transform: 'scale(0.98)',
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
          },
          // Improve touch feedback
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Typography 
          variant="caption" 
          color="textSecondary" 
          sx={{ 
            fontSize: tabletState.isLandscape ? '0.75rem' : '0.7rem',
            lineHeight: 1.2
          }}
        >
          計画: ¥{planCost.toLocaleString()}
        </Typography>
        <Typography 
          variant="body2" 
          fontWeight="bold" 
          sx={{ 
            fontSize: tabletState.isLandscape ? '0.875rem' : '0.8rem',
            color: actualCost > 0 ? theme.palette.success.main : theme.palette.text.primary
          }}
        >
          実績: ¥{actualCost.toLocaleString()}
        </Typography>
      </Box>
    );
  };

  const renderColumnToggleBar = () => {
    const hiddenCount = timeHeaders.length - visibleTimeHeaders.length;
    const { touchTargetSize, spacing, isLandscape } = tabletState;
    const maxChipsToShow = isLandscape ? 10 : 6;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: spacing / 8, 
        p: spacing / 8,
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: 2,
        mb: spacing / 8,
        flexWrap: 'wrap',
        minHeight: touchTargetSize * 0.8,
      }}>
        <Typography 
          variant="body2" 
          color="textSecondary"
          sx={{ 
            fontSize: isLandscape ? '0.875rem' : '0.8rem',
            fontWeight: 500,
            minWidth: 'fit-content'
          }}
        >
          列表示:
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: spacing / 16, 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {timeHeaders.slice(0, maxChipsToShow).map(header => (
            <Chip
              key={header}
              label={header}
              size="medium"
              variant={columnVisibility[header] ? "filled" : "outlined"}
              onClick={() => handleColumnToggle(header)}
              icon={columnVisibility[header] ? <VisibilityIcon /> : <VisibilityOffIcon />}
              sx={{ 
                fontSize: isLandscape ? '0.8rem' : '0.75rem',
                height: touchTargetSize * 0.7,
                minWidth: touchTargetSize * 0.8,
                '& .MuiChip-icon': { 
                  fontSize: isLandscape ? '1rem' : '0.875rem',
                  marginLeft: '4px'
                },
                '& .MuiChip-label': {
                  paddingLeft: spacing / 16,
                  paddingRight: spacing / 16,
                },
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                // Improve touch feedback
                WebkitTapHighlightColor: 'transparent',
              }}
            />
          ))}
          {timeHeaders.length > maxChipsToShow && (
            <Button
              size="medium"
              variant="outlined"
              onClick={() => {
                // Toggle all remaining columns
                const newVisibility = { ...columnVisibility };
                timeHeaders.slice(maxChipsToShow).forEach(header => {
                  newVisibility[header] = !newVisibility[header];
                });
                setColumnVisibility(newVisibility);
              }}
              sx={{ 
                minHeight: touchTargetSize * 0.7,
                minWidth: touchTargetSize * 1.2,
                fontSize: isLandscape ? '0.8rem' : '0.75rem',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                // Improve touch feedback
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              他{timeHeaders.length - maxChipsToShow}列 {hiddenCount > maxChipsToShow ? '表示' : '非表示'}
            </Button>
          )}
        </Box>
        {hiddenCount > 0 && (
          <Typography 
            variant="caption" 
            color="textSecondary"
            sx={{ 
              fontSize: isLandscape ? '0.75rem' : '0.7rem',
              marginLeft: 'auto'
            }}
          >
            ({hiddenCount}列非表示)
          </Typography>
        )}
      </Box>
    );
  };

  const renderTableRow = (item: HierarchicalData, isGrouped: boolean = false) => {
    const isExpanded = expanded[item.id] || false;
    const { touchTargetSize, spacing, isLandscape } = tabletState;
    const rowHeight = Math.max(touchTargetSize * 1.2, 60);

    return (
      <React.Fragment key={item.id}>
        <TableRow
          sx={{
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            },
            minHeight: rowHeight,
            height: rowHeight,
            // Improve touch scrolling
            touchAction: 'pan-y',
          }}
        >
          {/* Task name with expand button */}
          <TableCell 
            sx={{ 
              minWidth: isLandscape ? 250 : 200,
              maxWidth: isLandscape ? 350 : 300,
              position: 'sticky',
              left: 0,
              backgroundColor: theme.palette.background.paper,
              zIndex: 1,
              borderRight: `2px solid ${theme.palette.divider}`,
              padding: spacing / 8,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing / 16 }}>
              <IconButton
                size="medium"
                onClick={() => handleExpandToggle(item.id)}
                sx={{ 
                  minWidth: touchTargetSize,
                  minHeight: touchTargetSize,
                  padding: spacing / 16,
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    transform: 'scale(1.05)',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  },
                  // Improve touch feedback
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isExpanded ? 
                  <ExpandLessIcon fontSize={isLandscape ? "medium" : "small"} /> : 
                  <ExpandMoreIcon fontSize={isLandscape ? "medium" : "small"} />
                }
              </IconButton>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    wordBreak: 'break-word',
                    fontSize: isLandscape ? '0.9rem' : '0.875rem',
                    lineHeight: 1.3,
                    color: theme.palette.text.primary,
                  }}
                >
                  {item.task}
                </Typography>
                {(showBomCode || showCycle) && (
                  <Box sx={{ 
                    display: 'flex', 
                    gap: spacing / 16, 
                    mt: spacing / 16, 
                    flexWrap: 'wrap' 
                  }}>
                    {showBomCode && item.bomCode && (
                      <Chip 
                        label={item.bomCode} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: isLandscape ? '0.75rem' : '0.7rem', 
                          height: touchTargetSize * 0.5,
                          borderRadius: 1,
                        }}
                      />
                    )}
                    {showCycle && item.cycle && (
                      <Chip 
                        label={item.cycle} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: isLandscape ? '0.75rem' : '0.7rem', 
                          height: touchTargetSize * 0.5,
                          borderRadius: 1,
                        }}
                      />
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </TableCell>

          {/* Time columns */}
          {visibleTimeHeaders.map(timeHeader => (
            <TableCell 
              key={timeHeader}
              align="center"
              data-cell-id={`${item.id}|${timeHeader}`}
              sx={{ 
                minWidth: isLandscape ? 100 : 80,
                maxWidth: isLandscape ? 140 : 120,
                padding: spacing / 16,
                borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                // Improve touch scrolling
                touchAction: 'pan-x',
                // Prevent text selection during scroll
                userSelect: isScrolling ? 'none' : 'auto',
                // Smooth transitions
                transition: 'background-color 0.2s ease-in-out',
              }}
            >
              {viewMode === 'status' ? 
                renderStatusCell(item, timeHeader) : 
                renderCostCell(item, timeHeader)
              }
            </TableCell>
          ))}
        </TableRow>

        {/* Expanded row for specifications */}
        <TableRow>
          <TableCell 
            colSpan={visibleTimeHeaders.length + 1} 
            sx={{ 
              p: 0,
              borderBottom: isExpanded ? `2px solid ${theme.palette.divider}` : 'none'
            }}
          >
            <Collapse in={isExpanded} timeout={300}>
              <Box sx={{ 
                p: spacing / 8, 
                backgroundColor: alpha(theme.palette.grey[100], 0.3),
                borderRadius: 1,
                margin: spacing / 16,
              }}>
                {/* Hierarchy path */}
                {item.hierarchyPath && (
                  <Typography 
                    variant="caption" 
                    color="textSecondary" 
                    sx={{ 
                      mb: spacing / 16, 
                      display: 'block',
                      fontSize: isLandscape ? '0.8rem' : '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    階層: {item.hierarchyPath}
                  </Typography>
                )}

                {/* Specifications */}
                {item.specifications && item.specifications.length > 0 && (
                  <Box sx={{ mb: spacing / 8 }}>
                    <Typography 
                      variant="subtitle2" 
                      gutterBottom 
                      sx={{ 
                        fontSize: isLandscape ? '0.9rem' : '0.875rem',
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      機器仕様
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: spacing / 16,
                    }}>
                      {item.specifications.map((spec, index) => (
                        <Chip
                          key={index}
                          label={`${spec.key}: ${spec.value}`}
                          size="medium"
                          variant="outlined"
                          onClick={() => onSpecificationEdit(item.id, index, spec.key, spec.value)}
                          sx={{ 
                            fontSize: isLandscape ? '0.8rem' : '0.75rem',
                            height: touchTargetSize * 0.7,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              transform: 'scale(1.02)',
                            },
                            '&:active': {
                              transform: 'scale(0.98)',
                            },
                            // Improve touch feedback
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Hidden time columns summary */}
                {timeHeaders.length > visibleTimeHeaders.length && (
                  <Box>
                    <Typography 
                      variant="subtitle2" 
                      gutterBottom 
                      sx={{ 
                        fontSize: isLandscape ? '0.9rem' : '0.875rem',
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      その他の期間 ({timeHeaders.length - visibleTimeHeaders.length}期間)
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: spacing / 16,
                      maxHeight: isLandscape ? 200 : 150,
                      overflowY: 'auto',
                    }}>
                      {timeHeaders
                        .filter(header => !columnVisibility[header])
                        .map(timeHeader => {
                          const result = item.results[timeHeader];
                          if (!result) return null;

                          if (viewMode === 'status') {
                            const planned = result.planned || false;
                            const actual = result.actual || false;
                            let status = '未計画';
                            let symbol = '';
                            let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
                            
                            if (planned && actual) {
                              status = '計画・実績両方';
                              symbol = '◎';
                              color = 'success';
                            } else if (actual) {
                              status = '実績のみ';
                              symbol = '●';
                              color = 'success';
                            } else if (planned) {
                              status = '計画のみ';
                              symbol = '○';
                              color = 'primary';
                            }

                            return (
                              <Chip
                                key={timeHeader}
                                label={`${timeHeader}: ${symbol} ${status}`}
                                size="medium"
                                color={color}
                                variant="outlined"
                                onClick={(event) => handleCellClick(item, timeHeader, event)}
                                sx={{ 
                                  fontSize: isLandscape ? '0.75rem' : '0.7rem',
                                  height: touchTargetSize * 0.7,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease-in-out',
                                  '&:hover': {
                                    transform: 'scale(1.02)',
                                  },
                                  '&:active': {
                                    transform: 'scale(0.98)',
                                  },
                                  // Improve touch feedback
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              />
                            );
                          } else {
                            const planCost = result.planCost || 0;
                            const actualCost = result.actualCost || 0;
                            return (
                              <Chip
                                key={timeHeader}
                                label={`${timeHeader}: 計画¥${planCost.toLocaleString()} / 実績¥${actualCost.toLocaleString()}`}
                                size="medium"
                                color={actualCost > 0 ? 'primary' : 'default'}
                                variant="outlined"
                                onClick={(event) => handleCellClick(item, timeHeader, event)}
                                sx={{ 
                                  fontSize: isLandscape ? '0.75rem' : '0.7rem',
                                  height: touchTargetSize * 0.7,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease-in-out',
                                  '&:hover': {
                                    transform: 'scale(1.02)',
                                  },
                                  '&:active': {
                                    transform: 'scale(0.98)',
                                  },
                                  // Improve touch feedback
                                  WebkitTapHighlightColor: 'transparent',
                                }}
                              />
                            );
                          }
                        })}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  };

  const renderGroupHeader = (groupName: string, itemCount: number) => {
    const { spacing, isLandscape } = tabletState;
    
    return (
      <TableRow key={`group-${groupName}`}>
        <TableCell 
          colSpan={visibleTimeHeaders.length + 1}
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
            fontWeight: 'bold',
            fontSize: isLandscape ? '0.95rem' : '0.9rem',
            py: spacing / 8,
            borderTop: `2px solid ${theme.palette.primary.main}`,
            borderBottom: `1px solid ${theme.palette.primary.main}`,
            color: theme.palette.primary.dark,
          }}
        >
          {groupName} ({itemCount}件)
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      // Improve touch scrolling performance
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      // 回転アニメーション用のトランジション
      transition: rotationState.isRotating ? 'all 0.3s ease-in-out' : 'none',
      // 回転中の表示調整
      opacity: rotationState.isRotating ? 0.8 : 1,
      // CSS変数を使用したスケーリング
      transform: `scale(var(--rotation-scale, 1))`,
    }}>
      {/* Column toggle bar */}
      {renderColumnToggleBar()}

      {/* Table */}
      <TableContainer 
        ref={tableContainerRef}
        component={Paper} 
        sx={{ 
          flexGrow: 1,
          overflow: 'auto',
          // Improve touch scrolling
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          '& .MuiTable-root': {
            minWidth: tabletState.isLandscape ? 800 : 600,
          },
          // Add momentum scrolling for iOS (duplicate removed)
          // Improve scroll performance
          willChange: 'scroll-position',
          // Smooth scrolling behavior
          scrollBehavior: 'smooth',
          // Prevent overscroll bounce on iOS
          overscrollBehavior: 'contain',
        }}
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          setTabletState(prev => ({
            ...prev,
            scrollPosition: {
              x: target.scrollLeft,
              y: target.scrollTop
            }
          }));
        }}
        {...touchGestureHandlers}
      >
        <Table stickyHeader size={tabletState.isLandscape ? "medium" : "small"}>
          <TableHead>
            <TableRow sx={{ height: tabletState.touchTargetSize }}>
              <TableCell 
                sx={{ 
                  minWidth: tabletState.isLandscape ? 250 : 200,
                  position: 'sticky',
                  left: 0,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  zIndex: 2,
                  fontWeight: 'bold',
                  fontSize: tabletState.isLandscape ? '0.9rem' : '0.875rem',
                  borderRight: `2px solid ${theme.palette.divider}`,
                  color: theme.palette.primary.dark,
                  padding: tabletState.spacing / 8,
                }}
              >
                機器台帳
              </TableCell>
              {visibleTimeHeaders.map(timeHeader => (
                <TableCell 
                  key={timeHeader}
                  align="center"
                  sx={{ 
                    minWidth: tabletState.isLandscape ? 100 : 80,
                    fontWeight: 'bold',
                    fontSize: tabletState.isLandscape ? '0.875rem' : '0.8rem',
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    color: theme.palette.primary.dark,
                    padding: tabletState.spacing / 16,
                    // Improve readability
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {timeHeader}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedData ? (
              Object.entries(groupedData).map(([groupName, items]) => [
                renderGroupHeader(groupName, items.length),
                ...items.map(item => renderTableRow(item, true))
              ]).flat()
            ) : (
              data.map(item => renderTableRow(item))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TabletGridView;