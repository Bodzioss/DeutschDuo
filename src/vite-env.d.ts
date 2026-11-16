/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PAIR_EMAIL?: string;
  /** Web Push VAPID public key (base64url). Empty → notifications unavailable in this build. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
