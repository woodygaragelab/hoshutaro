import React from 'react';
import { Box, BoxProps, styled } from '@mui/material';
import { motion } from 'framer-motion';

// Stack component for vertical/horizontal layouts
interface StackProps extends BoxProps {
  direction?: 'row' | 'column';
  spacing?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  wrap?: boolean;
  animate?: boolean;
}

const StyledStack = styled(Box)<StackProps>(({ 
  theme, 
  direction = 'column', 
  spacing = 1, 
  align = 'stretch', 
  justify = 'start',
  wrap = false 
}) => ({
  display: 'flex',
  flexDirection: direction,
  alignItems: align === 'start' ? 'flex-start' : 
             align === 'end' ? 'flex-end' : 
             align === 'stretch' ? 'stretch' : 'center',
  justifyContent: justify === 'start' ? 'flex-start' : 
                  justify === 'end' ? 'flex-end' : 
                  justify,
  flexWrap: wrap ? 'wrap' : 'nowrap',
  gap: typeof spacing === 'number' ? theme.spacing(spacing) : spacing,
}));

export const Stack: React.FC<StackProps> = ({ 
  children, 
  animate = false,
  ...props 
}) => {
  const StackComponent = (
    <StyledStack {...props}>
      {children}
    </StyledStack>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {StackComponent}
      </motion.div>
    );
  }

  return StackComponent;
};

// Container component for consistent max-width and centering
interface ContainerProps extends BoxProps {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  center?: boolean;
  padding?: boolean;
}

const StyledContainer = styled(Box)<ContainerProps>(({ 
  theme, 
  maxWidth = 'lg', 
  center = true,
  padding = true 
}) => {
  const maxWidthMap = {
    xs: '444px',
    sm: '768px', 
    md: '1024px',
    lg: '1200px',
    xl: '1440px',
  };

  return {
    width: '100%',
    ...(maxWidth && { maxWidth: maxWidthMap[maxWidth] }),
    ...(center && { margin: '0 auto' }),
    ...(padding && { 
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      [theme.breakpoints.up('sm')]: {
        paddingLeft: theme.spacing(3),
        paddingRight: theme.spacing(3),
      },
    }),
  };
});

export const Container: React.FC<ContainerProps> = ({ children, ...props }) => (
  <StyledContainer {...props}>
    {children}
  </StyledContainer>
);

// Grid component for responsive layouts
interface GridProps extends BoxProps {
  columns?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: number | string;
  minItemWidth?: string;
}

const StyledGrid = styled(Box)<GridProps>(({ theme, columns = 1, gap = 2, minItemWidth }) => {
  if (typeof columns === 'object') {
    const breakpoints = Object.entries(columns).map(([breakpoint, cols]) => {
      if (breakpoint === 'xs') {
        return `grid-template-columns: repeat(${cols}, 1fr)`;
      }
      return `${theme.breakpoints.up(breakpoint as any)} { grid-template-columns: repeat(${cols}, 1fr); }`;
    });

    return {
      display: 'grid',
      gap: typeof gap === 'number' ? theme.spacing(gap) : gap,
      gridTemplateColumns: `repeat(${columns.xs || 1}, 1fr)`,
      
      [theme.breakpoints.up('sm')]: {
        gridTemplateColumns: `repeat(${columns.sm || columns.xs || 1}, 1fr)`,
      },
      [theme.breakpoints.up('md')]: {
        gridTemplateColumns: `repeat(${columns.md || columns.sm || columns.xs || 1}, 1fr)`,
      },
      [theme.breakpoints.up('lg')]: {
        gridTemplateColumns: `repeat(${columns.lg || columns.md || columns.sm || columns.xs || 1}, 1fr)`,
      },
      [theme.breakpoints.up('xl')]: {
        gridTemplateColumns: `repeat(${columns.xl || columns.lg || columns.md || columns.sm || columns.xs || 1}, 1fr)`,
      },
    };
  }

  return {
    display: 'grid',
    gap: typeof gap === 'number' ? theme.spacing(gap) : gap,
    gridTemplateColumns: minItemWidth 
      ? `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`
      : `repeat(${columns}, 1fr)`,
  };
});

export const Grid: React.FC<GridProps> = ({ children, ...props }) => (
  <StyledGrid {...props}>
    {children}
  </StyledGrid>
);

// Spacer component for adding space between elements
interface SpacerProps {
  size?: number | string;
  direction?: 'horizontal' | 'vertical';
}

export const Spacer: React.FC<SpacerProps> = ({ 
  size = 1, 
  direction = 'vertical' 
}) => (
  <Box
    sx={{
      ...(direction === 'vertical' && {
        height: typeof size === 'number' ? (theme) => theme.spacing(size) : size,
      }),
      ...(direction === 'horizontal' && {
        width: typeof size === 'number' ? (theme) => theme.spacing(size) : size,
      }),
    }}
  />
);

// Center component for centering content
interface CenterProps extends BoxProps {
  inline?: boolean;
}

export const Center: React.FC<CenterProps> = ({ 
  children, 
  inline = false, 
  ...props 
}) => (
  <Box
    {...props}
    sx={{
      display: inline ? 'inline-flex' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...props.sx,
    }}
  >
    {children}
  </Box>
);