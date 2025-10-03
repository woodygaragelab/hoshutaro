import React from 'react';
import { Badge as MuiBadge, BadgeProps as MuiBadgeProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface BadgeProps extends MuiBadgeProps {
  variant?: 'standard' | 'dot' | 'pulse';
  size?: 'small' | 'medium' | 'large';
}

const StyledBadge = styled(MuiBadge)<{ variant?: string; size?: string }>(
  ({ theme, variant, size }) => ({
    '& .MuiBadge-badge': {
      ...(size === 'small' && {
        minWidth: '16px',
        height: '16px',
        fontSize: '0.625rem',
        padding: '0 4px',
      }),
      
      ...(size === 'medium' && {
        minWidth: '20px',
        height: '20px',
        fontSize: '0.75rem',
        padding: '0 6px',
      }),
      
      ...(size === 'large' && {
        minWidth: '24px',
        height: '24px',
        fontSize: '0.875rem',
        padding: '0 8px',
      }),
      
      ...(variant === 'pulse' && {
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          animation: 'pulse 2s infinite',
          border: `2px solid ${theme.palette.primary.main}`,
        },
        
        '@keyframes pulse': {
          '0%': {
            transform: 'scale(0.95)',
            boxShadow: `0 0 0 0 ${theme.palette.primary.main}40`,
          },
          '70%': {
            transform: 'scale(1)',
            boxShadow: `0 0 0 10px ${theme.palette.primary.main}00`,
          },
          '100%': {
            transform: 'scale(0.95)',
            boxShadow: `0 0 0 0 ${theme.palette.primary.main}00`,
          },
        },
      }),
    },
  })
);

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'standard',
  size = 'medium',
  ...props
}) => {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ 
        type: 'spring',
        stiffness: 500,
        damping: 30 
      }}
    >
      <StyledBadge
        {...props}
        variant={variant === 'pulse' ? 'standard' : variant as any}
        size={size}
      >
        {children}
      </StyledBadge>
    </motion.div>
  );
};

export default Badge;