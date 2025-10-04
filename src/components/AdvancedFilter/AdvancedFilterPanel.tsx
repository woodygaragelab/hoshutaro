import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { AdvancedFilterPanelProps, FilterCondition } from './types';
import FilterConditionRow from './components/FilterConditionRow';
import SavedFilterManager from './components/SavedFilterManager';
import { createNewFilterCondition, validateFilterCondition } from './utils/filterUtils';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ height: '100%' }}>
    {value === index && children}
  </div>
);

const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  isOpen,
  onClose,
  filters,
  savedFilters,
  availableFields,
  onFilterChange,
  onSaveFilter,
  onUpdateFilter,
  onDuplicateFilter,
  onLoadFilter,
  onDeleteFilter,
  onClearFilters,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [validationErrors, setValidationErrors] = useState<{ [id: string]: string }>({});
  const [showPreview, setShowPreview] = useState(false);

  // Validate filters when they change
  useEffect(() => {
    const errors: { [id: string]: string } = {};
    filters.forEach(filter => {
      const validation = validateFilterCondition(filter);
      if (!validation.isValid && validation.error) {
        errors[filter.id] = validation.error;
      }
    });
    setValidationErrors(errors);
  }, [filters]);

  const handleAddCondition = () => {
    const newCondition = createNewFilterCondition();
    onFilterChange([...filters, newCondition]);
  };

  const handleUpdateCondition = (index: number, updatedCondition: FilterCondition) => {
    const newFilters = [...filters];
    newFilters[index] = updatedCondition;
    onFilterChange(newFilters);
  };

  const handleDeleteCondition = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    onFilterChange(newFilters);
  };

  const handleLoadSavedFilter = (filterId: string) => {
    onLoadFilter(filterId);
    setActiveTab(0); // Switch to filter tab
  };

  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const hasActiveFilters = filters.length > 0;

  const renderFilterPreview = () => {
    if (filters.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">フィルター条件プレビュー</Typography>
          <IconButton
            size="small"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={showPreview}>
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            {filters.map((filter, index) => {
              const field = availableFields.find(f => f.key === filter.field);
              return (
                <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {index > 0 && (
                    <Chip
                      label={filter.logicalOperator || 'AND'}
                      size="small"
                      variant="outlined"
                      color={filter.logicalOperator === 'OR' ? 'warning' : 'primary'}
                    />
                  )}
                  <Typography variant="body2">
                    {field?.label || filter.field} {filter.operator} {
                      Array.isArray(filter.value) 
                        ? `[${filter.value.join(', ')}]`
                        : filter.value
                    }
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600, md: 700 },
          maxWidth: '90vw',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon />
              <Typography variant="h6">高度フィルター</Typography>
              {hasActiveFilters && (
                <Chip
                  label={`${filters.length}条件`}
                  size="small"
                  color="primary"
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasActiveFilters && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={onClearFilters}
                  size="small"
                  color="error"
                >
                  クリア
                </Button>
              )}
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="フィルター条件" />
            <Tab label="保存済みフィルター" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ p: 2 }}>
              {/* Validation Errors */}
              {hasValidationErrors && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    フィルター条件にエラーがあります。修正してください。
                  </Typography>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                    {Object.values(validationErrors).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {/* Filter Preview */}
              {renderFilterPreview()}

              {/* Filter Conditions */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  フィルター条件
                </Typography>
                
                {filters.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      フィルター条件が設定されていません
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleAddCondition}
                      startIcon={<FilterIcon />}
                    >
                      条件を追加
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {filters.map((filter, index) => (
                      <FilterConditionRow
                        key={filter.id}
                        condition={filter}
                        availableFields={availableFields}
                        isFirst={index === 0}
                        onUpdate={(updatedCondition) => handleUpdateCondition(index, updatedCondition)}
                        onDelete={() => handleDeleteCondition(index)}
                        onAddCondition={handleAddCondition}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              {/* Help Text */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="body2" color="info.contrastText">
                  <strong>使い方:</strong>
                  <br />
                  • 複数の条件を「かつ」または「または」で組み合わせできます
                  <br />
                  • 「かつ」条件は全て満たす必要があります
                  <br />
                  • 「または」条件はいずれかを満たせば該当します
                  <br />
                  • 条件は上から順に評価されます
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box sx={{ p: 2 }}>
              <SavedFilterManager
                savedFilters={savedFilters}
                currentFilters={filters}
                availableFields={availableFields}
                onLoadFilter={handleLoadSavedFilter}
                onDeleteFilter={onDeleteFilter}
                onSaveFilter={onSaveFilter}
                onUpdateFilter={onUpdateFilter}
                onDuplicateFilter={onDuplicateFilter}
              />
            </Box>
          </TabPanel>
        </Box>

        {/* Footer */}
        {activeTab === 0 && hasActiveFilters && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {filters.length}つの条件が設定されています
                {hasValidationErrors && ' (エラーあり)'}
              </Typography>
              <Button
                variant="contained"
                onClick={onClose}
                disabled={hasValidationErrors}
              >
                適用
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default AdvancedFilterPanel;