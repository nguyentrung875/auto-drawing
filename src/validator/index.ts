/**
 * Bounded context: validator — two-layer validation (Schema + Game Logic).
 * Story 2.1.
 */
export const VALIDATOR_CONTEXT = 'validator';
export {
  Validator,
  HILO_MIN_DELTA,
  MOST_EXPENSIVE_MIN_DELTA,
} from './Validator';
export type {
  ValidationIssue,
  ValidationResult,
  ValidateOptions,
} from './Validator';
