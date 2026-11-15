import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { backend, backendConfigError } from '@/data/backend';
import { useProfileStore } from '@/stores/profileStore';

/** Device must be signed into the pair account; profiles are loaded from cache (and refreshed when online). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const { loaded, profiles, loadLocal, refresh } = useProfileStore();

  useEffect(() => {
    let alive = true;
    (async () => {
      const signedIn = await backend.isSignedIn();
      if (!signedIn) return alive && setState('out');
      await loadLocal();
      if (useProfileStore.getState().profiles.length === 0) await refresh();
      else void refresh();
      if (alive) setState('in');
    })();
    return () => {
      alive = false;
    };
  }, [loadLocal, refresh]);

  if (backendConfigError) return <p className="p-6 text-die">{backendConfigError}</p>;
  if (state === 'checking' || (state === 'in' && !loaded)) return null;
  if (state === 'out') return <Navigate to="/setup" replace />;
  if (profiles.length === 0) {
    return <p className="p-6 text-center text-muted">Brak profili — połącz się z internetem i odśwież aplikację.</p>;
  }
  return <>{children}</>;
}

/** A profile must be chosen on this device. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const currentId = useProfileStore((s) => s.currentId);
  const location = useLocation();
  if (!currentId) return <Navigate to="/who" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
