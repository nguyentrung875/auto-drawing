/**
 * Bounded context: validator — two-layer validation (Schema + Game Logic).
 * Story 2.1.
 */
export const VALIDATOR_CONTEXT = 'validator';
export {
  ASSETS_DIR_MISSING_WARNING,
  Validator,
  HILO_MIN_DELTA,
  MOST_EXPENSIVE_MIN_DELTA,
  resolveAssetCheck,
} from './Validator';
export type {
  AssetCheck,
  ValidationIssue,
  ValidationResult,
  ValidateOptions,
} from './Validator';
