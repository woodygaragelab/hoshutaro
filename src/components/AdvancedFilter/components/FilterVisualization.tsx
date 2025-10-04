import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Clear as ClearIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { FilterCondition, FilterField } from '../types';

interface FilterVisualizationProps {
  filters: FilterCondition[];
  availableFields: FilterField[];
  onRemoveFilter: (index: number) => void;
  onClearAllFilters: () => void;
  showDetails?: boolean;
  onToggleDetails?: () => void;
}

const operatorLabels: Record<string, string> = {
  equals: '=',
  contains: '含む',
  startsWith: '始まる',
  endsWith: '終わる',
  greaterThan: '>',
  lessThan: '<',
  between: '範囲',
  in: 'いずれか',
  notIn: '除外',
  isEmpty: '空',
  isNotEmpty: '非空',
};

const logicalOperatorLabels: Record<string, string> = {
  AND: 'かつ',
  OR: 'または',
};

const FilterVisualization: React.FC<FilterVisualizationProps> = ({
  filters,
  availableFields,
  onRemoveFilter,
  onClearAllFilters,
  showDetails = false,
  onToggleDetails,
}) => {
  if (filters.length === 0) {
    return null;
  }

  const getFieldLabel = (fieldKey: string) => {
    const field = availableFields.find(f => f.key === fieldKey);
    return field?.label || fieldKey;
  };

  const formatValue = (value: any, operator: string) => {
    if (operator === 'between' && Array.isArray(value)) {
      return `${value[0]} 〜 ${value[1]}`;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      return '';
    }
    return String(value);
  };

  const renderSimpleView = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="text.secondary">
        フィルター条件:
      </Typography>
      
      {filters.map((filter, index) => {
        const fieldLabel = getFieldLabel(filter.field);
        const operatorLabel = operatorLabels[filter.operator] || filter.operator;
        const formattedValue = formatValue(filter.value, filter.operator);
        
        return (
          <React.Fragment key={filter.id}>
            {index > 0 && (
              <Chip
                label={logicalOperatorLabels[filter.logicalOperator || 'AND']}
                size="small"
                color={filter.logicalOperator === 'OR' ? 'warning' : 'default'}
                variant="outlined"
              />
            )}
            <Chip
              label={`${fieldLabel} ${operatorLabel} ${formattedValue}`.trim()}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={() => onRemoveFilter(index)}
              deleteIcon={<ClearIcon />}
            />
          </React.Fragment>
        );
      })}
      
      <Tooltip title="すべてクリア">
        <IconButton size="small" onClick={onClearAllFilters} color="error">
          <ClearIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      {onToggleDetails && (
        <Tooltip title={showDetails ? "詳細を隠す" : "詳細を表示"}>
          <IconButton size="small" onClick={onToggleDetails}>
            {showDetails ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const renderDetailedView = () => (
    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2">
          フィルター条件詳細 ({filters.length}件)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onToggleDetails && (
            <IconButton size="small" onClick={onToggleDetails}>
              <VisibilityOffIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClearAllFilters} color="error">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filters.map((filter, index) => {
          const fieldLabel = getFieldLabel(filter.field);
          const operatorLabel = operatorLabels[filter.operator] || filter.operator;
          const formattedValue = formatValue(filter.value, filter.operator);
          
          return (
            <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {index > 0 && (
                <Chip
                  label={logicalOperatorLabels[filter.logicalOperator || 'AND']}
                  size="small"
                  color={filter.logicalOperator === 'OR' ? 'warning' : 'primary'}
                  sx={{ minWidth: 60 }}
                />
              )}
              
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                flex: 1,
                p: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper'
              }}>
                <Typography variant="body2" fontWeight="medium">
                  {fieldLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {operatorLabel}
                </Typography>
                {formattedValue && (
                  <Typography variant="body2" color="primary">
                    {formattedValue}
                  </Typography>
                )}
                
                <Box sx={{ ml: 'auto' }}>
                  <IconButton
                    size="small"
                    onClick={() => onRemoveFilter(index)}
                    color="error"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="caption" color="text.secondary">
        条件は上から順に評価されます。「または」条件は新しいグループを開始し、「かつ」条件は同じグループ内で評価されます。
      </Typography>
    </Paper>
  );

  return (
    <Box>
      {showDetails ? renderDetailedView() : renderSimpleView()}
    </Box>
  );
};

export default FilterVisualization;