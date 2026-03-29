import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { AppConfig } from './types.js';

let serviceClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client using the service-role key.
 * Used for server-side operations that bypass RLS.
 */
export function getServiceClient(config: AppConfig): SupabaseClient {
  if (serviceClient) {
    return serviceClient;
  }

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot create service client.',
    );
  }

  serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serviceClient;
}

/**
 * Returns a Supabase client scoped to a user's JWT.
 * Used for operations that should respect RLS policies.
 */
export function getUserClient(config: AppConfig, accessToken: string): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Cannot create user client.',
    );
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
