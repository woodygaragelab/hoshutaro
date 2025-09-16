import React from 'react';

interface TableHeaderProps {
  timeHeaders: string[];
  timeScale: 'year' | 'month' | 'week' | 'day';
  showBomCode: boolean;
  showCycle: boolean;
}

const TableHeader: React.FC<TableHeaderProps> = ({ timeHeaders, timeScale, showBomCode, showCycle }) => {
  const getTimeScaleClass = () => {
    return `time-col ${timeScale}-col`;
  };

  // 年表示の場合: rowSpan=2 を使ってセルを結合する
  if (timeScale === 'year') {
    return (
      <thead>
        <tr>
          <th rowSpan={2} className="task-name-col">機器</th>
          {showBomCode && <th rowSpan={2} className="bom-code-col">TAG No.</th>}
          {showCycle && <th rowSpan={2} className="cycle-col">周期(年)</th>}
          {timeHeaders.map(header => (
            <th key={header} rowSpan={2} className={getTimeScaleClass()}>
              {header}
            </th>
          ))}
        </tr>
        {/* rowSpanが適用されるための空の2行目 */}
        <tr></tr>
      </thead>
    );
  }

  // 月・週・日表示の場合
  const getGroupedHeaders = () => {
    const groups: { [key: string]: string[] } = {};
    timeHeaders.forEach(header => {
      const parts = header.split('-');
      let groupKey = parts[0]; // Default for month/week
      if (timeScale === 'day') {
        groupKey = `${parts[0]}-${parts[1]}`;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(header);
    });
    return groups;
  };

  const groupedHeaders = getGroupedHeaders();

  return (
    <thead>
      <tr>
        <th rowSpan={2} className="task-name-col">機器</th>
        {showBomCode && <th rowSpan={2} className="bom-code-col">TAG No.</th>}
        {showCycle && <th rowSpan={2} className="cycle-col">周期(年)</th>}
        {Object.keys(groupedHeaders).map(group => (
          <th key={group} colSpan={groupedHeaders[group].length} className="group-header">
            {group}
          </th>
        ))}
      </tr>
      <tr>
        {Object.values(groupedHeaders).flat().map(header => {
          const parts = header.split('-');
          let label = '';
          if (timeScale === 'month') {
            label = parts[1];
          } else if (timeScale === 'week') {
            label = parts[1].replace('W', '');
          } else if (timeScale === 'day') {
            label = parts[2];
          }
          return (
            <th key={header} className={getTimeScaleClass()}>
              {label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

export default TableHeader;