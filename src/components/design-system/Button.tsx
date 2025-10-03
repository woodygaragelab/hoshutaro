import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface ButtonProps extends Omit<MuiButtonProps, 'size'> {
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const StyledButton = styled(MuiButton)(() => ({
  position: 'relative',
  overflow: 'hidden',
  transition: 'all 0.2s ease-in-out',
  
  '&:before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
    transition: 'left 0.5s',
  },
  
  '&:hover:before': {
    left: '100%',
  },
  
  '&.loading': {
    pointerEvents: 'none',
  },
}));

const LoadingSpinner = styled('div')(({ theme }) => ({
  width: '16px',
  height: '16px',
  border: `2px solid ${theme.palette.primary.contrastText}`,
  borderTop: '2px solid transparent',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
}));

const Button: React.FC<ButtonProps> = ({
  children,
  size = 'medium',
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}) => {
  const sizeMap = {
    small: { padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
    medium: { padding: '0.5rem 1rem', fontSize: '1rem' },
    large: { padding: '0.75rem 1.5rem', fontSize: '1.125rem' },
  };

  return (
    <motion.div
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
    >
      <StyledButton
        {...props}
        disabled={disabled || loading}
        className={loading ? 'loading' : ''}
        sx={{
          ...sizeMap[size],
          ...props.sx,
        }}
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span style={{ marginRight: '0.5rem' }}>{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
              <span style={{ marginLeft: '0.5rem' }}>{icon}</span>
            )}
          </>
        )}
      </StyledButton>
    </motion.div>
  );
};

export default Button;