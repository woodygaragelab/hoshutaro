import React, { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import './Resizer.css';

interface ResizerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

export const Resizer: React.FC<ResizerProps> = ({
  direction,
  onResize,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPositionRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startPosition = direction === 'horizontal' ? e.clientX : e.clientY;
    startPositionRef.current = startPosition;
    
    // Add resizing class to body for visual feedback
    document.body.classList.add('resizing');
    
    // Add global mouse event listeners
    const handleMouseMove = (e: MouseEvent) => {
      const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPosition - startPositionRef.current;
      
      onResize(delta);
      startPositionRef.current = currentPosition; // Update start position for next delta
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, onResize]);

  const resizerStyle = {
    position: 'absolute' as const,
    zIndex: 100,
    backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.12)' : 'transparent',
    cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
    ...(direction === 'horizontal' ? {
      width: '8px',
      height: '100%',
      right: '-4px',
      top: 0,
    } : {
      width: '100%',
      height: '8px',
      bottom: '-4px',
      left: 0,
    }),
    transition: 'all 0.2s ease',
    borderRadius: direction === 'horizontal' ? '0 4px 4px 0' : '0 0 4px 4px',
    '&:hover': {
      backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.04)',
      boxShadow: isDragging ? 
        '0 0 12px rgba(0, 0, 0, 0.2)' : 
        '0 0 8px rgba(0, 0, 0, 0.1)',
    }
  };

  return (
    <Box
      className={`resizer ${className}`}
      sx={resizerStyle}
      onMouseDown={handleMouseDown}
    />
  );
};

export default Resizer;