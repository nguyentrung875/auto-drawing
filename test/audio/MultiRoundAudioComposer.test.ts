import { describe, it, expect } from 'vitest';
import { MultiRoundAudioComposer } from '../../src/audio/MultiRoundAudioComposer';
import { AllInOneScene } from '../../src/scene/AllInOneScene';
import type { MultiRoundChallenge } from '../../src/challenge/types';

describe('MultiRoundAudioComposer', () => {
  const mockChallenge: MultiRoundChallenge = {
    gameId: 'g9_test',
    seed: 42,
    title: '5 Giây Đoán Giá',
    seriesNumber: 15,
    rounds: [
      {
        roundIndex: 1,
        type: 'confidence_builder',
        question: 'Giá sản phẩm này là bao nhiêu?',
        products: [
          {
            productId: 'p001',
            name: 'Sản phẩm 1',
            image: 'p1.png',
            price: 29000,
            currency: 'VND',
            source: 's',
            updatedAt: '2026',
            category: 'c',
            brand: 'b',
            affiliate_link: 'l',
          },
        ],
        choices: [
          { id: 'A', label: '29K', isCorrect: true },
          { id: 'B', label: '290K', isCorrect: false },
        ],
        correctAnswer: 'A',
        timerSeconds: 5.0,
        scoreVector: {
          difficulty: 0.2,
          visualClarity: 1,
          curiosity: 0.5,
          surprise: 0.5,
          perceptionConflict: 0.1,
          debate: 0.3,
          identity: 0.8,
          familiarity: 0.9,
          commerceRelevance: 0.8,
          revealImpact: 0.4,
        },
        revealText: 'Giá chính xác: 29K',
      },
      {
        roundIndex: 2,
        type: 'wtf_reveal',
        question: 'Giá của củ sạc này là bao nhiêu?',
        products: [
          {
            productId: 'p002',
            name: 'Sản phẩm 2',
            image: 'p2.png',
            price: 2500000,
            currency: 'VND',
            source: 's',
            updatedAt: '2026',
            category: 'c',
            brand: 'b',
            affiliate_link: 'l',
          },
        ],
        choices: [
          { id: 'A', label: '150K', isCorrect: false },
          { id: 'B', label: '2.5 Tr', isCorrect: true },
        ],
        correctAnswer: 'B',
        timerSeconds: 5.0,
        scoreVector: {
          difficulty: 0.85,
          visualClarity: 1,
          curiosity: 0.9,
          surprise: 0.95,
          perceptionConflict: 0.95,
          debate: 0.8,
          identity: 0.9,
          familiarity: 0.8,
          commerceRelevance: 0.9,
          revealImpact: 0.92,
        },
        revealText: 'Giá chính xác: 2.5 Triệu',
      },
    ],
    finalCta: 'Ai đúng 2/2 giơ tay!',
  };

  it('generates audio plan with voice segments for every round and countdown ticks', () => {
    const scene = new AllInOneScene(mockChallenge);
    const timeline = scene.getTimeline();
    const composer = new MultiRoundAudioComposer();

    const plan = composer.planAudio(mockChallenge, timeline);

    // 2 rounds -> 2 voice plans starting at round_play.start + 0.1s
    expect(plan.voicePlans.length).toBe(2);
    expect(plan.voicePlans[0]?.startAt).toBe(1.1); // hook 1.0s + 0.1s
    expect(plan.voicePlans[0]?.script).toContain('Giá sản phẩm này');

    // SFX cues include intro, ticks, reveal, and micro-hook
    expect(plan.sfxCues.some((c) => c.type === 'tick' || c.type === 'countdown')).toBe(true);
    expect(plan.sfxCues.some((c) => c.type === 'reveal')).toBe(true);
    expect(plan.sfxCues.some((c) => c.type === 'transition')).toBe(true);
  });

  it('synthesizes and mixes multi-round audio into an actual WAV file', async () => {
    const { existsSync, unlinkSync } = await import('node:fs');
    const path = await import('node:path');
    const os = await import('node:os');
    const scene = new AllInOneScene(mockChallenge);
    const timeline = scene.getTimeline();
    const composer = new MultiRoundAudioComposer();
    const testOutPath = path.join(os.tmpdir(), `test_multi_audio_${Date.now()}.wav`);

    const result = await composer.composeAudio(mockChallenge, timeline, {
      outputPath: testOutPath,
    });

    expect(existsSync(result.audioPath)).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);
    try {
      unlinkSync(testOutPath);
    } catch {}
  }, 20_000);
});
