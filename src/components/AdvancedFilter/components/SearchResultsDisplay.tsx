import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  Chip,
  Button,
  Collapse,
  LinearProgress,
  Paper,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';

interface SearchResultsDisplayProps {
  searchTerm: string;
  totalResults: number;
  filteredResults: number;
  searchTime: number;
  isSearching: boolean;
  hasResults: boolean;
  suggestions: string[];
  alternativeSuggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  onClearSearch: () => void;
  children?: React.ReactNode;
}

const SearchResultsDisplay: React.FC<SearchResultsDisplayProps> = ({
  searchTerm,
  totalResults,
  filteredResults,
  searchTime,
  isSearching,
  hasResults,
  suggestions,
  alternativeSuggestions,
  onSuggestionClick,
  onClearSearch,
  children,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatSearchTime = (time: number) => {
    if (time < 1) return '< 1ms';
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  const renderSearchStats = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon color="action" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          {filteredResults.toLocaleString()} / {totalResults.toLocaleString()} 件
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SpeedIcon color="action" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          {formatSearchTime(searchTime)}
        </Typography>
      </Box>
      
      {searchTerm && (
        <Chip
          label={`"${searchTerm}"`}
          size="small"
          onDelete={onClearSearch}
          color="primary"
          variant="outlined"
        />
      )}
    </Box>
  );

  const renderSuggestions = () => {
    if (suggestions.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          検索候補:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {suggestions.map((suggestion, index) => (
            <Chip
              key={index}
              label={suggestion}
              size="small"
              variant="outlined"
              onClick={() => onSuggestionClick(suggestion)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  const renderAlternativeSuggestions = () => {
    if (alternativeSuggestions.length === 0) return null;

    return (
      <Alert 
        severity="info" 
        icon={<LightbulbIcon />}
        sx={{ mt: 2 }}
      >
        <Typography variant="body2" gutterBottom>
          検索結果が見つかりませんでした。以下の候補をお試しください:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          {alternativeSuggestions.map((suggestion, index) => (
            <Chip
              key={index}
              label={suggestion}
              size="small"
              color="info"
              variant="outlined"
              onClick={() => onSuggestionClick(suggestion)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Alert>
    );
  };

  const renderPerformanceDetails = () => (
    <Collapse in={showDetails}>
      <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          検索パフォーマンス詳細
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              検索時間
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatSearchTime(searchTime)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              総データ数
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {totalResults.toLocaleString()} 件
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              フィルター後
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {filteredResults.toLocaleString()} 件
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              検索効率
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {totalResults > 0 ? Math.round((filteredResults / totalResults) * 100) : 0}%
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Collapse>
  );

  return (
    <Box>
      {/* Loading indicator */}
      {isSearching && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      {/* Search statistics */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        {renderSearchStats()}
        
        <Button
          size="small"
          onClick={() => setShowDetails(!showDetails)}
          endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          詳細
        </Button>
      </Box>

      {/* Performance details */}
      {renderPerformanceDetails()}

      {/* Search suggestions */}
      {searchTerm && hasResults && renderSuggestions()}

      {/* Alternative suggestions for no results */}
      {searchTerm && !hasResults && renderAlternativeSuggestions()}

      {/* Results content */}
      {children && (
        <>
          <Divider sx={{ my: 2 }} />
          {children}
        </>
      )}

      {/* No results message */}
      {searchTerm && !hasResults && !isSearching && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            「{searchTerm}」に一致する結果が見つかりませんでした。
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            • 検索キーワードを変更してみてください
            <br />
            • より一般的な用語を使用してみてください
            <br />
            • フィルター条件を緩和してみてください
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default SearchResultsDisplay;