/**
 * Data Model Adapter for StatusSelectionDialog
 * 
 * Provides conversion between old StatusValue format and new AssociationSchedule format
 * to maintain backward compatibility while supporting the new data model.
 */

import { StatusValue } from '../CommonEdit/types';
import { AssociationSchedule } from '../../types/maintenanceTask';

/**
 * Convert AssociationSchedule entry to StatusValue
 * 
 * @param scheduleEntry - Single schedule entry from AssociationSchedule
 * @returns StatusValue compatible with the dialog
 */
export function scheduleToStatusValue(
  scheduleEntry: AssociationSchedule[string] | undefined
): StatusValue {
  if (!scheduleEntry) {
    return {
      planned: false,
      actual: false,
      displaySymbol: '',
      label: '未計画',
    };
  }

  const { planned, actual } = scheduleEntry;

  if (planned && actual) {
    return {
      planned: true,
      actual: true,
      displaySymbol: '◎',
      label: '両方',
    };
  } else if (planned && !actual) {
    return {
      planned: true,
      actual: false,
      displaySymbol: '○',
      label: '計画',
    };
  } else if (!planned && actual) {
    return {
      planned: false,
      actual: true,
      displaySymbol: '●',
      label: '実績',
    };
  } else {
    return {
      planned: false,
      actual: false,
      displaySymbol: '',
      label: '未計画',
    };
  }
}

/**
 * Convert StatusValue to AssociationSchedule entry
 * Preserves cost information from the original entry
 * 
 * @param statusValue - StatusValue from the dialog
 * @param originalEntry - Original schedule entry to preserve cost data
 * @returns Updated schedule entry
 */
export function statusValueToSchedule(
  statusValue: StatusValue,
  originalEntry?: AssociationSchedule[string]
): AssociationSchedule[string] {
  return {
    planned: statusValue.planned,
    actual: statusValue.actual,
    planCost: originalEntry?.planCost ?? 0,
    actualCost: originalEntry?.actualCost ?? 0,
  };
}

/**
 * Update a specific date entry in an AssociationSchedule
 * 
 * @param schedule - Complete association schedule
 * @param dateKey - Date key to update (e.g., "2025-02-01")
 * @param statusValue - New status value
 * @returns Updated schedule
 */
export function updateScheduleStatus(
  schedule: AssociationSchedule,
  dateKey: string,
  statusValue: StatusValue
): AssociationSchedule {
  const originalEntry = schedule[dateKey];
  
  return {
    ...schedule,
    [dateKey]: statusValueToSchedule(statusValue, originalEntry),
  };
}

/**
 * Check if a schedule entry exists for a given date
 * 
 * @param schedule - Association schedule
 * @param dateKey - Date key to check
 * @returns True if entry exists
 */
export function hasScheduleEntry(
  schedule: AssociationSchedule,
  dateKey: string
): boolean {
  return dateKey in schedule;
}

/**
 * Get or create a schedule entry for a given date
 * 
 * @param schedule - Association schedule
 * @param dateKey - Date key
 * @returns Schedule entry (existing or new)
 */
export function getOrCreateScheduleEntry(
  schedule: AssociationSchedule,
  dateKey: string
): AssociationSchedule[string] {
  if (hasScheduleEntry(schedule, dateKey)) {
    return schedule[dateKey];
  }
  
  return {
    planned: false,
    actual: false,
    planCost: 0,
    actualCost: 0,
  };
}
