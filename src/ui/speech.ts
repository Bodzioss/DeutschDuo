const synth = (): SpeechSynthesis | undefined =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

const isGerman = (v: { lang: string }) => v.lang.toLowerCase().replace('_', '-').startsWith('de');

function germanVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices() ?? [];
  return voices.find((v) => v.lang === 'de-DE') ?? voices.find(isGerman);
}

/** Speaks German text; silently does nothing on devices without speech synthesis. */
export function speak(text: string): void {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = 0.9;
  const v = germanVoice();
  if (v) u.voice = v;
  s.speak(u);
}

/** Resolves whether a German voice is available (voices may load asynchronously). */
export function hasGermanVoice(timeoutMs = 1000): Promise<boolean> {
  const s = synth();
  if (!s) return Promise.resolve(false);
  if (s.getVoices().some(isGerman)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener('voiceschanged', done);
      clearTimeout(t);
      resolve(s.getVoices().some(isGerman));
    };
    const t = setTimeout(done, timeoutMs);
    s.addEventListener('voiceschanged', done);
  });
}
