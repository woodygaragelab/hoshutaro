import React from 'react';
import { 
  ThemeProvider, 
  DesignSystemShowcase 
} from './components/design-system';

/**
 * Demo component showing how to integrate the new design system
 * This demonstrates the proper setup and usage of the modern design system
 */
const DesignSystemDemo: React.FC = () => {
  return (
    <ThemeProvider defaultMode="light">
      <DesignSystemShowcase />
    </ThemeProvider>
  );
};

export default DesignSystemDemo;