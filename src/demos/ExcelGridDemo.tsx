import React from 'react';
import { Box, Typography, Container, Tabs, Tab } from '@mui/material';
import { ExcelLikeGridDemo } from './components/ExcelLikeGrid/ExcelLikeGridDemo';
import { KeyboardNavigationTest } from './components/ExcelLikeGrid/KeyboardNavigationTest';
import { EnhancedMaintenanceGridDemo } from './components/ExcelLikeGrid/EnhancedMaintenanceGridDemo';
import Navigation from './components/Navigation';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const ExcelGridDemo: React.FC = () => {
  const [value, setValue] = React.useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <>
      <Navigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          ExcelLikeGrid デモンストレーション
        </Typography>
      
      <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
        タスク3.2で実装したセル編集とキーボードナビゲーション機能、および3.5で実装した既存データ構造統合のデモです
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
          <Tab label="基本デモ" {...a11yProps(0)} />
          <Tab label="キーボードナビゲーションテスト" {...a11yProps(1)} />
          <Tab label="既存データ統合デモ" {...a11yProps(2)} />
        </Tabs>
      </Box>
      
      <TabPanel value={value} index={0}>
        <ExcelLikeGridDemo />
      </TabPanel>
      
      <TabPanel value={value} index={1}>
        <KeyboardNavigationTest />
      </TabPanel>
      
      <TabPanel value={value} index={2}>
        <EnhancedMaintenanceGridDemo />
      </TabPanel>
      </Container>
    </>
  );
};

export default ExcelGridDemo;