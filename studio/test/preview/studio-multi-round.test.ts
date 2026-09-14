import { render, fireEvent } from '@testing-library/react';
import { GamePreview } from '@/components/GamePreview';
import type { GameJson, Mechanic } from '@/types/game';

// Minimal mock game JSON generator
function createMockGame(mechanic: Mechanic): GameJson {
  return {
    metadata: {
      gameId: 'mock-' + mechanic,
      mechanic,
      language: 'vi-VN',
      difficulty: 'easy',
      seed: 12345,
      resultVariant: 'in_video',
    },
    content: {
      title: 'Mock Title',
      hook: 'Mock Hook',
      question: 'Mock Question',
      choices: [],
      cta: 'Mock CTA',
      caption: 'Mock Caption',
      hashtags: [],
      voiceScript: '',
    },
    entities: [],
    gameplay: {} as any,
    scenes: [],
    timeline: {
      totalDuration: 38,
      sceneTimings: [],
    },
    audio: {
      voice: { script: '', wavPath: '', duration: 0 },
      music: { track: '', volume: 0 },
      sfx: [],
    },
    publishing: {
      caption: '',
      hashtags: [],
      affiliateLink: '',
      outputPath: '',
    },
  };
}

describe('GamePreview timeline scrubber', () => {
  const mechanics: Mechanic[] = ['GUESS_THE_PRICE', 'GROCERY_BASKET', 'DEAL_OR_SCAM'];

  mechanics.forEach((m) => {
    test(`renders scrubber for ${m}`, () => {
      const { getByRole } = render(<GamePreview game={createMockGame(m)} />);
      const slider = getByRole('slider') as HTMLInputElement;
      expect(slider).toBeInTheDocument();
      // Simulate moving slider to 10.5 seconds
      fireEvent.change(slider, { target: { value: '10.5' } });
      expect(slider.value).toBe('10.5');
    });
  });
});
