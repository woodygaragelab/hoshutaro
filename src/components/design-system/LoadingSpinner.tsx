import React from 'react';
import { Box, CircularProgress, styled, Typography } from '@mui/material';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
}

const StyledContainer = styled(Box)<{ overlay?: boolean }>(({ theme, overlay }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  
  ...(overlay && {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
  }),
}));

const PulsingDot = styled(motion.div)(({ theme }) => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  margin: '0 2px',
}));

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  overlay = false,
}) => {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
  };

  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -10 },
  };

  return (
    <StyledContainer overlay={overlay}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <CircularProgress 
          size={sizeMap[size]} 
          thickness={4}
          sx={{
            color: (theme) => theme.palette.primary.main,
          }}
        />
      </motion.div>
      
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ textAlign: 'center' }}
          >
            {message}
          </Typography>
        </motion.div>
      )}
      
      {/* Alternative dot loading animation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        {[0, 1, 2].map((index) => (
          <PulsingDot
            key={index}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: index * 0.2,
            }}
          />
        ))}
      </Box>
    </StyledContainer>
  );
};

export default LoadingSpinner;