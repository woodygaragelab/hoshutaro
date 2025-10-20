import React, { useState, useCallback, useContext } from 'react';
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
  Button,
  useTheme,
  alpha,
  useMediaQuery,

} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  AttachMoney as AttachMoneyIcon,
  Smartphone as SmartphoneIcon,
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';
import { ResponsiveLayout as GridResponsiveLayout } from '../ExcelLikeGrid/types';
import { CommonEditContext } from '../CommonEdit/CommonEditLogic';
import { createStatusValue } from '../CommonEdit/statusLogic';
import { 
  MobileStatusSelection, 
  MobileCostInput, 
  MobileSpecificationEdit 
} from './MobileDialogEnhancements';
import {
  ResponsiveText,
  PriorityInfoDisplay,
  ExpandableDetail,
  MobileSkeleton,
} from './MobileSpecificFeatures';
import {
  MobileOrientationProvider,
  useOrientation,
  ResponsiveLayout,
  OrientationAwareGrid,
  useOrientationPersistence,
  type DeviceInfo,
} from './MobileOrientationHandler';
import {
  Info as InfoIcon,
} from '@mui/icons-material';

interface MobileGridViewProps {
  data: HierarchicalData[];
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  showBomCode: boolean;
  showCycle: boolean;
  onCellEdit: (rowId: string, columnId: string, value: any) => void;
  onSpecificationEdit: (rowId: string, specIndex: number, key: string, value: string) => void;
  responsive: GridResponsiveLayout;
  groupedData?: { [key: string]: HierarchicalData[] };
  loading?: boolean;
}

interface ExpandedState {
  [key: string]: boolean;
}

// 最小タッチターゲットサイズ（44px）
const MIN_TOUCH_TARGET = 44;

