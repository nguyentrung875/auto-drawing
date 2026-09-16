import type { GameState } from '../state/types';
import type { PresentationModel } from '../presentation/types';
import type { VisualThemeId } from '../theme/types';
import { MechanicRegistry } from '../registry/MechanicRegistry';

export class PresentationCompiler {
  static compile<T>(
    state: GameState<T>,
    themeId: VisualThemeId,
    ctaVariant: 'single_round_challenge' | 'multi_round_scorecard' | 'comment_debate',
  ): PresentationModel<T> {
    const mechanic = MechanicRegistry.get<T>(state.mechanicId);
    const question = mechanic.compileQuestion(state, themeId);
    const reveal = mechanic.compileReveal(state);

    const isMulti = state.totalRounds > 1;
    const bannerText = isMulti ? '⭐ BẢNG ĐIỂM SHOW ⭐' : 'BẠN ĐOÁN ĐÚNG KHÔNG?';
    const subText = isMulti ? 'Bình luận số câu bạn đúng!' : 'Comment đáp án của bạn ngay!';

    return {
      question,
      reveal,
      cta: {
        bannerText,
        subText,
        variant: ctaVariant,
      },
    };
  }
}
