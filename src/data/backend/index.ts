import { createFakeBackend } from './fake';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

/** Set when the build has no backend configured (shown on screen instead of silently losing data). */
export let backendConfigError: string | null = null;

function pick(): Backend {
  const env = import.meta.env;
  if (env.VITE_BACKEND === 'fake') return createFakeBackend();
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !env.VITE_PAIR_EMAIL) {
    backendConfigError = 'Brak konfiguracji Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PAIR_EMAIL).';
    return createFakeBackend();
  }
  return createSupabaseBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, env.VITE_PAIR_EMAIL);
}

export const backend: Backend = pick();
export { BackendError } from './types';
