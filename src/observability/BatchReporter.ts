/**
 * `export/batch-<ts>/batch_report.json` (Story 4.3).
 *
 * The report is what Trung opens in the morning: totals, pass rate against
 * SM-1 (≥98%), average render time, and a `jobs[]` row per job so a failure is
 * traceable without reading any log.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BatchJobSummary, BatchReport } from './types';

export interface BatchReportInput {
  batchId: string;
  outputDir: string;
  jobs: BatchJobSummary[];
  workerPoolMax: number;
  /** Epoch ms when the batch started. */
  startedAt: number;
  totalMs?: number;
  warnings?: string[];
}

export const SM1_MIN_PASS_RATE = 0.98;

export class BatchReporter {
  static build(input: BatchReportInput): BatchReport {
    const passed = input.jobs.filter((job) => job.status === 'done').length;
    const failedJobs = input.jobs.filter((job) => job.status !== 'done');
    const renderTimes = input.jobs
      .map((job) => job.renderMs)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const total = input.jobs.length;
    const durationMs = input.totalMs ?? Number((Date.now() - input.startedAt).toFixed(2));
    return {
      batch_id: input.batchId,
      output_dir: input.outputDir,
      started_at: new Date(input.startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Number(durationMs.toFixed(2)),
      total,
      passed,
      failed: total - passed,
      pass_rate: total === 0 ? 0 : Number((passed / total).toFixed(4)),
      avg_render_ms:
        renderTimes.length === 0
          ? 0
          : Number(
              (renderTimes.reduce((sum, value) => sum + value, 0) / renderTimes.length).toFixed(2),
            ),
      worker_pool_max: input.workerPoolMax,
      manual_interventions: 0,
      jobs: input.jobs,
      failed_jobs: failedJobs,
      warnings: input.warnings ?? [],
    };
  }

  /** Write the report atomically into `export/batch-<ts>/`. */
  static write(report: BatchReport, exportDir = 'export'): string {
    const directory = path.resolve(exportDir, `batch-${report.batch_id}`);
    mkdirSync(directory, { recursive: true });
    const target = path.join(directory, 'batch_report.json');
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
    renameSync(temporary, target);
    return target;
  }

  static read(filePath: string): BatchReport | null {
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as BatchReport;
    } catch {
      return null;
    }
  }

  /** The one-line summary the CLI prints at the end of a batch. */
  static formatSummary(report: BatchReport): string {
    const rate = (report.pass_rate * 100).toFixed(0);
    // Report render time *and* true per-job wall-clock. `avg_render_ms` excludes
    // encoding (~9.5s of a ~17s job), so quoting it alone understates capacity
    // by more than half — it was read as the cost per video and it is not.
    const avgJobSeconds =
      report.total > 0 ? report.duration_ms / report.total / 1000 : 0;
    const lines = [
      `batch ${report.batch_id}: passed ${report.passed}/${report.total} (${rate}%) — ` +
        `avg_render_ms ${Math.round(report.avg_render_ms)} — ` +
        `avg_job ${avgJobSeconds.toFixed(1)}s wall-clock — ` +
        `${(report.duration_ms / 1000).toFixed(1)}s total`,
    ];
    if (report.failed_jobs.length > 0) {
      for (const job of report.failed_jobs) {
        lines.push(
          `  FAILED ${job.gameId} [${job.code ?? 'E_UNKNOWN'}${job.filter ? ` / ${job.filter}` : ''}]`,
        );
      }
    }
    if (report.pass_rate < SM1_MIN_PASS_RATE) {
      lines.push(
        `  WARNING pass rate ${rate}% is below the SM-1 target of ${(SM1_MIN_PASS_RATE * 100).toFixed(0)}%`,
      );
    }
    return lines.join('\n');
  }
}

export function isSm1Satisfied(report: BatchReport, minimum = SM1_MIN_PASS_RATE): boolean {
  return report.pass_rate >= minimum;
}
