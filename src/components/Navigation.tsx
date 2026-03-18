/**
 * Navigation Component
 * Simple navigation component for demo pages
 */

import React from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Navigation: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', gap: 2, p: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Button onClick={() => navigate('/')}>App</Button>
      <Button onClick={() => navigate('/app2')}>App2</Button>
      <Button onClick={() => navigate('/excel-demo')}>Excel Demo</Button>
    </Box>
  );
};

export default Navigation;
