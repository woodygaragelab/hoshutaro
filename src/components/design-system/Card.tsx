import React from 'react';
import { Card as MuiCard, CardProps as MuiCardProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface CardProps extends MuiCardProps {
  hover?: boolean;
  interactive?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

const StyledCard = styled(MuiCard)<{ interactive?: boolean; hover?: boolean }>(
  ({ theme, interactive, hover }) => ({
    transition: 'all 0.2s ease-in-out',
    cursor: interactive ? 'pointer' : 'default',
    
    ...(hover && {
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: theme.shadows[4],
      },
    }),
    
    ...(interactive && {
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: theme.shadows[3],
      },
      '&:active': {
        transform: 'translateY(0)',
        boxShadow: theme.shadows[1],
      },
    }),
  })
);

const Card: React.FC<CardProps> = ({
  children,
  hover = false,
  interactive = false,
  padding = 'medium',
  ...props
}) => {
  const paddingMap = {
    none: 0,
    small: 1,
    medium: 2,
    large: 3,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <StyledCard
        {...props}
        interactive={interactive}
        hover={hover}
        sx={{
          p: paddingMap[padding],
          ...props.sx,
        }}
      >
        {children}
      </StyledCard>
    </motion.div>
  );
};

export default Card;