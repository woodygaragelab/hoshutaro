import React from 'react';
import { render, screen } from '@testing-library/react';
import { Legend } from '../Legend';

describe('Legend Component', () => {
  describe('Status View Mode', () => {
    it('should render status legend symbols', () => {
      render(<Legend viewMode="status" />);
      
      expect(screen.getByText('凡例:')).toBeInTheDocument();
      expect(screen.getByText(': 計画')).toBeInTheDocument();
      expect(screen.getByText(': 実績')).toBeInTheDocument();
      expect(screen.getByText(': 計画と実績')).toBeInTheDocument();
    });

    it('should show count indicator in equipment-based mode', () => {
      render(<Legend viewMode="status" dataViewMode="equipment-based" />);
      
      expect(screen.getByText(': 複数作業')).toBeInTheDocument();
    });

    it('should not show count indicator in task-based mode', () => {
      render(<Legend viewMode="status" dataViewMode="task-based" />);
      
      expect(screen.queryByText(': 複数作業')).not.toBeInTheDocument();
    });
  });

  describe('Cost View Mode', () => {
    it('should render cost legend', () => {
      render(<Legend viewMode="cost" />);
      
      expect(screen.getByText('凡例 (単位: 千円):')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('456')).toBeInTheDocument();
    });

    it('should show aggregated cost indicator in equipment-based mode', () => {
      render(<Legend viewMode="cost" dataViewMode="equipment-based" />);
      
      expect(screen.getByText('合計コスト表示')).toBeInTheDocument();
    });

    it('should not show aggregated cost indicator in task-based mode', () => {
      render(<Legend viewMode="cost" dataViewMode="task-based" />);
      
      expect(screen.queryByText('合計コスト表示')).not.toBeInTheDocument();
    });
  });

  describe('Grouping Indicator', () => {
    it('should show equipment-based grouping indicator', () => {
      render(<Legend viewMode="status" dataViewMode="equipment-based" />);
      
      expect(screen.getByText('階層別グループ化')).toBeInTheDocument();
    });

    it('should show task-based grouping indicator', () => {
      render(<Legend viewMode="status" dataViewMode="task-based" />);
      
      expect(screen.getByText('作業分類別グループ化')).toBeInTheDocument();
    });

    it('should default to equipment-based when dataViewMode is not provided', () => {
      render(<Legend viewMode="status" />);
      
      expect(screen.getByText('階層別グループ化')).toBeInTheDocument();
    });
  });
});
