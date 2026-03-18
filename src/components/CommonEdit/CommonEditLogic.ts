/**
 * Common Edit Logic
 * Shared business logic for edit operations
 */

import { StatusValue, CostValue, SpecificationValue } from './types';

/**
 * CommonEditLogic class
 * Provides common validation and transformation logic for edit operations
 */
export class CommonEditLogic {
  /**
   * Validate status value
   */
  static validateStatus(status: StatusValue): { valid: boolean; errors: string[] } {
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
   * Validate cost value
   */
  static validateCost(cost: CostValue): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof cost.planCost !== 'number' || cost.planCost < 0) {
      errors.push('planCost must be a non-negative number');
    }
    if (typeof cost.actualCost !== 'number' || cost.actualCost < 0) {
      errors.push('actualCost must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate specification value
   */
  static validateSpecification(spec: SpecificationValue): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!spec.key || typeof spec.key !== 'string') {
      errors.push('key must be a non-empty string');
    }
    if (typeof spec.value !== 'string') {
      errors.push('value must be a string');
    }
    if (typeof spec.order !== 'number' || spec.order < 0) {
      errors.push('order must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create default status value
   */
  static createDefaultStatus(): StatusValue {
    return { planned: false, actual: false };
  }

  /**
   * Create default cost value
   */
  static createDefaultCost(): CostValue {
    return { planCost: 0, actualCost: 0 };
  }

  /**
   * Create default specification value
   */
  static createDefaultSpecification(key: string = '', order: number = 0): SpecificationValue {
    return { key, value: '', order };
  }
}
