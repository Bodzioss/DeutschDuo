import { useEffect, useState } from 'react';
import { hasGermanVoice, speak } from './speech';

let voiceAvailable: Promise<boolean> | null = null;
export function useGermanVoice(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    (voiceAvailable ??= hasGermanVoice()).then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

export function AudioButton({ text, label = 'Odsłuchaj', small = false }: { text: string; label?: string; small?: boolean }) {
  const ok = useGermanVoice();
  if (!ok) return null;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => speak(text)}
      className={`inline-flex items-center justify-center rounded-full bg-accent/10 text-accent active:scale-95 ${small ? 'h-8 w-8 text-sm' : 'h-11 w-11 text-lg'}`}
    >
      🔊
    </button>
  );
}
