import React from 'react';
import { 
  TextField, 
  TextFieldProps, 
  InputAdornment, 
  IconButton,
  styled 
} from '@mui/material';
import { motion } from 'framer-motion';
import { Visibility, VisibilityOff, Clear } from '@mui/icons-material';

interface InputProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
  clearable?: boolean;
  showPasswordToggle?: boolean;
}

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    transition: 'all 0.2s ease-in-out',
    
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: '2px',
      },
    },
    
    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: '2px',
        boxShadow: `0 0 0 3px ${theme.palette.primary.main}20`,
      },
    },
    
    '&.Mui-error': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.error.main,
      },
      
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.error.main,
      },
      
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        boxShadow: `0 0 0 3px ${theme.palette.error.main}20`,
      },
    },
  },
  
  '& .MuiInputLabel-root': {
    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },
  },
  
  '& .MuiFormHelperText-root': {
    marginLeft: 0,
    marginTop: theme.spacing(0.5),
  },
}));

const Input: React.FC<InputProps> = ({
  clearable = false,
  showPasswordToggle = false,
  type: initialType = 'text',
  value,
  onChange,
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [type, setType] = React.useState(initialType);

  React.useEffect(() => {
    if (showPasswordToggle && initialType === 'password') {
      setType(showPassword ? 'text' : 'password');
    }
  }, [showPassword, showPasswordToggle, initialType]);

  const handleClear = () => {
    if (onChange) {
      onChange({
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword);
  };

  const endAdornment = React.useMemo(() => {
    const adornments = [];

    if (clearable && value) {
      adornments.push(
        <IconButton
          key="clear"
          size="small"
          onClick={handleClear}
          edge="end"
          sx={{ mr: showPasswordToggle ? 0 : 0.5 }}
        >
          <Clear fontSize="small" />
        </IconButton>
      );
    }

    if (showPasswordToggle && initialType === 'password') {
      adornments.push(
        <IconButton
          key="password-toggle"
          size="small"
          onClick={handlePasswordToggle}
          edge="end"
          sx={{ mr: 0.5 }}
        >
          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      );
    }

    return adornments.length > 0 ? (
      <InputAdornment position="end">
        {adornments}
      </InputAdornment>
    ) : props.InputProps?.endAdornment;
  }, [clearable, value, showPasswordToggle, initialType, showPassword, props.InputProps?.endAdornment]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <StyledTextField
        {...props}
        type={type}
        value={value}
        onChange={onChange}
        variant="outlined"
        InputProps={{
          ...props.InputProps,
          endAdornment,
        }}
      />
    </motion.div>
  );
};

export default Input;