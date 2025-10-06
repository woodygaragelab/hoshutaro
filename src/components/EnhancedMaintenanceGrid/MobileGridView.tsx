import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';
import { ResponsiveLayout } from '../ExcelLikeGrid/types';

interface MobileGridViewProps {
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

interface EditDialogState {
  open: boolean;
  item: HierarchicalData | null;
  timeHeader: string | null;
}

const MobileGridView: React.FC<MobileGridViewProps> = ({
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
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    item: null,
    timeHeader: null
  });

  const handleExpandToggle = useCallback((itemId: string) => {
    setExpanded(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }, []);

  const handleEditClick = useCallback((item: HierarchicalData, timeHeader: string) => {
    setEditDialog({
      open: true,
      item,
      timeHeader
    });
  }, []);

  const handleEditClose = useCallback(() => {
    setEditDialog({
      open: false,
      item: null,
      timeHeader: null
    });
  }, []);

  const handleEditSave = useCallback((value: any) => {
    if (editDialog.item && editDialog.timeHeader) {
      onCellEdit(editDialog.item.id, `time_${editDialog.timeHeader}`, value);
      handleEditClose();
    }
  }, [editDialog, onCellEdit, handleEditClose]);

  const renderStatusIcon = (planned: boolean, actual: boolean) => {
    if (actual) {
      return <CheckCircleIcon sx={{ color: theme.palette.success.main }} />;
    } else if (planned) {
      return <RadioButtonUncheckedIcon sx={{ color: theme.palette.primary.main }} />;
    } else {
      return <RadioButtonUncheckedIcon sx={{ color: theme.palette.grey[400] }} />;
    }
  };

  const renderCostDisplay = (planCost: number, actualCost: number) => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <Typography variant="caption" color="textSecondary">
          予定: ¥{planCost.toLocaleString()}
        </Typography>
        <Typography variant="body2" fontWeight="bold">
          実績: ¥{actualCost.toLocaleString()}
        </Typography>
      </Box>
    );
  };

  const renderTimelineItem = (item: HierarchicalData, timeHeader: string) => {
    const result = item.results[timeHeader];
    if (!result) return null;

    const isPlanned = result.planned || false;
    const isActual = result.actual || false;
    const planCost = result.planCost || 0;
    const actualCost = result.actualCost || 0;

    return (
      <ListItem
        key={timeHeader}
        sx={{
          borderRadius: 1,
          mb: 1,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
          }
        }}
      >
        <ListItemText
          primary={timeHeader}
          secondary={viewMode === 'status' ? 
            `${isPlanned ? '計画済' : '未計画'} / ${isActual ? '実施済' : '未実施'}` :
            `予定: ¥${planCost.toLocaleString()} / 実績: ¥${actualCost.toLocaleString()}`
          }
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {viewMode === 'status' ? 
              renderStatusIcon(isPlanned, isActual) :
              <AttachMoneyIcon color="primary" />
            }
            <IconButton
              size="small"
              onClick={() => handleEditClick(item, timeHeader)}
              sx={{ 
                minWidth: 44,
                minHeight: 44,
                padding: responsive.getSpacing('sm')
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  const renderMobileCard = (item: HierarchicalData) => {
    const isExpanded = expanded[item.id] || false;
    const cellHeight = responsive.getCellHeight();
    const spacing = responsive.getSpacing('sm');

    return (
      <Card
        key={item.id}
        sx={{
          mb: spacing / 8,
          borderRadius: 2,
          boxShadow: theme.shadows[2],
          '&:hover': {
            boxShadow: theme.shadows[4],
          }
        }}
      >
        <CardContent sx={{ p: spacing / 8, '&:last-child': { pb: spacing / 8 } }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography 
                variant="subtitle1" 
                fontWeight="bold"
                sx={{ 
                  wordBreak: 'break-word',
                  fontSize: responsive.isMobile ? '0.9rem' : '1rem'
                }}
              >
                {item.task}
              </Typography>
              
              {/* Metadata chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {showBomCode && item.bomCode && (
                  <Chip 
                    label={`TAG: ${item.bomCode}`} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
                {showCycle && item.cycle && (
                  <Chip 
                    label={`周期: ${item.cycle}`} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
                {item.hierarchyPath && (
                  <Chip 
                    label={item.hierarchyPath} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>
            
            <IconButton
              onClick={() => handleExpandToggle(item.id)}
              sx={{ 
                minWidth: 44,
                minHeight: 44,
                ml: 1
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          {/* Specifications preview (if available) */}
          {item.specifications && item.specifications.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="textSecondary">
                仕様: {item.specifications.slice(0, 2).map(spec => `${spec.key}: ${spec.value}`).join(', ')}
                {item.specifications.length > 2 && '...'}
              </Typography>
            </Box>
          )}

          {/* Timeline summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="textSecondary">
              {timeHeaders.length}期間のデータ
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {timeHeaders.slice(0, 3).map(header => {
                const result = item.results[header];
                if (!result) return null;
                
                if (viewMode === 'status') {
                  return (
                    <Box key={header} sx={{ fontSize: '0.75rem' }}>
                      {renderStatusIcon(result.planned || false, result.actual || false)}
                    </Box>
                  );
                } else {
                  return (
                    <Chip
                      key={header}
                      label={`¥${(result.actualCost || 0).toLocaleString()}`}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  );
                }
              })}
              {timeHeaders.length > 3 && (
                <Typography variant="caption" color="textSecondary">
                  +{timeHeaders.length - 3}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Expanded content */}
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 1 }} />
            
            {/* Specifications */}
            {item.specifications && item.specifications.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  機器仕様
                </Typography>
                <List dense>
                  {item.specifications.map((spec, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={spec.key}
                        secondary={spec.value}
                        primaryTypographyProps={{ fontSize: '0.875rem' }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Timeline */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {viewMode === 'status' ? '実施状況' : 'コスト情報'}
              </Typography>
              <List dense>
                {timeHeaders.map(header => renderTimelineItem(item, header))}
              </List>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  const renderEditDialog = () => {
    if (!editDialog.item || !editDialog.timeHeader) return null;

    const result = editDialog.item.results[editDialog.timeHeader] || {};
    const [planned, setPlanned] = useState(result.planned || false);
    const [actual, setActual] = useState(result.actual || false);
    const [planCost, setPlanCost] = useState(result.planCost || 0);
    const [actualCost, setActualCost] = useState(result.actualCost || 0);

    const handleSave = () => {
      if (viewMode === 'status') {
        handleEditSave({ planned, actual });
      } else {
        handleEditSave({ planCost, actualCost });
      }
    };

    return (
      <Dialog 
        open={editDialog.open} 
        onClose={handleEditClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { 
            m: responsive.getSpacing('sm'),
            maxHeight: `calc(100vh - ${responsive.getSpacing('lg')}px)`
          }
        }}
      >
        <DialogTitle>
          {editDialog.timeHeader} - {editDialog.item.task}
        </DialogTitle>
        <DialogContent>
          {viewMode === 'status' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={() => setPlanned(!planned)}
                  sx={{ 
                    color: planned ? theme.palette.primary.main : theme.palette.grey[400],
                    minWidth: 44,
                    minHeight: 44
                  }}
                >
                  <RadioButtonUncheckedIcon />
                </IconButton>
                <Typography>計画</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={() => setActual(!actual)}
                  sx={{ 
                    color: actual ? theme.palette.success.main : theme.palette.grey[400],
                    minWidth: 44,
                    minHeight: 44
                  }}
                >
                  <CheckCircleIcon />
                </IconButton>
                <Typography>実績</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="計画コスト"
                type="number"
                value={planCost}
                onChange={(e) => setPlanCost(Number(e.target.value))}
                fullWidth
                InputProps={{
                  startAdornment: '¥',
                  sx: { minHeight: 44 }
                }}
              />
              <TextField
                label="実績コスト"
                type="number"
                value={actualCost}
                onChange={(e) => setActualCost(Number(e.target.value))}
                fullWidth
                InputProps={{
                  startAdornment: '¥',
                  sx: { minHeight: 44 }
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: responsive.getSpacing('md') / 8 }}>
          <Button 
            onClick={handleEditClose}
            sx={{ minHeight: 44 }}
          >
            キャンセル
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            sx={{ minHeight: 44 }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Group data for mobile display
  const displayData = groupedData ? 
    Object.entries(groupedData).flatMap(([groupName, items]) => [
      { isGroupHeader: true, groupName, items } as any,
      ...items
    ]) : 
    data;

  return (
    <Box 
      sx={{ 
        height: '100%',
        overflow: 'auto',
        p: responsive.getSpacing('sm') / 8,
        backgroundColor: theme.palette.grey[50]
      }}
    >
      {displayData.map((item: any, index) => {
        if (item.isGroupHeader) {
          return (
            <Box key={`group-${index}`} sx={{ mb: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  p: responsive.getSpacing('sm') / 8,
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  borderRadius: 1,
                  fontSize: responsive.isMobile ? '1rem' : '1.25rem'
                }}
              >
                {item.groupName} ({item.items.length}件)
              </Typography>
            </Box>
          );
        }
        return renderMobileCard(item);
      })}
      
      {renderEditDialog()}
    </Box>
  );
};

export default MobileGridView;