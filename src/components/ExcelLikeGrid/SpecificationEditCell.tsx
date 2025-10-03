import React, { useState, useEffect, useRef } from 'react';
import { 
  TextField, 
  IconButton, 
  Box, 
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { HierarchicalData } from '../../types';
import { SpecificationEditContext } from './types';

interface SpecificationEditCellProps {
  item: HierarchicalData;
  specIndex: number;
  field: 'key' | 'value' | 'order';
  value: string | number;
  isSelected: boolean;
  isEditing: boolean;
  onEdit: (context: SpecificationEditContext) => void;
  onSelect: (rowId: string | null, columnId: string | null) => void;
  onEditingChange: (rowId: string | null, columnId: string | null) => void;
  onSpecificationAdd: (rowId: string, afterIndex?: number) => void;
  onSpecificationDelete: (rowId: string, specIndex: number) => void;
  onSpecificationReorder: (rowId: string, fromIndex: number, toIndex: number) => void;
  readOnly: boolean;
}

export const SpecificationEditCell: React.FC<SpecificationEditCellProps> = ({
  item,
  specIndex,
  field,
  value,
  isSelected,
  isEditing,
  onEdit,
  onSelect,
  onEditingChange,
  onSpecificationAdd,
  onSpecificationDelete,
  onSpecificationReorder,
  readOnly
}) => {
  const [editValue, setEditValue] = useState(value);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellId = `spec_${specIndex}_${field}`;

  // Update edit value when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (field !== 'order' && inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing, field]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readOnly) {
      onSelect(item.id, cellId);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readOnly) {
      onEditingChange(item.id, cellId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
        case 'Escape':
          e.preventDefault();
          handleCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleSave();
          // Navigation will be handled by parent
          break;
      }
    } else if (isSelected) {
      switch (e.key) {
        case 'Enter':
        case 'F2':
          if (!readOnly) {
            e.preventDefault();
            onEditingChange(item.id, cellId);
          }
          break;
        case 'Delete':
          if (!readOnly && field === 'key') {
            e.preventDefault();
            handleDeleteSpecification();
          }
          break;
        case 'Insert':
          if (!readOnly && field === 'key') {
            e.preventDefault();
            handleAddSpecification();
          }
          break;
      }
    }
  };

  const handleSave = () => {
    let processedValue: string | number = editValue;
    
    if (field === 'order') {
      processedValue = parseInt(String(editValue), 10) || 0;
    } else {
      processedValue = String(editValue).trim();
    }

    // Validate the input
    const isValid = validateInput(processedValue);
    
    const context: SpecificationEditContext = {
      rowId: item.id,
      specIndex,
      field,
      value: processedValue,
      previousValue: value,
      isValid,
      errorMessage: isValid ? undefined : getValidationError(processedValue)
    };

    if (isValid) {
      onEdit(context);
    }
    
    onEditingChange(null, null);
  };

  const handleCancel = () => {
    setEditValue(value);
    onEditingChange(null, null);
  };

  const validateInput = (inputValue: string | number): boolean => {
    if (field === 'key') {
      const keyStr = String(inputValue).trim();
      if (keyStr.length === 0) return false;
      
      // Check for duplicate keys in the same item
      const existingKeys = item.specifications
        ?.filter((_, index) => index !== specIndex)
        .map(spec => spec.key) || [];
      
      return !existingKeys.includes(keyStr);
    }
    
    if (field === 'order') {
      const orderNum = Number(inputValue);
      return !isNaN(orderNum) && orderNum >= 0;
    }
    
    return true; // Value field can be any string
  };

  const getValidationError = (inputValue: string | number): string => {
    if (field === 'key') {
      const keyStr = String(inputValue).trim();
      if (keyStr.length === 0) {
        return '仕様項目名は必須です';
      }
      
      const existingKeys = item.specifications
        ?.filter((_, index) => index !== specIndex)
        .map(spec => spec.key) || [];
      
      if (existingKeys.includes(keyStr)) {
        return 'この仕様項目名は既に存在します';
      }
    }
    
    if (field === 'order') {
      const orderNum = Number(inputValue);
      if (isNaN(orderNum) || orderNum < 0) {
        return '順序は0以上の数値で入力してください';
      }
    }
    
    return '';
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly && field === 'key') {
      setContextMenuAnchor(e.currentTarget as HTMLElement);
    }
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
  };

  const handleAddSpecification = () => {
    onSpecificationAdd(item.id, specIndex);
    handleContextMenuClose();
  };

  const handleDeleteSpecification = () => {
    if (item.specifications && item.specifications.length > 1) {
      onSpecificationDelete(item.id, specIndex);
    }
    handleContextMenuClose();
  };

  const handleMoveUp = () => {
    if (specIndex > 0) {
      onSpecificationReorder(item.id, specIndex, specIndex - 1);
    }
    handleContextMenuClose();
  };

  const handleMoveDown = () => {
    if (item.specifications && specIndex < item.specifications.length - 1) {
      onSpecificationReorder(item.id, specIndex, specIndex + 1);
    }
    handleContextMenuClose();
  };

  const renderEditingContent = () => {
    return (
      <TextField
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        fullWidth
        variant="standard"
        size="small"
        type={field === 'order' ? 'number' : 'text'}
        placeholder={
          field === 'key' ? '仕様項目名' :
          field === 'value' ? '値' :
          '順序'
        }
        error={!validateInput(editValue)}
        helperText={!validateInput(editValue) ? getValidationError(editValue) : undefined}
      />
    );
  };

  const renderDisplayContent = () => {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%',
          minHeight: '24px'
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || (field === 'key' ? '未設定' : '')}
        </span>
        
        {isSelected && !readOnly && field === 'key' && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
            <Tooltip title="仕様項目メニュー">
              <IconButton
                size="small"
                onClick={handleContextMenu}
                sx={{ p: 0.25 }}
              >
                <MoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    );
  };

  const getCellClassName = () => {
    let className = 'specification-edit-cell';
    
    if (isSelected) {
      className += ' selected';
    }
    
    if (isEditing) {
      className += ' editing';
    }
    
    if (readOnly) {
      className += ' readonly';
    }
    
    if (field === 'key') {
      className += ' spec-key';
    } else if (field === 'value') {
      className += ' spec-value';
    } else {
      className += ' spec-order';
    }
    
    return className;
  };

  return (
    <>
      <td
        className={getCellClassName()}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        tabIndex={isSelected ? 0 : -1}
        data-row-id={item.id}
        data-column-id={cellId}
        style={{
          padding: '4px 8px',
          border: '1px solid #ddd',
          position: 'relative'
        }}
      >
        {isEditing ? renderEditingContent() : renderDisplayContent()}
      </td>

      {/* Context Menu */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleAddSpecification}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>仕様項目を追加</ListItemText>
        </MenuItem>
        
        {item.specifications && item.specifications.length > 1 && (
          <MenuItem onClick={handleDeleteSpecification}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>この項目を削除</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={handleMoveUp} disabled={specIndex === 0}>
          <ListItemIcon>
            <DragIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>上に移動</ListItemText>
        </MenuItem>
        
        <MenuItem 
          onClick={handleMoveDown} 
          disabled={!item.specifications || specIndex >= item.specifications.length - 1}
        >
          <ListItemIcon>
            <DragIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>下に移動</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default SpecificationEditCell;