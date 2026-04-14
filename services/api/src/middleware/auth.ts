import { IncomingMessage } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { getServiceClient } from '../supabase.js';

export interface AuthenticatedUser {
  authUserId: string;
  profileId: string;
  email: string | null;
}

export interface AuthenticatedContext extends RequestContext {
  user: AuthenticatedUser;
  accessToken: string;
}

function extractBearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

async function resolveDevelopmentUser(
  token: string,
  config: AppConfig,
): Promise<AuthenticatedUser | null> {
  if (config.nodeEnv === 'production') {
    return null;
  }

  const usesLegacyToken = token === 'dev-token';
  const usesScopedToken = token.startsWith('dev-session:');
  if (!usesLegacyToken && !usesScopedToken) {
    return null;
  }

  const profileId = usesLegacyToken ? 'dev-user-001' : token.slice('dev-session:'.length).trim();
  if (!profileId) {
    throw new AppError('unauthorized', 'Invalid development session token', 401);
  }

  const supabase = getServiceClient(config);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', profileId)
    .single();

  if (error || !profile) {
    throw new AppError(
      'profile_not_found',
      'Development profile not found. Create a development session first.',
      404,
    );
  }

  return {
    authUserId: profileId,
    profileId: profile.id,
    email: profile.email ?? null,
  };
}

/**
 * Resolves the authenticated user from a Supabase JWT.
 *
 * 1. Extracts Bearer token from Authorization header
 * 2. Validates token with Supabase Auth
 * 3. Looks up the HINTO profile by auth.users.id
 * 4. Returns an AuthenticatedContext or throws AppError
 */
export async function resolveAuthenticatedUser(
  request: IncomingMessage,
  context: RequestContext,
  config: AppConfig,
): Promise<AuthenticatedContext> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AppError('unauthorized', 'Missing or invalid Authorization header', 401);
  }

  const developmentUser = await resolveDevelopmentUser(token, config);
  if (developmentUser) {
    return {
      ...context,
      user: developmentUser,
      accessToken: token,
    };
  }

  const supabase = getServiceClient(config);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new AppError('unauthorized', 'Invalid or expired token', 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new AppError(
      'profile_not_found',
      'No profile found for authenticated user. Profile may need to be created.',
      404,
    );
  }

  return {
    ...context,
    user: {
      authUserId: user.id,
      profileId: profile.id,
      email: user.email ?? null,
    },
    accessToken: token,
  };
}