// 内部コンポーネント（向き対応版）
const MobileGridViewInternal: React.FC<MobileGridViewProps> = ({
  data,
  timeHeaders,
  viewMode,
  showBomCode,
  showCycle,
  onCellEdit,
  onSpecificationEdit,
  responsive,
  groupedData,
  loading = false
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 向き情報を取得
  const { deviceInfo, isRotating } = useOrientation();
  
  // 展開状態の永続化（画面回転時も保持）
  const [expanded, setExpanded] = useOrientationPersistence<ExpandedState>('expanded-cards', {});
  
  // CommonEditContextを使用
  const editContext = useContext(CommonEditContext);
  
  // 編集ダイアログの状態管理
  const [currentEditItem, setCurrentEditItem] = useState<{
    item: HierarchicalData;
    timeHeader: string;
    editType: 'status' | 'cost' | 'specification';
  } | null>(null);



  const handleExpandToggle = useCallback((itemId: string) => {
    const newExpanded = {
      ...expanded,
      [itemId]: !expanded[itemId]
    };
    setExpanded(newExpanded);
  }, [expanded, setExpanded]);

  const handleEditClick = useCallback((
    item: HierarchicalData, 
    timeHeader: string, 
    editType: 'status' | 'cost' | 'specification'
  ) => {
    if (!editContext) return;
    
    setCurrentEditItem({ item, timeHeader, editType });
    
    // CommonEditLogicを使用して編集を開始
    const columnId = editType === 'specification' ? 'specifications' : `time_${timeHeader}`;
    editContext.startCellEdit(item.id, columnId, editType);
  }, [editContext]);

  const handleEditClose = useCallback(() => {
    if (editContext) {
      editContext.cancelEdit();
    }
    setCurrentEditItem(null);
  }, [editContext]);

  /**
   * 星取表の状態記号を正確に表示
   * 要件3.11: 計画（○）、実績（●）、両方（◎）、未計画（空白）
   */
  const renderStatusSymbol = (planned: boolean, actual: boolean) => {
    let symbol = '';
    let color = theme.palette.grey[400];
    
    if (planned && actual) {
      symbol = '◎'; // 両方
      color = theme.palette.success.main;
    } else if (actual) {
      symbol = '●'; // 実績のみ
      color = theme.palette.success.main;
    } else if (planned) {
      symbol = '○'; // 計画のみ
      color = theme.palette.primary.main;
    } else {
      symbol = ''; // 未計画（空白）
      color = theme.palette.grey[300];
    }
    
    return (
      <Typography
        variant="h6"
        sx={{
          color,
          fontWeight: 'bold',
          minWidth: '24px',
          textAlign: 'center',
          fontSize: isSmallScreen ? '1.2rem' : '1.5rem',
        }}
      >
        {symbol || '－'}
      </Typography>
    );
  };



  /**
   * タイムライン項目の表示（モバイル最適化）
   */
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
          borderRadius: 2,
          mb: 1,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            transform: 'translateY(-1px)',
            boxShadow: theme.shadows[2],
          },
          transition: 'all 0.2s ease-in-out',
          minHeight: MIN_TOUCH_TARGET,
        }}
      >
        <ListItemText
          primary={
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: isSmallScreen ? '0.85rem' : '0.9rem',
              }}
            >
              {timeHeader}
            </Typography>
          }
          secondary={
            <Typography 
              variant="body2" 
              color="textSecondary"
              sx={{ 
                fontSize: isSmallScreen ? '0.75rem' : '0.8rem',
                mt: 0.5,
              }}
            >
              {viewMode === 'status' ? 
                `${isPlanned ? '計画済' : '未計画'} / ${isActual ? '実施済' : '未実施'}` :
                `予定: ¥${planCost.toLocaleString()} / 実績: ¥${actualCost.toLocaleString()}`
              }
            </Typography>
          }
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {viewMode === 'status' ? 
              renderStatusSymbol(isPlanned, isActual) :
              <AttachMoneyIcon color="primary" sx={{ fontSize: isSmallScreen ? '1.2rem' : '1.5rem' }} />
            }
            <IconButton
              onClick={() => handleEditClick(item, timeHeader, viewMode)}
              sx={{ 
                minWidth: MIN_TOUCH_TARGET,
                minHeight: MIN_TOUCH_TARGET,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <EditIcon fontSize={isSmallScreen ? 'small' : 'medium'} />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  /**
   * モバイルカードの表示（改善版）
   * 要件3.1, 3.2, 3.6: レイアウト崩れ修正、カードUI改善、44px以上のタッチターゲット
   */
  const renderMobileCard = (item: HierarchicalData) => {
    const isExpanded = expanded[item.id] || false;

    return (
      <Card
        key={item.id}
        sx={{
          mb: 2,
          borderRadius: 3,
          boxShadow: theme.shadows[1],
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          touchAction: 'manipulation', // タッチ操作を最適化
          '&:hover': {
            boxShadow: theme.shadows[3],
            transform: 'translateY(-2px)',
          },
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Header with Priority Info Display */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0, pr: 1 }}>
              {/* 重要情報の優先表示 - 要件3.13, 3.14 */}
              <PriorityInfoDisplay
                item={item}
                timeHeaders={timeHeaders}
                viewMode={viewMode}
                showBomCode={showBomCode}
                showCycle={showCycle}
              />
            </Box>
            
            <IconButton
              onClick={() => handleExpandToggle(item.id)}
              sx={{ 
                minWidth: MIN_TOUCH_TARGET,
                minHeight: MIN_TOUCH_TARGET,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              {isExpanded ? 
                <ExpandLessIcon sx={{ fontSize: isSmallScreen ? '1.5rem' : '1.8rem' }} /> : 
                <ExpandMoreIcon sx={{ fontSize: isSmallScreen ? '1.5rem' : '1.8rem' }} />
              }
            </IconButton>
          </Box>

          {/* Timeline summary - 要件3.13: 最初の3期間の状態を視覚的に表示 */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 1.5,
            backgroundColor: alpha(theme.palette.background.default, 0.5),
            borderRadius: 2,
          }}>
            <Typography 
              variant="caption" 
              color="textSecondary"
              sx={{ 
                fontSize: '0.75rem',
                fontWeight: 'medium',
              }}
            >
              {timeHeaders.length}期間のデータ
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {timeHeaders.slice(0, 3).map(header => {
                const result = item.results[header];
                if (!result) return null;
                
                if (viewMode === 'status') {
                  return (
                    <Box 
                      key={header} 
                      sx={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: 32,
                      }}
                    >
                      {renderStatusSymbol(result.planned || false, result.actual || false)}
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.6rem',
                          color: theme.palette.text.secondary,
                          mt: 0.5,
                        }}
                      >
                        {header.slice(-2)}
                      </Typography>
                    </Box>
                  );
                } else {
                  return (
                    <Chip
                      key={header}
                      label={`¥${(result.actualCost || 0).toLocaleString()}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ 
                        fontSize: '0.65rem', 
                        height: 24,
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  );
                }
              })}
              {timeHeaders.length > 3 && (
                <Typography 
                  variant="caption" 
                  color="primary"
                  sx={{ 
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    ml: 0.5,
                  }}
                >
                  +{timeHeaders.length - 3}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Expanded content - 詳細情報の展開可能UI */}
          <Collapse in={isExpanded} timeout={300}>
            <Divider sx={{ my: 2 }} />
            
            {/* 機器仕様詳細 - 展開可能UI */}
            {item.specifications && item.specifications.length > 0 && (
              <ExpandableDetail
                title="機器仕様詳細"
                priority="medium"
                icon={<InfoIcon />}
                defaultExpanded={false}
              >
                <List dense sx={{ backgroundColor: alpha(theme.palette.background.default, 0.3), borderRadius: 2 }}>
                  {item.specifications.map((spec, index) => (
                    <ListItem 
                      key={index} 
                      sx={{ 
                        py: 1,
                        borderBottom: index < item.specifications!.length - 1 ? 
                          `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
                      }}
                    >
                      <ListItemText
                        primary={
                          <ResponsiveText
                            text={spec.key}
                            maxLines={1}
                            variant="subtitle2"
                            showExpandButton={false}
                          />
                        }
                        secondary={
                          <ResponsiveText
                            text={spec.value}
                            maxLines={3}
                            variant="body2"
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                <Button
                  onClick={() => handleEditClick(item, '', 'specification')}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    mt: 2,
                    minHeight: MIN_TOUCH_TARGET,
                  }}
                >
                  仕様を編集
                </Button>
              </ExpandableDetail>
            )}

            {/* タイムライン詳細 - 展開可能UI */}
            <ExpandableDetail
              title={viewMode === 'status' ? '実施状況詳細' : 'コスト情報詳細'}
              priority="high"
              defaultExpanded={true}
            >
              <List dense>
                {timeHeaders.map(header => renderTimelineItem(item, header))}
              </List>
            </ExpandableDetail>
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  /**
   * 編集ダイアログの表示（モバイル最適化版）
   * 要件3.8, 3.5: フルスクリーンまたは適切なサイズでの表示、片手操作対応
   */
  const renderEditDialogs = () => {
    if (!editContext || !currentEditItem) return null;

    const { item, timeHeader, editType } = currentEditItem;
    const { editState } = editContext;

    // 現在の値を取得
    let statusValue = createStatusValue(false, false);
    let costValue = { planCost: 0, actualCost: 0 };
    let specificationValue: any[] = [];

    if (editType === 'status') {
      const result = item.results[timeHeader];
      statusValue = result ? createStatusValue(result.planned, result.actual) : createStatusValue(false, false);
    } else if (editType === 'cost') {
      const result = item.results[timeHeader];
      costValue = {
        planCost: result?.planCost || 0,
        actualCost: result?.actualCost || 0,
      };
    } else if (editType === 'specification') {
      specificationValue = item.specifications || [];
    }

    return (
      <>
        {/* モバイル最適化状態選択ダイアログ */}
        <MobileStatusSelection
          open={editState.ui.dialogStates.statusSelection}
          currentStatus={statusValue}
          onSelect={(status) => {
            editContext.updateEditValue(status);
            editContext.saveEdit();
          }}
          onClose={handleEditClose}
        />

        {/* モバイル最適化コスト入力ダイアログ */}
        <MobileCostInput
          open={editState.ui.dialogStates.costInput}
          currentCost={costValue}
          onSave={(cost) => {
            editContext.updateEditValue(cost);
            editContext.saveEdit();
          }}
          onClose={handleEditClose}
        />

        {/* モバイル最適化機器仕様編集ダイアログ */}
        <MobileSpecificationEdit
          open={editState.ui.dialogStates.specificationEdit}
          specifications={specificationValue}
          onSave={(specifications) => {
            editContext.updateEditValue(specifications);
            editContext.saveEdit();
          }}
          onClose={handleEditClose}
        />
      </>
    );
  };

  /**
   * ローディング状態のスケルトン表示（モバイル最適化）
   */
  const renderLoadingSkeleton = () => (
    <MobileSkeleton count={5} showPriority={true} />
  );

  // Group data for mobile display
  const displayData = groupedData ? 
    Object.entries(groupedData).flatMap(([groupName, items]) => [
      { isGroupHeader: true, groupName, items } as any,
      ...items
    ]) : 
    data;

  return (
    <ResponsiveLayout
      portraitProps={{
        sx: {
          height: '100%',
          overflow: 'auto',
          backgroundColor: alpha(theme.palette.background.default, 0.5),
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y pan-x', // タッチスクロールを許可
          overscrollBehavior: 'contain', // オーバースクロールを制限
        }
      }}
      landscapeProps={{
        sx: {
          height: '100%',
          overflow: 'auto',
          backgroundColor: alpha(theme.palette.background.default, 0.5),
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y pan-x', // タッチスクロールを許可
          overscrollBehavior: 'contain', // オーバースクロールを制限
          // 横向きでは少し異なるスタイル
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      {loading ? (
        renderLoadingSkeleton()
      ) : (
        <Box sx={{ 
          p: isSmallScreen ? 1 : 2,
          // 回転中は少し透明に
          opacity: isRotating ? 0.7 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}>
          {displayData.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
                textAlign: 'center',
                p: 3,
              }}
            >
              <SmartphoneIcon 
                sx={{ 
                  fontSize: 64,
                  color: theme.palette.grey[400],
                  mb: 2,
                }}
              />
              <Typography 
                variant="h6" 
                color="textSecondary"
                sx={{ mb: 1 }}
              >
                データがありません
              </Typography>
              <Typography 
                variant="body2" 
                color="textSecondary"
              >
                表示するデータが見つかりませんでした
              </Typography>
            </Box>
          ) : (
            // 向き対応グリッドレイアウト
            <OrientationAwareGrid
              portraitColumns={1}
              landscapeColumns={deviceInfo.isSmallScreen ? 1 : 2}
              spacing={2}
            >
              {displayData.map((item: any, index) => {
                if (item.isGroupHeader) {
                  return (
                    <Box 
                      key={`group-${index}`} 
                      sx={{ 
                        mb: 3,
                        gridColumn: '1 / -1', // グループヘッダーは全幅
                      }}
                    >
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          p: 2,
                          backgroundColor: theme.palette.primary.main,
                          color: theme.palette.primary.contrastText,
                          borderRadius: 3,
                          fontSize: deviceInfo.orientation === 'landscape' && !isSmallScreen ? 
                            '1.4rem' : isSmallScreen ? '1.1rem' : '1.3rem',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          boxShadow: theme.shadows[2],
                        }}
                      >
                        {item.groupName} ({item.items.length}件)
                      </Typography>
                    </Box>
                  );
                }
                return renderMobileCard(item);
              })}
            </OrientationAwareGrid>
          )}
        </Box>
      )}
      
      {renderEditDialogs()}
    </ResponsiveLayout>
  );
};

// メインコンポーネント（プロバイダーでラップ）
const MobileGridView: React.FC<MobileGridViewProps> = (props) => {
  return (
    <MobileOrientationProvider
      onOrientationChange={(deviceInfo) => {
        // 向き変更時の処理（必要に応じて追加）
      }}
      persistState={true}
    >
      <MobileGridViewInternal {...props} />
    </MobileOrientationProvider>
  );
};

export default MobileGridView;