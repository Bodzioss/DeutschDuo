import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentProfile, useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { backend } from '@/data/backend';
import { Button } from '@/ui/Button';
import { applyTheme, getTheme, type Theme } from './theme';

const GOALS = [10, 15, 20, 30];
const THEMES: { t: Theme; label: string }[] = [
  { t: 'system', label: 'System' },
  { t: 'light', label: 'Jasny' },
  { t: 'dark', label: 'Ciemny' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-muted/10 p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg py-2 text-sm ${o.v === value ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const profile = useCurrentProfile();
  const { updateProfile, clear } = useProfileStore();
  const resetSession = useSessionStore((s) => s.reset);
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [newPerDay, setNewPerDay] = useState<number | null>(null);

  // Debounce the slider: one backend write after the finger stops, not one per tick.
  useEffect(() => {
    if (!profile || newPerDay === null || newPerDay === profile.newPerDay) return;
    const t = setTimeout(() => void updateProfile({ ...profile, newPerDay }), 400);
    return () => clearTimeout(t);
  }, [newPerDay, profile, updateProfile]);

  if (!profile) return null;

  const signOut = async () => {
    if (!confirm('Wylogować to urządzenie? Postęp zostaje w chmurze i na telefonie.')) return;
    await backend.signOut();
    resetSession();
    navigate('/setup', { replace: true });
    await clear();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ustawienia</h1>
      <section className="divide-y divide-muted/10 rounded-2xl bg-surface ring-1 ring-muted/10">
        <Row label="Cel dzienny">
          <Segmented value={profile.dailyGoalMin} options={GOALS.map((g) => ({ v: g, label: `${g} min` }))} onChange={(v) => updateProfile({ ...profile, dailyGoalMin: v })} />
        </Row>
        <Row label={`Nowe słowa dziennie: ${newPerDay ?? profile.newPerDay}`}>
          <input
            type="range"
            min={5}
            max={20}
            value={newPerDay ?? profile.newPerDay}
            aria-label="Nowe słowa dziennie"
            onChange={(e) => setNewPerDay(Number(e.target.value))}
            className="w-full accent-[rgb(var(--accent))]"
          />
        </Row>
        <Row label="Podpowiedź po polsku">
          <Segmented value={profile.showPl ? 'on' : 'off'} options={[{ v: 'on', label: 'Wł.' }, { v: 'off', label: 'Wył.' }]} onChange={(v) => updateProfile({ ...profile, showPl: v === 'on' })} />
        </Row>
        <Row label="Motyw">
          <Segmented value={theme} options={THEMES.map(({ t, label }) => ({ v: t, label }))} onChange={(t) => { setTheme(t); applyTheme(t); }} />
        </Row>
      </section>
      <section className="space-y-2">
        <Button variant="secondary" className="w-full" onClick={() => navigate('/who')}>Zmień profil</Button>
        <Link to="/settings/about-data" className="block rounded-xl px-4 py-3 text-center text-accent">O danych i licencjach</Link>
        <Button variant="ghost" className="w-full" onClick={signOut}>Wyloguj to urządzenie</Button>
      </section>
    </div>
  );
}
