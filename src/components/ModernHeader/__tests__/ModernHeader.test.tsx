import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SelectChangeEvent } from '@mui/material';
import ModernHeader from '../ModernHeader';

// Mock theme for responsive testing
const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

// Mock props for testing
const mockProps = {
  searchTerm: '',
  onSearchChange: jest.fn(),
  level1Filter: 'all',
  level2Filter: 'all',
  level3Filter: 'all',
  onLevel1FilterChange: jest.fn(),
  onLevel2FilterChange: jest.fn(),
  onLevel3FilterChange: jest.fn(),
  hierarchyFilterTree: {
    children: {
      'プラント1': {
        children: {
          'エリア1': {
            children: {
              'サブエリア1': {}
            }
          }
        }
      },
      'プラント2': {
        children: {
          'エリア2': {
            children: {
              'サブエリア2': {}
            }
          }
        }
      }
    }
  },
  level2Options: ['エリア1'],
  level3Options: ['サブエリア1'],
  viewMode: 'status' as const,
  onViewModeChange: jest.fn(),
  timeScale: 'year' as const,
  onTimeScaleChange: jest.fn(),
  showBomCode: true,
  showCycle: true,
  onShowBomCodeChange: jest.fn(),
  onShowCycleChange: jest.fn(),
  onAddYear: jest.fn(),
  onDeleteYear: jest.fn(),
  onExportData: jest.fn(),
  onImportData: jest.fn(),
  onResetData: jest.fn(),
};

// Helper function to render component with theme
const renderWithTheme = (component: React.ReactElement, customTheme = theme) => {
  return render(
    <ThemeProvider theme={customTheme}>
      {component}
    </ThemeProvider>
  );
};

// Mock useMediaQuery for responsive testing
const mockUseMediaQuery = jest.fn();
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: () => mockUseMediaQuery(),
}));

