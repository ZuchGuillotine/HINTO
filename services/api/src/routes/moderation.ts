import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';
import { mapWriteError, normalizeShortText } from './situationships.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REPORT_CONTENT_TYPES = ['profile', 'situationship', 'vote', 'message'] as const;
type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number];

interface ReportRow {
  id: string;
  content_type: ReportContentType;
  content_id: string;
  reason: string;
  status: string;
  created_at: string;
}

interface BlockRow {
  blocked_id: string;
  reason: string | null;
  created_at: string;
}

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new AppError('validation_error', `${field} must be a UUID`, 400);
  }
  return value.toLowerCase();
}

function toReportDto(row: ReportRow) {
  return {
    reportId: row.id,
    contentType: row.content_type,
    contentId: row.content_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toBlockDto(row: BlockRow) {
  return {
    blockedProfileId: row.blocked_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function matchBlockProfileId(path: string): string | null {
  const match = path.match(/^\/v1\/me\/blocks\/([a-f0-9-]+)$/iu);
  return match ? match[1] : null;
}

/**
 * POST /v1/reports - Report content for moderation.
 */
export async function handleCreateReport(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  const contentType = body.contentType;
  if (!REPORT_CONTENT_TYPES.includes(contentType as ReportContentType)) {
    throw new AppError(
      'validation_error',
      `contentType must be one of ${REPORT_CONTENT_TYPES.join(', ')}`,
      400
    );
  }

  const contentId = assertUuid(body.contentId, 'contentId');
  const reason = normalizeShortText(body.reason, 'reason', 100);
  if (!reason) {
    throw new AppError('validation_error', 'reason is required', 400);
  }
  const description = normalizeShortText(body.description, 'description', 1000);
  const reportedProfileId =
    body.reportedProfileId === undefined || body.reportedProfileId === null
      ? null
      : assertUuid(body.reportedProfileId, 'reportedProfileId');

  const supabase = getServiceClient(config);
  const { data: row, error } = await supabase
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
    .select('id, content_type, content_id, reason, status, created_at')
    .single();

  if (error || !row) {
    throw mapWriteError(error, 'report_failed', 'Failed to submit report');
  }

  sendJsonSuccess(response, 201, context.requestId, {
    report: toReportDto(row as ReportRow),
  });
}

/**
 * GET /v1/me/blocks - List profiles the current user has blocked.
 */
export async function handleListBlocks(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, reason, created_at')
    .eq('blocker_id', authCtx.user.profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to load blocks', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    blocks: ((data ?? []) as BlockRow[]).map(toBlockDto),
  });
}

/**
 * POST /v1/me/blocks - Block a profile.
 */
export async function handleCreateBlock(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const blockedProfileId = assertUuid(body.blockedProfileId, 'blockedProfileId');

  if (blockedProfileId === authCtx.user.profileId.toLowerCase()) {
    throw new AppError('validation_error', 'You cannot block yourself', 400);
  }

  const reason = normalizeShortText(body.reason, 'reason', 200);
  const supabase = getServiceClient(config);

  const { data: row, error } = await supabase
    .from('blocks')
    .upsert(
      {
        blocker_id: authCtx.user.profileId,
        blocked_id: blockedProfileId,
        reason,
      },
      { onConflict: 'blocker_id,blocked_id' }
    )
    .select('blocked_id, reason, created_at')
    .single();

  if (error || !row) {
    throw mapWriteError(error, 'block_failed', 'Failed to block profile');
  }

  sendJsonSuccess(response, 201, context.requestId, {
    block: toBlockDto(row as BlockRow),
  });
}

/**
 * DELETE /v1/me/blocks/:profileId - Unblock a profile.
 */
export async function handleDeleteBlock(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  blockedProfileId: string
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const targetId = assertUuid(blockedProfileId, 'profileId');
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', authCtx.user.profileId)
    .eq('blocked_id', targetId)
    .select('blocked_id');

  if (error) {
    throw new AppError('unblock_failed', 'Failed to remove block', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    blockedProfileId: targetId,
    removed: Array.isArray(data) ? data.length > 0 : true,
  });
}
