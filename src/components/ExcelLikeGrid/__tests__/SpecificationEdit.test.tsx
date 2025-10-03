import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpecificationEditDemo } from '../SpecificationEditDemo';

describe('SpecificationEdit', () => {
  test('renders specification edit demo', () => {
    render(<SpecificationEditDemo />);
    
    expect(screen.getByText('機器仕様編集機能デモ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '機器仕様のみ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '計画実績のみ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '両方表示' })).toBeInTheDocument();
  });

  test('switches display modes', async () => {
    render(<SpecificationEditDemo />);
    
    const specificationsButton = screen.getByRole('button', { name: '機器仕様のみ' });
    const maintenanceButton = screen.getByRole('button', { name: '計画実績のみ' });
    const bothButton = screen.getByRole('button', { name: '両方表示' });
    
    // Initially specifications mode should be active
    expect(specificationsButton).toHaveClass('MuiButton-contained');
    
    // Switch to maintenance mode
    fireEvent.click(maintenanceButton);
    await waitFor(() => {
      expect(maintenanceButton).toHaveClass('MuiButton-contained');
    });
    
    // Switch to both mode
    fireEvent.click(bothButton);
    await waitFor(() => {
      expect(bothButton).toHaveClass('MuiButton-contained');
    });
  });

  test('displays equipment specifications', () => {
    render(<SpecificationEditDemo />);
    
    // Check if sample equipment names are displayed
    expect(screen.getByText('遠心ポンプ P-001')).toBeInTheDocument();
    expect(screen.getByText('誘導電動機 M-001')).toBeInTheDocument();
    expect(screen.getByText('ボールバルブ V-001')).toBeInTheDocument();
  });

  test('displays specification values', () => {
    render(<SpecificationEditDemo />);
    
    // Check if specification values are displayed
    expect(screen.getByText('遠心ポンプ')).toBeInTheDocument();
    expect(screen.getByText('CP-100A')).toBeInTheDocument();
    expect(screen.getByText('100 L/min')).toBeInTheDocument();
    expect(screen.getByText('誘導電動機')).toBeInTheDocument();
    expect(screen.getByText('IM-200B')).toBeInTheDocument();
  });

  test('shows operation instructions', () => {
    render(<SpecificationEditDemo />);
    
    expect(screen.getByText('操作方法')).toBeInTheDocument();
    expect(screen.getByText(/ダブルクリックで編集/)).toBeInTheDocument();
    expect(screen.getByText(/Enter\/F2で編集開始/)).toBeInTheDocument();
  });
});