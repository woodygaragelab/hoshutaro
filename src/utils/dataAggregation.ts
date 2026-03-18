/**
 * データ集約ユーティリティ
 * 
 * 保守作業のスケジュールデータを時間スケール（年/月/日）に応じて集約し、
 * 表示用のステータス記号を生成します。
 */

import type { AssociationSchedule, AggregatedStatus } from '../types/maintenanceTask';
import { memoizeDeep, memoizeShallow } from './memoization';
import { getTimeKey, parseTimeKey } from './dateUtils';

/**
 * 時間スケールに応じてスケジュールデータを集約します
 * 
 * @param schedule - 関連付けスケジュール（日付キーとステータス情報のマップ）
 * @param timeScale - 集約する時間スケール（'day' | 'week' | 'month' | 'year'）
 * @returns 集約されたステータス情報のマップ
 */
function aggregateScheduleByTimeScaleInternal(
  schedule: AssociationSchedule,
  timeScale: 'day' | 'week' | 'month' | 'year'
): { [timeKey: string]: AggregatedStatus } {
  const aggregated: { [timeKey: string]: AggregatedStatus } = {};

  Object.entries(schedule).forEach(([dateKey, status]) => {
    // 日付キーを時間スケールに変換
    // Use robust parsing from dateUtils
    let date = parseTimeKey(dateKey, timeScale);

    // Fallback simple parsing for ISO strings
    if (!date) {
      date = new Date(dateKey);
    }

    if (isNaN(date.getTime())) {
      // Try loose parsing for "YYYY-W1" legacy format if dealing with week but parseTimeKey failed?
      // parseTimeKey already handles YYYY-W1 now.
      // If still invalid, skip.
      return;
    }

    const aggregateKey = getTimeKey(date, timeScale);

    // 集約データの初期化または更新
    if (!aggregated[aggregateKey]) {
      aggregated[aggregateKey] = {
        planned: false,
        actual: false,
        totalPlanCost: 0,
        totalActualCost: 0,
        count: 0
      };
    }

    // 集約ルール: OR演算（1つでもtrueならtrue）
    aggregated[aggregateKey].planned = aggregated[aggregateKey].planned || status.planned;
    aggregated[aggregateKey].actual = aggregated[aggregateKey].actual || status.actual;

    // コストの合算
    aggregated[aggregateKey].totalPlanCost += status.planCost;
    aggregated[aggregateKey].totalActualCost += status.actualCost;

    // 実行回数のカウント
    aggregated[aggregateKey].count += 1;
  });

  return aggregated;
}

// Memoized version for performance
export const aggregateScheduleByTimeScale = memoizeDeep(
  aggregateScheduleByTimeScaleInternal,
  100 // Cache up to 100 different schedule/timeScale combinations
);

/**
 * 集約されたステータスから表示記号を取得します
 * 
 * @param status - 集約されたステータス情報
 * @returns 表示記号（◎、○、●、または空文字列）
 * 
 * 記号の意味:
 * - ◎: 計画あり・実績あり
 * - ○: 計画あり・実績なし
 * - ●: 計画なし・実績あり
 * - '': 計画なし・実績なし
 * 
 * @example
 * getDisplaySymbol({ planned: true, actual: true, totalPlanCost: 1000000, totalActualCost: 950000, count: 1 })
 * // => '◎'
 * 
 * getDisplaySymbol({ planned: true, actual: false, totalPlanCost: 1000000, totalActualCost: 0, count: 1 })
 * // => '○'
 * 
 * getDisplaySymbol({ planned: false, actual: true, totalPlanCost: 0, totalActualCost: 950000, count: 1 })
 * // => '●'
 */
export function getDisplaySymbol(status: AggregatedStatus): string {
  if (status.planned && status.actual) {
    return '◎';  // 計画あり・実績あり
  } else if (status.planned && !status.actual) {
    return '○';  // 計画あり・実績なし
  } else if (!status.planned && status.actual) {
    return '●';  // 計画なし・実績あり
  } else {
    return '';   // 計画なし・実績なし
  }
}

