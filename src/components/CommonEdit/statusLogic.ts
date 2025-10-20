import { StatusValue, StatusOption } from './types';

/**
 * 星取表の状態オプション定義
 */
export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: {
      planned: false,
      actual: false,
      displaySymbol: '',
      label: '未計画',
    },
    symbol: '',
    label: '未計画',
    description: '計画も実績もない状態',
    color: '#9e9e9e', // グレー
  },
  {
    value: {
      planned: true,
      actual: false,
      displaySymbol: '○',
      label: '計画',
    },
    symbol: '○',
    label: '計画',
    description: '計画済みだが未実施',
    color: '#2196f3', // ブルー
  },
  {
    value: {
      planned: false,
      actual: true,
      displaySymbol: '●',
      label: '実績',
    },
    symbol: '●',
    label: '実績',
    description: '実施済み（計画なし）',
    color: '#4caf50', // グリーン
  },
  {
    value: {
      planned: true,
      actual: true,
      displaySymbol: '◎',
      label: '両方',
    },
    symbol: '◎',
    label: '両方',
    description: '計画済みかつ実施済み',
    color: '#ff9800', // オレンジ
  },
];

/**
 * planned/actualの値からStatusValueを生成
 */
export const createStatusValue = (planned: boolean, actual: boolean): StatusValue => {
  const option = STATUS_OPTIONS.find(
    opt => opt.value.planned === planned && opt.value.actual === actual
  );
  
  return option ? option.value : STATUS_OPTIONS[0].value; // デフォルトは未計画
};

/**
 * StatusValueからplanned/actualの値を取得
 */
export const extractPlannedActual = (status: StatusValue): { planned: boolean; actual: boolean } => {
  return {
    planned: status.planned,
    actual: status.actual,
  };
};

/**
 * 状態記号から StatusValue を取得
 */
export const getStatusFromSymbol = (symbol: '○' | '●' | '◎' | ''): StatusValue => {
  const option = STATUS_OPTIONS.find(opt => opt.symbol === symbol);
  return option ? option.value : STATUS_OPTIONS[0].value;
};

/**
 * StatusValue から状態記号を取得
 */
export const getSymbolFromStatus = (status: StatusValue): '○' | '●' | '◎' | '' => {
  return status.displaySymbol;
};

/**
 * StatusValue から色を取得
 */
export const getColorFromStatus = (status: StatusValue): string => {
  const option = STATUS_OPTIONS.find(
    opt => opt.value.planned === status.planned && opt.value.actual === status.actual
  );
  return option ? option.color : STATUS_OPTIONS[0].color;
};

/**
 * 状態の説明文を取得
 */
export const getStatusDescription = (status: StatusValue): string => {
  const option = STATUS_OPTIONS.find(
    opt => opt.value.planned === status.planned && opt.value.actual === status.actual
  );
  return option ? option.description : STATUS_OPTIONS[0].description;
};

/**
 * 次の状態に循環的に変更（クリック時の動作用）
 */
export const getNextStatus = (currentStatus: StatusValue): StatusValue => {
  const currentIndex = STATUS_OPTIONS.findIndex(
    opt => opt.value.planned === currentStatus.planned && opt.value.actual === currentStatus.actual
  );
  
  const nextIndex = (currentIndex + 1) % STATUS_OPTIONS.length;
  return STATUS_OPTIONS[nextIndex].value;
};

/**
 * 状態遷移が有効かどうかをチェック
 */
export const isValidStatusTransition = (
  from: StatusValue,
  to: StatusValue
): boolean => {
  // 基本的にすべての遷移を許可
  // 必要に応じてビジネスルールを追加
  return true;
};

/**
 * 状態変更に確認が必要かどうかをチェック
 */
export const requiresConfirmation = (
  from: StatusValue,
  to: StatusValue
): boolean => {
  // 実績ありから実績なしへの変更は確認が必要
  if (from.actual && !to.actual) {
    return true;
  }
  
  // 計画ありから計画なしへの変更は確認が必要
  if (from.planned && !to.planned) {
    return true;
  }
  
  return false;
};

/**
 * 状態変更の確認メッセージを生成
 */
export const getConfirmationMessage = (
  from: StatusValue,
  to: StatusValue
): string => {
  if (from.actual && !to.actual) {
    return '実績データを削除しますか？この操作は元に戻せません。';
  }
  
  if (from.planned && !to.planned) {
    return '計画データを削除しますか？';
  }
  
  return `状態を「${from.label}」から「${to.label}」に変更しますか？`;
};

/**
 * 複数の状態値から統計情報を計算
 */
export interface StatusStatistics {
  total: number;
  planned: number;
  actual: number;
  both: number;
  none: number;
  plannedRate: number;
  actualRate: number;
  completionRate: number;
}

export const calculateStatusStatistics = (statuses: StatusValue[]): StatusStatistics => {
  const total = statuses.length;
  const planned = statuses.filter(s => s.planned && !s.actual).length;
  const actual = statuses.filter(s => !s.planned && s.actual).length;
  const both = statuses.filter(s => s.planned && s.actual).length;
  const none = statuses.filter(s => !s.planned && !s.actual).length;
  
  const totalPlanned = planned + both;
  const totalActual = actual + both;
  
  return {
    total,
    planned,
    actual,
    both,
    none,
    plannedRate: total > 0 ? (totalPlanned / total) * 100 : 0,
    actualRate: total > 0 ? (totalActual / total) * 100 : 0,
    completionRate: total > 0 ? (both / total) * 100 : 0,
  };
};