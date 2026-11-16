import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';

const tabs = [
  { to: '/', label: 'Heute', icon: '☀️', end: true },
  { to: '/game', label: 'Gra', icon: '🃏', end: false },
  { to: '/words', label: 'Słowa', icon: '📖', end: false },
  { to: '/stats', label: 'Statystyki', icon: '📈', end: false },
  { to: '/settings', label: 'Ustawienia', icon: '⚙️', end: false },
];

export function Layout() {
  const profile = useCurrentProfile();
  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col">
      {import.meta.env.PROD && import.meta.env.VITE_BACKEND === 'fake' && (
        <p className="bg-amber-500/20 px-4 py-1 text-center text-xs text-amber-800 dark:text-amber-200">
          Tryb testowy — postęp zapisuje się tylko na tym urządzeniu
        </p>
      )}
      <main className="relative flex-1 px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
        {profile && (
          <Link
            to="/who"
            aria-label={`Profil: ${profile.displayName}. Zmień profil`}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 font-bold text-accent"
          >
            {profile.displayName.slice(0, 1)}
          </Link>
        )}
        <Outlet />
      </main>
      <nav
        aria-label="Nawigacja główna"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-muted/20 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-[480px]">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
