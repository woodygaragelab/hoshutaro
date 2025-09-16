import React, { useState, useEffect } from 'react';
import { HierarchicalData } from '../types';
import { TextField, Select, MenuItem, FormControl } from '@mui/material';

interface EditableCellProps {
  item: HierarchicalData;
  timeHeader: string;
  viewMode: 'status' | 'cost';
  onUpdateItem: (updatedItem: HierarchicalData) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ item, timeHeader, viewMode, onUpdateItem }) => {
  const resultsData = item.children.length > 0 ? item.rolledUpResults : item.results;
  const dataForTimeHeader = resultsData?.[timeHeader] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
  
  const [isEditing, setIsEditing] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [planCostValue, setPlanCostValue] = useState(0);
  const [actualCostValue, setActualCostValue] = useState(0);

  useEffect(() => {
    const currentStatus = dataForTimeHeader.planned && dataForTimeHeader.actual ? 'plan_and_actual' : dataForTimeHeader.planned ? 'plan_only' : dataForTimeHeader.actual ? 'actual_only' : 'clear';
    setStatusValue(currentStatus);
    setPlanCostValue(dataForTimeHeader.planCost || 0);
    setActualCostValue(dataForTimeHeader.actualCost || 0);
  }, [dataForTimeHeader]);

  const handleCellClick = () => {
    if (item.children.length === 0) { // Only allow editing for leaf nodes
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    let updatedResults = { ...item.results };
    if (!updatedResults[timeHeader]) {
      updatedResults[timeHeader] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
    }

    if (viewMode === 'status') {
      switch (statusValue) {
        case 'plan_only':
          updatedResults[timeHeader].planned = true;
          updatedResults[timeHeader].actual = false;
          break;
        case 'actual_only':
          updatedResults[timeHeader].planned = false;
          updatedResults[timeHeader].actual = true;
          break;
        case 'plan_and_actual':
          updatedResults[timeHeader].planned = true;
          updatedResults[timeHeader].actual = true;
          break;
        case 'clear':
        default:
          updatedResults[timeHeader].planned = false;
          updatedResults[timeHeader].actual = false;
          break;
      }
    } else { // cost mode
      updatedResults[timeHeader].planCost = planCostValue;
      updatedResults[timeHeader].actualCost = actualCostValue;
    }

    onUpdateItem({ ...item, results: updatedResults });
    setIsEditing(false);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleBlur(); // Apply changes on Enter
    } else if (e.key === 'Escape') {
      // Revert to original values and exit editing mode
      const originalStatus = dataForTimeHeader.planned && dataForTimeHeader.actual ? 'plan_and_actual' : dataForTimeHeader.planned ? 'plan_only' : dataForTimeHeader.actual ? 'actual_only' : 'clear';
      setStatusValue(originalStatus);
      setPlanCostValue(dataForTimeHeader.planCost || 0);
      setActualCostValue(dataForTimeHeader.actualCost || 0);
      setIsEditing(false);
    }
  };

  return (
    <td className={`year-col ${viewMode === 'cost' ? 'cost-mode' : ''}`} data-time-header={timeHeader} onClick={handleCellClick}>
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
              <MenuItem value="plan_and_actual">◎: 計画と実績</MenuItem>
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
          dataForTimeHeader && (() => {
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
            return null; // Render nothing if no data
          })()
        ) : (
          <>
            <div className="cost-plan" title="計画コスト">{(dataForTimeHeader?.planCost || 0).toLocaleString()}</div>
            <div className="cost-actual" title="実績コスト">{(dataForTimeHeader?.actualCost || 0).toLocaleString()}</div>
          </>
        )
      )}
    </td>
  );
};

export default EditableCell;