import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Popper,
  ClickAwayListener,
  Fade,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { debounce } from '../utils/searchOptimization';

interface EnhancedSearchBoxProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  suggestions?: string[];
  searchHistory?: string[];
  onAdvancedFilterClick: () => void;
  hasActiveFilters: boolean;
  filterCount: number;
  placeholder?: string;
  disabled?: boolean;
  isSearching?: boolean;
  searchTime?: number;
  resultCount?: number;
  onSearchSubmit?: (term: string) => void;
}

const EnhancedSearchBox: React.FC<EnhancedSearchBoxProps> = ({
  searchTerm,
  onSearchChange,
  suggestions = [],
  searchHistory = [],
  onAdvancedFilterClick,
  hasActiveFilters,
  filterCount,
  placeholder = "機器を検索...",
  disabled = false,
  isSearching = false,
  searchTime,
  resultCount,
  onSearchSubmit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState(searchTerm);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search change
  const debouncedOnSearchChange = useMemo(
    () => debounce((value: string) => {
      onSearchChange(value);
    }, 300),
    [onSearchChange]
  );

  // Update internal value when external searchTerm changes
  useEffect(() => {
    setInternalValue(searchTerm);
  }, [searchTerm]);

  // Combine suggestions and history
  const allSuggestions = useMemo(() => [
    ...suggestions.map(s => ({ type: 'suggestion' as const, text: s })),
    ...searchHistory
      .filter(h => h.toLowerCase().includes(internalValue.toLowerCase()) && h !== internalValue)
      .slice(0, 3)
      .map(h => ({ type: 'history' as const, text: h }))
  ].slice(0, 8), [suggestions, searchHistory, internalValue]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [internalValue]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInternalValue(value);
    debouncedOnSearchChange(value);
    setIsOpen(value.length > 0);
  };

  const handleInputFocus = () => {
    if (internalValue.length > 0 || searchHistory.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInternalValue(suggestion);
    onSearchChange(suggestion);
    if (onSearchSubmit) {
      onSearchSubmit(suggestion);
    }
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < allSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allSuggestions.length) {
          handleSuggestionClick(allSuggestions[highlightedIndex].text);
        } else {
          if (onSearchSubmit && internalValue.trim()) {
            onSearchSubmit(internalValue.trim());
          }
          setIsOpen(false);
          inputRef.current?.blur();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleClear = () => {
    setInternalValue('');
    onSearchChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClickAway = () => {
    setIsOpen(false);
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box ref={anchorRef} sx={{ position: 'relative', minWidth: 250 }}>
        <TextField
          ref={inputRef}
          fullWidth
          size="small"
          placeholder={placeholder}
          value={internalValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isSearching && (
                    <CircularProgress size={16} />
                  )}
                  {internalValue && (
                    <IconButton
                      size="small"
                      onClick={handleClear}
                      title="クリア"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={onAdvancedFilterClick}
                    color={hasActiveFilters ? 'primary' : 'default'}
                    title="高度フィルター"
                  >
                    <FilterIcon fontSize="small" />
                    {hasActiveFilters && filterCount > 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          fontSize: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {filterCount}
                      </Box>
                    )}
                  </IconButton>
                </Box>
              </InputAdornment>
            ),
          }}
        />

        <Popper
          open={isOpen}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth }}
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <Paper
                elevation={8}
                sx={{
                  mt: 0.5,
                  maxHeight: 300,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <List dense>
                  {/* Search suggestions */}
                  {suggestions.length > 0 && (
                    <>
                      <ListItem>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon fontSize="small" color="primary" />
                          <Typography variant="caption" color="primary" fontWeight="medium">
                            検索候補
                          </Typography>
                        </Box>
                      </ListItem>
                      {suggestions.slice(0, 5).map((suggestion, index) => (
                        <ListItem
                          key={`suggestion-${index}`}
                          button
                          selected={index === highlightedIndex}
                          onClick={() => handleSuggestionClick(suggestion)}
                          sx={{
                            pl: 4,
                            '&.Mui-selected': {
                              backgroundColor: 'primary.light',
                              '&:hover': {
                                backgroundColor: 'primary.light',
                              },
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <SearchIcon fontSize="small" color="action" />
                            <ListItemText
                              primary={
                                <Typography variant="body2">
                                  {suggestion}
                                </Typography>
                              }
                            />
                          </Box>
                        </ListItem>
                      ))}
                      {searchHistory.length > 0 && <Divider />}
                    </>
                  )}

                  {/* Search history */}
                  {searchHistory.length > 0 && (
                    <>
                      <ListItem>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HistoryIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary" fontWeight="medium">
                            検索履歴
                          </Typography>
                        </Box>
                      </ListItem>
                      {searchHistory
                        .filter(h => h.toLowerCase().includes(internalValue.toLowerCase()) && h !== internalValue)
                        .slice(0, 3)
                        .map((historyItem, index) => (
                          <ListItem
                            key={`history-${index}`}
                            button
                            selected={suggestions.length + index === highlightedIndex}
                            onClick={() => handleSuggestionClick(historyItem)}
                            sx={{
                              pl: 4,
                              '&.Mui-selected': {
                                backgroundColor: 'primary.light',
                                '&:hover': {
                                  backgroundColor: 'primary.light',
                                },
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <HistoryIcon fontSize="small" color="action" />
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2">
                                      {historyItem}
                                    </Typography>
                                    <Chip
                                      label="履歴"
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontSize: 10, height: 18 }}
                                    />
                                  </Box>
                                }
                              />
                            </Box>
                          </ListItem>
                        ))}
                    </>
                  )}

                  {/* No suggestions */}
                  {allSuggestions.length === 0 && internalValue.length > 0 && (
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography variant="body2" color="text.secondary">
                            候補が見つかりませんでした
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}

                  {/* Performance info */}
                  {searchTime !== undefined && resultCount !== undefined && (
                    <>
                      <Divider />
                      <ListItem>
                        <Typography variant="caption" color="text.secondary">
                          {resultCount.toLocaleString()}件 • {searchTime < 1 ? '< 1ms' : `${Math.round(searchTime)}ms`}
                        </Typography>
                      </ListItem>
                    </>
                  )}
                </List>
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default EnhancedSearchBox;