import React, { useState, useCallback, useMemo } from 'react';
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
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AttachMoney as AttachMoneyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';
import { ResponsiveLayout } from '../ExcelLikeGrid/types';

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
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() => {
    // Show only high priority columns initially on tablet
    const initialVisibility: ColumnVisibility = {};
    timeHeaders.forEach((header, index) => {
      initialVisibility[header] = index < 6; // Show first 6 time columns
    });
    return initialVisibility;
  });

  const handleExpandToggle = useCallback((itemId: string) => {
    setExpanded(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }, []);

  const handleColumnToggle = useCallback((columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  }, []);

  const handleCellClick = useCallback((item: HierarchicalData, timeHeader: string) => {
    const result = item.results[timeHeader] || {};
    
    if (viewMode === 'status') {
      // Toggle between states: none -> planned -> actual -> both -> none
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
      // For cost mode, we'd need a more complex edit dialog
      // For now, just toggle between 0 and some default values
      const actualCost = result.actualCost || 0;
      const newValue = {
        planCost: actualCost === 0 ? 10000 : 0,
        actualCost: actualCost === 0 ? 10000 : 0
      };
      onCellEdit(item.id, `time_${timeHeader}`, newValue);
    }
  }, [viewMode, onCellEdit]);

  const visibleTimeHeaders = useMemo(() => {
    return timeHeaders.filter(header => columnVisibility[header]);
  }, [timeHeaders, columnVisibility]);

  const renderStatusCell = (item: HierarchicalData, timeHeader: string) => {
    const result = item.results[timeHeader];
    if (!result) return null;

    const planned = result.planned || false;
    const actual = result.actual || false;
    const cellHeight = responsive.getCellHeight();

    let icon;
    let color;
    let tooltip;

    if (actual) {
      icon = <CheckCircleIcon />;
      color = theme.palette.success.main;
      tooltip = '実施済み';
    } else if (planned) {
      icon = <RadioButtonUncheckedIcon />;
      color = theme.palette.primary.main;
      tooltip = '計画済み';
    } else {
      icon = <RadioButtonUncheckedIcon />;
      color = theme.palette.grey[400];
      tooltip = '未計画';
    }

    return (
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          onClick={() => handleCellClick(item, timeHeader)}
          sx={{
            color,
            minWidth: cellHeight,
            minHeight: cellHeight,
            padding: responsive.getSpacing('xs'),
            '&:hover': {
              backgroundColor: alpha(color, 0.1),
            }
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

    return (
      <Box
        onClick={() => handleCellClick(item, timeHeader)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          p: responsive.getSpacing('xs') / 8,
          borderRadius: 1,
          minHeight: responsive.getCellHeight(),
          justifyContent: 'center',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
          }
        }}
      >
        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
          ¥{planCost.toLocaleString()}
        </Typography>
        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>
          ¥{actualCost.toLocaleString()}
        </Typography>
      </Box>
    );
  };

  const renderColumnToggleBar = () => {
    const hiddenCount = timeHeaders.length - visibleTimeHeaders.length;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        p: responsive.getSpacing('sm') / 8,
        backgroundColor: alpha(theme.palette.primary.main, 0.05),
        borderRadius: 1,
        mb: 1,
        flexWrap: 'wrap'
      }}>
        <Typography variant="body2" color="textSecondary">
          列表示:
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {timeHeaders.slice(0, 8).map(header => (
            <Chip
              key={header}
              label={header}
              size="small"
              variant={columnVisibility[header] ? "filled" : "outlined"}
              onClick={() => handleColumnToggle(header)}
              icon={columnVisibility[header] ? <VisibilityIcon /> : <VisibilityOffIcon />}
              sx={{ 
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': { fontSize: '0.875rem' }
              }}
            />
          ))}
          {timeHeaders.length > 8 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                // Toggle all remaining columns
                const newVisibility = { ...columnVisibility };
                timeHeaders.slice(8).forEach(header => {
                  newVisibility[header] = !newVisibility[header];
                });
                setColumnVisibility(newVisibility);
              }}
              sx={{ minHeight: 24, fontSize: '0.75rem' }}
            >
              他{timeHeaders.length - 8}列 {hiddenCount > 8 ? '表示' : '非表示'}
            </Button>
          )}
        </Box>
        {hiddenCount > 0 && (
          <Typography variant="caption" color="textSecondary">
            ({hiddenCount}列非表示)
          </Typography>
        )}
      </Box>
    );
  };

  const renderTableRow = (item: HierarchicalData, isGrouped: boolean = false) => {
    const isExpanded = expanded[item.id] || false;
    const cellHeight = responsive.getCellHeight();
    const spacing = responsive.getSpacing('xs');

    return (
      <React.Fragment key={item.id}>
        <TableRow
          sx={{
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            },
            height: cellHeight
          }}
        >
          {/* Task name with expand button */}
          <TableCell 
            sx={{ 
              minWidth: 200,
              maxWidth: 300,
              position: 'sticky',
              left: 0,
              backgroundColor: theme.palette.background.paper,
              zIndex: 1,
              borderRight: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => handleExpandToggle(item.id)}
                sx={{ 
                  minWidth: 32,
                  minHeight: 32,
                  padding: spacing / 8
                }}
              >
                {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    wordBreak: 'break-word',
                    fontSize: '0.875rem',
                    lineHeight: 1.2
                  }}
                >
                  {item.task}
                </Typography>
                {(showBomCode || showCycle) && (
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    {showBomCode && item.bomCode && (
                      <Chip 
                        label={item.bomCode} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 18 }}
                      />
                    )}
                    {showCycle && item.cycle && (
                      <Chip 
                        label={item.cycle} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 18 }}
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
              sx={{ 
                minWidth: 80,
                maxWidth: 120,
                padding: spacing / 8,
                borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
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
              borderBottom: isExpanded ? `1px solid ${theme.palette.divider}` : 'none'
            }}
          >
            <Collapse in={isExpanded}>
              <Box sx={{ p: responsive.getSpacing('md') / 8, backgroundColor: alpha(theme.palette.grey[100], 0.5) }}>
                {/* Hierarchy path */}
                {item.hierarchyPath && (
                  <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                    階層: {item.hierarchyPath}
                  </Typography>
                )}

                {/* Specifications */}
                {item.specifications && item.specifications.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.875rem' }}>
                      機器仕様
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {item.specifications.map((spec, index) => (
                        <Chip
                          key={index}
                          label={`${spec.key}: ${spec.value}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Hidden time columns summary */}
                {timeHeaders.length > visibleTimeHeaders.length && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontSize: '0.875rem' }}>
                      その他の期間 ({timeHeaders.length - visibleTimeHeaders.length}期間)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {timeHeaders
                        .filter(header => !columnVisibility[header])
                        .map(timeHeader => {
                          const result = item.results[timeHeader];
                          if (!result) return null;

                          if (viewMode === 'status') {
                            const planned = result.planned || false;
                            const actual = result.actual || false;
                            let status = '未計画';
                            let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
                            
                            if (actual) {
                              status = '実施済';
                              color = 'success';
                            } else if (planned) {
                              status = '計画済';
                              color = 'primary';
                            }

                            return (
                              <Chip
                                key={timeHeader}
                                label={`${timeHeader}: ${status}`}
                                size="small"
                                color={color}
                                variant="outlined"
                                onClick={() => handleCellClick(item, timeHeader)}
                                sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                              />
                            );
                          } else {
                            const actualCost = result.actualCost || 0;
                            return (
                              <Chip
                                key={timeHeader}
                                label={`${timeHeader}: ¥${actualCost.toLocaleString()}`}
                                size="small"
                                color={actualCost > 0 ? 'primary' : 'default'}
                                variant="outlined"
                                onClick={() => handleCellClick(item, timeHeader)}
                                sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
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
    return (
      <TableRow key={`group-${groupName}`}>
        <TableCell 
          colSpan={visibleTimeHeaders.length + 1}
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            fontWeight: 'bold',
            fontSize: '0.9rem',
            py: responsive.getSpacing('sm') / 8,
          }}
        >
          {groupName} ({itemCount}件)
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Column toggle bar */}
      {renderColumnToggleBar()}

      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          flexGrow: 1,
          overflow: 'auto',
          '& .MuiTable-root': {
            minWidth: 600,
          }
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell 
                sx={{ 
                  minWidth: 200,
                  position: 'sticky',
                  left: 0,
                  backgroundColor: theme.palette.grey[100],
                  zIndex: 2,
                  fontWeight: 'bold',
                  borderRight: `1px solid ${theme.palette.divider}`,
                }}
              >
                作業内容
              </TableCell>
              {visibleTimeHeaders.map(timeHeader => (
                <TableCell 
                  key={timeHeader}
                  align="center"
                  sx={{ 
                    minWidth: 80,
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    backgroundColor: theme.palette.grey[100],
                    borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
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