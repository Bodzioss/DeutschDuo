import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { backend, BackendError } from '@/data/backend';
import { useProfileStore } from '@/stores/profileStore';
import { Button } from '@/ui/Button';

const ERRORS: Record<string, string> = {
  bad_password: 'Złe hasło',
  offline: 'Potrzebny internet przy pierwszym uruchomieniu',
};

export function PairPasswordScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const refresh = useProfileStore((s) => s.refresh);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.signIn(password);
      await refresh();
      navigate('/who', { replace: true });
    } catch (err) {
      setError(err instanceof BackendError ? ERRORS[err.code] ?? 'Coś poszło nie tak' : 'Coś poszło nie tak');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col justify-center gap-8 px-6">
      <div className="text-center">
        <div className="mb-3 text-5xl">🇩🇪</div>
        <h1 className="text-3xl font-bold">Deutsch Duo</h1>
        <p className="mt-2 text-muted">Wpisz hasło pary — tylko raz na tym urządzeniu.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Hasło pary"
          placeholder="Hasło pary"
          autoComplete="current-password"
          className="w-full rounded-xl bg-surface px-4 py-3 text-lg ring-1 ring-muted/30 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p role="alert" className="text-sm text-die">{error}</p>}
        <Button type="submit" className="w-full" disabled={!password || busy}>
          {busy ? 'Łączę…' : 'Wejdź'}
        </Button>
      </form>
    </div>
  );
}
