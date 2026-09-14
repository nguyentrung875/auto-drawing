/**
 * Bounded context: observability — job logs + batch_report (NFR-4).
 */
export const OBSERVABILITY_CONTEXT = 'observability';

export {
  BatchReporter,
  SM1_MIN_PASS_RATE,
  isSm1Satisfied,
  type BatchReportInput,
} from './BatchReporter';
export { JobLogger, type JobLogInput } from './JobLogger';
export {
  InsufficientDiskSpaceError,
  MIN_FREE_DISK_BYTES,
  checkDiskSpace,
  ensureDiskSpace,
  type DiskSpace,
} from './DiskGuard';
export { filterForCode, type JobFilter } from './filters';
export { isJobLog, type BatchJobSummary, type BatchReport, type JobLog, type JobStatus } from './types';
