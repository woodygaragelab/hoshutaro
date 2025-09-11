import React, { useState } from 'react';
import { HierarchicalData } from '../types';
import { TextField } from '@mui/material';
import EditableYearCell from './EditableYearCell';

interface TableRowProps {
  item: HierarchicalData;
  allYears: number[];
  viewMode: 'status' | 'cost';
  onUpdateItem: (updatedItem: HierarchicalData) => void; // Callback to update parent state
  showBomCode: boolean;
  showCycle: boolean;
  onToggle: (id: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({ item, allYears, viewMode, onUpdateItem, showBomCode, showCycle, onToggle }) => {
  
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskInputValue, setTaskInputValue] = useState(item.task);
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleInputValue, setCycleInputValue] = useState(item.cycle || '');

  const handleTaskClick = (e: React.MouseEvent) => {
    if (item.level >= 4) { // Only allow editing for level 4 tasks
      setIsEditingTask(true);
    }
    e.stopPropagation(); // Prevent toggle when clicking on task text for editing
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
      setTaskInputValue(item.task); // Revert to original value
      setIsEditingTask(false);
    }
  };

  const handleCycleClick = (e: React.MouseEvent) => {
    if (item.level >= 4) { // Only allow editing for level 4 tasks
      setIsEditingCycle(true);
    }
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
      setCycleInputValue(item.cycle || ''); // Revert to original value
      setIsEditingCycle(false);
    }
  };

  const handleRowClick = () => {
    if (item.children.length > 0) {
      onToggle(item.id);
    }
  };

  return (
    <React.Fragment>
      <tr data-id={item.id} className={`level-${item.level} ${item.children.length > 0 ? 'has-children' : ''}`} onClick={handleRowClick}>
        <td className="task-name-col">
          <div className="task-name-content" style={{ paddingLeft: `${(item.level - 1) * 20 + 5}px` }}>
            <span className="toggle-icon">
              {item.children.length > 0 ? (item.isOpen ? '▼' : '▶') : ''}
            </span>
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
        {allYears.map(year => (
          <EditableYearCell
            key={year}
            item={item}
            year={year}
            viewMode={viewMode}
            onUpdateItem={onUpdateItem}
          />
        ))}
      </tr>
      {item.isOpen && item.children && item.children.map(child => (
        <TableRow key={child.id} item={child} allYears={allYears} viewMode={viewMode} onUpdateItem={onUpdateItem} showBomCode={showBomCode} showCycle={showCycle} onToggle={onToggle} />
      ))}
    </React.Fragment>
  );
};

export default TableRow;