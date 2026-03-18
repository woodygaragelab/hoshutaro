import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Smartphone as SmartphoneIcon,
  Tablet as TabletIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useResponsiveLayout, useDeviceCapabilities } from './hooks/useResponsiveLayout';
import EnhancedMaintenanceGrid from './components/EnhancedMaintenanceGrid/EnhancedMaintenanceGrid';
import { transformData } from './utils/dataTransformer';
import rawData from './data/equipments.json';
import { HierarchicalData, RawEquipment } from './types';
import './styles/responsive.css';

const ResponsiveDemo: React.FC = () => {
  const responsive = useResponsiveLayout();
  const capabilities = useDeviceCapabilities();
  
  // Demo data
  const [maintenanceData, setMaintenanceData] = useState<HierarchicalData[]>([]);
  const [timeHeaders, setTimeHeaders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'status' | 'cost'>('status');
  const [displayMode] = useState<'specifications' | 'maintenance' | 'both'>('maintenance');
  
  // Force responsive mode for demo
  const [forcedMode, setForcedMode] = useState<'auto' | 'mobile' | 'tablet' | 'desktop'>('auto');

  useEffect(() => {
    const [flatData, headers] = transformData(rawData as { [id: string]: RawEquipment }, 'year');
    setMaintenanceData(flatData.slice(0, 20)); // Limit data for demo
    setTimeHeaders(headers.slice(0, 8)); // Limit time headers for demo
  }, []);

  const handleUpdateItem = (updatedItem: HierarchicalData) => {
    setMaintenanceData(prevData => 
      prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  };

  const handleCellEdit = (rowId: string, columnId: string, value: any) => {
    setMaintenanceData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          if (columnId.startsWith('time_')) {
            const timeHeader = columnId.replace('time_', '');
            const updatedResults = { ...item.results };
            updatedResults[timeHeader] = value;
            return { ...item, results: updatedResults };
          }
        }
        return item;
      })
    );
  };

  const handleSpecificationEdit = (rowId: string, specIndex: number, key: string, value: string) => {
    setMaintenanceData(prevData => 
      prevData.map(item => {
        if (item.id === rowId) {
          const updatedSpecs = [...(item.specifications || [])];
          while (updatedSpecs.length <= specIndex) {
            updatedSpecs.push({ key: '', value: '', order: updatedSpecs.length });
          }
          updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], [key]: value };
          return { ...item, specifications: updatedSpecs };
        }
        return item;
      })
    );
  };

  // Create forced responsive layout
  const getForcedResponsive = () => {
    if (forcedMode === 'auto') return responsive;
    
    const screenSize = forcedMode === 'mobile' ? 'xs' : forcedMode === 'tablet' ? 'md' : 'lg';
    
    return {
      ...responsive,
      isMobile: forcedMode === 'mobile',
      isTablet: forcedMode === 'tablet',
      isDesktop: forcedMode === 'desktop',
      screenSize: screenSize as 'xs' | 'sm' | 'md' | 'lg' | 'xl',
    };
  };

  const currentResponsive = getForcedResponsive();

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Demo Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          レスポンシブデザインデモ
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          {/* Device Mode Selector */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              表示モード:
            </Typography>
            <ButtonGroup size="small">
              <Button
                variant={forcedMode === 'auto' ? 'contained' : 'outlined'}
                onClick={() => setForcedMode('auto')}
              >
                自動
              </Button>
              <Button
                variant={forcedMode === 'mobile' ? 'contained' : 'outlined'}
                onClick={() => setForcedMode('mobile')}
                startIcon={<SmartphoneIcon />}
              >
                モバイル
              </Button>
              <Button
                variant={forcedMode === 'tablet' ? 'contained' : 'outlined'}
                onClick={() => setForcedMode('tablet')}
                startIcon={<TabletIcon />}
              >
                タブレット
              </Button>
              <Button
                variant={forcedMode === 'desktop' ? 'contained' : 'outlined'}
                onClick={() => setForcedMode('desktop')}
                startIcon={<ComputerIcon />}
              >
                デスクトップ
              </Button>
            </ButtonGroup>
          </Box>

          {/* View Mode Selector */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              データ表示:
            </Typography>
            <ButtonGroup size="small">
              <Button
                variant={viewMode === 'status' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('status')}
              >
                星取表示
              </Button>
              <Button
                variant={viewMode === 'cost' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('cost')}
              >
                コスト表示
              </Button>
            </ButtonGroup>
          </Box>
        </Box>

        {/* Device Info */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip 
            label={`画面: ${currentResponsive.screenSize.toUpperCase()}`}
            color="primary"
            size="small"
          />
          <Chip 
            label={`幅: ${currentResponsive.width}px`}
            variant="outlined"
            size="small"
          />
          <Chip 
            label={`高さ: ${currentResponsive.height}px`}
            variant="outlined"
            size="small"
          />
          <Chip 
            label={`向き: ${currentResponsive.orientation}`}
            variant="outlined"
            size="small"
          />
          {capabilities.hasTouch && (
            <Chip 
              label="タッチ対応"
              color="success"
              size="small"
            />
          )}
          {!capabilities.hasHover && (
            <Chip 
              label="ホバー非対応"
              color="warning"
              size="small"
            />
          )}
        </Box>

        {/* Layout Info */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              レイアウト情報:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip 
                label={`セル高: ${currentResponsive.getCellHeight()}px`}
                size="small"
                variant="outlined"
              />
              <Chip 
                label={`スペーシング: ${currentResponsive.getSpacing()}px`}
                size="small"
                variant="outlined"
              />
              {currentResponsive.shouldStackElements() && (
                <Chip 
                  label="要素スタック"
                  color="info"
                  size="small"
                />
              )}
              {currentResponsive.shouldHideSecondaryActions() && (
                <Chip 
                  label="セカンダリアクション非表示"
                  color="info"
                  size="small"
                />
              )}
              {currentResponsive.shouldUseCompactSpacing() && (
                <Chip 
                  label="コンパクトスペーシング"
                  color="info"
                  size="small"
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Paper>

      {/* Responsive Grid */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <EnhancedMaintenanceGrid
          data={maintenanceData}
          timeHeaders={timeHeaders}
          viewMode={viewMode}
          displayMode={displayMode}
          showBomCode={true}
          showCycle={true}
          onCellEdit={handleCellEdit}
          onSpecificationEdit={handleSpecificationEdit}
          onUpdateItem={handleUpdateItem}
          virtualScrolling={false}
          readOnly={false}
          responsive={currentResponsive}
        />
      </Paper>
    </Box>
  );
};

export default ResponsiveDemo;