/**
 * 集約されたステータスから表示記号と作業数を含む文字列を取得します
 * 
 * @param status - 集約されたステータス情報
 * @returns 表示文字列（例: "◎(2)", "○(1)", "●", ""）
 * 
 * @example
 * getDisplaySymbolWithCount({ planned: true, actual: true, totalPlanCost: 2000000, totalActualCost: 1900000, count: 2 })
 * // => '◎(2)'
 * 
 * getDisplaySymbolWithCount({ planned: true, actual: false, totalPlanCost: 1000000, totalActualCost: 0, count: 1 })
 * // => '○(1)'
 */
export function getDisplaySymbolWithCount(status: AggregatedStatus): string {
  const symbol = getDisplaySymbol(status);
  if (!symbol) {
    return '';
  }

  // 作業数が1の場合は数字を省略
  if (status.count === 1) {
    return symbol;
  }

  return `${symbol}(${status.count})`;
}

/**
 * 複数の関連付けスケジュールを集約します (internal implementation)
 */
function aggregateMultipleSchedulesInternal(
  schedules: AssociationSchedule[],
  timeScale: 'day' | 'month' | 'year'
): { [timeKey: string]: AggregatedStatus } {
  const combined: { [timeKey: string]: AggregatedStatus } = {};

  schedules.forEach(schedule => {
    const aggregated = aggregateScheduleByTimeScale(schedule, timeScale);

    Object.entries(aggregated).forEach(([timeKey, status]) => {
      if (!combined[timeKey]) {
        combined[timeKey] = {
          planned: false,
          actual: false,
          totalPlanCost: 0,
          totalActualCost: 0,
          count: 0
        };
      }

      // OR演算で計画/実績フラグを統合
      combined[timeKey].planned = combined[timeKey].planned || status.planned;
      combined[timeKey].actual = combined[timeKey].actual || status.actual;

      // コストを合算
      combined[timeKey].totalPlanCost += status.totalPlanCost;
      combined[timeKey].totalActualCost += status.totalActualCost;

      // 作業数を合算
      combined[timeKey].count += status.count;
    });
  });

  return combined;
}

/**
 * 複数の関連付けスケジュールを集約します (memoized)
 * 
 * 機器ベースモードで、1つの機器に複数の作業が関連付けられている場合に使用します。
 * 
 * @param schedules - 関連付けスケジュールの配列
 * @param timeScale - 集約する時間スケール
 * @returns 集約されたステータス情報のマップ
 * 
 * @example
 * const schedules = [
 *   { "2025-02-01": { planned: true, actual: true, planCost: 1000000, actualCost: 950000 } },
 *   { "2025-02-15": { planned: true, actual: false, planCost: 500000, actualCost: 0 } }
 * ];
 * 
 * const aggregated = aggregateMultipleSchedules(schedules, 'month');
 * // => { "2025-02": { planned: true, actual: true, totalPlanCost: 1500000, totalActualCost: 950000, count: 2 } }
 */
export const aggregateMultipleSchedules = memoizeDeep(
  aggregateMultipleSchedulesInternal,
  50 // Cache up to 50 different schedule array/timeScale combinations
);

/**
 * 日付キーを時間スケールに変換します
 * 
 * @param dateKey - 日付キー（例: "2025-02-01", "2025-02", "2025"）
 * @param timeScale - 変換先の時間スケール
 * @returns 変換された日付キー
 * 
 * @example
 * convertDateKeyToTimeScale("2025-02-01", 'year')  // => "2025"
 * convertDateKeyToTimeScale("2025-02-01", 'month') // => "2025-02"
 * convertDateKeyToTimeScale("2025-02-01", 'day')   // => "2025-02-01"
 */
export function convertDateKeyToTimeScale(
  dateKey: string,
  timeScale: 'day' | 'month' | 'year'
): string {
  if (timeScale === 'year') {
    return dateKey.slice(0, 4);
  } else if (timeScale === 'month') {
    return dateKey.slice(0, 7);
  } else {
    return dateKey;
  }
}

/**
 * 時間スケールに応じた日付キーのフォーマットを取得します
 * 
 * @param timeScale - 時間スケール
 * @returns 日付キーのフォーマット（例: "YYYY", "YYYY-MM", "YYYY-MM-DD"）
 */
export function getDateKeyFormat(timeScale: 'day' | 'month' | 'year'): string {
  switch (timeScale) {
    case 'year':
      return 'YYYY';
    case 'month':
      return 'YYYY-MM';
    case 'day':
      return 'YYYY-MM-DD';
  }
}
