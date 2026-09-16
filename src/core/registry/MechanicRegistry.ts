import type { MechanicId, RawEntity, GameState, DifficultyProfile, GlobalDifficulty } from '../state/types';
import type { IForkableRng } from '../rng/ForkableRng';
import type { QuestionRenderModel, RevealRenderModel } from '../presentation/types';
import type { VisualThemeId } from '../theme/types';
import type { MechanicScriptContext } from '../script/types';

export interface CreateStateInput {
  entities: RawEntity[];
  rng: IForkableRng;
  difficultyTarget?: Partial<GlobalDifficulty>;
  roundIndex?: number;
  totalRounds?: number;
}

export interface IMechanicDefinition<TReveal = unknown> {
  readonly id: MechanicId;
  readonly name: string;
  readonly defaultTotalRounds: number;

  createState(input: CreateStateInput): GameState<TReveal>;
  validateState(state: GameState<TReveal>): void;
  compileQuestion(state: GameState<TReveal>, themeId: VisualThemeId): QuestionRenderModel;
  compileReveal(state: GameState<TReveal>): RevealRenderModel<TReveal>;
  getDifficultyModel(state: GameState<TReveal>): DifficultyProfile;
  getScriptContext(state: GameState<TReveal>): MechanicScriptContext;
}

export class MechanicRegistry {
  private static readonly mechanics = new Map<MechanicId, IMechanicDefinition<any>>();

  static register<T>(mechanic: IMechanicDefinition<T>): void {
    if (this.mechanics.has(mechanic.id)) {
      throw new Error(`Mechanic "${mechanic.id}" already registered`);
    }
    this.mechanics.set(mechanic.id, mechanic);
  }

  static get<T = unknown>(id: MechanicId): IMechanicDefinition<T> {
    const found = this.mechanics.get(id);
    if (!found) throw new Error(`Mechanic "${id}" not found in registry`);
    return found as IMechanicDefinition<T>;
  }

  static list(): string[] {
    return Array.from(this.mechanics.keys());
  }

  static clear(): void {
    this.mechanics.clear();
  }
}
