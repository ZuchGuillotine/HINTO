export type CoachMessageRole = 'system' | 'user' | 'assistant';

export interface CoachMessage {
  role: CoachMessageRole;
  content: string;
}

export interface HintoCoachContext {
  userDisplayName?: string;
  relationshipStatus?: string;
  situationshipName?: string;
  situationshipEmoji?: string;
  situationshipCategory?: string;
  situationshipDescription?: string;
  situationshipRank?: number;
  friendComments?: string;
}

export interface CoachPromptInput {
  latestUserMessage: string;
  context?: HintoCoachContext;
  history?: Array<Pick<CoachMessage, 'role' | 'content'>>;
}

export interface CoachModerationResult {
  flagged: boolean;
  category: 'self_harm' | 'physical_violence' | null;
  reason: string | null;
  emergencyResponse: string | null;
}

export declare const HINTO_AI_MODEL: string;
export declare const HINTO_COACH_SYSTEM_PROMPT: string;
export declare const USER_MESSAGE_PREAMBLE: string;
export declare const STYLE_GUIDE: string;
export declare const EMERGENCY_RESPONSES: {
  selfHarm: string;
  physicalViolence: string;
  emergencyServices: string;
};

export declare function buildDynamicContext(context?: HintoCoachContext): string;
export declare function buildCoachMessages(input: CoachPromptInput): CoachMessage[];
export declare function moderateCoachInput(content: string): CoachModerationResult;
export declare function buildSituationshipContext(
  situationship: Record<string, unknown> | null | undefined,
  userProfile: Record<string, unknown> | null | undefined,
): HintoCoachContext;
export declare function generateConversationStarters(context?: HintoCoachContext): string[];
