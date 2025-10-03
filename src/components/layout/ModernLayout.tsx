import React from 'react';
import { Box, Container, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface ModernLayoutProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  padding?: boolean;
  fullHeight?: boolean;
}

const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(3),
  },
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const ModernLayout: React.FC<ModernLayoutProps> = ({
  children,
  maxWidth = 'xl',
  padding = true,
  fullHeight = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <StyledContainer
        maxWidth={maxWidth}
        sx={{
          minHeight: fullHeight ? '100vh' : 'auto',
          padding: padding ? undefined : 0,
        }}
      >
        <ContentArea>
          {children}
        </ContentArea>
      </StyledContainer>
    </motion.div>
  );
};

export default ModernLayout;