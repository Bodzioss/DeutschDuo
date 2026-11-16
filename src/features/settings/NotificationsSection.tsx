import { useEffect, useState } from 'react';
import { notifyPrefs, type NotifyPrefs, type Profile } from '@/domain/types';
import { disablePush, enablePush, pushAvailable, pushState, readPushEnv, type PushState } from '@/data/push';
import { useProfileStore } from '@/stores/profileStore';
import { Button } from '@/ui/Button';
import { Row, Segmented } from './controls';

const HOURS = [17, 18, 19, 20, 21, 22];
const ONOFF = [{ v: 'on' as const, label: 'Wł.' }, { v: 'off' as const, label: 'Wył.' }];

const MESSAGES: Partial<Record<PushState, string>> = {
  'ios-not-installed': 'Na iPhonie dodaj aplikację do ekranu głównego: Udostępnij → Do ekranu początkowego, potem otwórz ją z ikony.',
  denied: 'Powiadomienia są zablokowane w ustawieniach telefonu.',
  unsupported: 'Ta przeglądarka nie obsługuje powiadomień.',
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <Segmented value={value ? 'on' : 'off'} options={ONOFF} onChange={(v) => onChange(v === 'on')} />
    </Row>
  );
}

export function NotificationsSection({ profile }: { profile: Profile }) {
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const available = pushAvailable();
  const [state, setState] = useState<PushState | null>(available ? null : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    void readPushEnv().then((env) => alive && setState(pushState(env)));
    return () => {
      alive = false;
    };
  }, [available]);

  const prefs = notifyPrefs(profile);
  const setPrefs = (patch: Partial<NotifyPrefs>) => void updateProfile({ ...profile, notify: { ...prefs, ...patch } });

  const onEnable = async () => {
    // No await before enablePush: iOS needs requestPermission() inside the tap.
    setError(null);
    setBusy(true);
    try {
      setState(await enablePush(profile.id));
    } catch (e) {
      console.error('enable push failed', e);
      setError('Nie udało się włączyć powiadomień. Spróbuj ponownie z internetem.');
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setError(null);
    setBusy(true);
    try {
      await disablePush();
      setState('off');
    } catch (e) {
      console.error('disable push failed', e);
      setError('Nie udało się wyłączyć powiadomień.');
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!available) body = <p className="px-4 py-3 text-sm text-muted">Powiadomienia nie są dostępne w tej wersji.</p>;
  else if (state === null) body = null;
  else if (state === 'off') {
    body = (
      <div className="space-y-2 px-4 py-3">
        <p className="text-sm text-muted">Przypomnienia o celu, streaku i ruchach partnera.</p>
        <Button className="w-full" disabled={busy} onClick={onEnable}>Włącz powiadomienia</Button>
      </div>
    );
  } else if (state === 'on') {
    body = (
      <>
        <Toggle label="Przypomnienie o celu" value={prefs.goal} onChange={(goal) => setPrefs({ goal })} />
        {prefs.goal && (
          <Row label="Godzina przypomnienia">
            <Segmented value={prefs.goalHour} options={HOURS.map((h) => ({ v: h, label: `${h}:00` }))} onChange={(goalHour) => setPrefs({ goalHour })} />
          </Row>
        )}
        <Toggle label="Streak w niebezpieczeństwie (21:30)" value={prefs.streak} onChange={(streak) => setPrefs({ streak })} />
        <Toggle label="Ruchy partnera" value={prefs.partner} onChange={(partner) => setPrefs({ partner })} />
        <div className="px-4 py-2">
          <button type="button" disabled={busy} onClick={onDisable} className="w-full py-2 text-sm text-accent disabled:opacity-50">
            Wyłącz na tym telefonie
          </button>
        </div>
      </>
    );
  } else body = <p className="px-4 py-3 text-sm text-muted">{MESSAGES[state]}</p>;

  return (
    <section aria-labelledby="notify-heading" className="space-y-2">
      <h2 id="notify-heading" className="px-1 text-lg font-semibold">Powiadomienia</h2>
      <div className="divide-y divide-muted/10 rounded-2xl bg-surface ring-1 ring-muted/10">
        {body}
        {error && <p role="alert" className="px-4 py-3 text-sm text-die">{error}</p>}
      </div>
    </section>
  );
}
