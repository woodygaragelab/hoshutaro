import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
} from '@mui/material';
import { FilterCondition, FilterField } from '../types';

interface HierarchyFilterIntegrationProps {
  level1Filter: string;
  level2Filter: string;
  level3Filter: string;
  onLevel1FilterChange: (event: SelectChangeEvent) => void;
  onLevel2FilterChange: (event: SelectChangeEvent) => void;
  onLevel3FilterChange: (event: SelectChangeEvent) => void;
  hierarchyFilterTree: any;
  level2Options: string[];
  level3Options: string[];
  onConvertToAdvancedFilter: (conditions: FilterCondition[]) => void;
}

const HierarchyFilterIntegration: React.FC<HierarchyFilterIntegrationProps> = ({
  level1Filter,
  level2Filter,
  level3Filter,
  onLevel1FilterChange,
  onLevel2FilterChange,
  onLevel3FilterChange,
  hierarchyFilterTree,
  level2Options,
  level3Options,
  onConvertToAdvancedFilter,
}) => {
  const hasActiveHierarchyFilters = level1Filter !== 'all' || level2Filter !== 'all' || level3Filter !== 'all';

  const convertToAdvancedFilters = () => {
    const conditions: FilterCondition[] = [];
    
    if (level1Filter !== 'all') {
      conditions.push({
        id: `hierarchy_level1_${Date.now()}`,
        field: 'hierarchyPath',
        operator: 'startsWith',
        value: level1Filter,
        logicalOperator: 'AND',
      });
    }
    
    if (level2Filter !== 'all') {
      conditions.push({
        id: `hierarchy_level2_${Date.now()}`,
        field: 'hierarchyPath',
        operator: 'contains',
        value: `${level1Filter} > ${level2Filter}`,
        logicalOperator: 'AND',
      });
    }
    
    if (level3Filter !== 'all') {
      conditions.push({
        id: `hierarchy_level3_${Date.now()}`,
        field: 'hierarchyPath',
        operator: 'contains',
        value: `${level1Filter} > ${level2Filter} > ${level3Filter}`,
        logicalOperator: 'AND',
      });
    }
    
    if (conditions.length > 0) {
      onConvertToAdvancedFilter(conditions);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        階層フィルター（既存機能）
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>階層レベル1</InputLabel>
          <Select
            value={level1Filter}
            label="階層レベル1"
            onChange={onLevel1FilterChange}
          >
            <MenuItem value="all">すべて</MenuItem>
            {hierarchyFilterTree && Object.keys(hierarchyFilterTree.children).map(name => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 150 }} disabled={level1Filter === 'all'}>
          <InputLabel>階層レベル2</InputLabel>
          <Select
            value={level2Filter}
            label="階層レベル2"
            onChange={onLevel2FilterChange}
          >
            <MenuItem value="all">すべて</MenuItem>
            {level2Options.map(name => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 150 }} disabled={level2Filter === 'all'}>
          <InputLabel>階層レベル3</InputLabel>
          <Select
            value={level3Filter}
            label="階層レベル3"
            onChange={onLevel3FilterChange}
          >
            <MenuItem value="all">すべて</MenuItem>
            {level3Options.map(name => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {hasActiveHierarchyFilters && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            アクティブな階層フィルター:
          </Typography>
          
          {level1Filter !== 'all' && (
            <Chip
              label={`レベル1: ${level1Filter}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          
          {level2Filter !== 'all' && (
            <Chip
              label={`レベル2: ${level2Filter}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          
          {level3Filter !== 'all' && (
            <Chip
              label={`レベル3: ${level3Filter}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          
          <Typography
            variant="body2"
            color="primary"
            sx={{ 
              cursor: 'pointer', 
              textDecoration: 'underline',
              '&:hover': { color: 'primary.dark' }
            }}
            onClick={convertToAdvancedFilters}
          >
            高度フィルターに変換
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HierarchyFilterIntegration;