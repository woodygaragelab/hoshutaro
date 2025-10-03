import React from 'react';
import { Avatar as MuiAvatar, AvatarProps as MuiAvatarProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface AvatarProps extends MuiAvatarProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  status?: 'online' | 'offline' | 'away' | 'busy';
  interactive?: boolean;
  gradient?: boolean;
}

const StyledAvatar = styled(MuiAvatar)<{ 
  size?: string; 
  interactive?: boolean; 
  gradient?: boolean;
}>(({ theme, size, interactive, gradient }) => {
  const sizeMap = {
    small: { width: 32, height: 32, fontSize: '0.875rem' },
    medium: { width: 40, height: 40, fontSize: '1rem' },
    large: { width: 56, height: 56, fontSize: '1.25rem' },
    xlarge: { width: 80, height: 80, fontSize: '1.5rem' },
  };

  return {
    ...sizeMap[size as keyof typeof sizeMap],
    transition: 'all 0.2s ease-in-out',
    
    ...(gradient && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    }),
    
    ...(interactive && {
      cursor: 'pointer',
      
      '&:hover': {
        transform: 'scale(1.05)',
        boxShadow: theme.shadows[3],
      },
    }),
  };
});

const StatusIndicator = styled('div')<{ status?: string; size?: string }>(
  ({ theme, status, size }) => {
    const statusColors = {
      online: theme.palette.success.main,
      offline: theme.palette.grey[400],
      away: theme.palette.warning.main,
      busy: theme.palette.error.main,
    };

    const sizeMap = {
      small: { width: 8, height: 8, bottom: 0, right: 0 },
      medium: { width: 10, height: 10, bottom: 2, right: 2 },
      large: { width: 12, height: 12, bottom: 4, right: 4 },
      xlarge: { width: 16, height: 16, bottom: 6, right: 6 },
    };

    const indicatorSize = sizeMap[size as keyof typeof sizeMap];

    return {
      position: 'absolute',
      ...indicatorSize,
      backgroundColor: statusColors[status as keyof typeof statusColors],
      borderRadius: '50%',
      border: `2px solid ${theme.palette.background.paper}`,
    };
  }
);

const Avatar: React.FC<AvatarProps> = ({
  size = 'medium',
  status,
  interactive = false,
  gradient = false,
  children,
  ...props
}) => {
  return (
    <motion.div
      style={{ position: 'relative', display: 'inline-block' }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={interactive ? { scale: 1.05 } : {}}
    >
      <StyledAvatar
        {...props}
        size={size}
        interactive={interactive}
        gradient={gradient}
      >
        {children}
      </StyledAvatar>
      
      {status && (
        <StatusIndicator status={status} size={size} />
      )}
    </motion.div>
  );
};

export default Avatar;