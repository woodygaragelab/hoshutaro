import React from 'react';
import { Typography as MuiTypography, TypographyProps as MuiTypographyProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

interface TypographyProps extends MuiTypographyProps {
  gradient?: boolean;
  truncate?: boolean;
  animate?: boolean;
}

const StyledTypography = styled(MuiTypography)<{ gradient?: boolean; truncate?: boolean }>(
  ({ theme, gradient, truncate }) => ({
    ...(gradient && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }),
    
    ...(truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  })
);

const Typography: React.FC<TypographyProps> = ({
  children,
  gradient = false,
  truncate = false,
  animate = false,
  ...props
}) => {
  const TypographyComponent = (
    <StyledTypography
      {...props}
      gradient={gradient}
      truncate={truncate}
    >
      {children}
    </StyledTypography>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {TypographyComponent}
      </motion.div>
    );
  }

  return TypographyComponent;
};

export default Typography;