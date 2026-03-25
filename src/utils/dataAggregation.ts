/**
 * データ集約ユーティリティ
 * 
 * 保守作業の表示用ステータス記号などを生成します。
 */

import type { AggregatedStatus } from '../types/maintenanceTask';

/**
 * 集約されたステータスから表示記号を取得します
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
 * 日付キーを時間スケールに変換します
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
