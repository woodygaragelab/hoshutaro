import React from 'react';
import { ThemeProvider } from '../design-system/ThemeProvider';
import ModernHeaderDemo from './ModernHeaderDemo';

/**
 * Example of how to integrate the ModernHeader component
 * This shows the complete setup with theme provider
 */
const HeaderIntegrationExample: React.FC = () => {
  return (
    <ThemeProvider>
      <ModernHeaderDemo />
    </ThemeProvider>
  );
};

export default HeaderIntegrationExample;