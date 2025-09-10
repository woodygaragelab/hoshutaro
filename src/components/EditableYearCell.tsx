import React, { useState, useEffect } from 'react';
import { HierarchicalData } from '../types';
import { TextField, Select, MenuItem, FormControl } from '@mui/material';

interface EditableYearCellProps {
  item: HierarchicalData;
  year: number;
  viewMode: 'status' | 'cost';
  onUpdateItem: (updatedItem: HierarchicalData) => void;
}

const EditableYearCell: React.FC<EditableYearCellProps> = ({ item, year, viewMode, onUpdateItem }) => {
  const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
  const dataForYear = resultsData?.[year] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
  
  const [isEditing, setIsEditing] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [planCostValue, setPlanCostValue] = useState(0);
  const [actualCostValue, setActualCostValue] = useState(0);

  useEffect(() => {
    const currentStatus = dataForYear.planned && dataForYear.actual ? 'plan_and_actual' : dataForYear.planned ? 'plan_only' : dataForYear.actual ? 'actual_only' : 'clear';
    setStatusValue(currentStatus);
    setPlanCostValue(dataForYear.planCost || 0);
    setActualCostValue(dataForYear.actualCost || 0);
  }, [dataForYear]);

  const handleCellClick = () => {
    if (item.children.length === 0) { // Only allow editing for leaf nodes
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    let updatedResults = { ...item.results };
    if (!updatedResults[year]) {
      updatedResults[year] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
    }

    if (viewMode === 'status') {
      switch (statusValue) {
        case 'plan_only':
          updatedResults[year].planned = true;
          updatedResults[year].actual = false;
          break;
        case 'actual_only':
          updatedResults[year].planned = false;
          updatedResults[year].actual = true;
          break;
        case 'plan_and_actual':
          updatedResults[year].planned = true;
          updatedResults[year].actual = true;
          break;
        case 'clear':
        default:
          updatedResults[year].planned = false;
          updatedResults[year].actual = false;
          break;
      }
    } else { // cost mode
      updatedResults[year].planCost = planCostValue;
      updatedResults[year].actualCost = actualCostValue;
    }

    onUpdateItem({ ...item, results: updatedResults });
    setIsEditing(false);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleBlur(); // Apply changes on Enter
    } else if (e.key === 'Escape') {
      // Revert to original values and exit editing mode
      const originalStatus = dataForYear.planned && dataForYear.actual ? 'plan_and_actual' : dataForYear.planned ? 'plan_only' : dataForYear.actual ? 'actual_only' : 'clear';
      setStatusValue(originalStatus);
      setPlanCostValue(dataForYear.planCost || 0);
      setActualCostValue(dataForYear.actualCost || 0);
      setIsEditing(false);
    }
  };

  return (
    <td className={`year-col ${viewMode === 'cost' ? 'cost-mode' : ''}`} data-year={year} onClick={handleCellClick}>
      {isEditing && item.children.length === 0 ? (
        viewMode === 'status' ? (
          <FormControl fullWidth variant="standard">
            <Select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as string)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              size="small"
            >
              <MenuItem value="plan_only">〇: 計画のみ</MenuItem>
              <MenuItem value="actual_only">●: 実績のみ</MenuItem>
              <MenuItem value="plan_and_actual">〇●: 計画と実績</MenuItem>
              <MenuItem value="clear">[ ] 削除</MenuItem>
            </Select>
          </FormControl>
        ) : (
          <div onBlur={handleBlur}> {/* Use a div with onBlur to handle both fields */}
            <TextField
              value={String(planCostValue)}
              onChange={(e) => setPlanCostValue(parseInt(e.target.value, 10) || 0)}
              onKeyDown={handleKeyDown}
              autoFocus
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
        )
      ) : (
        viewMode === 'status' ? (
          dataForYear && (
            <>
              <div className={item.children.length > 0 ? 'summary-mark' : ''}>{dataForYear.planned ? '〇' : ''}</div>
              <div className={`actual-mark ${item.children.length > 0 ? 'summary-mark summary-actual' : ''}`}>{dataForYear.actual ? '●' : ''}</div>
            </>
          )
        ) : (
          <>
            <div className="cost-plan" title="計画コスト">{(dataForYear?.planCost || 0).toLocaleString()}</div>
            <div className="cost-actual" title="実績コスト">{(dataForYear?.actualCost || 0).toLocaleString()}</div>
          </>
        )
      )}
    </td>
  );
};

export default EditableYearCell;