import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HierarchicalData } from '../../types';
import './CostTrendGraph.css';

interface CostTrendGraphProps {
  data: HierarchicalData[];
  timeHeaders: string[];
}

interface ChartDataPoint {
  year: number;
  plan: number;
  actual: number;
}

export const CostTrendGraph: React.FC<CostTrendGraphProps> = ({ data, timeHeaders }) => {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  const { chartData, maxCost } = useMemo(() => {
    // Determine start and end years based on timeHeaders
    const currentYear = new Date().getFullYear();
    let startYear = currentYear;
    let endYear = currentYear;

    if (timeHeaders && timeHeaders.length > 0) {
      const startMatch = timeHeaders[0].substring(0, 4);
      const endMatch = timeHeaders[timeHeaders.length - 1].substring(0, 4);
      const parsedStart = parseInt(startMatch, 10);
      const parsedEnd = parseInt(endMatch, 10);
      
      if (!isNaN(parsedStart)) startYear = parsedStart;
      if (!isNaN(parsedEnd)) endYear = Math.max(parsedStart, parsedEnd); // Ensure end >= start
    }

    // Aggregate costs per year across the provided data
    const aggregatedCosts: Record<number, { plan: number; actual: number }> = {};
    
    // デバッグ用：最初の数行だけ形を出力
    // console.log("CostTrendGraph DATA [0]:", data[0]);
    // console.log("timeHeaders:", timeHeaders);

    data.forEach(row => {
      // Exclude hierarchy group headers to prevent duplication
      if (row.isGroupHeader) return;
      
      // 作業ベースモードでの二重集計防止 (子が 'assetChild'、親が 'workOrder')
      if (row.type === 'assetChild') return;

      const resultsToUse = row.aggregatedSchedule || row.results;

      if (resultsToUse) {
        Object.entries(resultsToUse).forEach(([timeKey, status]: [string, any]) => {
          const yearMatch = String(timeKey).substring(0, 4);
          const year = parseInt(yearMatch, 10);
          if (!isNaN(year)) {
            if (!aggregatedCosts[year]) {
              aggregatedCosts[year] = { plan: 0, actual: 0 };
            }
            // プロパティが存在しない場合はNumber()でNaNになるため、|| 0 で受ける
            const pCost = Number(status.planCost) || Number(status.totalPlanCost) || Number(status.PlanCost) || 0;
            const aCost = Number(status.actualCost) || Number(status.totalActualCost) || Number(status.ActualCost) || 0;
            
            aggregatedCosts[year].plan += isNaN(pCost) ? 0 : pCost;
            aggregatedCosts[year].actual += isNaN(aCost) ? 0 : aCost;
          }
        });
      }
    });

    // Build the array spanning startYear to endYear
    let calculatedMaxCost = 1000; // minimum scale
    const points: ChartDataPoint[] = [];
    
    for (let y = startYear; y <= endYear; y++) {
      const plan = aggregatedCosts[y]?.plan || 0;
      const actual = aggregatedCosts[y]?.actual || 0;
      points.push({ year: y, plan, actual });
      
      if (plan > calculatedMaxCost) calculatedMaxCost = plan;
      if (actual > calculatedMaxCost) calculatedMaxCost = actual;
    }

    // Add 10% padding to max chart scale
    return {
      chartData: points,
      maxCost: calculatedMaxCost * 1.1
    };
  }, [data, timeHeaders]);

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(cost);
  };

  return (
    <motion.div 
      className="cost-trend-graph-container"
      initial={{ opacity: 0, y: -20, height: 0 }}
      animate={{ opacity: 1, y: 0, height: '100%' }}
      exit={{ opacity: 0, y: -20, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="ctg-header">
        <div className="ctg-legend">
          <div className="ctg-legend-item">
            <span className="ctg-legend-color plan"></span>
            <span>計画コスト</span>
          </div>
          <div className="ctg-legend-item">
            <span className="ctg-legend-color actual"></span>
            <span>実績コスト</span>
          </div>
        </div>
      </div>
      
      <div className="ctg-chart-area">
        {chartData.map((d, index) => {
          const planHeightPercent = (d.plan / maxCost) * 100;
          const actualHeightPercent = (d.actual / maxCost) * 100;
          
          return (
            <div 
              key={d.year} 
              className="ctg-bar-group"
              onMouseEnter={() => setHoveredYear(d.year)}
              onMouseLeave={() => setHoveredYear(null)}
            >
              {/* Tooltip */}
              <AnimatePresence>
                {hoveredYear === d.year && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="ctg-tooltip-content"
                  >
                    <div style={{ paddingBottom: '4px', borderBottom: '1px solid #444', marginBottom: '6px' }}>{d.year}年度</div>
                    <div className="ctg-tooltip-line">
                      <span style={{ color: '#60a5fa' }}>計画</span>
                      <span>{formatCost(d.plan)}</span>
                    </div>
                    <div className="ctg-tooltip-line">
                      <span style={{ color: '#f87171' }}>実績</span>
                      <span>{formatCost(d.actual)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="ctg-bars">
                <motion.div 
                  className="ctg-bar plan"
                  initial={{ height: 0 }}
                  animate={{ height: `${planHeightPercent}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05, ease: 'easeOut' }}
                />
                <motion.div 
                  className="ctg-bar actual"
                  initial={{ height: 0 }}
                  animate={{ height: `${actualHeightPercent}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 + 0.1, ease: 'easeOut' }}
                />
              </div>
              <div className="ctg-label">{d.year}</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
