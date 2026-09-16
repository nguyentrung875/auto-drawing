import type { Product } from '../product/schema';
import type { ComputedGame, GameJson, ResultVariant, Timeline } from '../types/game';
import {
  CTAScene,
  CountdownScene,
  HookScene,
  ProductScene,
  QuestionScene,
  RevealScene,
  ResultScene,
} from './scenes';
import {
  SCENE_NAMES,
  SceneError,
  type IScene,
  type SceneData,
  type SceneName,
  type SceneRenderResult,
  type SceneContext,
} from './types';
import {
  CANONICAL_18S_PROFILE,
  getTimingProfileForMechanic,
  type SceneTimingProfile,
} from './timingProfiles';

export const SCENE_DURATIONS: Record<SceneName, number> = {
  hook: 2,
  product: 3,
  question: 3,
  countdown: 3,
  reveal: 2,
  result: 2,
  cta: 3,
};

export interface SceneRenderOptions {
  products?: Product[];
  computed?: ComputedGame;
  timeline?: Timeline;
  sceneData?: SceneData;
  variant?: ResultVariant;
}

export type SceneRenderInput = SceneRenderOptions | Product[];

function normalizeOptions(input: SceneRenderInput): SceneRenderOptions {
  return Array.isArray(input) ? { products: input } : input;
}

export class SceneSystem {
  private readonly components: Map<SceneName, IScene>;

  constructor() {
    this.components = new Map<SceneName, IScene>([
      ['hook', new HookScene()],
      ['product', new ProductScene()],
      ['question', new QuestionScene()],
      ['countdown', new CountdownScene()],
      ['reveal', new RevealScene()],
      ['result', new ResultScene()],
      ['cta', new CTAScene()],
    ]);
  }

  static render(game: GameJson, input: SceneRenderInput = {}): SceneRenderResult {
    return new SceneSystem().render(game, input);
  }

  getScene(name: SceneName): IScene {
    const scene = this.components.get(name);
    if (!scene) {
      throw new SceneError(
        'E_SCHEMA_SCENE_INVALID',
        `scenes.${name}`,
        `scene '${name}' is not one of the 7 MVP scenes`,
      );
    }
    return scene;
  }

  getComponents(): ReadonlyMap<SceneName, IScene> {
    return this.components;
  }

  render(game: GameJson, input: SceneRenderInput = {}): SceneRenderResult {
    const options = normalizeOptions(input);
    validateSceneSequence(game.scenes);
    const timeline = options.timeline ?? buildSceneTimeline(game.scenes as SceneName[], game.metadata?.mechanic);
    validateSceneTimeline(game.scenes as SceneName[], timeline, game.metadata?.mechanic);
    const variant = options.variant ?? game.metadata.result_variant ?? 'in_video';
    const context: SceneContext = {
      game,
      timeline,
      variant,
      products: options.products,
      computed: options.computed,
      sceneData: options.sceneData,
    };

    const revealType =
      options.sceneData?.revealType ??
      (game.metadata.mechanic === 'ONE_AWAY' ? 'DigitReveal' : 'PriceReveal');
    const scenes = game.scenes.map((name) => {
      const sceneName = name as SceneName;
      const component = sceneName === 'reveal'
        ? new RevealScene(revealType)
        : this.getScene(sceneName);
      const timelineSlot = timeline.slots.find((slot) => slot.type === sceneName);
      if (!timelineSlot) {
        throw new SceneError(
          'E_TIMELINE_DRIFT',
          `timeline.${sceneName}`,
          `timeline is missing the '${sceneName}' scene`,
        );
      }
      return {
        name: sceneName,
        component,
        timeline: timelineSlot,
        frames: component.render(context),
      };
    });

    return {
      gameId: game.metadata.gameId,
      variant,
      timeline,
      scenes,
      frames: scenes.flatMap((scene) => scene.frames),
    };
  }

  renderFrames(game: GameJson, input: SceneRenderInput = {}) {
    return this.render(game, input).frames;
  }
}

export function createScene(name: SceneName, revealType?: 'PriceReveal' | 'DigitReveal'): IScene {
  if (name === 'reveal') return new RevealScene(revealType);
  return new SceneSystem().getScene(name);
}

export function createSceneSystem(): SceneSystem {
  return new SceneSystem();
}

