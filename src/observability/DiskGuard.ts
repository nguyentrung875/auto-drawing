/**
 * Pre-flight disk check (AD-10 / Story 4.3).
 *
 * A 50-video batch writes a PNG sequence plus MP4s; running out of disk mid-way
 * would produce the one thing fail-forward cannot repair (half-written files).
 * The batch therefore aborts with `INSUFFICIENT_DISK_SPACE` *before* the first
 * render when free space is below the floor.
 */
import { mkdirSync, statfsSync } from 'node:fs';

export const MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export interface DiskSpace {
  path: string;
  freeBytes: number;
  totalBytes: number;
  requiredBytes: number;
  ok: boolean;
}

export class InsufficientDiskSpaceError extends Error {
  readonly code = 'INSUFFICIENT_DISK_SPACE';
  readonly field = 'disk';
  readonly hint: string;
  readonly freeBytes: number;
  readonly requiredBytes: number;

  constructor(space: DiskSpace) {
    const freeGb = (space.freeBytes / 1024 ** 3).toFixed(2);
    const requiredGb = (space.requiredBytes / 1024 ** 3).toFixed(2);
    super(
      `INSUFFICIENT_DISK_SPACE — ${space.path} has ${freeGb}GB free, ${requiredGb}GB required`,
    );
    this.name = 'InsufficientDiskSpaceError';
    this.freeBytes = space.freeBytes;
    this.requiredBytes = space.requiredBytes;
    this.hint = `free at least ${requiredGb}GB on the volume holding ${space.path} before running the batch`;
  }

  toJSON(): { code: string; field: string; hint: string } {
    return { code: this.code, field: this.field, hint: this.hint };
  }
}

/** Read free space on the volume that holds `targetPath` (creating it if needed). */
export function checkDiskSpace(
  targetPath: string,
  requiredBytes = MIN_FREE_DISK_BYTES,
): DiskSpace {
  mkdirSync(targetPath, { recursive: true });
  try {
    const stats = statfsSync(targetPath, { bigint: false });
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    return {
      path: targetPath,
      freeBytes,
      totalBytes,
      requiredBytes,
      ok: freeBytes >= requiredBytes,
    };
  } catch {
    // `statfs` is unavailable on some platforms/filesystems: report unknown as
    // "ok" so an exotic filesystem never blocks a legitimate batch.
    return { path: targetPath, freeBytes: Number.POSITIVE_INFINITY, totalBytes: 0, requiredBytes, ok: true };
  }
}

/** Throws `InsufficientDiskSpaceError` unless there is room; returns the probe. */
export function ensureDiskSpace(
  targetPath: string,
  requiredBytes = MIN_FREE_DISK_BYTES,
): DiskSpace {
  const space = checkDiskSpace(targetPath, requiredBytes);
  if (!space.ok) throw new InsufficientDiskSpaceError(space);
  return space;
}
