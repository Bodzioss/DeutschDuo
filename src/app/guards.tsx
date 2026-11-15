import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { backend, backendConfigError } from '@/data/backend';
import { useProfileStore } from '@/stores/profileStore';
import { useSync } from '@/data/useSync';

/**
 * Layout route: the device must be signed into the pair account. Mounted once for all guarded routes.
 * Sign-in is checked locally (works offline); profiles come from the device cache and are refreshed when online.
 */
export function AuthGate() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const { loaded, profiles, loadLocal, refresh } = useProfileStore();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!(await backend.isSignedIn())) return alive && setState('out');
        await loadLocal();
        if (useProfileStore.getState().profiles.length === 0) await refresh();
        else void refresh();
        if (alive) setState('in');
      } catch (e) {
        console.error('auth check failed', e);
        if (alive) setState('out');
      }
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
  return <Outlet />;
}

/** Layout route: a profile must be chosen on this device. Runs background sync for it. */
export function ProfileGate() {
  const currentId = useProfileStore((s) => s.currentId);
  const location = useLocation();
  useSync(currentId);
  if (!currentId) return <Navigate to="/who" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
