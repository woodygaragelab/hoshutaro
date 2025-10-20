import React from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,

  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Collapse,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,

  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,

} from '@mui/icons-material';
import { SpecificationEditItem } from './SpecificationEditDialog';

// デスクトップ用インライン編集コンポーネント
export interface DesktopInlineEditProps {
  item: SpecificationEditItem;
  index: number;
  isEditing: boolean;
  onEdit: (field: 'key' | 'value', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  readOnly?: boolean;
}

export const DesktopInlineEdit: React.FC<DesktopInlineEditProps> = ({
  item,
  index: _index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onStartEdit,
  readOnly = false,
}) => {
  if (!isEditing) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          '&:hover .edit-button': {
            opacity: 1,
          },
        }}
        onDoubleClick={readOnly ? undefined : onStartEdit}
      >
        <Typography variant="subtitle2" fontWeight="bold" sx={{ minWidth: 120 }}>
          {item.key || '（未入力）'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {item.value || '（未入力）'}
        </Typography>
        <IconButton
          className="edit-button"
          size="small"
          onClick={onStartEdit}
          disabled={readOnly}
          sx={{ opacity: 0, transition: 'opacity 0.2s' }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
      <TextField
        fullWidth
        label="項目名"
        value={item.key}
        onChange={(e) => onEdit('key', e.target.value)}
        error={!!item.keyError}
        helperText={item.keyError}
        size="small"
        variant="outlined"
        autoFocus
        inputProps={{ maxLength: 50 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <TextField
        fullWidth
        label="値"
        value={item.value}
        onChange={(e) => onEdit('value', e.target.value)}
        error={!!item.valueError}
        helperText={item.valueError}
        size="small"
        variant="outlined"
        inputProps={{ maxLength: 200 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button size="small" onClick={onCancel}>
          キャンセル
        </Button>
        <Button size="small" variant="contained" onClick={onSave}>
          保存
        </Button>
      </Box>
    </Box>
  );
};

// タブレット用タッチ最適化編集コンポーネント
export interface TabletTouchEditProps {
  item: SpecificationEditItem;
  index: number;
  isEditing: boolean;
  onEdit: (field: 'key' | 'value', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  readOnly?: boolean;
}

export const TabletTouchEdit: React.FC<TabletTouchEditProps> = ({
  item,
  index: _index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onStartEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  readOnly = false,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (isEditing) {
    return (
      <Box sx={{ p: 2, border: '2px solid', borderColor: 'primary.main', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          項目編集
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="項目名"
            value={item.key}
            onChange={(e) => onEdit('key', e.target.value)}
            error={!!item.keyError}
            helperText={item.keyError}
            size="medium"
            variant="outlined"
            inputProps={{ maxLength: 50 }}
          />
          <TextField
            fullWidth
            label="値"
            value={item.value}
            onChange={(e) => onEdit('value', e.target.value)}
            error={!!item.valueError}
            helperText={item.valueError}
            size="medium"
            variant="outlined"
            multiline
            rows={3}
            inputProps={{ maxLength: 200 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button size="large" onClick={onCancel} sx={{ minWidth: 120 }}>
              キャンセル
            </Button>
            <Button size="large" variant="contained" onClick={onSave} sx={{ minWidth: 120 }}>
              保存
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {item.key || '（未入力）'}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {item.value || '（未入力）'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {expanded ? '▲' : '▼'}
        </Typography>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            startIcon={<EditIcon />}
            onClick={onStartEdit}
            disabled={readOnly}
            size="large"
            sx={{ minHeight: 48 }}
          >
            編集
          </Button>
          <Button
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={readOnly}
            color="error"
            size="large"
            sx={{ minHeight: 48 }}
          >
            削除
          </Button>
          <Button
            startIcon={<ArrowUpIcon />}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            size="large"
            sx={{ minHeight: 48 }}
          >
            上へ
          </Button>
          <Button
            startIcon={<ArrowDownIcon />}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            size="large"
            sx={{ minHeight: 48 }}
          >
            下へ
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
};

// モバイル用フルスクリーン編集コンポーネント
export interface MobileFullscreenEditProps {
  item: SpecificationEditItem;
  index: number;
  isEditing: boolean;
  onEdit: (field: 'key' | 'value', value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export const MobileFullscreenEdit: React.FC<MobileFullscreenEditProps> = ({
  item,
  index: _index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onStartEdit,
  onDelete,
  readOnly = false,
}) => {
  if (isEditing) {
    return (
      <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h5" gutterBottom textAlign="center">
          項目編集
        </Typography>
        
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <TextField
            fullWidth
            label="項目名"
            value={item.key}
            onChange={(e) => onEdit('key', e.target.value)}
            error={!!item.keyError}
            helperText={item.keyError}
            size="medium"
            variant="outlined"
            inputProps={{ maxLength: 50 }}
            sx={{ '& .MuiInputBase-root': { fontSize: '1.125rem' } }}
          />
          
          <TextField
            fullWidth
            label="値"
            value={item.value}
            onChange={(e) => onEdit('value', e.target.value)}
            error={!!item.valueError}
            helperText={item.valueError}
            size="medium"
            variant="outlined"
            multiline
            rows={6}
            inputProps={{ maxLength: 200 }}
            sx={{ '& .MuiInputBase-root': { fontSize: '1.125rem' } }}
          />
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
          <Button
            size="large"
            variant="contained"
            onClick={onSave}
            sx={{ minHeight: 56, fontSize: '1.125rem' }}
          >
            保存
          </Button>
          <Button
            size="large"
            onClick={onCancel}
            sx={{ minHeight: 56, fontSize: '1.125rem' }}
          >
            キャンセル
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        mb: 2,
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {item.key || '（未入力）'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {item.value || '（未入力）'}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          startIcon={<EditIcon />}
          onClick={onStartEdit}
          disabled={readOnly}
          size="large"
          variant="outlined"
          sx={{ flex: 1, minHeight: 48 }}
        >
          編集
        </Button>
        <Button
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          disabled={readOnly}
          color="error"
          size="large"
          variant="outlined"
          sx={{ flex: 1, minHeight: 48 }}
        >
          削除
        </Button>
      </Box>
    </Box>
  );
};

// フローティングアクションボタン（モバイル用）
export interface MobileFloatingActionsProps {
  onAddItem: () => void;
  onSave: () => void;
  onCancel: () => void;
  hasChanges: boolean;
  isValid: boolean;
  readOnly?: boolean;
}

export const MobileFloatingActions: React.FC<MobileFloatingActionsProps> = ({
  onAddItem,
  onSave,
  onCancel,
  hasChanges,
  isValid,
  readOnly = false,
}) => {
  const [open, setOpen] = React.useState(false);

  const actions = [
    {
      icon: <AddIcon />,
      name: '項目追加',
      onClick: onAddItem,
      disabled: readOnly,
    },
    {
      icon: <SaveIcon />,
      name: '保存',
      onClick: onSave,
      disabled: !hasChanges || !isValid || readOnly,
    },
    {
      icon: <CancelIcon />,
      name: 'キャンセル',
      onClick: onCancel,
      disabled: false,
    },
  ];

  return (
    <SpeedDial
      ariaLabel="編集アクション"
      sx={{ position: 'fixed', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => {
            action.onClick();
            setOpen(false);
          }}
          sx={{ 
            opacity: action.disabled ? 0.5 : 1,
            pointerEvents: action.disabled ? 'none' : 'auto',
          }}
        />
      ))}
    </SpeedDial>
  );
};

// エラー表示コンポーネント（デバイス別）
export interface DeviceErrorDisplayProps {
  errors: string[];
  warnings: string[];
  deviceType: 'desktop' | 'tablet' | 'mobile';
  onClose?: () => void;
}

export const DeviceErrorDisplay: React.FC<DeviceErrorDisplayProps> = ({
  errors,
  warnings,
  deviceType,
  onClose,
}) => {
  const [open, setOpen] = React.useState(errors.length > 0 || warnings.length > 0);

  React.useEffect(() => {
    setOpen(errors.length > 0 || warnings.length > 0);
  }, [errors.length, warnings.length]);

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  if (deviceType === 'desktop') {
    // デスクトップ：インライン表示
    if (errors.length === 0 && warnings.length === 0) return null;
    
    return (
      <Box sx={{ mb: 2 }}>
        {errors.map((error, index) => (
          <Alert key={`error-${index}`} severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        ))}
        {warnings.map((warning, index) => (
          <Alert key={`warning-${index}`} severity="warning" sx={{ mb: 1 }}>
            {warning}
          </Alert>
        ))}
      </Box>
    );
  }

  // タブレット・モバイル：スナックバー表示
  const message = errors.length > 0 ? errors[0] : warnings[0];
  const severity = errors.length > 0 ? 'error' : 'warning';

  return (
    <Snackbar
      open={open}
      autoHideDuration={deviceType === 'mobile' ? 4000 : 6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
        {message}
        {(errors.length + warnings.length) > 1 && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            他に{(errors.length + warnings.length) - 1}件のメッセージがあります
          </Typography>
        )}
      </Alert>
    </Snackbar>
  );
};

// キーボード表示時の調整コンポーネント
export interface KeyboardAdjustmentProps {
  isKeyboardVisible: boolean;
  children: React.ReactNode;
}

export const KeyboardAdjustment: React.FC<KeyboardAdjustmentProps> = ({
  isKeyboardVisible,
  children,
}) => {
  return (
    <Box
      sx={{
        transition: 'all 0.3s ease-in-out',
        transform: isKeyboardVisible ? 'translateY(-10vh)' : 'translateY(0)',
        height: isKeyboardVisible ? '90vh' : '100vh',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
};