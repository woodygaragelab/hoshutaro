import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip,
  Card,
  CardContent,
  useTheme,
  alpha,
  useMediaQuery,
  Skeleton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  PriorityHigh as PriorityIcon,
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';

/**
 * 長いテキストの適切な改行表示コンポーネント
 * 要件3.9: 長いテキストの適切な改行表示
 */
interface ResponsiveTextProps {
  text: string;
  maxLines?: number;
  variant?: 'body1' | 'body2' | 'caption' | 'subtitle1' | 'subtitle2';
  showExpandButton?: boolean;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  text,
  maxLines = 2,
  variant = 'body2',
  showExpandButton = true,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowExpand, setShouldShowExpand] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(textRef.current).lineHeight);
      const maxHeight = lineHeight * maxLines;
      setShouldShowExpand(textRef.current.scrollHeight > maxHeight);
    }
  }, [text, maxLines]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <span>
      <Typography
        ref={textRef}
        variant={variant}
        component="span"
        sx={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: 1.5,
          ...(isSmallScreen && {
            fontSize: variant === 'body1' ? '0.9rem' : 
                     variant === 'body2' ? '0.8rem' : 
                     variant === 'caption' ? '0.7rem' : undefined,
          }),
          ...(!isExpanded && shouldShowExpand && {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {text}
      </Typography>
      
      {shouldShowExpand && showExpandButton && (
        <span style={{ marginTop: '0.25rem', display: 'inline-block' }}>
          <Chip
            label={isExpanded ? '折りたたむ' : 'もっと見る'}
            size="small"
            onClick={handleToggleExpand}
            sx={{
              fontSize: '0.7rem',
              height: 24,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
              },
            }}
          />
        </span>
      )}
    </span>
  );
};

/**
 * 重要情報の優先表示コンポーネント
 * 要件3.13, 3.14: 重要情報の優先表示、詳細情報の展開可能UI
 */
interface PriorityInfoDisplayProps {
  item: HierarchicalData;
  timeHeaders: string[];
  viewMode: 'status' | 'cost';
  showBomCode: boolean;
  showCycle: boolean;
}

