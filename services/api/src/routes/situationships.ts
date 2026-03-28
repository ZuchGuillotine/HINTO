import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';

interface SituationshipRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  category: string | null;
  description: string | null;
  rank: number;
  status: string | null;
  created_at: string;
  updated_at: string;
}

function toSituationshipDto(row: SituationshipRow) {
  return {
    situationshipId: row.id,
    ownerProfileId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    category: row.category,
    description: row.description,
    rank: row.rank ?? 0,
    status: row.status === 'archived' ? ('archived' as const) : ('active' as const),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /v1/me/situationships - List the authenticated user's situationships.
 */
export async function handleListSituationships(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { data: rows, error } = await supabase
    .from('situationships')
    .select('*')
    .eq('user_id', authCtx.user.profileId)
    .order('rank', { ascending: true });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch situationships', 500);
  }

  const items = (rows as SituationshipRow[]).map(toSituationshipDto);

  const aggregate = {
    ownerProfile: {
      profileId: authCtx.user.profileId,
      username: '',
      displayName: '',
    },
    viewerContext: {
      mode: 'owner' as const,
      viewerProfileId: authCtx.user.profileId,
    },
    items,
    ordering: {
      orderedSituationshipIds: items.map((i) => i.situationshipId),
    },
    capabilities: {
      canEdit: true,
      canReorder: true,
      canVote: false,
    },
    audience: {
      mode: 'owner_only' as const,
    },
  };

  // Enrich owner profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', authCtx.user.profileId)
    .single();

  if (profile) {
    aggregate.ownerProfile.username = (profile as { username: string }).username ?? '';
    aggregate.ownerProfile.displayName = (profile as { display_name: string }).display_name ?? '';
  }

  sendJsonSuccess(response, 200, context.requestId, aggregate);
}

/**
 * POST /v1/me/situationships - Create a new situationship.
 */
export async function handleCreateSituationship(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  if (!body.name || typeof body.name !== 'string' || (body.name as string).trim().length === 0) {
    throw new AppError('validation_error', 'name is required', 400);
  }

  const supabase = getServiceClient(config);

  // Determine next rank
  const { data: existing } = await supabase
    .from('situationships')
    .select('rank')
    .eq('user_id', authCtx.user.profileId)
    .order('rank', { ascending: false })
    .limit(1);

  const nextRank = existing && existing.length > 0 ? (existing[0] as { rank: number }).rank + 1 : 0;

  const { data: row, error } = await supabase
    .from('situationships')
    .insert({
      user_id: authCtx.user.profileId,
      name: (body.name as string).trim(),
      emoji: body.emoji ?? null,
      category: body.category ?? null,
      description: body.description ?? null,
      rank: nextRank,
      status: 'active',
    })
    .select('*')
    .single();

  if (error || !row) {
    throw new AppError('create_failed', 'Failed to create situationship', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    situationship: toSituationshipDto(row as SituationshipRow),
  });
}

/**
 * PATCH /v1/me/situationships/:id - Update a situationship.
 */
export async function handleUpdateSituationship(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  situationshipId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  const updateFields: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || (body.name as string).trim().length === 0) {
      throw new AppError('validation_error', 'name must be a non-empty string', 400);
    }
    updateFields.name = (body.name as string).trim();
  }
  if (body.emoji !== undefined) updateFields.emoji = body.emoji;
  if (body.category !== undefined) updateFields.category = body.category;
  if (body.description !== undefined) updateFields.description = body.description;
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'archived') {
      throw new AppError('validation_error', 'status must be active or archived', 400);
    }
    updateFields.status = body.status;
  }

  if (Object.keys(updateFields).length === 0) {
    throw new AppError('validation_error', 'No valid fields to update', 400);
  }

  updateFields.updated_at = new Date().toISOString();

  const supabase = getServiceClient(config);

  const { data: row, error } = await supabase
    .from('situationships')
    .update(updateFields)
    .eq('id', situationshipId)
    .eq('user_id', authCtx.user.profileId)
    .select('*')
    .single();

  if (error || !row) {
    throw new AppError('not_found', 'Situationship not found or not owned by user', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    situationship: toSituationshipDto(row as SituationshipRow),
  });
}

/**
 * DELETE /v1/me/situationships/:id - Delete a situationship.
 */
export async function handleDeleteSituationship(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  situationshipId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { error } = await supabase
    .from('situationships')
    .delete()
    .eq('id', situationshipId)
    .eq('user_id', authCtx.user.profileId);

  if (error) {
    throw new AppError('delete_failed', 'Failed to delete situationship', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    situationshipId,
    deleted: true,
  });
}

/**
 * PUT /v1/me/situationships/order - Reorder situationships.
 */
export async function handleReorderSituationships(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  if (
    !Array.isArray(body.orderedSituationshipIds) ||
    body.orderedSituationshipIds.length === 0
  ) {
    throw new AppError(
      'validation_error',
      'orderedSituationshipIds must be a non-empty array',
      400,
    );
  }

  const orderedIds = body.orderedSituationshipIds as string[];
  const supabase = getServiceClient(config);

  // Fetch current situationships for validation
  const { data: current, error: fetchError } = await supabase
    .from('situationships')
    .select('id, user_id, rank, status')
    .eq('user_id', authCtx.user.profileId)
    .order('rank', { ascending: true });

  if (fetchError) {
    throw new AppError('fetch_failed', 'Failed to fetch current situationships', 500);
  }

  const currentRows = current as { id: string; user_id: string; rank: number; status: string }[];

  // Validate: all IDs must match
  const currentIds = new Set(currentRows.map((r) => r.id));
  const orderedSet = new Set(orderedIds);

  if (orderedIds.length !== currentRows.length) {
    throw new AppError(
      'validation_error',
      'orderedSituationshipIds must include every situationship exactly once',
      400,
    );
  }

  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      throw new AppError('validation_error', `Unknown situationship ID: ${id}`, 400);
    }
  }

  if (orderedSet.size !== orderedIds.length) {
    throw new AppError('validation_error', 'Duplicate IDs in orderedSituationshipIds', 400);
  }

  // Update ranks
  const updates = orderedIds.map((id, rank) =>
    supabase
      .from('situationships')
      .update({ rank, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', authCtx.user.profileId),
  );

  await Promise.all(updates);

  // Fetch updated list
  const { data: updated } = await supabase
    .from('situationships')
    .select('*')
    .eq('user_id', authCtx.user.profileId)
    .order('rank', { ascending: true });

  const items = (updated as SituationshipRow[] ?? []).map(toSituationshipDto);

  sendJsonSuccess(response, 200, context.requestId, {
    ordering: {
      orderedSituationshipIds: items.map((i) => i.situationshipId),
    },
    items,
  });
}
