import fs from "node:fs";
import path from "node:path";

export interface GameRecord {
  gameId: string;
  mechanic: string;
  seed: number;
  resultVariant: string;
  status: string;
  gameJson?: Record<string, unknown> | null;
  outputPath: string | null;
  captionJson: Record<string, unknown> | null;
  validatorErrors: unknown[] | null;
  renderMs: number | null;
  planningMs: number | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LogRecord {
  id: number;
  gameId: string;
  level: string;
  code: string | null;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface BatchRecord {
  batchId: string;
  total: number;
  passed: number;
  failed: number;
  avgRenderMs: number | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  reportJson?: Record<string, unknown> | null;
}

function getRootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith("studio") ? path.resolve(cwd, "..") : cwd;
}

function getGamesDir(): string {
  const dir = path.join(getRootDir(), "data", "games");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getBatchesDir(): string {
  const dir = path.join(getRootDir(), "data", "batches");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLogsDir(): string {
  const dir = path.join(getRootDir(), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveGame(game: GameRecord, logs?: LogRecord[]): void {
  const gamesDir = getGamesDir();
  const filePath = path.join(gamesDir, `${game.gameId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2), "utf-8");

  if (logs && logs.length > 0) {
    const logsDir = getLogsDir();
    const logFilePath = path.join(logsDir, `${game.gameId}.json`);
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf-8");
  }
}

export function getGame(gameId: string): { game: GameRecord | null; logs: LogRecord[] } {
  const gamesDir = getGamesDir();
  const filePath = path.join(gamesDir, `${gameId}.json`);
  if (!fs.existsSync(filePath)) {
    return { game: null, logs: [] };
  }

  try {
    const game = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GameRecord;
    const logsDir = getLogsDir();
    const logFilePath = path.join(logsDir, `${gameId}.json`);
    let logs: LogRecord[] = [];
    if (fs.existsSync(logFilePath)) {
      logs = JSON.parse(fs.readFileSync(logFilePath, "utf-8")) as LogRecord[];
    }
    return { game, logs };
  } catch {
    return { game: null, logs: [] };
  }
}

export function listGames(limit = 100, offset = 0): GameRecord[] {
  const gamesDir = getGamesDir();
  try {
    const files = fs.readdirSync(gamesDir).filter((f) => f.endsWith(".json"));
    const records: GameRecord[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(gamesDir, file), "utf-8");
        const record = JSON.parse(content) as GameRecord;
        records.push(record);
      } catch {
        // ignore corrupted file
      }
    }
    // Sort descending by createdAt
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return records.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

export function deleteGame(gameId: string): boolean {
  const gamesDir = getGamesDir();
  const filePath = path.join(gamesDir, `${gameId}.json`);
  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  const logsDir = getLogsDir();
  const logFilePath = path.join(logsDir, `${gameId}.json`);
  if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath);
  }
  return deleted;
}

export function saveBatch(batch: BatchRecord): void {
  const batchesDir = getBatchesDir();
  const filePath = path.join(batchesDir, `${batch.batchId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(batch, null, 2), "utf-8");
}

export function listBatches(): BatchRecord[] {
  const batchesDir = getBatchesDir();
  try {
    const files = fs.readdirSync(batchesDir).filter((f) => f.endsWith(".json"));
    const records: BatchRecord[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(batchesDir, file), "utf-8");
        const record = JSON.parse(content) as BatchRecord;
        records.push(record);
      } catch {
        // ignore
      }
    }
    records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return records;
  } catch {
    return [];
  }
}
