import { COACH_SAFETY_RULES } from './safety.js';

export interface CoachSituationshipContext {
  name: string;
  emoji: string | null;
  category: string | null;
  description: string | null;
  rank: number;
}

export interface CoachVoteSummaryContext {
  situationshipName: string;
  bestVotes: number;
  worstVotes: number;
}

export interface CoachUserContext {
  displayName: string | null;
  age: number | null;
  situationships: CoachSituationshipContext[];
  recentVotes: CoachVoteSummaryContext[];
}

function sanitize(value: string | null | undefined, max = 200): string {
  if (!value) return '';
  return value
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Builds the system prompt. User-generated strings are sanitized and placed in
 * a clearly delimited data block so the model treats them as context, not commands.
 */
export function buildCoachSystemPrompt(context: CoachUserContext): string {
  const intro =
    'You are HINTO Coach, a warm, direct relationship coach for women deciding between romantic options. ' +
    'Your job is to help the user get clarity about what she wants, notice patterns, and choose her own next step.';

  const rules = COACH_SAFETY_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n');

  const list =
    context.situationships.length === 0
      ? '(the user has not added anyone yet)'
      : context.situationships
          .slice()
          .sort((a, b) => a.rank - b.rank)
          .map(item => {
            const label = [item.emoji ? sanitize(item.emoji, 10) : null, sanitize(item.name, 60)]
              .filter(Boolean)
              .join(' ');
            const meta = [
              item.category ? sanitize(item.category, 30) : null,
              item.description ? sanitize(item.description, 240) : null,
            ]
              .filter(Boolean)
              .join(' — ');
            return `- #${item.rank + 1} ${label}${meta ? `: ${meta}` : ''}`;
          })
          .join('\n');

  const votes =
    context.recentVotes.length === 0
      ? '(no votes yet)'
      : context.recentVotes
          .map(
            vote =>
              `- ${sanitize(vote.situationshipName, 60)}: ${vote.bestVotes} friend(s) picked as best fit, ${vote.worstVotes} picked as not the one`
          )
          .join('\n');

  const user = [
    context.displayName ? `Name: ${sanitize(context.displayName, 60)}` : null,
    context.age !== null ? `Age: ${context.age}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    intro,
    '',
    'Rules you must always follow:',
    rules,
    '',
    '<user_context>',
    user || '(no profile details)',
    '',
    'Ranked list (1 = top choice right now):',
    list,
    '',
    'Recent friend votes:',
    votes,
    '</user_context>',
  ].join('\n');
}