export const SceneFactory = {
  create(name: SceneName, revealType?: 'PriceReveal' | 'DigitReveal'): IScene {
    return createScene(name, revealType);
  },
  createReveal(revealType: 'PriceReveal' | 'DigitReveal'): RevealScene {
    return new RevealScene(revealType);
  },
};

export function validateSceneSequence(scenes: string[]): asserts scenes is SceneName[] {
  const allowed = new Set<string>(SCENE_NAMES);
  for (const name of scenes) {
    if (!allowed.has(name)) {
      throw new SceneError(
        'E_SCHEMA_SCENE_INVALID',
        `scenes.${name}`,
        `scene '${name}' is not one of the 7 MVP scenes`,
      );
    }
  }
  for (const required of SCENE_NAMES) {
    if (!scenes.includes(required)) {
      throw new SceneError('E_MISSING_REQUIRED_SCENE', 'scenes', `${required} required`);
    }
  }
  if (scenes.length !== SCENE_NAMES.length || scenes.some((name, index) => name !== SCENE_NAMES[index])) {
    throw new SceneError(
      'E_SCHEMA_SCENE_INVALID',
      'scenes',
      `scene order must be ${SCENE_NAMES.join(' → ')}`,
    );
  }
}

export function validateSceneTimeline(
  scenes: SceneName[],
  timeline: Timeline,
  mechanic?: string,
): void {
  const fail = (hint: string): never => {
    throw new SceneError('E_TIMELINE_DRIFT', 'timeline', hint);
  };
  if (timeline.slots.length !== scenes.length) {
    fail(`timeline has ${timeline.slots.length} slots; expected ${scenes.length}`);
  }

  const profile = getTimingProfileForMechanic(mechanic);

  // Helper to check if timeline matches a specific profile
  const checkProfile = (expectedProfile: SceneTimingProfile): string | null => {
    let cursor = 0;
    for (let index = 0; index < scenes.length; index++) {
      const expectedType = scenes[index]!;
      const expectedDuration = expectedProfile[expectedType];
      const slot = timeline.slots[index];
      if (!slot || slot.type !== expectedType) {
        return `timeline slot ${index} is '${slot?.type}'; expected '${expectedType}'`;
      }
      if (![slot.start, slot.duration, slot.end].every(Number.isFinite) || slot.duration <= 0) {
        return `timeline slot '${slot.type}' must contain finite start/end and a positive duration`;
      }
      if (Math.abs(slot.start - cursor) > 0.001) {
        return `timeline slot '${slot.type}' starts at ${slot.start}s; expected ${cursor}s`;
      }
      if (expectedDuration === undefined || Math.abs(slot.duration - expectedDuration) > 0.1) {
        return `timeline slot '${slot.type}' duration ${slot.duration}s; expected ${expectedDuration}s ±0.1s`;
      }
      const calculatedEnd = Number((slot.start + slot.duration).toFixed(3));
      if (Math.abs(slot.end - calculatedEnd) > 0.001) {
        return `timeline slot '${slot.type}' ends at ${slot.end}s; expected ${calculatedEnd}s`;
      }
      cursor = slot.end;
    }

    if (!Number.isFinite(timeline.totalDuration) || Math.abs(timeline.totalDuration - cursor) > 0.001) {
      return `timeline total ${timeline.totalDuration}s does not match final slot end ${cursor}s`;
    }
    if (Math.abs(timeline.totalDuration - expectedProfile.totalDuration) > 0.05) {
      return `timeline total ${timeline.totalDuration}s; expected ${expectedProfile.totalDuration}s ±0.05s`;
    }
    return null;
  };

  const profileError = checkProfile(profile);
  if (profileError !== null) {
    // If it doesn't match the mechanic profile, check if it matches the legacy canonical 18s profile
    const canonicalError = checkProfile(CANONICAL_18S_PROFILE);
    if (canonicalError !== null) {
      fail(profileError);
    }
  }
}

export function buildSceneTimeline(scenes: SceneName[], mechanic?: string): Timeline {
  const profile = getTimingProfileForMechanic(mechanic);
  let cursor = 0;
  const slots = scenes.map((type) => {
    const duration = profile[type] ?? SCENE_DURATIONS[type] ?? 2.0;
    const start = cursor;
    cursor = Number((cursor + duration).toFixed(3));
    return { type, duration, start, end: cursor };
  });
  return { slots, totalDuration: cursor };
}
