import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { readJsonBody } from '../body.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import {
  createProfileAvatarMedia,
  createSituationshipImageMedia,
  MediaAssetRow,
} from '../repositories/postgres-core.js';
import { toSituationshipDto } from './situationships.js';
import { fetchMeAggregateForProfileId } from './profile.js';
import { AppConfig, RequestContext } from '../types.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const LOCAL_MEDIA_ROOT = resolve(process.cwd(), '.hinto-media');

export type UploadTarget = 'profile_avatar' | 'situationship_image' | 'feed_submission_image';

export interface StoredMedia {
  storageProvider: 's3' | 'local';
  storageBucket: string | null;
  storageKey: string;
  publicUrl: string;
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
  case 'image/jpeg':
    return 'jpg';
  case 'image/png':
    return 'png';
  case 'image/webp':
    return 'webp';
  default:
    throw new AppError(
      'validation_error',
      'contentType must be image/jpeg, image/png, or image/webp',
      400,
    );
  }
}

export function parseUploadBody(body: Record<string, unknown>): {
  contentType: string;
  buffer: Buffer;
} {
  const contentType =
    typeof body.contentType === 'string' ? body.contentType.toLowerCase().trim() : '';
  extensionForContentType(contentType);

  if (typeof body.dataBase64 !== 'string' || body.dataBase64.length === 0) {
    throw new AppError('validation_error', 'dataBase64 is required', 400);
  }

  const buffer = Buffer.from(body.dataBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new AppError(
      'validation_error',
      `Image must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
      400,
    );
  }

  return { contentType, buffer };
}

export function mediaKey(
  target: UploadTarget,
  profileId: string,
  targetId: string | null,
  contentType: string,
): string {
  const ext = extensionForContentType(contentType);
  if (target === 'profile_avatar') {
    return `profiles/${profileId}/avatar/${randomUUID()}.${ext}`;
  }

  if (target === 'situationship_image') {
    return `situationships/${profileId}/${targetId}/${randomUUID()}.${ext}`;
  }

  return `feed-submissions/${profileId}/${targetId}/${randomUUID()}.${ext}`;
}

function localPublicUrl(request: IncomingMessage, key: string): string {
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  const host = request.headers.host;
  if (!host) {
    throw new AppError('invalid_request', 'Missing request host', 400);
  }
  return `${protocol}://${host}/media-local/${key}`;
}

function cloudfrontPublicUrl(config: AppConfig, key: string): string | null {
  if (!config.cloudfrontMediaDomain) {
    return null;
  }
  return `https://${config.cloudfrontMediaDomain.replace(/^https?:\/\//u, '')}/${key}`;
}

export async function storeMedia(
  request: IncomingMessage,
  config: AppConfig,
  key: string,
  contentType: string,
  buffer: Buffer,
): Promise<StoredMedia> {
  if (config.s3MediaBucket) {
    const client = new S3Client({ region: config.awsRegion ?? 'us-west-2' });
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3MediaBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      storageProvider: 's3',
      storageBucket: config.s3MediaBucket,
      storageKey: key,
      publicUrl:
        cloudfrontPublicUrl(config, key) ??
        `https://${config.s3MediaBucket}.s3.${config.awsRegion ?? 'us-west-2'}.amazonaws.com/${key}`,
    };
  }

  const filePath = resolve(LOCAL_MEDIA_ROOT, key);
  if (!filePath.startsWith(LOCAL_MEDIA_ROOT)) {
    throw new AppError('validation_error', 'Invalid media key', 400);
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);

  return {
    storageProvider: 'local',
    storageBucket: null,
    storageKey: key,
    publicUrl: localPublicUrl(request, key),
  };
}

export function toMediaDto(media: MediaAssetRow) {
  return {
    mediaId: media.id,
    url: media.public_url,
    contentType: media.content_type,
    byteSize: media.byte_size,
    createdAt: media.created_at,
  };
}

export async function handleUploadProfileAvatar(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const { contentType, buffer } = parseUploadBody(body);
  const key = mediaKey('profile_avatar', authCtx.user.profileId, null, contentType);
  const stored = await storeMedia(request, config, key, contentType, buffer);

  const { media } = await createProfileAvatarMedia(config, {
    ownerProfileId: authCtx.user.profileId,
    storageProvider: stored.storageProvider,
    storageBucket: stored.storageBucket,
    storageKey: stored.storageKey,
    publicUrl: stored.publicUrl,
    contentType,
    byteSize: buffer.length,
  });
  const me = await fetchMeAggregateForProfileId(
    authCtx.user.profileId,
    authCtx.user.authUserId,
    config,
  );

  sendJsonSuccess(response, 201, context.requestId, {
    media: toMediaDto(media),
    me,
  });
}

export async function handleUploadSituationshipImage(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  situationshipId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const { contentType, buffer } = parseUploadBody(body);
  const key = mediaKey(
    'situationship_image',
    authCtx.user.profileId,
    situationshipId,
    contentType,
  );
  const stored = await storeMedia(request, config, key, contentType, buffer);

  const { media, situationship } = await createSituationshipImageMedia(config, {
    ownerProfileId: authCtx.user.profileId,
    situationshipId,
    storageProvider: stored.storageProvider,
    storageBucket: stored.storageBucket,
    storageKey: stored.storageKey,
    publicUrl: stored.publicUrl,
    contentType,
    byteSize: buffer.length,
  });

  sendJsonSuccess(response, 201, context.requestId, {
    media: toMediaDto(media),
    situationship: toSituationshipDto(situationship),
  });
}

export async function handleLocalMedia(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const rawKey = decodeURIComponent(url.pathname.replace(/^\/media-local\//u, ''));
  const safeKey = normalize(rawKey).replace(/^(\.\.(\/|\\|$))+/u, '');
  const filePath = resolve(LOCAL_MEDIA_ROOT, safeKey);
  if (!filePath.startsWith(LOCAL_MEDIA_ROOT)) {
    throw new AppError('not_found', 'Media not found', 404);
  }

  const ext = extname(filePath).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
        'image/jpeg';

  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) {
        response.statusCode = 404;
      }
      response.end();
    })
    .pipe(response);
}
