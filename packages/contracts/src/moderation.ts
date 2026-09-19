/**
 * Report and block contracts.
 *
 * Routes:
 * - POST   /v1/reports
 * - GET    /v1/me/blocks
 * - POST   /v1/me/blocks
 * - DELETE /v1/me/blocks/:profileId
 */

export type ReportContentType = 'profile' | 'situationship' | 'vote' | 'message';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface CreateReportRequestDto {
  contentType: ReportContentType;
  /** UUID of the reported object (profile id, situationship id, vote id, or message id). */
  contentId: string;
  /** Profile that owns the reported content, when known. */
  reportedProfileId?: string | null;
  /** Short machine-friendly reason such as "harassment", "spam", "underage", "other". */
  reason: string;
  description?: string | null;
}

export interface ReportDto {
  reportId: string;
  contentType: ReportContentType;
  contentId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface CreateReportResponseDto {
  data: {
    report: ReportDto;
  };
}

export interface BlockDto {
  blockedProfileId: string;
  reason: string | null;
  createdAt: string;
}

export interface ListBlocksResponseDto {
  data: {
    blocks: BlockDto[];
  };
}

export interface CreateBlockRequestDto {
  blockedProfileId: string;
  reason?: string | null;
}

export interface CreateBlockResponseDto {
  data: {
    block: BlockDto;
  };
}

export interface DeleteBlockResponseDto {
  data: {
    blockedProfileId: string;
    removed: boolean;
  };
}
