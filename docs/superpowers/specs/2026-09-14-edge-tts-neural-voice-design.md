# Technical Design Specification: Microsoft Edge Neural TTS Integration (`vi-VN-HoaiMyNeural`)

- **Author**: Antigravity & Trung
- **Date**: 2026-09-14
- **Status**: Approved
- **Target Components**: `src/audio/EdgeTtsEngine.ts`, `src/audio/AudioEngine.ts`, `package.json`

---

## 1. Problem Statement & Motivation

1. **Current Audio Defect:**
   - In [`src/audio/AudioEngine.ts`](file:///d:/source_code/auto-drawing/src/audio/AudioEngine.ts), the default TTS adapter is [`ViPiperEngine`](file:///d:/source_code/auto-drawing/src/audio/ViPiperEngine.ts).
   - Because neither the `piper` binary nor the Vietnamese ONNX model (`assets/voices/vi_VN.onnx`) is installed on the local Windows environment, the engine silently and deterministically falls back to [`FormantViEngine.ts`](file:///d:/source_code/auto-drawing/src/audio/FormantViEngine.ts).
   - `FormantViEngine` calculates glottal pulses and formant frequencies (F1-F3) mathematically in pure TypeScript, producing a robotic, buzzing, metallic audio output that degrades the perceived quality of rendered TikTok/Reels videos.

2. **Objective:**
   - Integrate **Microsoft Edge Neural Voice** (`vi-VN-HoaiMyNeural`) as the primary high-fidelity TTS voice for both the Core Engine CLI and Web Studio on-demand rendering.
   - Deliver human-like, expressive Vietnamese voiceovers with zero local AI model installations.
   - Maintain robust offline/error resilience by falling back to `FormantViEngine` if network fails.

---

## 2. Architectural Design

```
   [ Input Script: "Thử thách 5 giây, đắt hơn hay rẻ hơn?" ]
                               │
                               ▼
                 [ EdgeTtsEngine.synthesizeVoice() ]
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        [ Local Cache Hit ]           [ Local Cache Miss ]
      (SHA-256 Script Hash)                   │
    (File .wav exists & >44B)                 ▼
                │                  [ Call MsEdgeTTS WebSocket ]
                │                  - Voice: vi-VN-HoaiMyNeural
                │                  - Format: RIFF_24KHZ_16BIT_MONO_PCM
                │                  - Timeout: 10,000ms
                │                             │
                │             ┌───────────────┴───────────────┐
                │             ▼                               ▼
                │         [ Success ]                    [ Network Error ]
                │         Write .wav file                Emit warning:
                │         to cache directory             W_VOICE_EDGE_FALLBACK
                │             │                               │
                │             │                               ▼
                │             │                      [ Fallback to FormantViEngine ]
                │             │                               │
                └─────────────┼───────────────────────────────┘
                              ▼
                [ Parse Duration from WAV ]
                - Extract byteRate & data size from RIFF header
                - Duration = dataSize / byteRate
                              │
                              ▼
             [ Return VoiceResult: { voiceWavPath, duration } ]
                              │
                              ▼
                [ AudioEngine Mux with SFX + BGM ]
```

---

## 3. Detailed Component Specifications

### 3.1. Dependency Addition
- Package: `msedge-tts` (v1.4+) added to root [`package.json`](file:///d:/source_code/auto-drawing/package.json).
- Compatible with Node.js 22+.

### 3.2. `EdgeTtsEngine` Implementation (`src/audio/EdgeTtsEngine.ts`)

Implements `IAudioEngine`:

```typescript
export interface EdgeTtsOptions {
  /** Voice model identifier. Defaults to 'vi-VN-HoaiMyNeural'. */
  voice?: string;
  /** Speaking rate. Defaults to '+0%'. */
  rate?: string;
  /** Voice pitch. Defaults to '+0Hz'. */
  pitch?: string;
  /** Voice volume. Defaults to '+0%'. */
  volume?: string;
  /** Cache directory for synthesized WAV files. Defaults to os.tmpdir()/auto-drawing-audio. */
  cacheDir?: string;
  /** Network timeout in milliseconds. Defaults to 10,000ms. */
  timeoutMs?: number;
  /** If true, fall back to FormantViEngine on failure instead of silent stub. Defaults to true. */
  formantFallback?: boolean;
}

export class EdgeTtsEngine implements IAudioEngine {
  readonly warnings: Array<{ code: string; hint: string }> = [];

  constructor(private readonly options: EdgeTtsOptions = {});

  async synthesizeVoice(script: string, options?: VoiceOptions): Promise<VoiceResult>;
}
```

### 3.3. Deterministic Caching Strategy
- Script normalization: `script.trim().replace(/\s+/g, ' ')`.
- Cache key: `sha256(voice + ":" + normalizedScript).slice(0, 16)`.
- Cache path: `path.join(cacheDir, `voice-edge-${hash}.wav`)`.
- Behavior:
  - If the cache file exists and size > 44 bytes, return cached file directly (0ms latency, zero bandwidth).
  - Otherwise, synthesize via `MsEdgeTTS`, write to temporary file, atomically move to cache path.

### 3.4. Format & Duration Extraction
- Output format: `OUTPUT_FORMAT.RIFF_24KHZ_16BIT_MONO_PCM`.
- Produces valid standard PCM WAV files with standard RIFF chunk header:
  - Format tag: 1 (PCM)
  - Channels: 1 (Mono)
  - Sample rate: 24,000 Hz
  - Bits per sample: 16 bits
  - Byte rate: 48,000 bytes/sec
- The duration is calculated deterministically by reading `dataSize / byteRate`, matching `AudioEngine`'s exact timing calculations.

### 3.5. Default Engine Wiring in `AudioEngine.ts`
- Update `AudioEngine` constructor:
  ```typescript
  export class AudioEngine {
    constructor(adapter: IAudioEngine = new EdgeTtsEngine()) {
      this.adapter = adapter;
    }
  }
  ```
- Retain `ViPiperEngine` and `FormantViEngine` for full backward compatibility and fallback hierarchies.

---

## 4. Verification & Testing Strategy

1. **Unit Test (`test/audio/EdgeTtsEngine.test.ts`):**
   - Synthesize a standard Vietnamese test phrase: `"Thử thách 5 giây đoán giá"`.
   - Verify that output file is a valid RIFF/WAVE file with duration > 0.
   - Verify that calling `synthesizeVoice` a second time hits the cache (instant resolution).
   - Verify graceful fallback to `FormantViEngine` when network is simulated offline.

2. **Integration Test (`test/audio/AudioEngine.test.ts`):**
   - Run full audio engine test suite to verify SFX cues and BGM mixing with Edge-TTS voice track.

3. **End-to-End Render Verification:**
   - Execute `node bin/game.js render --mechanic hi_lo --products p001,p042 --seed 12345`.
   - Play the generated MP4 file to confirm clear, human-like voiceover narration.
