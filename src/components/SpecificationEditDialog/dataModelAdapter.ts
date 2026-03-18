/**
 * Data Model Adapter for SpecificationEditDialog
 * 
 * Provides conversion between old SpecificationValue format and new Asset.specifications format
 * to maintain backward compatibility while supporting the new data model.
 */

import { SpecificationValue } from '../CommonEdit/types';
import { Specification, Asset } from '../../types/maintenanceTask';

/**
 * Convert new Specification format to old SpecificationValue format
 * 
 * @param specification - Specification from new data model
 * @returns SpecificationValue compatible with the dialog
 */
export function specificationToValue(specification: Specification): SpecificationValue {
  return {
    key: specification.key,
    value: specification.value,
    order: specification.order,
  };
}

/**
 * Convert old SpecificationValue format to new Specification format
 * 
 * @param value - SpecificationValue from the dialog
 * @returns Specification for new data model
 */
export function valueToSpecification(value: SpecificationValue): Specification {
  return {
    key: value.key,
    value: value.value,
    order: value.order,
  };
}

/**
 * Convert array of Specifications to SpecificationValues
 * 
 * @param specifications - Array of specifications from new data model
 * @returns Array of SpecificationValues compatible with the dialog
 */
export function specificationsToValues(specifications: Specification[]): SpecificationValue[] {
  return specifications.map(specificationToValue);
}

/**
 * Convert array of SpecificationValues to Specifications
 * 
 * @param values - Array of SpecificationValues from the dialog
 * @returns Array of Specifications for new data model
 */
export function valuesToSpecifications(values: SpecificationValue[]): Specification[] {
  return values.map(valueToSpecification);
}

/**
 * Update an asset's specifications
 * 
 * @param asset - Asset to update
 * @param specifications - New specifications
 * @returns Updated asset
 */
export function updateAssetSpecifications(
  asset: Asset,
  specifications: SpecificationValue[]
): Asset {
  return {
    ...asset,
    specifications: valuesToSpecifications(specifications),
    updatedAt: new Date(),
  };
}

/**
 * Validate specifications array
 * 
 * @param specifications - Specifications to validate
 * @returns Validation result with any errors
 */
export function validateSpecifications(specifications: SpecificationValue[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for empty keys
  specifications.forEach((spec, index) => {
    if (!spec.key.trim()) {
      errors.push(`${index + 1}行目: 項目名は必須です`);
    }
    if (!spec.value.trim()) {
      errors.push(`${index + 1}行目: 値は必須です`);
    }
  });

  // Check for duplicate keys
  const keys = specifications.map(s => s.key.trim().toLowerCase());
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    errors.push(`重複する項目名があります: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Check order values
  const orders = specifications.map(s => s.order);
  if (orders.some(order => order < 1)) {
    errors.push('順序は1以上である必要があります');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sort specifications by order
 * 
 * @param specifications - Specifications to sort
 * @returns Sorted specifications
 */
export function sortSpecificationsByOrder(
  specifications: SpecificationValue[]
): SpecificationValue[] {
  return [...specifications].sort((a, b) => a.order - b.order);
}

/**
 * Reorder specifications after changes
 * Ensures order values are sequential starting from 1
 * 
 * @param specifications - Specifications to reorder
 * @returns Reordered specifications
 */
export function reorderSpecifications(
  specifications: SpecificationValue[]
): SpecificationValue[] {
  return specifications.map((spec, index) => ({
    ...spec,
    order: index + 1,
  }));
}
