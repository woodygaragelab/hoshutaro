import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Chip,
  Autocomplete,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { FilterCondition, FilterField, FilterOperator, LogicalOperator } from '../types';

interface FilterConditionRowProps {
  condition: FilterCondition;
  availableFields: FilterField[];
  isFirst: boolean;
  onUpdate: (condition: FilterCondition) => void;
  onDelete: () => void;
  onAddCondition: () => void;
}

const operatorLabels: Record<FilterOperator, string> = {
  equals: '等しい',
  contains: '含む',
  startsWith: '始まる',
  endsWith: '終わる',
  greaterThan: 'より大きい',
  lessThan: 'より小さい',
  between: '範囲内',
  in: 'いずれか',
  notIn: 'いずれでもない',
  isEmpty: '空である',
  isNotEmpty: '空でない',
};

const logicalOperatorLabels: Record<LogicalOperator, string> = {
  AND: 'かつ',
  OR: 'または',
};

const FilterConditionRow: React.FC<FilterConditionRowProps> = ({
  condition,
  availableFields,
  isFirst,
  onUpdate,
  onDelete,
  onAddCondition,
}) => {
  const selectedField = availableFields.find(f => f.key === condition.field);
  
  const getAvailableOperators = (): FilterOperator[] => {
    if (!selectedField) return ['contains', 'equals'];
    
    switch (selectedField.type) {
      case 'text':
        return ['equals', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
      case 'number':
        return ['equals', 'greaterThan', 'lessThan', 'between', 'isEmpty', 'isNotEmpty'];
      case 'select':
        return ['equals', 'in', 'notIn', 'isEmpty', 'isNotEmpty'];
      case 'boolean':
        return ['equals'];
      case 'date':
        return ['equals', 'greaterThan', 'lessThan', 'between'];
      default:
        return ['contains', 'equals'];
    }
  };

  const handleFieldChange = (event: SelectChangeEvent) => {
    const newField = event.target.value;
    const field = availableFields.find(f => f.key === newField);
    const availableOps = getAvailableOperators();
    
    onUpdate({
      ...condition,
      field: newField,
      operator: availableOps.includes(condition.operator) ? condition.operator : availableOps[0],
      value: '',
    });
  };

  const handleOperatorChange = (event: SelectChangeEvent) => {
    const newOperator = event.target.value as FilterOperator;
    let newValue = condition.value;
    
    // Reset value for operators that don't need input
    if (['isEmpty', 'isNotEmpty'].includes(newOperator)) {
      newValue = '';
    } else if (newOperator === 'between' && !Array.isArray(condition.value)) {
      newValue = ['', ''];
    } else if (['in', 'notIn'].includes(newOperator) && !Array.isArray(condition.value)) {
      newValue = [];
    }
    
    onUpdate({
      ...condition,
      operator: newOperator,
      value: newValue,
    });
  };

  const handleValueChange = (newValue: any) => {
    onUpdate({
      ...condition,
      value: newValue,
    });
  };

  const handleLogicalOperatorChange = (event: SelectChangeEvent) => {
    onUpdate({
      ...condition,
      logicalOperator: event.target.value as LogicalOperator,
    });
  };

  const renderValueInput = () => {
    if (['isEmpty', 'isNotEmpty'].includes(condition.operator)) {
      return null;
    }

    if (condition.operator === 'between') {
      const values = Array.isArray(condition.value) ? condition.value : ['', ''];
      return (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            type={selectedField?.type === 'number' ? 'number' : 'text'}
            value={values[0] || ''}
            onChange={(e) => handleValueChange([e.target.value, values[1]])}
            placeholder="最小値"
            sx={{ width: 100 }}
          />
          <Typography variant="body2">〜</Typography>
          <TextField
            size="small"
            type={selectedField?.type === 'number' ? 'number' : 'text'}
            value={values[1] || ''}
            onChange={(e) => handleValueChange([values[0], e.target.value])}
            placeholder="最大値"
            sx={{ width: 100 }}
          />
        </Box>
      );
    }

    if (['in', 'notIn'].includes(condition.operator)) {
      const values = Array.isArray(condition.value) ? condition.value : [];
      
      if (selectedField?.options) {
        return (
          <Autocomplete
            multiple
            size="small"
            options={selectedField.options}
            getOptionLabel={(option) => option.label}
            value={selectedField.options.filter(opt => values.includes(opt.value))}
            onChange={(_, newValue) => {
              handleValueChange(newValue.map(opt => opt.value));
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.label}
                  size="small"
                  {...getTagProps({ index })}
                  key={option.value}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="選択してください"
                sx={{ minWidth: 200 }}
              />
            )}
          />
        );
      } else {
        return (
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={[]}
            value={values}
            onChange={(_, newValue) => handleValueChange(newValue)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option}
                  size="small"
                  {...getTagProps({ index })}
                  key={index}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="値を入力してEnter"
                sx={{ minWidth: 200 }}
              />
            )}
          />
        );
      }
    }

    if (selectedField?.options) {
      return (
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select
            value={condition.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
          >
            {selectedField.options.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        size="small"
        type={selectedField?.type === 'number' ? 'number' : 'text'}
        value={condition.value || ''}
        onChange={(e) => handleValueChange(e.target.value)}
        placeholder="値を入力"
        sx={{ minWidth: 150 }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
      {/* Logical Operator (except for first condition) */}
      {!isFirst && (
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={condition.logicalOperator || 'AND'}
            onChange={handleLogicalOperatorChange}
          >
            {Object.entries(logicalOperatorLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Field Selection */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>フィールド</InputLabel>
        <Select
          value={condition.field}
          label="フィールド"
          onChange={handleFieldChange}
        >
          {availableFields.map(field => (
            <MenuItem key={field.key} value={field.key}>
              {field.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Operator Selection */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>条件</InputLabel>
        <Select
          value={condition.operator}
          label="条件"
          onChange={handleOperatorChange}
        >
          {getAvailableOperators().map(op => (
            <MenuItem key={op} value={op}>
              {operatorLabels[op]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Value Input */}
      {renderValueInput()}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={onAddCondition}
          color="primary"
          title="条件を追加"
        >
          <AddIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={onDelete}
          color="error"
          title="条件を削除"
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default FilterConditionRow;