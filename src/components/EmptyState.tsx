import React from 'react';
import { Box, Typography } from '@mui/material';
import { Storage as DataIcon, NoteAdd as FileIcon } from '@mui/icons-material';

interface EmptyStateProps {
  onImportClick: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onImportClick }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        backgroundColor: '#000000',
        color: '#b3b3b3',
        p: 4,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          mb: 4,
          cursor: 'pointer',
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'pulse-glow 4s infinite alternate',
          transformOrigin: 'center center',
          '&:hover': {
            transform: 'scale(1.1) rotate(180deg)'
          }
        }}
        onClick={onImportClick}
        title="クリックしてデータをインポート"
      >
        <img src="/favicon.svg" alt="HOSHUTARO Logo" style={{ width: 100, height: 100, opacity: 0.9 }} />
      </Box>
      <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 300, letterSpacing: '8px', ml: '8px' }}>
        HOSHUTARO
      </Typography>
    </Box>
  );
};
