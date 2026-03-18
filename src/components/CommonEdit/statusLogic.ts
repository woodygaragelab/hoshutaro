/**
 * Status Logic
 * Business logic for status value operations
 */

import { StatusValue, StatusOption } from './types';

/**
 * Available status options for selection
 */
export const STATUS_OPTIONS: StatusOption[] = [
  {
    label: '未実施',
    value: { planned: false, actual: false },
    description: '計画なし・実施なし',
    icon: '－',
    symbol: '－',
    color: '#666666',
  },
  {
    label: '計画のみ',
    value: { planned: true, actual: false },
    description: '計画あり・実施なし',
    icon: '○',
    symbol: '○',
    color: '#2196F3',
  },
  {
    label: '実施済み',
    value: { planned: false, actual: true },
    description: '計画なし・実施あり',
    icon: '●',
    symbol: '●',
    color: '#4CAF50',
  },
  {
    label: '計画・実施',
    value: { planned: true, actual: true },
    description: '計画あり・実施あり',
    icon: '◎',
    symbol: '◎',
    color: '#FF9800',
  },
];

/**
 * Create a new StatusValue with label and display symbol
 */
export function createStatusValue(planned: boolean, actual: boolean): StatusValue {
  // Find matching status option
  const option = STATUS_OPTIONS.find(
    opt => opt.value.planned === planned && opt.value.actual === actual
  );

  return {
    planned,
    actual,
    label: option?.label,
    displaySymbol: option?.symbol,
  };
}

/**
 * Check if status change requires confirmation
 */
export function requiresConfirmation(
  from: StatusValue,
  to: StatusValue
): boolean {
  // Require confirmation when removing actual status
  if (from.actual && !to.actual) {
    return true;
  }
  return false;
}

/**
 * Get confirmation message for status change
 */
export function getConfirmationMessage(
  from: StatusValue,
  to: StatusValue
): string {
  if (from.actual && !to.actual) {
    return '実施済みの状態を変更しようとしています。よろしいですか？';
  }
  return '状態を変更しますか？';
}

/**
 * Validate status value
 */
export function validateStatusValue(status: StatusValue): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof status.planned !== 'boolean') {
    errors.push('planned must be a boolean');
  }
  if (typeof status.actual !== 'boolean') {
    errors.push('actual must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract planned and actual values from StatusValue
 */
export function extractPlannedActual(status: StatusValue): {
  planned: boolean;
  actual: boolean;
} {
  return {
    planned: status.planned,
    actual: status.actual,
  };
}

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(
  from: StatusValue,
  to: StatusValue
): boolean {
  // All transitions are valid in this system
  // This function exists for future business rule enforcement
  return true;
}