export const PriorityInfoDisplay: React.FC<PriorityInfoDisplayProps> = ({
  item,
  timeHeaders,
  viewMode,
  showBomCode,
  showCycle,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // 重要度の計算
  const calculatePriority = () => {
    let priority = 0;
    
    // 実績がある項目は高優先度
    timeHeaders.forEach(header => {
      const result = item.results[header];
      if (result?.actual) priority += 3;
      if (result?.planned) priority += 1;
    });
    
    // コストが高い項目は高優先度
    const totalCost = timeHeaders.reduce((sum, header) => {
      const result = item.results[header];
      return sum + (result?.actualCost || result?.planCost || 0);
    }, 0);
    
    if (totalCost > 1000000) priority += 2; // 100万円以上
    if (totalCost > 5000000) priority += 3; // 500万円以上
    
    return priority;
  };

  const priority = calculatePriority();
  const isHighPriority = priority >= 5;

  // 最新の状態を取得
  const getLatestStatus = () => {
    for (let i = timeHeaders.length - 1; i >= 0; i--) {
      const result = item.results[timeHeaders[i]];
      if (result && (result.planned || result.actual)) {
        return {
          header: timeHeaders[i],
          planned: result.planned,
          actual: result.actual,
          cost: result.actualCost || result.planCost || 0,
        };
      }
    }
    return null;
  };

  const latestStatus = getLatestStatus();

  // 重要な仕様項目（最初の2つ）
  const importantSpecs = item.specifications?.slice(0, 2) || [];

  return (
    <Box>
      {/* 優先度インジケーター */}
      {isHighPriority && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <PriorityIcon 
            sx={{ 
              color: theme.palette.warning.main, 
              fontSize: '1rem',
              mr: 0.5,
            }} 
          />
          <Chip
            label="重要"
            size="small"
            color="warning"
            sx={{
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 'bold',
            }}
          />
        </Box>
      )}

      {/* タスク名（重要情報として常に表示） */}
      <ResponsiveText
        text={item.task}
        maxLines={isSmallScreen ? 2 : 3}
        variant="subtitle1"
      />

      {/* メタデータ（重要度に応じて表示） */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, mb: 2 }}>
        {showBomCode && item.bomCode && (
          <Chip 
            label={`TAG: ${item.bomCode}`} 
            size="small" 
            variant="outlined"
            color="primary"
            sx={{ 
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
        {showCycle && item.cycle && (
          <Chip 
            label={`周期: ${item.cycle}`} 
            size="small" 
            variant="outlined"
            color="secondary"
            sx={{ 
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
        {item.hierarchyPath && (
          <Chip 
            label={item.hierarchyPath} 
            size="small" 
            color="info"
            variant="filled"
            sx={{ 
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
      </Box>

      {/* 最新状態（重要情報として優先表示） */}
      {latestStatus && (
        <Card
          sx={{
            mb: 2,
            backgroundColor: alpha(
              latestStatus.actual ? theme.palette.success.main : theme.palette.primary.main,
              0.05
            ),
            border: `1px solid ${alpha(
              latestStatus.actual ? theme.palette.success.main : theme.palette.primary.main,
              0.2
            )}`,
          }}
        >
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ fontSize: '0.7rem', display: 'block' }}
                >
                  最新状況 ({latestStatus.header})
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 'bold',
                    fontSize: isSmallScreen ? '0.8rem' : '0.85rem',
                    color: latestStatus.actual ? theme.palette.success.main : theme.palette.primary.main,
                  }}
                >
                  {latestStatus.actual ? '実施済み' : '計画済み'}
                  {latestStatus.planned && latestStatus.actual && ' (両方完了)'}
                </Typography>
              </Box>
              
              {viewMode === 'cost' && latestStatus.cost > 0 && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 'bold',
                    fontSize: isSmallScreen ? '0.8rem' : '0.85rem',
                  }}
                >
                  ¥{latestStatus.cost.toLocaleString()}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 重要な仕様項目（最初の2つを優先表示） */}
      {importantSpecs.length > 0 && (
        <Card
          sx={{
            backgroundColor: alpha(theme.palette.info.main, 0.05),
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          }}
        >
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ 
                fontSize: '0.7rem', 
                display: 'block',
                mb: 1,
                fontWeight: 'medium',
              }}
            >
              主要仕様
            </Typography>
            {importantSpecs.map((spec, index) => (
              <Box key={index} sx={{ mb: index < importantSpecs.length - 1 ? 1 : 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: isSmallScreen ? '0.75rem' : '0.8rem',
                    fontWeight: 'medium',
                    color: theme.palette.text.primary,
                  }}
                >
                  {spec.key}:
                </Typography>
                <ResponsiveText
                  text={spec.value}
                  maxLines={2}
                  variant="body2"
                  showExpandButton={false}
                />
              </Box>
            ))}
            {item.specifications && item.specifications.length > 2 && (
              <Typography
                variant="caption"
                color="primary"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 'medium',
                  mt: 0.5,
                  display: 'block',
                }}
              >
                他{item.specifications.length - 2}項目あり
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

/**
 * 詳細情報の展開可能UIコンポーネント
 * 要件3.14: 詳細情報の展開可能UI
 */
interface ExpandableDetailProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  priority?: 'high' | 'medium' | 'low';
  icon?: React.ReactNode;
}

export const ExpandableDetail: React.FC<ExpandableDetailProps> = ({
  title,
  children,
  defaultExpanded = false,
  priority = 'medium',
  icon,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  const getPriorityColor = () => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.info.main;
      default: return theme.palette.primary.main;
    }
  };

  return (
    <Card
      sx={{
        mb: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(getPriorityColor(), 0.2)}`,
        backgroundColor: alpha(getPriorityColor(), 0.02),
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* ヘッダー */}
        <Box
          onClick={handleToggle}
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 2,
            cursor: 'pointer',
            minHeight: 44, // タッチターゲット
            '&:hover': {
              backgroundColor: alpha(getPriorityColor(), 0.05),
            },
            transition: 'background-color 0.2s ease-in-out',
          }}
        >
          {icon && (
            <Box sx={{ mr: 1, color: getPriorityColor() }}>
              {icon}
            </Box>
          )}
          
          <Typography
            variant="subtitle2"
            sx={{
              flexGrow: 1,
              fontWeight: 'bold',
              fontSize: isSmallScreen ? '0.9rem' : '1rem',
              color: getPriorityColor(),
            }}
          >
            {title}
          </Typography>
          
          <IconButton
            size="small"
            sx={{
              minWidth: 32,
              minHeight: 32,
              color: getPriorityColor(),
            }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* 展開可能コンテンツ */}
        <Collapse in={expanded} timeout={300}>
          <Box sx={{ px: 2, pb: 2 }}>
            {children}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

/**
 * モバイル用のローディングスケルトン
 */
interface MobileSkeletonProps {
  count?: number;
  showPriority?: boolean;
}

export const MobileSkeleton: React.FC<MobileSkeletonProps> = ({
  count = 3,
  showPriority = false,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 2 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} sx={{ mb: 2, borderRadius: 3 }}>
          <CardContent sx={{ p: 2 }}>
            {/* 優先度インジケーター */}
            {showPriority && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Skeleton variant="circular" width={16} height={16} sx={{ mr: 0.5 }} />
                <Skeleton variant="rounded" width={40} height={20} />
              </Box>
            )}

            {/* ヘッダー */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ flexGrow: 1, pr: 1 }}>
                <Skeleton variant="text" width="80%" height={28} />
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                  <Skeleton variant="rounded" width={60} height={24} />
                  <Skeleton variant="rounded" width={80} height={24} />
                </Box>
              </Box>
              <Skeleton variant="rounded" width={44} height={44} />
            </Box>

            {/* 最新状況 */}
            <Skeleton variant="rounded" width="100%" height={60} sx={{ mb: 2 }} />

            {/* 主要仕様 */}
            <Skeleton variant="rounded" width="100%" height={80} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};