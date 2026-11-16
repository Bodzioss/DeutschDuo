/**
 * Short haptic feedback. Android/Chrome: Vibration API. iPhone Safari has no Vibration API, but toggling a hidden
 * `<input type="checkbox" switch>` (Safari 18+) gives a light system tap; it must run inside a user gesture.
 */
export type Haptic = 'light' | 'success' | 'win';

const PATTERNS: Record<Haptic, number | number[]> = { light: 12, success: [25, 60, 40], win: [40, 70, 40, 70, 90] };
const IOS_TAPS: Record<Haptic, number> = { light: 1, success: 2, win: 3 };

function iosTap() {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  label.style.display = 'none';
  document.body.appendChild(label);
  label.click();
  label.remove();
}

export function haptic(kind: Haptic) {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }
    for (let i = 0; i < IOS_TAPS[kind]; i++) {
      if (i === 0) iosTap();
      else setTimeout(iosTap, i * 110);
    }
  } catch {
    // haptics are a nicety; never break a move
  }
}

let ctx: AudioContext | null = null;

/** A short rising chime (C–E–G); quiet, and silent when the phone is muted. */
export function chime(notes = [523.25, 659.25, 783.99]) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t = t0 + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // sound is optional
  }
}
