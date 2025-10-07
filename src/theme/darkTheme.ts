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
    surface: {
      main: '#1e1e1e',
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
          backgroundColor: '#000000',
          color: '#ffffff',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          '& .MuiTableCell-head': {
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            fontWeight: 600,
            borderBottom: '2px solid #333333',
          },
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          '& .MuiTableRow-root': {
            backgroundColor: '#000000',
            '&:nth-of-type(odd)': {
              backgroundColor: '#0a0a0a',
            },
            '&:hover': {
              backgroundColor: '#1e1e1e',
            },
          },
          '& .MuiTableCell-body': {
            color: '#ffffff',
            borderBottom: '1px solid #333333',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          backgroundColor: '#000000',
          borderBottom: '1px solid #333333',
          fontSize: '14px',
          fontWeight: 400,
        },
        head: {
          color: '#ffffff',
          backgroundColor: '#1e1e1e',
          fontWeight: 600,
          fontSize: '14px',
        },
        body: {
          color: '#ffffff',
          backgroundColor: '#000000',
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
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: '#ffffff',
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          color: '#b3b3b3',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiAlert-root': {
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            border: '1px solid #333333',
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
    backgroundColor: '#000000',
    color: '#ffffff',
    border: '1px solid #333333',
    '&:hover': {
      backgroundColor: '#1e1e1e',
    },
    '&.selected': {
      backgroundColor: '#333333',
    },
  },
  
  // ヘッダー用のスタイル
  header: {
    backgroundColor: '#000000',
    color: '#ffffff',
    borderBottom: '2px solid #333333',
  },
  
  // サイドバー用のスタイル
  sidebar: {
    backgroundColor: '#121212',
    color: '#ffffff',
    borderRight: '1px solid #333333',
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