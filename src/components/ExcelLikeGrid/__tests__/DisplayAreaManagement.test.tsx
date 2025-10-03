import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplayAreaControl } from '../DisplayAreaControl';
import { DisplayAreaConfig } from '../types';

describe('Display Area Management System', () => {
  const mockConfig: DisplayAreaConfig = {
    mode: 'maintenance',
    fixedColumns: ['task', 'bomCode'],
    scrollableAreas: {
      specifications: {
        visible: false,
        width: 400,
        columns: ['spec_model', 'spec_capacity', 'spec_power']
      },
      maintenance: {
        visible: true,
        width: 600,
        columns: ['2024-01', '2024-02', '2024-03']
      }
    }
  };

  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test('renders display area control with correct initial mode', () => {
    render(
      <DisplayAreaControl
        config={mockConfig}
        onChange={mockOnChange}
      />
    );

    // Check if the maintenance mode is selected
    const maintenanceButton = screen.getByRole('button', { name: /計画実績/ });
    expect(maintenanceButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('switches to specifications mode when clicked', () => {
    render(
      <DisplayAreaControl
        config={mockConfig}
        onChange={mockOnChange}
      />
    );

    const specificationsButton = screen.getByRole('button', { name: /機器仕様/ });
    fireEvent.click(specificationsButton);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockConfig,
      mode: 'specifications',
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 800,
          columns: mockConfig.scrollableAreas.specifications?.columns || []
        },
        maintenance: {
          visible: false,
          width: 800,
          columns: mockConfig.scrollableAreas.maintenance?.columns || []
        }
      }
    });
  });

  test('switches to both mode when clicked', () => {
    render(
      <DisplayAreaControl
        config={mockConfig}
        onChange={mockOnChange}
      />
    );

    const bothButton = screen.getByRole('button', { name: /両方表示/ });
    fireEvent.click(bothButton);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockConfig,
      mode: 'both',
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 400,
          columns: mockConfig.scrollableAreas.specifications?.columns || []
        },
        maintenance: {
          visible: true,
          width: 600,
          columns: mockConfig.scrollableAreas.maintenance?.columns || []
        }
      }
    });
  });

  test('shows additional info when both mode is selected', () => {
    const bothModeConfig: DisplayAreaConfig = {
      ...mockConfig,
      mode: 'both'
    };

    render(
      <DisplayAreaControl
        config={bothModeConfig}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('機器リスト固定、各エリア独立スクロール')).toBeInTheDocument();
  });

  test('does not show additional info when single mode is selected', () => {
    render(
      <DisplayAreaControl
        config={mockConfig}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByText('機器リスト固定、各エリア独立スクロール')).not.toBeInTheDocument();
  });
});

describe('DisplayAreaConfig Interface', () => {
  test('validates DisplayAreaConfig structure', () => {
    const config: DisplayAreaConfig = {
      mode: 'both',
      fixedColumns: ['task', 'bomCode'],
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 400,
          columns: ['spec_model', 'spec_capacity']
        },
        maintenance: {
          visible: true,
          width: 600,
          columns: ['2024-01', '2024-02']
        }
      }
    };

    // Test that the interface accepts all required properties
    expect(config.mode).toBe('both');
    expect(config.fixedColumns).toEqual(['task', 'bomCode']);
    expect(config.scrollableAreas.specifications?.visible).toBe(true);
    expect(config.scrollableAreas.maintenance?.visible).toBe(true);
  });

  test('supports specifications only mode', () => {
    const config: DisplayAreaConfig = {
      mode: 'specifications',
      fixedColumns: ['task'],
      scrollableAreas: {
        specifications: {
          visible: true,
          width: 800,
          columns: ['spec_model', 'spec_capacity', 'spec_power']
        },
        maintenance: {
          visible: false,
          width: 0,
          columns: []
        }
      }
    };

    expect(config.mode).toBe('specifications');
    expect(config.scrollableAreas.specifications?.visible).toBe(true);
    expect(config.scrollableAreas.maintenance?.visible).toBe(false);
  });

  test('supports maintenance only mode', () => {
    const config: DisplayAreaConfig = {
      mode: 'maintenance',
      fixedColumns: ['task', 'bomCode'],
      scrollableAreas: {
        specifications: {
          visible: false,
          width: 0,
          columns: []
        },
        maintenance: {
          visible: true,
          width: 800,
          columns: ['2024-01', '2024-02', '2024-03']
        }
      }
    };

    expect(config.mode).toBe('maintenance');
    expect(config.scrollableAreas.specifications?.visible).toBe(false);
    expect(config.scrollableAreas.maintenance?.visible).toBe(true);
  });
});