/**
 * FFmpeg resolution + process supervision.
 *
 * AD-2: external binaries are called through `child_process.spawn` with a typed
 * wrapper. AD-10: every external process gets a timeout → `SIGTERM`, then
 * `SIGKILL` if it is still alive, mapped to `PROCESS_TIMEOUT`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

export interface SpawnResult {
  command: string;
  args: string[];
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  killed: boolean;
  durationMs: number;
}

export interface SpawnOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Grace period between SIGTERM and SIGKILL (ms). */
  killGraceMs?: number;
  onStderr?: (chunk: string) => void;
  onStdout?: (chunk: string) => void;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a process to completion with a hard timeout.
 * Resolves (never rejects) — callers interpret `code`/`timedOut`.
 */
export function runProcess(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  const started = Date.now();
  return new Promise<SpawnResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let killTimer: NodeJS.Timeout | undefined;

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killed = true;
          child.kill('SIGTERM');
          killTimer = setTimeout(() => child.kill('SIGKILL'), options.killGraceMs ?? 2_000);
        }, options.timeoutMs)
      : undefined;

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      resolve({
        command,
        args,
        code,
        signal,
        stdout,
        stderr,
        timedOut,
        killed,
        durationMs: Date.now() - started,
      });
    };

    child.on('error', () => finish(null, null));
    child.on('close', (code, signal) => finish(code, signal));
  });
}

const binaryCache = new Map<string, string | null>();

/**
 * Optional npm packages that ship a static binary per platform. Installing them
 * keeps the renderer dependency-free for the operator (no system ffmpeg), while
 * `FFMPEG_PATH` / PATH still win when a system build is preferred.
 */
const BINARY_PACKAGES: Record<string, string> = {
  ffmpeg: '@ffmpeg-installer/ffmpeg',
  ffprobe: '@ffprobe-installer/ffprobe',
};

function installerPath(name: string): string | null {
  const module = BINARY_PACKAGES[name];
  if (!module) return null;
  try {
    const require = createRequire(import.meta.url);
    const resolved = require(module) as { path?: string };
    return typeof resolved?.path === 'string' ? resolved.path : null;
  } catch {
    return null;
  }
}

/** Resolve an external binary: explicit path → env var → bundled installer → PATH. */
export function resolveBinary(
  name: string,
  explicit?: string,
  envVar = name === 'ffprobe' ? 'FFPROBE_PATH' : 'FFMPEG_PATH',
): string | null {
  const candidates = [explicit, process.env[envVar], installerPath(name), name].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const cacheKey = `${name}:${candidates.join('|')}`;
  const cached = binaryCache.get(cacheKey);
  if (cached !== undefined) return cached;
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
    if (!probe.error && probe.status === 0) {
      binaryCache.set(cacheKey, candidate);
      return candidate;
    }
  }
  binaryCache.set(cacheKey, null);
  return null;
}

export function ffmpegAvailable(explicit?: string): boolean {
  return resolveBinary('ffmpeg', explicit) !== null;
}

/** Directory of the running ffmpeg binary (used to find a sibling ffprobe). */
export function siblingBinary(binary: string, name: string): string | null {
  const directory = path.dirname(binary);
  const candidate = path.join(directory, name);
  const probe = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0 ? candidate : null;
}
