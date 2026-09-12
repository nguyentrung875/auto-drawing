/**
 * Failure vocabulary shared by job logs, batch reports and the CLI.
 *
 * `filter` answers "which gate rejected this job?" so Hermes can act without
 * reading code: schema / game_logic / price_source / asset / audio / scene /
 * render / timeout / disk / queue.
 */

export type JobFilter =
  | 'schema'
  | 'game_logic'
  | 'price_source'
  | 'asset'
  | 'audio'
  | 'scene'
  | 'render'
  | 'timeout'
  | 'disk'
  | 'llm'
  | 'queue';

/** Map an error code to the filter that produced it. */
export function filterForCode(code: string): JobFilter {
  if (code.includes('TIMEOUT')) return 'timeout';
  if (code.startsWith('E_SCHEMA') || code === 'E_MISSING_REQUIRED_SCENE') return 'schema';
  if (code === 'E_PRICE_SOURCE_INVALID') return 'price_source';
  if (code.startsWith('E_ASSET')) return 'asset';
  if (code.startsWith('E_AUDIO')) return 'audio';
  if (code.startsWith('E_SCENE') || code === 'E_TIMELINE_DRIFT') return 'scene';
  if (code.startsWith('E_LLM')) return 'llm';
  if (code.startsWith('E_RENDER') || code.startsWith('E_ENCODE') || code.startsWith('E_FFMPEG')) {
    return 'render';
  }
  if (code === 'INSUFFICIENT_DISK_SPACE') return 'disk';
  if (code.startsWith('E_GAME_LOGIC') || code.startsWith('E_HILO') || code.startsWith('E_MOST')) {
    return 'game_logic';
  }
  return 'queue';
}
