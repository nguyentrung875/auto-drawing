export const SCENE_CONTEXT = 'scene';

export {
  SceneFactory,
  SceneSystem,
  buildSceneTimeline,
  createScene,
  createSceneSystem,
  validateSceneSequence,
} from './SceneSystem';
export type { SceneRenderInput, SceneRenderOptions } from './SceneSystem';

export {
  CTAScene,
  CountdownScene,
  DigitReveal,
  HookScene,
  PriceReveal,
  ProductScene,
  QuestionScene,
  RevealImplementation,
  RevealScene,
  ResultScene,
} from './scenes';

export {
  SCENE_NAMES,
  SceneError,
  answerOf,
  frame,
  revealTypeOf,
  slotFor,
} from './types';
export type {
  Frame,
  FrameElement,
  IScene,
  RenderedScene,
  RevealImplementation as RevealImplementationType,
  SceneContext,
  SceneData,
  SceneName,
  SceneRenderResult,
} from './types';
