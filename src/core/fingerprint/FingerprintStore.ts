import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FingerprintBundle } from './types';

export class FileFingerprintStore {
  private exactSet = new Set<string>();
  private semanticSet = new Set<string>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  record(bundle: FingerprintBundle): void {
    this.exactSet.add(bundle.exact);
    this.semanticSet.add(bundle.semantic);
    this.save();
  }

  hasExact(exactHash: string): boolean {
    return this.exactSet.has(exactHash);
  }

  hasSemantic(semanticHash: string): boolean {
    return this.semanticSet.has(semanticHash);
  }

  private load(): void {
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw) as { exacts: string[]; semantics: string[] };
        this.exactSet = new Set(data.exacts || []);
        this.semanticSet = new Set(data.semantics || []);
      } catch {
        this.exactSet = new Set();
        this.semanticSet = new Set();
      }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(
      {
        exacts: Array.from(this.exactSet),
        semantics: Array.from(this.semanticSet),
      },
      null,
      2,
    );
    writeFileSync(this.filePath, payload, 'utf-8');
  }
}
