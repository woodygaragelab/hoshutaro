import { createTheme } from '@mui/material/styles';

// ブラック基調のダークテーマ
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffffff',
      light: '#f5f5f5',
      dark: '#e0e0e0',
      contrastText: '#000000',
    },
    secondary: {
      main: '#90caf9',
      light: '#bbdefb',
      dark: '#64b5f6',
      contrastText: '#000000',
    },
    background: {
      default: '#000000',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
      disabled: '#666666',
    },
    divider: '#333333',
    grey: {
      50: '#1e1e1e',
      100: '#1e1e1e',
      200: '#1e1e1e',
      300: '#333333',
      400: '#555555',
      500: '#777777',
      600: '#999999',
      700: '#bbbbbb',
      800: '#dddddd',
      900: '#ffffff',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    info: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", "Noto Sans JP", sans-serif',
    fontSize: 14,
    h1: {
      color: '#ffffff',
      fontWeight: 600,
    },
    h2: {
      color: '#ffffff',
      fontWeight: 600,
    },
    h3: {
      color: '#ffffff',
      fontWeight: 600,
    },
    h4: {
      color: '#ffffff',
      fontWeight: 600,
    },
    h5: {
      color: '#ffffff',
      fontWeight: 600,
    },
    h6: {
      color: '#ffffff',
      fontWeight: 600,
    },
    body1: {
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 400,
    },
    body2: {
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 400,
    },
    button: {
      color: '#ffffff',
      fontWeight: 500,
      fontSize: '14px',
    },
    caption: {
      color: '#b3b3b3',
      fontSize: '12px',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#000000',
          color: '#ffffff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          color: '#ffffff',
          borderBottom: '1px solid #333333',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#ffffff',
          border: '1px solid #333333',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          border: '1px solid #333333',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          borderColor: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
            borderColor: '#ffffff',
          },
        },
        contained: {
          backgroundColor: '#333333',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#555555',
          },
        },
        outlined: {
          borderColor: '#ffffff',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
            borderColor: '#ffffff',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            '& fieldset': {
              borderColor: '#666666',
            },
            '&:hover fieldset': {
              borderColor: '#ffffff',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ffffff',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#b3b3b3',
            '&.Mui-focused': {
              color: '#ffffff',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#666666',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ffffff',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ffffff',
          },
        },
        icon: {
          color: '#ffffff',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
          },
          '&.Mui-selected': {
            backgroundColor: '#333333',
            '&:hover': {
              backgroundColor: '#555555',
            },
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          color: '#ffffff',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(8px)',
          '& .MuiTableCell-head': {
            backgroundColor: 'transparent',
            color: '#ffffff',
            fontWeight: 600,
            borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '13px',
          },
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          '& .MuiTableRow-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            transition: 'background-color 0.2s ease',
            '&:nth-of-type(odd)': {
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            },
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
          '& .MuiTableCell-body': {
            color: '#e0e0e0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          backgroundColor: 'transparent',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '14px',
          fontWeight: 400,
        },
        head: {
          color: '#ffffff',
          backgroundColor: 'transparent',
          fontWeight: 600,
          fontSize: '13px',
        },
        body: {
          color: '#e0e0e0',
          backgroundColor: 'transparent',
          fontSize: '14px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#333333',
          color: '#ffffff',
          border: '1px solid #666666',
        },
        outlined: {
          backgroundColor: 'transparent',
          color: '#ffffff',
          borderColor: '#666666',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#333333',
          },
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(25, 25, 25, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
          backgroundImage: 'none',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          fontWeight: 400,
          letterSpacing: '0.5px',
          padding: '24px 24px 16px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#e0e0e0',
          padding: '8px 24px 24px',
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          color: '#b3b3b3',
          lineHeight: 1.6,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(25, 25, 25, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          backgroundImage: 'none',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiAlert-root': {
            backgroundColor: 'rgba(25, 25, 25, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-track': {
            backgroundColor: '#666666',
          },
          '& .MuiSwitch-thumb': {
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          color: '#ffffff',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#b3b3b3',
          '&.Mui-focused': {
            color: '#ffffff',
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
        h1: {
          color: '#ffffff',
          fontWeight: 600,
        },
        h2: {
          color: '#ffffff',
          fontWeight: 600,
        },
        h3: {
          color: '#ffffff',
          fontWeight: 600,
        },
        h4: {
          color: '#ffffff',
          fontWeight: 600,
        },
        h5: {
          color: '#ffffff',
          fontWeight: 600,
        },
        h6: {
          color: '#ffffff',
          fontWeight: 600,
        },
        body1: {
          color: '#ffffff',
          fontSize: '14px',
        },
        body2: {
          color: '#ffffff',
          fontSize: '14px',
        },
        caption: {
          color: '#b3b3b3',
          fontSize: '12px',
        },
      },
    },
  },
});

// 追加のカスタムスタイル
export const darkThemeStyles = {
  // グリッドセル用のスタイル
  gridCell: {
    backgroundColor: 'transparent',
    color: '#e0e0e0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    borderRight: '1px solid rgba(255, 255, 255, 0.02)',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    '&.selected': {
      backgroundColor: 'rgba(33, 150, 243, 0.15)',
    },
  },
  
  // ヘッダー用のスタイル
  header: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    backdropFilter: 'blur(8px)',
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  // サイドバー用のスタイル
  sidebar: {
    backgroundColor: 'rgba(15, 15, 15, 0.85)',
    backdropFilter: 'blur(12px)',
    color: '#ffffff',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  },
  
  // AIアシスタント用のスタイル
  aiAssistant: {
    backgroundColor: '#000000',
    color: '#ffffff',
    border: '1px solid #333333',
  },
  
  // チャットメッセージ用のスタイル
  chatMessage: {
    user: {
      backgroundColor: '#333333',
      color: '#ffffff',
    },
    assistant: {
      backgroundColor: '#1e1e1e',
      color: '#ffffff',
      border: '1px solid #666666',
    },
    system: {
      backgroundColor: '#121212',
      color: '#b3b3b3',
      border: '1px solid #333333',
    },
  },
};