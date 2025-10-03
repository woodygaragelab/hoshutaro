import React from 'react';
import { Chip as MuiChip, ChipProps as MuiChipProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface ChipProps extends MuiChipProps {
  gradient?: boolean;
  interactive?: boolean;
}

const StyledChip = styled(MuiChip)<{ gradient?: boolean; interactive?: boolean }>(
  ({ theme, gradient, interactive }) => ({
    transition: 'all 0.2s ease-in-out',
    
    ...(gradient && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
      color: theme.palette.primary.contrastText,
      
      '& .MuiChip-deleteIcon': {
        color: theme.palette.primary.contrastText,
        '&:hover': {
          color: theme.palette.primary.contrastText,
        },
      },
    }),
    
    ...(interactive && {
      cursor: 'pointer',
      
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: theme.shadows[2],
      },
      
      '&:active': {
        transform: 'translateY(0)',
      },
    }),
    
    '&.MuiChip-outlined': {
      borderWidth: '2px',
      
      '&:hover': {
        borderColor: theme.palette.primary.main,
        backgroundColor: `${theme.palette.primary.main}08`,
      },
    },
  })
);

const Chip: React.FC<ChipProps> = ({
  gradient = false,
  interactive = false,
  ...props
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      whileHover={interactive ? { scale: 1.05 } : {}}
      whileTap={interactive ? { scale: 0.95 } : {}}
    >
      <StyledChip
        {...props}
        gradient={gradient}
        interactive={interactive}
      />
    </motion.div>
  );
};

export default Chip;