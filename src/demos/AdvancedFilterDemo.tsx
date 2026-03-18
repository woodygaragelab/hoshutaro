import React, { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { 
  AdvancedFilterPanel, 
  EnhancedSearchBox, 
  useAdvancedFilter, 
  FilterField 
} from './components/AdvancedFilter';
import { useEnhancedSearch } from './components/AdvancedFilter/hooks/useEnhancedSearch';
import SearchResultsDisplay from './components/AdvancedFilter/components/SearchResultsDisplay';

import rawData from './data/equipments.json';
import { transformData } from './utils/dataTransformer';

const AdvancedFilterDemo: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Transform raw data
  const [maintenanceData] = useMemo(() => {
    const [flatData] = transformData(rawData as any, 'year');
    return [flatData];
  }, []);

  // Define available filter fields
  const availableFields: FilterField[] = useMemo(() => [
    {
      key: 'task',
      label: '機器名',
      type: 'text',
    },
    {
      key: 'hierarchyPath',
      label: '階層パス',
      type: 'text',
    },
    {
      key: 'cycle',
      label: '周期',
      type: 'select',
      options: [
        { value: '年次', label: '年次' },
        { value: '半年', label: '半年' },
        { value: '四半期', label: '四半期' },
        { value: '月次', label: '月次' },
        { value: '週次', label: '週次' },
        { value: '日次', label: '日次' },
      ],
    },
    {
      key: 'bomCode',
      label: 'TAG No.',
      type: 'text',
    },
    {
      key: 'specifications.0.key',
      label: '仕様項目1',
      type: 'text',
    },
    {
      key: 'specifications.0.value',
      label: '仕様値1',
      type: 'text',
    },
  ], []);

  // Use advanced filter hook
  const {
    filters,
    savedFilters,
    setFilters,
    clearFilters,
    saveFilter,
    updateSavedFilter,
    duplicateFilter,
    loadFilter,
    deleteFilter,
  } = useAdvancedFilter({
    data: maintenanceData,
    availableFields,
    searchTerm,
  });

  // Use enhanced search hook
  const {
    searchResult,
    suggestions,
    alternativeSuggestions,
    isSearching,
    searchHistory,
    addToHistory,
  } = useEnhancedSearch({
    data: maintenanceData,
    filters,
    searchTerm,
    debounceMs: 300,
  });

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSearchSubmit = (value: string) => {
    if (value.trim()) {
      addToHistory(value);
    }
  };

  const handleOpenFilterPanel = () => {
    setIsFilterPanelOpen(true);
  };

  const handleCloseFilterPanel = () => {
    setIsFilterPanelOpen(false);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        高度フィルタリング・検索機能デモ
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        既存の検索機能を拡張した高度フィルタリング機能のデモです。
        複数条件の組み合わせ検索、保存済みフィルター管理、リアルタイム検索候補表示などの機能を提供します。
      </Typography>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <EnhancedSearchBox
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              onSearchSubmit={handleSearchSubmit}
              suggestions={suggestions}
              searchHistory={searchHistory}
              onAdvancedFilterClick={handleOpenFilterPanel}
              hasActiveFilters={filters.length > 0}
              filterCount={filters.length}
              placeholder="機器名、階層、仕様などで検索..."
              isSearching={isSearching}
              searchTime={searchResult.searchTime}
              resultCount={searchResult.items.length}
            />
          </Box>
          
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={handleOpenFilterPanel}
            color={filters.length > 0 ? 'primary' : 'inherit'}
          >
            高度フィルター
            {filters.length > 0 && (
              <Chip
                label={filters.length}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Button>
        </Box>

        {/* Search Results Display */}
        <SearchResultsDisplay
          searchTerm={searchTerm}
          totalResults={searchResult.totalCount}
          filteredResults={searchResult.items.length}
          searchTime={searchResult.searchTime}
          isSearching={isSearching}
          hasResults={searchResult.hasResults}
          suggestions={suggestions}
          alternativeSuggestions={alternativeSuggestions}
          onSuggestionClick={handleSearchChange}
          onClearSearch={() => setSearchTerm('')}
        />

        {/* Active Filters */}
        {filters.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              アクティブフィルター:
            </Typography>
            {filters.map((filter, index) => (
              <Chip
                key={filter.id}
                label={`${availableFields.find(f => f.key === filter.field)?.label || filter.field}: ${filter.operator} ${filter.value}`}
                size="small"
                onDelete={() => {
                  const newFilters = filters.filter((_, i) => i !== index);
                  setFilters(newFilters);
                }}
                color="secondary"
                variant="outlined"
              />
            ))}
            <Button
              size="small"
              onClick={clearFilters}
              color="error"
            >
              すべてクリア
            </Button>
          </Box>
        )}
      </Paper>

      {/* Results */}
      {searchResult.hasResults ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>機器名</TableCell>
                <TableCell>階層パス</TableCell>
                <TableCell>TAG No.</TableCell>
                <TableCell>周期</TableCell>
                <TableCell>仕様</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {searchResult.items.slice(0, 50).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.task}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {item.hierarchyPath}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.bomCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.cycle}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {item.specifications?.slice(0, 2).map((spec, index) => (
                        <Chip
                          key={index}
                          label={`${spec.key}: ${spec.value}`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      ))}
                      {(item.specifications?.length || 0) > 2 && (
                        <Chip
                          label={`+${(item.specifications?.length || 0) - 2}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {searchResult.items.length > 50 && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                最初の50件を表示中（全{searchResult.items.length}件）
              </Typography>
            </Box>
          )}
        </TableContainer>
      ) : null}

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={handleCloseFilterPanel}
        filters={filters}
        savedFilters={savedFilters}
        availableFields={availableFields}
        onFilterChange={setFilters}
        onSaveFilter={saveFilter}
        onUpdateFilter={updateSavedFilter}
        onDuplicateFilter={duplicateFilter}
        onLoadFilter={loadFilter}
        onDeleteFilter={deleteFilter}
        onClearFilters={clearFilters}
      />
    </Container>
  );
};

export default AdvancedFilterDemo;