import React from 'react';
import { Box, Typography } from '@mui/material';
import { CopyPasteDemo } from './components/ExcelLikeGrid/CopyPasteDemo';

export const CopyPasteIntegrationDemo: React.FC = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h3" gutterBottom>
        コピー&ペースト機能統合デモ
      </Typography>
      
      <Typography variant="body1" paragraph>
        ExcelLikeGridのコピー&ペースト機能をテストするためのデモページです。
      </Typography>
      
      <CopyPasteDemo />
    </Box>
  );
};

export default CopyPasteIntegrationDemo;