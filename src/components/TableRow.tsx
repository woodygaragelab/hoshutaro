import React, { useState } from 'react';
import { HierarchicalData } from '../types';
import { TextField } from '@mui/material';
import EditableCell from './EditableCell';

interface TableRowProps {
  item: HierarchicalData;
  allTimeHeaders: string[];
  viewMode: 'status' | 'cost';
  onUpdateItem: (updatedItem: HierarchicalData) => void;
  showBomCode: boolean;
  showCycle: boolean;
}

const TableRow: React.FC<TableRowProps> = ({ item, allTimeHeaders, viewMode, onUpdateItem, showBomCode, showCycle }) => {
  
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInputValue, setTaskInputValue] = useState(item.task);
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleInputValue, setCycleInputValue] = useState(item.cycle || '');

  const handleTaskClick = (e: React.MouseEvent) => {
    setIsEditingTask(true);
    e.stopPropagation();
  };

  const handleTaskBlur = () => {
    if (taskInputValue.trim() !== item.task) {
      onUpdateItem({ ...item, task: taskInputValue.trim() });
    }
    setIsEditingTask(false);
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setTaskInputValue(item.task);
      setIsEditingTask(false);
    }
  };

  const handleCycleClick = (e: React.MouseEvent) => {
    setIsEditingCycle(true);
    e.stopPropagation();
  };

  const handleCycleBlur = () => {
    const newCycle = parseInt(cycleInputValue as string, 10);
    if (newCycle !== item.cycle) {
      onUpdateItem({ ...item, cycle: isNaN(newCycle) ? undefined : newCycle });
    }
    setIsEditingCycle(false);
  };

  const handleCycleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setCycleInputValue(item.cycle || '');
      setIsEditingCycle(false);
    }
  };

  return (
      <tr data-id={item.id}>
        <td className="task-name-col">
          <div className="task-name-content">
            <div className="task-text-container" onClick={handleTaskClick}>
              {isEditingTask ? (
                <TextField
                  value={taskInputValue}
                  onChange={(e) => setTaskInputValue(e.target.value)}
                  onBlur={handleTaskBlur}
                  onKeyDown={handleTaskKeyDown}
                  autoFocus
                  fullWidth
                  variant="standard"
                  size="small"
                />
              ) : (
                item.task
              )}
            </div>
            <div className="task-actions"></div>
          </div>
        </td>
        {showBomCode && <td className="bom-code-col">{item.bomCode}</td>}
        {showCycle && (
          <td className="cycle-col">
            <div className="cycle-col-content" onClick={handleCycleClick}>
              {isEditingCycle ? (
                <TextField
                  value={cycleInputValue}
                  onChange={(e) => setCycleInputValue(e.target.value)}
                  onBlur={handleCycleBlur}
                  onKeyDown={handleCycleKeyDown}
                  autoFocus
                  fullWidth
                  variant="standard"
                  size="small"
                  type="number"
                />
              ) : (
                <span>{item.cycle || ''}</span>
              )}
            </div>
          </td>
        )}
        {allTimeHeaders.map(timeHeader => (
          <EditableCell
            key={timeHeader}
            item={item}
            timeHeader={timeHeader}
            viewMode={viewMode}
            onUpdateItem={onUpdateItem}
          />
        ))}
      </tr>
  );
};

export default TableRow;