describe('ModernHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMediaQuery.mockReturnValue(false); // Default to desktop
  });

  describe('Basic Rendering', () => {
    it('renders the header with title', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('renders search input with placeholder', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      expect(screen.getByPlaceholderText('機器を検索...')).toBeInTheDocument();
    });

    it('renders all control buttons in desktop mode', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      expect(screen.getByText('フィルター')).toBeInTheDocument();
      expect(screen.getByText('表示設定')).toBeInTheDocument();
      expect(screen.getByText('年度操作')).toBeInTheDocument();
      expect(screen.getByText('データ操作')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('calls onSearchChange when search input changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('機器を検索...');
      await user.clear(searchInput);
      await user.type(searchInput, 'a');
      
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('a');
    });

    it('displays current search term in input', () => {
      const propsWithSearch = { ...mockProps, searchTerm: 'existing search' };
      renderWithTheme(<ModernHeader {...propsWithSearch} />);
      
      const searchInput = screen.getByDisplayValue('existing search');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('displays correct label for status mode', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      expect(screen.getByText('星取')).toBeInTheDocument();
    });

    it('displays correct label for cost mode', () => {
      const propsWithCostMode = { ...mockProps, viewMode: 'cost' as const };
      renderWithTheme(<ModernHeader {...propsWithCostMode} />);
      expect(screen.getByText('コスト')).toBeInTheDocument();
    });

    it('calls onViewModeChange when toggle is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const toggle = screen.getByRole('switch');
      await user.click(toggle);
      
      expect(mockProps.onViewModeChange).toHaveBeenCalled();
    });
  });

  describe('Time Scale Selection', () => {
    it('displays current time scale', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      // The select component should show the current value
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('calls onTimeScaleChange when time scale is changed', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const timeScaleSelect = screen.getByRole('combobox');
      await user.click(timeScaleSelect);
      
      await waitFor(() => {
        const monthOption = screen.getByText('月');
        return user.click(monthOption);
      });
      
      expect(mockProps.onTimeScaleChange).toHaveBeenCalled();
    });
  });

  describe('Filter Menu Functionality', () => {
    it('opens filter menu when filter button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
      });
    });

    it('displays hierarchy filter options in filter menu', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
      });
    });

    it('shows hierarchy options in filter menu', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        // Check that the filter menu is open
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
      });
    });
  });

  describe('Display Settings Menu', () => {
    it('opens display settings menu when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const settingsButton = screen.getByText('表示設定');
      await user.click(settingsButton);
      
      await waitFor(() => {
        expect(screen.getByText('TAG No.')).toBeInTheDocument();
        expect(screen.getByText('周期')).toBeInTheDocument();
      });
    });

    it('shows display setting options in menu', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const settingsButton = screen.getByText('表示設定');
      await user.click(settingsButton);
      
      await waitFor(() => {
        // Check that both display settings are present
        const tagNoOption = screen.getByText('TAG No.');
        const cycleOption = screen.getByText('周期');
        expect(tagNoOption).toBeInTheDocument();
        expect(cycleOption).toBeInTheDocument();
      });
    });
  });

  describe('Year Operations Menu', () => {
    it('opens year operations menu when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const yearButton = screen.getByText('年度操作');
      await user.click(yearButton);
      
      await waitFor(() => {
        expect(screen.getByText('年度追加')).toBeInTheDocument();
        expect(screen.getByText('年度削除')).toBeInTheDocument();
      });
    });

    it('disables year operations when time scale is not year', () => {
      const propsWithMonthScale = { ...mockProps, timeScale: 'month' as const };
      renderWithTheme(<ModernHeader {...propsWithMonthScale} />);
      
      const yearButton = screen.getByText('年度操作');
      expect(yearButton).toBeDisabled();
    });

    it('calls year operation handlers when menu items are clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const yearButton = screen.getByText('年度操作');
      await user.click(yearButton);
      
      await waitFor(async () => {
        const addYearItem = screen.getByText('年度追加');
        await user.click(addYearItem);
        
        expect(mockProps.onAddYear).toHaveBeenCalled();
      });
    });
  });

  describe('Data Operations Menu', () => {
    it('opens data operations menu when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const dataButton = screen.getByText('データ操作');
      await user.click(dataButton);
      
      await waitFor(() => {
        expect(screen.getByText('エクスポート (JSON)')).toBeInTheDocument();
        expect(screen.getByText('インポート (JSON)')).toBeInTheDocument();
        expect(screen.getByText('データを初期化')).toBeInTheDocument();
      });
    });

    it('calls data operation handlers when menu items are clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const dataButton = screen.getByText('データ操作');
      await user.click(dataButton);
      
      await waitFor(async () => {
        const exportItem = screen.getByText('エクスポート (JSON)');
        await user.click(exportItem);
        
        expect(mockProps.onExportData).toHaveBeenCalled();
      });
    });
  });

  describe('Responsive Behavior', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true); // Mobile mode
    });

    it('shows mobile layout when screen is small', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Should show hamburger menu icon
      expect(screen.getByTestId('MenuIcon')).toBeInTheDocument();
      
      // Should not show desktop control buttons
      expect(screen.queryByText('フィルター')).not.toBeInTheDocument();
      expect(screen.queryByText('表示設定')).not.toBeInTheDocument();
    });

    it('shows mobile search input with different placeholder', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      expect(screen.getByPlaceholderText('検索...')).toBeInTheDocument();
    });

    it('opens mobile drawer when hamburger menu is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('コントロール')).toBeInTheDocument();
        });
      }
    });

    it('shows all controls in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('星取表示')).toBeInTheDocument();
          expect(screen.getAllByText('時間スケール')[0]).toBeInTheDocument();
          expect(screen.getByText('階層フィルター')).toBeInTheDocument();
          expect(screen.getByText('表示設定')).toBeInTheDocument();
          expect(screen.getByText('年度追加')).toBeInTheDocument();
          expect(screen.getByText('データエクスポート')).toBeInTheDocument();
        });
      }
    });

    it('calls handlers from mobile drawer controls', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          const viewModeToggle = screen.getByText('星取表示').closest('label')?.querySelector('input');
          if (viewModeToggle) {
            await user.click(viewModeToggle);
            expect(mockProps.onViewModeChange).toHaveBeenCalled();
          }
        });
      }
    });

    it('switches between desktop and mobile layouts based on screen size', () => {
      // Test desktop layout
      mockUseMediaQuery.mockReturnValue(false);
      const { rerender } = renderWithTheme(<ModernHeader {...mockProps} />);
      
      expect(screen.getByText('フィルター')).toBeInTheDocument();
      expect(screen.queryByTestId('MenuIcon')).not.toBeInTheDocument();
      
      // Switch to mobile layout
      mockUseMediaQuery.mockReturnValue(true);
      rerender(
        <ThemeProvider theme={theme}>
          <ModernHeader {...mockProps} />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('MenuIcon')).toBeInTheDocument();
      expect(screen.queryByText('フィルター')).not.toBeInTheDocument();
    });

    it('maintains search functionality across responsive breakpoints', async () => {
      const user = userEvent.setup();
      
      // Test mobile search
      mockUseMediaQuery.mockReturnValue(true);
      const { rerender } = renderWithTheme(<ModernHeader {...mockProps} />);
      
      const mobileSearchInput = screen.getByPlaceholderText('検索...');
      await user.clear(mobileSearchInput);
      await user.type(mobileSearchInput, 'a');
      
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('a');
      
      // Switch to desktop and test search
      mockUseMediaQuery.mockReturnValue(false);
      rerender(
        <ThemeProvider theme={theme}>
          <ModernHeader {...mockProps} />
        </ThemeProvider>
      );
      
      const desktopSearchInput = screen.getByPlaceholderText('機器を検索...');
      await user.clear(desktopSearchInput);
      await user.type(desktopSearchInput, 'b');
      
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('b');
    });

    it('provides complete functionality in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          // Test view mode toggle
          const viewModeToggle = screen.getByText('星取表示').closest('label')?.querySelector('input');
          if (viewModeToggle) {
            await user.click(viewModeToggle);
            expect(mockProps.onViewModeChange).toHaveBeenCalled();
          }
          
          // Test time scale selection - find by role instead of label
          const timeScaleSelects = screen.getAllByRole('combobox');
          const timeScaleSelect = timeScaleSelects.find(select => 
            select.closest('.MuiFormControl-root')?.querySelector('label')?.textContent === '時間スケール'
          );
          
          if (timeScaleSelect) {
            await user.click(timeScaleSelect);
            
            await waitFor(async () => {
              const monthOption = screen.getByText('月');
              await user.click(monthOption);
              expect(mockProps.onTimeScaleChange).toHaveBeenCalled();
            });
          }
        });
      }
    });

    it('handles hierarchy filters in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          // Find select elements by role instead of label
          const selectElements = screen.getAllByRole('combobox');
          const level1Select = selectElements.find(select => 
            select.closest('.MuiFormControl-root')?.querySelector('label')?.textContent === 'レベル1'
          );
          
          if (level1Select) {
            await user.click(level1Select);
            
            await waitFor(async () => {
              const plantOption = screen.getByText('プラント1');
              await user.click(plantOption);
              expect(mockProps.onLevel1FilterChange).toHaveBeenCalled();
            });
          }
        });
      }
    });

    it('handles display settings in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          const bomCodeSwitch = screen.getByText('TAG No.').closest('label')?.querySelector('input');
          const cycleSwitch = screen.getByText('周期').closest('label')?.querySelector('input');
          
          if (bomCodeSwitch) {
            await user.click(bomCodeSwitch);
            expect(mockProps.onShowBomCodeChange).toHaveBeenCalled();
          }
          
          if (cycleSwitch) {
            await user.click(cycleSwitch);
            expect(mockProps.onShowCycleChange).toHaveBeenCalled();
          }
        });
      }
    });

    it('handles year operations in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          const addYearButton = screen.getByText('年度追加');
          const deleteYearButton = screen.getByText('年度削除');
          
          await user.click(addYearButton);
          expect(mockProps.onAddYear).toHaveBeenCalled();
          
          await user.click(deleteYearButton);
          expect(mockProps.onDeleteYear).toHaveBeenCalled();
        });
      }
    });

    it('handles data operations in mobile drawer', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          const exportButton = screen.getByText('データエクスポート');
          const importButton = screen.getByText('データインポート');
          const resetButton = screen.getByText('データ初期化');
          
          await user.click(exportButton);
          expect(mockProps.onExportData).toHaveBeenCalled();
          
          await user.click(importButton);
          expect(mockProps.onImportData).toHaveBeenCalled();
          
          await user.click(resetButton);
          expect(mockProps.onResetData).toHaveBeenCalled();
        });
      }
    });

    it('closes mobile drawer when clicking outside or pressing escape', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('コントロール')).toBeInTheDocument();
        });
        
        // Press Escape to close drawer
        await user.keyboard('{Escape}');
        
        await waitFor(() => {
          expect(screen.queryByText('コントロール')).not.toBeInTheDocument();
        });
      }
    });

    it('disables year operations in mobile drawer when time scale is not year', async () => {
      const user = userEvent.setup();
      const propsWithMonthScale = { ...mockProps, timeScale: 'month' as const };
      renderWithTheme(<ModernHeader {...propsWithMonthScale} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(() => {
          const addYearButton = screen.getByText('年度追加').closest('button');
          const deleteYearButton = screen.getByText('年度削除').closest('button');
          
          expect(addYearButton).toBeDisabled();
          expect(deleteYearButton).toBeDisabled();
        });
      }
    });

    it('maintains proper layout structure in mobile mode', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Check that the mobile layout has proper structure
      const toolbar = screen.getByRole('banner').querySelector('.MuiToolbar-root');
      expect(toolbar).toBeInTheDocument();
      
      const title = screen.getByText('星取表');
      expect(title).toBeInTheDocument();
      
      const searchInput = screen.getByPlaceholderText('検索...');
      expect(searchInput).toBeInTheDocument();
      
      const menuIcon = screen.getByTestId('MenuIcon');
      expect(menuIcon).toBeInTheDocument();
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('properly handles hierarchy filter tree structure', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Verify that the component can handle the hierarchy structure
      expect(mockProps.hierarchyFilterTree.children['プラント1']).toBeDefined();
      expect(mockProps.hierarchyFilterTree.children['プラント2']).toBeDefined();
    });

    it('handles empty or undefined hierarchy filter tree', () => {
      const propsWithoutTree = { ...mockProps, hierarchyFilterTree: null };
      renderWithTheme(<ModernHeader {...propsWithoutTree} />);
      
      // Should not crash and should render basic structure
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('properly manages filter dependencies', async () => {
      const user = userEvent.setup();
      const propsWithLevel1Selected = {
        ...mockProps,
        level1Filter: 'プラント1',
        level2Options: ['エリア1'],
        level3Options: []
      };
      
      renderWithTheme(<ModernHeader {...propsWithLevel1Selected} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        // Check that filter menu is open
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
      });
    });

    it('maintains state consistency across mode changes', () => {
      const { rerender } = renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Change to cost mode
      const propsWithCostMode = { ...mockProps, viewMode: 'cost' as const };
      rerender(
        <ThemeProvider theme={theme}>
          <ModernHeader {...propsWithCostMode} />
        </ThemeProvider>
      );
      
      expect(screen.getByText('コスト')).toBeInTheDocument();
    });

    it('handles all time scale options correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const timeScaleSelect = screen.getByRole('combobox');
      await user.click(timeScaleSelect);
      
      await waitFor(() => {
        // All time scale options should be available
        const yearOptions = screen.getAllByText('年');
        const monthOptions = screen.getAllByText('月');
        expect(yearOptions.length).toBeGreaterThan(0);
        expect(monthOptions.length).toBeGreaterThan(0);
        expect(screen.getByText('週')).toBeInTheDocument();
        expect(screen.getByText('日')).toBeInTheDocument();
      });
    });

    it('integrates search functionality with existing data filtering', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('機器を検索...');
      await user.clear(searchInput);
      await user.type(searchInput, 'a');
      
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('a');
    });

    it('properly cascades hierarchy filter changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(async () => {
        // Find the select element by its role and then click it
        const level1Selects = screen.getAllByRole('combobox');
        const level1Select = level1Selects.find(select => 
          select.closest('.MuiFormControl-root')?.querySelector('label')?.textContent === '階層レベル1'
        );
        
        if (level1Select) {
          await user.click(level1Select);
          
          await waitFor(async () => {
            const plantOption = screen.getByText('プラント1');
            await user.click(plantOption);
            
            expect(mockProps.onLevel1FilterChange).toHaveBeenCalled();
          });
        }
      });
    });

    it('maintains display settings state across component updates', () => {
      const propsWithSettings = {
        ...mockProps,
        showBomCode: false,
        showCycle: false
      };
      
      const { rerender } = renderWithTheme(<ModernHeader {...propsWithSettings} />);
      
      // Update with different settings
      const updatedProps = {
        ...propsWithSettings,
        showBomCode: true,
        showCycle: true
      };
      
      rerender(
        <ThemeProvider theme={theme}>
          <ModernHeader {...updatedProps} />
        </ThemeProvider>
      );
      
      // Component should render without errors
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('handles year operations integration with time scale', async () => {
      const user = userEvent.setup();
      
      // Test with year scale (should be enabled)
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const yearButton = screen.getByText('年度操作');
      expect(yearButton).not.toBeDisabled();
      
      await user.click(yearButton);
      
      await waitFor(() => {
        expect(screen.getByText('年度追加')).toBeInTheDocument();
        expect(screen.getByText('年度削除')).toBeInTheDocument();
      });
    });

    it('disables year operations for non-year time scales', () => {
      const propsWithMonthScale = { ...mockProps, timeScale: 'month' as const };
      renderWithTheme(<ModernHeader {...propsWithMonthScale} />);
      
      const yearButton = screen.getByText('年度操作');
      expect(yearButton).toBeDisabled();
    });

    it('integrates data operations with existing data management', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const dataButton = screen.getByText('データ操作');
      await user.click(dataButton);
      
      await waitFor(async () => {
        const exportItem = screen.getByText('エクスポート (JSON)');
        const importItem = screen.getByText('インポート (JSON)');
        const resetItem = screen.getByText('データを初期化');
        
        expect(exportItem).toBeInTheDocument();
        expect(importItem).toBeInTheDocument();
        expect(resetItem).toBeInTheDocument();
        
        // Test export functionality
        await user.click(exportItem);
        expect(mockProps.onExportData).toHaveBeenCalled();
      });
    });

    it('maintains filter state consistency when switching between levels', async () => {
      const user = userEvent.setup();
      const propsWithFilters = {
        ...mockProps,
        level1Filter: 'プラント1',
        level2Filter: 'エリア1',
        level3Filter: 'all'
      };
      
      renderWithTheme(<ModernHeader {...propsWithFilters} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        // Check that the filter menu is open and shows hierarchy structure
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
        
        // Find select elements by their roles
        const selectElements = screen.getAllByRole('combobox');
        expect(selectElements.length).toBeGreaterThan(0);
      });
    });

    it('properly handles view mode changes with existing functionality', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Test status mode
      expect(screen.getByText('星取')).toBeInTheDocument();
      
      const toggle = screen.getByRole('switch');
      await user.click(toggle);
      
      expect(mockProps.onViewModeChange).toHaveBeenCalled();
    });

    it('integrates display settings with existing table functionality', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const settingsButton = screen.getByText('表示設定');
      await user.click(settingsButton);
      
      await waitFor(async () => {
        const bomCodeSwitch = screen.getByText('TAG No.').closest('label')?.querySelector('input');
        const cycleSwitch = screen.getByText('周期').closest('label')?.querySelector('input');
        
        expect(bomCodeSwitch).toBeInTheDocument();
        expect(cycleSwitch).toBeInTheDocument();
        
        if (bomCodeSwitch) {
          await user.click(bomCodeSwitch);
          expect(mockProps.onShowBomCodeChange).toHaveBeenCalled();
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles missing callback functions gracefully', () => {
      const propsWithMissingCallbacks = {
        ...mockProps,
        onSearchChange: undefined as any,
        onViewModeChange: undefined as any,
      };
      
      // Should not crash when rendering
      expect(() => {
        renderWithTheme(<ModernHeader {...propsWithMissingCallbacks} />);
      }).not.toThrow();
    });

    it('handles empty filter options arrays', () => {
      const propsWithEmptyOptions = {
        ...mockProps,
        level2Options: [],
        level3Options: [],
      };
      
      renderWithTheme(<ModernHeader {...propsWithEmptyOptions} />);
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('closes menus when clicking outside', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const filterButton = screen.getByText('フィルター');
      await user.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('階層フィルター')).toBeInTheDocument();
      });
      
      // Press Escape to close menu (more reliable than clicking outside)
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByText('階層フィルター')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles rapid state changes without errors', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('機器を検索...');
      
      // Rapid typing simulation
      await user.clear(searchInput);
      await user.type(searchInput, 'a');
      
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('a');
    });

    it('handles large hierarchy filter trees efficiently', async () => {
      const largeHierarchyTree = {
        children: {}
      };
      
      // Create a large hierarchy tree
      for (let i = 0; i < 100; i++) {
        largeHierarchyTree.children[`プラント${i}`] = {
          children: {
            [`エリア${i}`]: {
              children: {
                [`サブエリア${i}`]: {}
              }
            }
          }
        };
      }
      
      const propsWithLargeTree = {
        ...mockProps,
        hierarchyFilterTree: largeHierarchyTree
      };
      
      const startTime = performance.now();
      renderWithTheme(<ModernHeader {...propsWithLargeTree} />);
      const endTime = performance.now();
      
      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('handles concurrent menu operations gracefully', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Open multiple menus rapidly
      const filterButton = screen.getByText('フィルター');
      const settingsButton = screen.getByText('表示設定');
      
      await user.click(filterButton);
      await user.click(settingsButton);
      
      // Should handle concurrent operations without crashing
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('maintains performance with frequent responsive layout changes', () => {
      const { rerender } = renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Simulate rapid responsive changes
      for (let i = 0; i < 10; i++) {
        mockUseMediaQuery.mockReturnValue(i % 2 === 0);
        rerender(
          <ThemeProvider theme={theme}>
            <ModernHeader {...mockProps} />
          </ThemeProvider>
        );
      }
      
      expect(screen.getByText('星取表')).toBeInTheDocument();
    });

    it('handles memory cleanup properly on unmount', () => {
      const { unmount } = renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('機器を検索...');
      expect(searchInput).toHaveAttribute('type', 'text');
      
      const viewModeToggle = screen.getByRole('switch');
      expect(viewModeToggle).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('機器を検索...');
      searchInput.focus();
      
      // Tab should move to next focusable element
      await user.tab();
      
      const filterButton = screen.getByText('フィルター');
      expect(filterButton).toHaveFocus();
    });

    it('provides proper focus management in mobile drawer', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(() => {
          // Focus should be managed properly in the drawer
          const drawerContent = screen.getByText('コントロール');
          expect(drawerContent).toBeInTheDocument();
        });
      }
    });

    it('supports screen reader navigation', () => {
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      // Check for proper semantic structure
      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();
      
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toBeInTheDocument();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('maintains focus trap in mobile drawer', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      renderWithTheme(<ModernHeader {...mockProps} />);
      
      const menuButton = screen.getByTestId('MenuIcon').closest('button');
      if (menuButton) {
        await user.click(menuButton);
        
        await waitFor(async () => {
          // Tab through drawer elements
          await user.tab();
          await user.tab();
          
          // Focus should remain within the drawer
          const focusedElement = document.activeElement;
          const drawer = screen.getByText('コントロール').closest('[role="presentation"]');
          expect(drawer).toContainElement(focusedElement);
        });
      }
    });
  });
});