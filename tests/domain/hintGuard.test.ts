import { describe, it, expect } from 'vitest';
import { isHintSafe } from '../../src/domain/hintGuard';

describe('isHintSafe', () => {
  it('rejects a hint that quotes the correct answer text', () => {
    expect(isHintSafe('Remember, the answer is Photosynthesis.', 'Photosynthesis')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isHintSafe('Think about PHOTOSYNTHESIS and light.', 'Photosynthesis')).toBe(false);
  });

  it('ignores surrounding whitespace on the answer', () => {
    expect(isHintSafe('It is called photosynthesis.', '  Photosynthesis  ')).toBe(false);
  });

  it('allows a conceptual hint that does not name the answer', () => {
    expect(isHintSafe('Think about how plants turn sunlight into energy.', 'Photosynthesis')).toBe(true);
  });

  it('treats an empty answer as unsafe (nothing to protect means guard fails closed)', () => {
    expect(isHintSafe('any hint', '')).toBe(false);
  });
});
