import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Legend from '../Legend';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('Legend Component', () => {
  describe('Status Mode', () => {
    it('should render status legend correctly', () => {
      renderWithTheme(<Legend viewMode="status" />);
      
      expect(screen.getByText('凡例:')).toBeInTheDocument();
      expect(screen.getByText(': 計画')).toBeInTheDocument();
      expect(screen.getByText(': 実績')).toBeInTheDocument();
      expect(screen.getByText(': 計画と実績')).toBeInTheDocument();
    });

    it('should display status symbols', () => {
      renderWithTheme(<Legend viewMode="status" />);
      
      // Check for the symbols (○, ●, ◎)
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('◎')).toBeInTheDocument();
    });
  });

  describe('Cost Mode', () => {
    it('should render cost legend correctly', () => {
      renderWithTheme(<Legend viewMode="cost" />);
      
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
      expect(screen.getByText(': 計画')).toBeInTheDocument();
      expect(screen.getByText(': 実績')).toBeInTheDocument();
    });

    it('should display cost examples', () => {
      renderWithTheme(<Legend viewMode="cost" />);
      
      // Check for the cost examples
      const costExamples = screen.getAllByText('(123)');
      expect(costExamples).toHaveLength(2); // One for plan, one for actual
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const { container } = renderWithTheme(<Legend viewMode="status" className="custom-class" />);
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should have legend-container class', () => {
      const { container } = renderWithTheme(<Legend viewMode="status" />);
      
      expect(container.querySelector('.legend-container')).toBeInTheDocument();
    });
  });
});