/**
 * データ集約の統合テスト
 * 年表示・月表示での集約表示が完全に動作することを確認
 */

import {
  aggregateScheduleByTimeScale,
  getDisplaySymbol,
  getDisplaySymbolWithCount,
  aggregateMultipleSchedules,
} from '../dataAggregation';
import type { AssociationSchedule } from '../../types/maintenanceTask';

describe('dataAggregation - Integration Tests', () => {
  describe('年表示での集約表示', () => {
    it('複数の作業が同じ年に実行される場合、正しく集約される', () => {
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
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result['2025']).toEqual({
        planned: true,
        actual: true,
        totalPlanCost: 2000000,
        totalActualCost: 950000,
        count: 2,
      });

      expect(getDisplaySymbolWithCount(result['2025'])).toBe('◎(2)');
    });

    it('異なる年の作業が正しく分離される', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2024-05-15': {
            planned: true,
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
        },
        {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result['2024']).toBeDefined();
      expect(result['2025']).toBeDefined();
      expect(getDisplaySymbolWithCount(result['2024'])).toBe('◎');
      expect(getDisplaySymbolWithCount(result['2025'])).toBe('○');
    });

    it('計画のみの作業が正しく表示される', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2026-01-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(getDisplaySymbolWithCount(result['2026'])).toBe('○');
    });

    it('実績のみの作業が正しく表示される', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-03-15': {
            planned: false,
            actual: true,
            planCost: 0,
            actualCost: 800000,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(getDisplaySymbolWithCount(result['2025'])).toBe('●');
    });
  });

  describe('月表示での集約表示', () => {
    it('同じ月の複数作業が正しく集約される', () => {
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

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02']).toEqual({
        planned: true,
        actual: true,
        totalPlanCost: 1500000,
        totalActualCost: 950000,
        count: 2,
      });

      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('◎(2)');
    });

    it('異なる月の作業が正しく分離される', () => {
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
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02']).toBeDefined();
      expect(result['2025-11']).toBeDefined();
      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('◎');
      expect(getDisplaySymbolWithCount(result['2025-11'])).toBe('○');
    });
  });

  describe('機器ベースモードでの表示記号', () => {
    it('◎(2)形式で作業数が表示される', () => {
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
            actual: true,
            planCost: 500000,
            actualCost: 480000,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');
      const displayText = getDisplaySymbolWithCount(result['2025-02']);

      expect(displayText).toBe('◎(2)');
    });

    it('作業数が1の場合は数字が省略される', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: true,
            actual: true,
            planCost: 1000000,
            actualCost: 950000,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');
      const displayText = getDisplaySymbolWithCount(result['2025-02']);

      expect(displayText).toBe('◎');
    });

    it('10個以上の作業が正しく表示される', () => {
      const schedules: AssociationSchedule[] = Array.from({ length: 15 }, (_, i) => ({
        [`2025-02-${String(i + 1).padStart(2, '0')}`]: {
          planned: true,
          actual: true,
          planCost: 100000,
          actualCost: 95000,
        },
      }));

      const result = aggregateMultipleSchedules(schedules, 'month');
      const displayText = getDisplaySymbolWithCount(result['2025-02']);

      expect(displayText).toBe('◎(15)');
    });
  });

  describe('コスト集約の正確性', () => {
    it('年表示でコストが正しく合算される', () => {
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
          '2025-11-30': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result['2025'].totalPlanCost).toBe(2000000);
      expect(result['2025'].totalActualCost).toBe(950000);
    });

    it('月表示でコストが正しく合算される', () => {
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

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02'].totalPlanCost).toBe(1500000);
      expect(result['2025-02'].totalActualCost).toBe(950000);
    });

    it('コストが0の場合も正しく処理される', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: true,
            actual: false,
            planCost: 1000000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02'].totalPlanCost).toBe(1000000);
      expect(result['2025-02'].totalActualCost).toBe(0);
    });
  });

  describe('エッジケース', () => {
    it('空のスケジュール配列を処理できる', () => {
      const schedules: AssociationSchedule[] = [];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result).toEqual({});
    });

    it('スケジュールが空のオブジェクトを処理できる', () => {
      const schedules: AssociationSchedule[] = [{}];

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result).toEqual({});
    });

    it('計画も実績もない作業を処理できる', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: false,
            actual: false,
            planCost: 0,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02']).toEqual({
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 1,
      });

      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('');
    });

    it('最大20作業のシナリオを処理できる', () => {
      const schedules: AssociationSchedule[] = Array.from({ length: 20 }, (_, i) => ({
        [`2025-${String(i + 1).padStart(2, '0')}-01`]: {
          planned: true,
          actual: i % 2 === 0,
          planCost: 100000,
          actualCost: i % 2 === 0 ? 95000 : 0,
        },
      }));

      const result = aggregateMultipleSchedules(schedules, 'year');

      expect(result['2025'].count).toBe(20);
      expect(result['2025'].planned).toBe(true);
      expect(result['2025'].actual).toBe(true);
      expect(result['2025'].totalPlanCost).toBe(2000000);
      expect(result['2025'].totalActualCost).toBe(950000);
      expect(getDisplaySymbolWithCount(result['2025'])).toBe('◎(20)');
    });
  });

  describe('OR演算ロジックの検証', () => {
    it('計画と実績が異なる作業でOR演算が正しく動作する', () => {
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
      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('◎(2)');
    });

    it('すべて計画のみの場合、actualはfalseのまま', () => {
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
            planned: true,
            actual: false,
            planCost: 500000,
            actualCost: 0,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02'].planned).toBe(true);
      expect(result['2025-02'].actual).toBe(false);
      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('○(2)');
    });

    it('すべて実績のみの場合、plannedはfalseのまま', () => {
      const schedules: AssociationSchedule[] = [
        {
          '2025-02-01': {
            planned: false,
            actual: true,
            planCost: 0,
            actualCost: 950000,
          },
        },
        {
          '2025-02-15': {
            planned: false,
            actual: true,
            planCost: 0,
            actualCost: 480000,
          },
        },
      ];

      const result = aggregateMultipleSchedules(schedules, 'month');

      expect(result['2025-02'].planned).toBe(false);
      expect(result['2025-02'].actual).toBe(true);
      expect(getDisplaySymbolWithCount(result['2025-02'])).toBe('●(2)');
    });
  });
});
