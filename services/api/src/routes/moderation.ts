import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';

const REPORT_CONTENT_TYPES = new Set(['profile', 'situationship', 'vote', 'message']);
const REPORT_REASON_MAX_LENGTH = 500;
const REPORT_DESCRIPTION_MAX_LENGTH = 2000;
const BLOCK_REASON_MAX_LENGTH = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
}

interface ReportRow {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  content_type: string;
  content_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

function toBlockDto(row: BlockRow) {
  return {
    blockId: row.id,
    blockerProfileId: row.blocker_id,
    blockedProfileId: row.blocked_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function toReportDto(row: ReportRow) {
  return {
    reportId: row.id,
    reporterProfileId: row.reporter_id,
    reportedProfileId: row.reported_user_id,
    contentType: row.content_type,
    contentId: row.content_id,
    reason: row.reason,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new AppError('validation_error', `${field} must be a valid UUID`, 400);
  }
  return value;
}

function normalizeOptionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new AppError('validation_error', `${field} must be a string`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new AppError(
      'validation_error',
      `${field} must be ${maxLength} characters or fewer`,
      400,
    );
  }
  return trimmed;
}

function normalizeRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new AppError('validation_error', `${field} is required`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError('validation_error', `${field} is required`, 400);
  }
  if (trimmed.length > maxLength) {
    throw new AppError(
      'validation_error',
      `${field} must be ${maxLength} characters or fewer`,
      400,
    );
  }
  return trimmed;
}

/**
 * POST /v1/me/blocks - Block another profile.
 */
export async function handleCreateBlock(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const blockedProfileId = assertUuid(body.blockedProfileId, 'blockedProfileId');

  if (blockedProfileId === authCtx.user.profileId) {
    throw new AppError('validation_error', 'You cannot block yourself', 400);
  }

  const reason = normalizeOptionalString(body.reason, 'reason', BLOCK_REASON_MAX_LENGTH);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('blocks')
    .insert({
      blocker_id: authCtx.user.profileId,
      blocked_id: blockedProfileId,
      reason,
    })
    .select('*')
    .single();

  if (error) {
    const code = typeof error.code === 'string' ? error.code : '';
    if (code === '23505') {
      throw new AppError('duplicate_block', 'You have already blocked this profile', 409);
    }
    if (code === '23503') {
      throw new AppError('not_found', 'Blocked profile not found', 404);
    }
    throw new AppError('create_failed', 'Failed to create block', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    block: toBlockDto(data as BlockRow),
  });
}

/**
 * DELETE /v1/me/blocks/:blockedProfileId - Unblock a profile.
 */
export async function handleDeleteBlock(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  blockedProfileId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  assertUuid(blockedProfileId, 'blockedProfileId');

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', authCtx.user.profileId)
    .eq('blocked_id', blockedProfileId)
    .select('id');

  if (error) {
    throw new AppError('delete_failed', 'Failed to remove block', 500);
  }

  if (!data || data.length === 0) {
    throw new AppError('not_found', 'Block not found', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    blockedProfileId,
    removed: true,
  });
}

/**
 * GET /v1/me/blocks - List the authenticated user's blocks.
 */
export async function handleListBlocks(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('blocker_id', authCtx.user.profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch blocks', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    blocks: (data ?? []).map((row) => toBlockDto(row as BlockRow)),
  });
}

/**
 * POST /v1/reports - File a content/user report.
 */
export async function handleCreateReport(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  const contentType = body.contentType;
  if (typeof contentType !== 'string' || !REPORT_CONTENT_TYPES.has(contentType)) {
    throw new AppError(
      'validation_error',
      `contentType must be one of: ${Array.from(REPORT_CONTENT_TYPES).join(', ')}`,
      400,
    );
  }

  const contentId = assertUuid(body.contentId, 'contentId');
  const reportedProfileId =
    body.reportedProfileId === undefined || body.reportedProfileId === null
      ? null
      : assertUuid(body.reportedProfileId, 'reportedProfileId');
  const reason = normalizeRequiredString(body.reason, 'reason', REPORT_REASON_MAX_LENGTH);
  const description = normalizeOptionalString(
    body.description,
    'description',
    REPORT_DESCRIPTION_MAX_LENGTH,
  );

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: authCtx.user.profileId,
      reported_user_id: reportedProfileId,
      content_type: contentType,
      content_id: contentId,
      reason,
      description,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    throw new AppError('create_failed', 'Failed to file report', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    report: toReportDto(data as ReportRow),
  });
}
