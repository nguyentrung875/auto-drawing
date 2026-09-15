export const AUDIO_CONTEXT = 'audio';

export {
  AudioEngine,
  AudioError,
  PIPER_DEFAULT_VOICE,
  VOICE_FORMANT_WARNING,
  VOICE_STUB_WARNING,
  VOICE_TRUNCATED_WARNING,
  ViPiperEngine,
  synthesizeAudio,
} from './AudioEngine';
export { FormantViEngine } from './FormantViEngine';
export type { FormantViOptions } from './FormantViEngine';
export {
  EdgeTtsEngine,
  EDGE_DEFAULT_VOICE,
  EDGE_TTS_FALLBACK_WARNING,
} from './EdgeTtsEngine';
export type { EdgeTtsOptions } from './EdgeTtsEngine';
export type {
  AudioSegment,
  AudioWarning,
  IAudioEngine,
  MusicTrack,
  SfxCue,
  ViPiperOptions,
  VoiceOptions,
  VoiceResult,
} from './AudioEngine';

export { VOICE_RULEBOOK } from './voiceRulebook';
export type { MechanicVoiceRule } from './voiceRulebook';
export { VoiceHistoryStore } from './voiceHistoryStore';
export type { VoiceHistoryRecord, VoiceHistoryStoreOptions } from './voiceHistoryStore';
export { selectVoiceScript, calculateScriptQualityScore } from './voiceSelector';
export type { SelectVoiceOptions } from './voiceSelector';
export type {
  VoiceMode,
  VoiceIntent,
  VisualDependency,
  VoiceCandidate,
  VoiceMetadata,
  VoiceTimingConfig,
  ScriptQualityScore,
  AudioRuntimeScore,
} from './types';
