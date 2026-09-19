import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { AppConfig } from './types.js';

let serviceClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client using the service-role key.
 * Used for server-side data access that bypasses RLS and for `auth.admin.*`.
 *
 * IMPORTANT: never call session-producing auth methods (`verifyOtp`,
 * `refreshSession`, `signInWith*`) on this client. supabase-js stores the
 * resulting session in memory even with `persistSession: false` and then
 * sends that user's JWT on every later PostgREST call, which silently
 * downgrades the service-role client to a single user's RLS context.
 * Use `getAuthClient` for those calls instead.
 */
export function getServiceClient(config: AppConfig): SupabaseClient {
  if (serviceClient) {
    return serviceClient;
  }

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot create service client.'
    );
  }

  const serviceRoleKey = config.supabaseServiceRoleKey;

  serviceClient = createClient(config.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      // Pin the Authorization header so a stray session can never replace it.
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
    },
  });

  return serviceClient;
}

/**
 * Returns a throwaway anon-key client for auth handshakes that produce a
 * session (email OTP verify, refresh, id-token exchange). A fresh instance
 * per call guarantees no session leaks between requests.
 */
export function getAuthClient(config: AppConfig): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Cannot create auth client.');
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/**
 * Returns a Supabase client scoped to a user's JWT.
 * Used for operations that should respect RLS policies.
 */
export function getUserClient(config: AppConfig, accessToken: string): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Cannot create user client.');
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/** Test seam: drop the cached service client. */
export function resetSupabaseClients(): void {
  serviceClient = null;
}
