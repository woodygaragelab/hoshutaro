import React, { useState, useEffect, useRef } from 'react';
import { TextField, Select, MenuItem, FormControl } from '@mui/material';
import { HierarchicalData } from '../../types';
import { GridColumn } from './types';

interface MaintenanceGridCellProps {
  item: HierarchicalData;
  column: GridColumn;
  value: any;
  isSelected: boolean;
  isEditing: boolean;
  onEdit: (rowId: string, columnId: string, value: any) => void;
  onSelect: (rowId: string | null, columnId: string | null) => void;
  onEditingChange: (rowId: string | null, columnId: string | null) => void;
  readOnly: boolean;
  timeHeader?: string; // For time-based cells
  viewMode?: 'status' | 'cost'; // For time-based cells
}

export const MaintenanceGridCell: React.FC<MaintenanceGridCellProps> = ({
  item,
  column,
  value,
  isSelected,
  isEditing,
  onEdit,
  onSelect,
  onEditingChange,
  readOnly,
  timeHeader,
  viewMode = 'status'
}) => {
  const [editValue, setEditValue] = useState(value);
  const [statusValue, setStatusValue] = useState('');
  const [planCostValue, setPlanCostValue] = useState(0);
  const [actualCostValue, setActualCostValue] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when value prop changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Handle time-based cell data
  useEffect(() => {
    if (column.type === 'status' || column.type === 'cost') {
      const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
      const dataForTimeHeader = resultsData?.[timeHeader || ''] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
      
      const currentStatus = dataForTimeHeader.planned && dataForTimeHeader.actual ? 'plan_and_actual' : 
                           dataForTimeHeader.planned ? 'plan_only' : 
                           dataForTimeHeader.actual ? 'actual_only' : 'clear';
      setStatusValue(currentStatus);
      setPlanCostValue(dataForTimeHeader.planCost || 0);
      setActualCostValue(dataForTimeHeader.actualCost || 0);
    }
  }, [item, column.type, timeHeader]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (column.type === 'text' && inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing, column.type]);

  const handleClick = () => {
    if (!readOnly) {
      onSelect(item.id, column.id);
    }
  };

  const handleDoubleClick = () => {
    if (!readOnly && column.editable && item.children.length === 0) {
      onEditingChange(item.id, column.id);
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
          if (!readOnly && column.editable && item.children.length === 0) {
            e.preventDefault();
            onEditingChange(item.id, column.id);
          }
          break;
      }
    }
  };

  const handleSave = () => {
    if (column.type === 'status') {
      // Handle status cell save
      const timeHeaderKey = timeHeader || column.id.replace('time_', '');
      let updatedResults = { ...item.results };
      if (!updatedResults[timeHeaderKey]) {
        updatedResults[timeHeaderKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
      }

      switch (statusValue) {
        case 'plan_only':
          updatedResults[timeHeaderKey].planned = true;
          updatedResults[timeHeaderKey].actual = false;
          break;
        case 'actual_only':
          updatedResults[timeHeaderKey].planned = false;
          updatedResults[timeHeaderKey].actual = true;
          break;
        case 'plan_and_actual':
          updatedResults[timeHeaderKey].planned = true;
          updatedResults[timeHeaderKey].actual = true;
          break;
        case 'clear':
        default:
          updatedResults[timeHeaderKey].planned = false;
          updatedResults[timeHeaderKey].actual = false;
          break;
      }
      
      onEdit(item.id, timeHeaderKey, updatedResults[timeHeaderKey]);
    } else if (column.type === 'cost') {
      // Handle cost cell save
      const timeHeaderKey = timeHeader || column.id.replace('time_', '');
      let updatedResults = { ...item.results };
      if (!updatedResults[timeHeaderKey]) {
        updatedResults[timeHeaderKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
      }
      
      updatedResults[timeHeaderKey].planCost = planCostValue;
      updatedResults[timeHeaderKey].actualCost = actualCostValue;
      
      onEdit(item.id, timeHeaderKey, updatedResults[timeHeaderKey]);
    } else {
      // Handle regular cell save
      let processedValue = editValue;
      if (column.type === 'number') {
        processedValue = parseFloat(editValue) || 0;
      }
      onEdit(item.id, column.id, processedValue);
    }
    
    onEditingChange(null, null);
  };

  const handleCancel = () => {
    setEditValue(value);
    if (column.type === 'status' || column.type === 'cost') {
      const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
      const dataForTimeHeader = resultsData?.[timeHeader || ''] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
      
      const originalStatus = dataForTimeHeader.planned && dataForTimeHeader.actual ? 'plan_and_actual' : 
                            dataForTimeHeader.planned ? 'plan_only' : 
                            dataForTimeHeader.actual ? 'actual_only' : 'clear';
      setStatusValue(originalStatus);
      setPlanCostValue(dataForTimeHeader.planCost || 0);
      setActualCostValue(dataForTimeHeader.actualCost || 0);
    }
    onEditingChange(null, null);
  };

  const renderEditingContent = () => {
    if (column.type === 'status') {
      return (
        <FormControl fullWidth variant="standard">
          <Select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as string)}
            autoFocus
            size="small"
            onKeyDown={handleKeyDown}
          >
            <MenuItem value="plan_only">〇: 計画</MenuItem>
            <MenuItem value="actual_only">●: 実績</MenuItem>
            <MenuItem value="plan_and_actual">◎: 両方</MenuItem>
            <MenuItem value="clear">[ ] 削除</MenuItem>
          </Select>
        </FormControl>
      );
    } else if (column.type === 'cost') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <TextField
            ref={inputRef}
            value={String(planCostValue)}
            onChange={(e) => setPlanCostValue(parseInt(e.target.value, 10) || 0)}
            onKeyDown={handleKeyDown}
            fullWidth
            variant="standard"
            size="small"
            type="number"
            label="計画コスト"
            className="cost-input"
          />
          <TextField
            value={String(actualCostValue)}
            onChange={(e) => setActualCostValue(parseInt(e.target.value, 10) || 0)}
            onKeyDown={handleKeyDown}
            fullWidth
            variant="standard"
            size="small"
            type="number"
            label="実績コスト"
            className="cost-input"
          />
        </div>
      );
    } else {
      return (
        <TextField
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
          variant="standard"
          size="small"
          type={column.type === 'number' ? 'number' : 'text'}
        />
      );
    }
  };

  const renderDisplayContent = () => {
    if (column.type === 'status') {
      const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
      const dataForTimeHeader = resultsData?.[timeHeader || ''] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
      
      if (dataForTimeHeader) {
        const { planned, actual } = dataForTimeHeader;
        const isSummary = item.children.length > 0;
        const summaryClass = isSummary ? 'summary-mark' : '';
        const actualClass = `actual-mark ${isSummary ? 'summary-mark summary-actual' : ''}`;

        if (planned && actual) {
          return <div className={summaryClass}>◎</div>;
        } else if (planned) {
          return <div className={summaryClass}>〇</div>;
        } else if (actual) {
          return <div className={actualClass}>●</div>;
        }
      }
      return null;
    } else if (column.type === 'cost') {
      const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
      const dataForTimeHeader = resultsData?.[timeHeader || ''] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
      
      return (
        <>
          <div className="cost-plan" title="計画コスト">{(dataForTimeHeader?.planCost || 0).toLocaleString()}</div>
          <div className="cost-actual" title="実績コスト">{(dataForTimeHeader?.actualCost || 0).toLocaleString()}</div>
        </>
      );
    } else {
      return value || '';
    }
  };

  const getCellClassName = () => {
    let className = 'maintenance-grid-cell';
    
    if (isSelected) {
      className += ' selected';
    }
    
    if (isEditing) {
      className += ' editing';
    }
    
    if (column.type === 'status' || column.type === 'cost') {
      className += ` time-col ${viewMode === 'cost' ? 'cost-mode' : ''}`;
    }
    
    if (!column.editable || readOnly || item.children.length > 0) {
      className += ' readonly';
    }
    
    return className;
  };

  return (
    <td
      className={getCellClassName()}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
      data-row-id={item.id}
      data-column-id={column.id}
      style={{
        width: column.width,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth
      }}
    >
      {isEditing ? renderEditingContent() : renderDisplayContent()}
    </td>
  );
};

export default MaintenanceGridCell;