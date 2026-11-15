import { afterEach, describe, expect, test, vi } from 'vitest';
import { hasGermanVoice, speak } from '@/ui/speech';

function mockSynth(voices: { lang: string }[]) {
  const speakFn = vi.fn();
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => voices, speak: speakFn, cancel: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  (globalThis as any).SpeechSynthesisUtterance = class { lang = ''; rate = 1; voice = null; constructor(public text: string) {} };
  return speakFn;
}

afterEach(() => {
  delete (window as any).speechSynthesis;
});

describe('speech', () => {
  test('hasGermanVoice false when no voices', async () => {
    mockSynth([]);
    expect(await hasGermanVoice(50)).toBe(false);
  });
  test('hasGermanVoice true when a de-DE voice exists', async () => {
    mockSynth([{ lang: 'en-US' }, { lang: 'de-DE' }]);
    expect(await hasGermanVoice(50)).toBe(true);
  });
  test('hasGermanVoice false without speechSynthesis', async () => {
    expect(await hasGermanVoice(50)).toBe(false);
  });
  test('speak is a no-op without speechSynthesis', () => {
    expect(() => speak('Hallo')).not.toThrow();
  });
  test('speak uses de-DE', () => {
    const fn = mockSynth([{ lang: 'de-DE' }]);
    speak('Hallo');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].lang).toBe('de-DE');
  });
});

describe('speak without a German voice', () => {
  test('does not speak at all (would read German with a foreign voice)', () => {
    const fn = mockSynth([{ lang: 'pl-PL' }, { lang: 'en-US' }]);
    speak('Hallo');
    expect(fn).not.toHaveBeenCalled();
  });
});
