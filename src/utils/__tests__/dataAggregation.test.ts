/**
 * データ集約ユーティリティのテスト
 */

import {
  aggregateScheduleByTimeScale,
  getDisplaySymbol,
  getDisplaySymbolWithCount,
  aggregateMultipleSchedules,
  convertDateKeyToTimeScale,
  getDateKeyFormat,
} from '../dataAggregation';
import type { AssociationSchedule, AggregatedStatus } from '../../types/maintenanceTask';

describe('dataAggregation', () => {
  describe('aggregateScheduleByTimeScale', () => {
    it('should aggregate schedule by year', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-11-30': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(result).toEqual({
        '2025': {
          planned: true,
          actual: true,
          totalPlanCost: 2000000,
          totalActualCost: 950000,
          count: 2,
        },
      });
    });

    it('should aggregate schedule by month', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-02-15': {
          planned: true,
          actual: false,
          planCost: 500000,
          actualCost: 0,
        },
        '2025-11-30': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'month');

      expect(result).toEqual({
        '2025-02': {
          planned: true,
          actual: true,
          totalPlanCost: 1500000,
          totalActualCost: 950000,
          count: 2,
        },
        '2025-11': {
          planned: true,
          actual: false,
          totalPlanCost: 1000000,
          totalActualCost: 0,
          count: 1,
        },
      });
    });

    it('should not aggregate when timeScale is day', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-02-15': {
          planned: true,
          actual: false,
          planCost: 500000,
          actualCost: 0,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'day');

      expect(result).toEqual({
        '2025-02-01': {
          planned: true,
          actual: true,
          totalPlanCost: 1000000,
          totalActualCost: 950000,
          count: 1,
        },
        '2025-02-15': {
          planned: true,
          actual: false,
          totalPlanCost: 500000,
          totalActualCost: 0,
          count: 1,
        },
      });
    });

    it('should use OR logic for planned and actual flags', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
        '2025-02-15': {
          planned: false,
          actual: true,
          planCost: 0,
          actualCost: 500000,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'month');

      expect(result['2025-02'].planned).toBe(true);
      expect(result['2025-02'].actual).toBe(true);
    });

    it('should handle empty schedule', () => {
      const schedule: AssociationSchedule = {};

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(result).toEqual({});
    });

    it('should handle schedule with only planned entries', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(result['2025'].planned).toBe(true);
      expect(result['2025'].actual).toBe(false);
    });

    it('should handle schedule with only actual entries', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: false,
          actual: true,
          planCost: 0,
          actualCost: 950000,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(result['2025'].planned).toBe(false);
      expect(result['2025'].actual).toBe(true);
    });
  });

  describe('getDisplaySymbol', () => {
    it('should return ◎ for planned and actual', () => {
      const status: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 1000000,
        totalActualCost: 950000,
        count: 1,
      };

      expect(getDisplaySymbol(status)).toBe('◎');
    });

    it('should return ○ for planned only', () => {
      const status: AggregatedStatus = {
        planned: true,
        actual: false,
        totalPlanCost: 1000000,
        totalActualCost: 0,
        count: 1,
      };

      expect(getDisplaySymbol(status)).toBe('○');
    });

    it('should return ● for actual only', () => {
      const status: AggregatedStatus = {
        planned: false,
        actual: true,
        totalPlanCost: 0,
        totalActualCost: 950000,
        count: 1,
      };

      expect(getDisplaySymbol(status)).toBe('●');
    });

    it('should return empty string for no planned or actual', () => {
      const status: AggregatedStatus = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0,
      };

      expect(getDisplaySymbol(status)).toBe('');
    });
  });

  describe('getDisplaySymbolWithCount', () => {
    it('should return symbol without count when count is 1', () => {
      const status: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 1000000,
        totalActualCost: 950000,
        count: 1,
      };

      expect(getDisplaySymbolWithCount(status)).toBe('◎');
    });

    it('should return symbol with count when count is greater than 1', () => {
      const status: AggregatedStatus = {
        planned: true,
        actual: true,
        totalPlanCost: 2000000,
        totalActualCost: 1900000,
        count: 2,
      };

      expect(getDisplaySymbolWithCount(status)).toBe('◎(2)');
    });

    it('should return empty string when no planned or actual', () => {
      const status: AggregatedStatus = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0,
      };

      expect(getDisplaySymbolWithCount(status)).toBe('');
    });

    it('should handle large counts', () => {
      const status: AggregatedStatus = {
        planned: true,
        actual: false,
        totalPlanCost: 10000000,
        totalActualCost: 0,
        count: 10,
      };

      expect(getDisplaySymbolWithCount(status)).toBe('○(10)');
    });
  });

  describe('aggregateMultipleSchedules', () => {
    it('should aggregate multiple schedules by year', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
        },
        {
          '2025-02-15': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result).toEqual({
        '2025': {
          planned: true,
          actual: true,
          totalPlanCost: 1500000,
          totalActualCost: 950000,
          count: 2,
        },
      });
    });

    it('should aggregate multiple schedules by month', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
        },
        {
          '2025-02-15': {
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
        {
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result).toEqual({
        '2025-02': {
          planned: true,
          actual: true,
          totalPlanCost: 1500000,
          totalActualCost: 950000,
          count: 2,
        },
        '2025-11': {
          planned: true,
          actual: false,
          totalPlanCost: 1000000,
          totalActualCost: 0,
          count: 1,
        },
      });
    });

    it('should handle empty schedules array', () => {
      const schedules: AssociationSchedule[] = [];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result).toEqual({});
    });

    it('should use OR logic for planned and actual flags across schedules', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
        {
          '2025-02-15': {
            planned: false,
            actual: true,
            planCost: 0,
            actualCost: 500000,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02'].planned).toBe(true);
      expect(result['2025-02'].actual).toBe(true);
    });
  });

  describe('convertDateKeyToTimeScale', () => {
    it('should convert to year format', () => {
      expect(convertDateKeyToTimeScale('2025-02-01', 'year')).toBe('2025');
      expect(convertDateKeyToTimeScale('2025-11-30', 'year')).toBe('2025');
    });

    it('should convert to month format', () => {
      expect(convertDateKeyToTimeScale('2025-02-01', 'month')).toBe('2025-02');
      expect(convertDateKeyToTimeScale('2025-11-30', 'month')).toBe('2025-11');
    });

    it('should keep day format unchanged', () => {
      expect(convertDateKeyToTimeScale('2025-02-01', 'day')).toBe('2025-02-01');
      expect(convertDateKeyToTimeScale('2025-11-30', 'day')).toBe('2025-11-30');
    });

    it('should handle already formatted keys', () => {
      expect(convertDateKeyToTimeScale('2025', 'year')).toBe('2025');
      expect(convertDateKeyToTimeScale('2025-02', 'month')).toBe('2025-02');
    });
  });

  describe('getDateKeyFormat', () => {
    it('should return correct format for year', () => {
      expect(getDateKeyFormat('year')).toBe('YYYY');
    });

    it('should return correct format for month', () => {
      expect(getDateKeyFormat('month')).toBe('YYYY-MM');
    });

    it('should return correct format for day', () => {
      expect(getDateKeyFormat('day')).toBe('YYYY-MM-DD');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex multi-year, multi-task scenario', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2024-05-15': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
          '2025-05-20': {
            planned: true,
            actual: false,
            planCost: 520000,
            actualCost: 0,
          },
        },
        {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const yearResult = aggregateMultipleSchedules(schedules, 'year');

      expect(yearResult['2024']).toEqual({
        planned: true,
        actual: true,
        totalPlanCost: 500000,
        totalActualCost: 480000,
        count: 1,
      });

      expect(yearResult['2025']).toEqual({
        planned: true,
        actual: true,
        totalPlanCost: 2520000,
        totalActualCost: 950000,
        count: 3,
      });

      expect(getDisplaySymbolWithCount(yearResult['2024'])).toBe('◎');
      expect(getDisplaySymbolWithCount(yearResult['2025'])).toBe('◎(3)');
    });

    it('should handle equipment with 20 tasks scenario', () => {
      const schedules: AssociationSchedule[] = Array.from({ length: 20 }, (_, i) => ({
        [`2025-${String(i + 1).padStart(2, '0')}-01`]: {
          planned: true,
          actual: i % 2 === 0, // Half completed
          planCost: 100000,
          actualCost: i % 2 === 0 ? 95000 : 0,
        },
      }));

      const yearResult = aggregateMultipleSchedules(schedules, 'year');

      expect(yearResult['2025'].count).toBe(20);
      expect(yearResult['2025'].planned).toBe(true);
      expect(yearResult['2025'].actual).toBe(true);
      expect(yearResult['2025'].totalPlanCost).toBe(2000000);
      expect(yearResult['2025'].totalActualCost).toBe(950000);
      expect(getDisplaySymbolWithCount(yearResult['2025'])).toBe('◎(20)');
    });
  });

  describe('Time scale aggregation - Additional tests', () => {
    it('should aggregate across multiple years correctly', () => {
      const schedule: AssociationSchedule = {
        '2024-01-15': {
          planned: true,
          actual: true,
          planCost: 500000,
          actualCost: 480000,
        },
        '2024-12-20': {
          planned: true,
          actual: false,
          planCost: 600000,
          actualCost: 0,
        },
        '2025-06-10': {
          planned: false,
          actual: true,
          planCost: 0,
          actualCost: 700000,
        },
        '2026-03-05': {
          planned: true,
          actual: true,
          planCost: 800000,
          actualCost: 750000,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(Object.keys(result).length).toBe(3);
      expect(result['2024'].count).toBe(2);
      expect(result['2025'].count).toBe(1);
      expect(result['2026'].count).toBe(1);
      expect(result['2024'].totalPlanCost).toBe(1100000);
      expect(result['2025'].actual).toBe(true);
      expect(result['2025'].planned).toBe(false);
    });

    it('should handle zero costs with valid planned/actual flags', () => {
      const schedule: AssociationSchedule = {
        '2025-01-01': {
          planned: true,
          actual: false,
          planCost: 0,
          actualCost: 0,
        },
        '2025-02-01': {
          planned: false,
          actual: true,
          planCost: 0,
          actualCost: 0,
        },
      };

      const result = aggregateScheduleByTimeScale(schedule, 'year');

      expect(result['2025'].planned).toBe(true);
      expect(result['2025'].actual).toBe(true);
      expect(result['2025'].totalPlanCost).toBe(0);
      expect(result['2025'].totalActualCost).toBe(0);
      expect(result['2025'].count).toBe(2);
      expect(getDisplaySymbol(result['2025'])).toBe('◎');
    });

    it('should maintain consistency when aggregating same data at different time scales', () => {
      const schedule: AssociationSchedule = {
        '2025-03-15': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-03-20': {
          planned: true,
          actual: false,
          planCost: 500000,
          actualCost: 0,
        },
      };

      const dayResult = aggregateScheduleByTimeScale(schedule, 'day');
      const monthResult = aggregateScheduleByTimeScale(schedule, 'month');
      const yearResult = aggregateScheduleByTimeScale(schedule, 'year');

      // Day level should have 2 separate entries
      expect(Object.keys(dayResult).length).toBe(2);
      
      // Month level should aggregate to 1 entry
      expect(Object.keys(monthResult).length).toBe(1);
      expect(monthResult['2025-03'].count).toBe(2);
      expect(monthResult['2025-03'].totalPlanCost).toBe(1500000);
      
      // Year level should also aggregate to 1 entry with same totals
      expect(Object.keys(yearResult).length).toBe(1);
      expect(yearResult['2025'].count).toBe(2);
      expect(yearResult['2025'].totalPlanCost).toBe(1500000);
      expect(yearResult['2025'].totalActualCost).toBe(950000);
    });

    it('should correctly aggregate when same task runs multiple times in same month', () => {
      const schedule: AssociationSchedule = {
        '2025-02-01': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 950000,
        },
        '2025-02-15': {
          planned: true,
          actual: true,
          planCost: 1000000,
          actualCost: 980000,
        },
        '2025-02-28': {
          planned: true,
          actual: false,
          planCost: 1000000,
          actualCost: 0,
        },
      };

      const monthResult = aggregateScheduleByTimeScale(schedule, 'month');

      expect(monthResult['2025-02'].count).toBe(3);
      expect(monthResult['2025-02'].planned).toBe(true);
      expect(monthResult['2025-02'].actual).toBe(true);
      expect(monthResult['2025-02'].totalPlanCost).toBe(3000000);
      expect(monthResult['2025-02'].totalActualCost).toBe(1930000);
      expect(getDisplaySymbolWithCount(monthResult['2025-02'])).toBe('◎(3)');
    });
  });
});
