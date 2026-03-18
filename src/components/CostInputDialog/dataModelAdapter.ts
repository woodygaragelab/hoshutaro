/**
 * Data Model Adapter for CostInputDialog
 * 
 * Provides conversion between old CostValue format and new AssociationSchedule format
 * to maintain backward compatibility while supporting the new data model.
 */

import { CostValue } from '../CommonEdit/types';
import { AssociationSchedule } from '../../types/maintenanceTask';

/**
 * Convert AssociationSchedule entry to CostValue
 * 
 * @param scheduleEntry - Single schedule entry from AssociationSchedule
 * @returns CostValue compatible with the dialog
 */
export function scheduleToCostValue(
  scheduleEntry: AssociationSchedule[string] | undefined
): CostValue {
  if (!scheduleEntry) {
    return {
      planCost: 0,
      actualCost: 0,
    };
  }

  return {
    planCost: scheduleEntry.planCost,
    actualCost: scheduleEntry.actualCost,
  };
}

/**
 * Convert CostValue to AssociationSchedule entry
 * Preserves status information from the original entry
 * 
 * @param costValue - CostValue from the dialog
 * @param originalEntry - Original schedule entry to preserve status data
 * @returns Updated schedule entry
 */
export function costValueToSchedule(
  costValue: CostValue,
  originalEntry?: AssociationSchedule[string]
): AssociationSchedule[string] {
  return {
    planned: originalEntry?.planned ?? false,
    actual: originalEntry?.actual ?? false,
    planCost: costValue.planCost,
    actualCost: costValue.actualCost,
  };
}

/**
 * Update a specific date entry in an AssociationSchedule with cost data
 * 
 * @param schedule - Complete association schedule
 * @param dateKey - Date key to update (e.g., "2025-02-01")
 * @param costValue - New cost value
 * @returns Updated schedule
 */
export function updateScheduleCost(
  schedule: AssociationSchedule,
  dateKey: string,
  costValue: CostValue
): AssociationSchedule {
  const originalEntry = schedule[dateKey];
  
  return {
    ...schedule,
    [dateKey]: costValueToSchedule(costValue, originalEntry),
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

/**
 * Validate cost values are within acceptable ranges
 * 
 * @param costValue - Cost value to validate
 * @returns Validation result with any errors
 */
export function validateCostValue(costValue: CostValue): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (costValue.planCost < 0) {
    errors.push('計画コストは0以上である必要があります');
  }

  if (costValue.actualCost < 0) {
    errors.push('実績コストは0以上である必要があります');
  }

  if (costValue.planCost > 999999999999) {
    errors.push('計画コストが大きすぎます');
  }

  if (costValue.actualCost > 999999999999) {
    errors.push('実績コストが大きすぎます');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
