import React, { useState, useMemo } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { HierarchicalData } from './types';
import { EnhancedMaintenanceGrid } from './components/EnhancedMaintenanceGrid';

// Sample data for demonstration
const sampleData: HierarchicalData[] = [
  {
    id: '1',
    task: 'ポンプ点検',
    level: 1,
    bomCode: 'P001',
    cycle: 12,
    specifications: [
      { key: '型式', value: 'ABC-123', order: 1 },
      { key: '容量', value: '100L/min', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: true, actual: false, planCost: 50, actualCost: 0 },
      '2025': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    rolledUpResults: {
      '2024': { planned: true, actual: false, planCost: 50, actualCost: 0 },
      '2025': { planned: false, actual: false, planCost: 0, actualCost: 0 }
    },
    hierarchyPath: 'プラント1 > エリアA > 設備1'
  },
  {
    id: '2',
    task: 'バルブ交換',
    level: 1,
    bomCode: 'V001',
    cycle: 24,
    specifications: [
      { key: '型式', value: 'XYZ-456', order: 1 },
      { key: 'サイズ', value: '50A', order: 2 }
    ],
    children: [],
    results: {
      '2024': { planned: false, actual: true, planCost: 0, actualCost: 75 },
      '2025': { planned: true, actual: false, planCost: 80, actualCost: 0 }
    },
    rolledUpResults: {
      '2024': { planned: false, actual: true, planCost: 0, actualCost: 75 },
      '2025': { planned: true, actual: false, planCost: 80, actualCost: 0 }
    },
    hierarchyPath: 'プラント1 > エリアB > 設備2'
  }
];

const EnhancedMaintenanceGridDemo: React.FC = () => {
  const [data, setData] = useState<HierarchicalData[]>(sampleData);
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [displayMode, setDisplayMode] = useState<'specifications' | 'maintenance' | 'both'>('both');
  const [showBomCode, setShowBomCode] = useState(true);
  const [showCycle, setShowCycle] = useState(true);

  const timeHeaders = ['2024', '2025'];

  // Group data by hierarchy path
  const groupedData = useMemo(() => {
    return data.reduce((acc, item) => {
      const path = item.hierarchyPath || 'Uncategorized';
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(item);
      return acc;
    }, {} as { [key: string]: HierarchicalData[] });
  }, [data]);

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    console.log('Cell edit:', { rowId, columnId, value });
    
    setData(prevData => 
      prevData.map(item => {
        if (item.id !== rowId) return item;
        
        // Handle time column edits
        if (columnId.startsWith('time_')) {
          const timeHeader = columnId.replace('time_', '');
          return {
            ...item,
            results: {
              ...item.results,
              [timeHeader]: value
            }
          };
        }
        
        return item;
      })
    );
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    console.log('Specification edit:', { rowId, specIndex, key, value });
    
    setData(prevData => 
      prevData.map(item => {
        if (item.id !== rowId) return item;
        
        const newSpecs = [...(item.specifications || [])];
        if (!newSpecs[specIndex]) {
          newSpecs[specIndex] = { key: '', value: '', order: specIndex + 1 };
        }
        
        newSpecs[specIndex] = {
          ...newSpecs[specIndex],
          [key]: value
        };
        
        return {
          ...item,
          specifications: newSpecs
        };
      })
    );
  };

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    console.log('Update item:', updatedItem);
    
    setData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Enhanced Maintenance Grid Demo
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2">View Mode:</Typography>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value as 'status' | 'cost')}
        >
          <option value="status">Status</option>
          <option value="cost">Cost</option>
        </select>
        
        <Typography variant="body2">Display Mode:</Typography>
        <select 
          value={displayMode} 
          onChange={(e) => setDisplayMode(e.target.value as 'specifications' | 'maintenance' | 'both')}
        >
          <option value="specifications">Specifications</option>
          <option value="maintenance">Maintenance</option>
          <option value="both">Both</option>
        </select>
        
        <label>
          <input 
            type="checkbox" 
            checked={showBomCode} 
            onChange={(e) => setShowBomCode(e.target.checked)} 
          />
          Show BOM Code
        </label>
        
        <label>
          <input 
            type="checkbox" 
            checked={showCycle} 
            onChange={(e) => setShowCycle(e.target.checked)} 
          />
          Show Cycle
        </label>
      </Box>

      <Box sx={{ height: 600, border: '1px solid #ccc' }}>
        <EnhancedMaintenanceGrid
          data={data}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={showBomCode}
          showCycle={showCycle}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onUpdateItem={handleUpdateItem}
          groupedData={groupedData}
        />
      </Box>
    </Container>
  );
};

export default EnhancedMaintenanceGridDemo;