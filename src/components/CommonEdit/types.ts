/**
 * Common Edit Types
 * Shared types for dialog-based editing components
 */

/**
 * StatusValue - Represents maintenance status (planned/actual)
 */
export interface StatusValue {
  planned: boolean;
  actual: boolean;
  label?: string;
  displaySymbol?: string;
}

/**
 * StatusOption - Status selection option with display information
 */
export interface StatusOption {
  label: string;
  value: StatusValue;
  description?: string;
  icon?: string;
  color?: string;
  symbol?: string;
}

/**
 * CostValue - Represents cost information
 */
export interface CostValue {
  planCost: number;
  actualCost: number;
}

/**
 * SpecificationValue - Represents equipment specification
 */
export interface SpecificationValue {
  key: string;
  value: string;
  order: number;
}
