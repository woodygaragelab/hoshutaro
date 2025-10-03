import React from 'react';
import { Tooltip as MuiTooltip, TooltipProps as MuiTooltipProps, styled } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps extends Omit<MuiTooltipProps, 'title'> {
  title: React.ReactNode;
  delay?: number;
  variant?: 'default' | 'dark' | 'light';
}

const StyledTooltip = styled(MuiTooltip)<{ variant?: string }>(({ theme, variant }) => ({
  '& .MuiTooltip-tooltip': {
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '8px 12px',
    maxWidth: '300px',
    
    ...(variant === 'dark' && {
      backgroundColor: theme.palette.grey[900],
      color: theme.palette.common.white,
    }),
    
    ...(variant === 'light' && {
      backgroundColor: theme.palette.common.white,
      color: theme.palette.text.primary,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: theme.shadows[2],
    }),
  },
  
  '& .MuiTooltip-arrow': {
    color: variant === 'light' 
      ? theme.palette.common.white 
      : theme.palette.grey[900],
  },
}));

const MotionDiv = motion.div;

const Tooltip: React.FC<TooltipProps> = ({
  children,
  title,
  delay = 500,
  variant = 'default',
  ...props
}) => {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setTimeout(() => setOpen(true), delay);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <StyledTooltip
      {...props}
      title={
        <AnimatePresence>
          {open && (
            <MotionDiv
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              {title}
            </MotionDiv>
          )}
        </AnimatePresence>
      }
      variant={variant}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      arrow
      enterDelay={delay}
      leaveDelay={100}
    >
      <span>{children}</span>
    </StyledTooltip>
  );
};

export default Tooltip;