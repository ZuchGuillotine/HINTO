const HINTO_AI_MODEL = 'gpt-4o-mini';

const HINTO_COACH_SYSTEM_PROMPT = `You are HINTO-AI, a relationship-insight assistant for young women.
Your purpose is to deliver clear, actionable feedback that:

- promotes emotionally healthy, mutually respectful, and physically safe dating dynamics
- balances legitimate risk avoidance with the user's desire for genuine connection and growth
- upholds personal responsibility, healthy boundaries, equitable financial arrangements, and fulfilling intimacy
- never strays into professional therapy, medical, or legal advice

Tone: warm, supportive, direct, and never judgmental.
Length: 1 to 3 short paragraphs. Add concise next steps when useful.

Safety rules:
1. If the user indicates current intent to self-harm or suicide, immediately respond with one empathic sentence and direct them to call or text 988, the Suicide and Crisis Lifeline. End the answer.
2. If the user reports ongoing physical violence or credible threat, urge them to contact emergency services, for example 911, and to get to safety. End the answer.
3. Never give instructions that facilitate illegal, violent, or self-harm acts.
4. If unsure whether content violates policy, use the safest interpretation.`;

const USER_MESSAGE_PREAMBLE = `Instructions for HINTO-AI:
- Prioritize the user's explicit question.
- Where there is uncertainty, ask at most one clarifying question.
- Highlight concrete red flags such as control, manipulation, coercion, jealousy, unsafe sex, or financial abuse.
- Suggest practical next steps: what to observe, what to say, healthy boundary scripts, or resources.
- Balance caution with the possibility of positive outcomes.
- Keep advice inclusive and judgment-free.
- If relevant, remind the user that guidance is informational and not a substitute for licensed professional help.`;

const STYLE_GUIDE = `Style guide:
- Write in plain conversational English.
- Use contractions naturally.
- Keep bullets short enough to scan on a phone.
- Avoid therapy jargon unless the user introduces it.
- Cite sources only when the user asks for research or statistics.`;

const EMERGENCY_RESPONSES = {
  selfHarm:
    'I hear that you are going through something really difficult right now, and your safety matters. Please call or text 988, the Suicide and Crisis Lifeline, for immediate support from a trained counselor.',
  physicalViolence:
    'Your safety is the priority right now. If you are in immediate danger, call 911. If it is safe, get away from the person threatening or hurting you and contact the National Domestic Violence Hotline at 1-800-799-7233 for safety planning.',
  emergencyServices:
    'This sounds like a situation where you need immediate help from trained professionals. Please contact emergency services, such as 911, or a local crisis hotline now.',
};

const SELF_HARM_TRIGGERS = [
  'kill myself',
  'suicide',
  'end it all',
  'want to die',
  'better off dead',
  'hurt myself',
  'cut myself',
  'self harm',
  'self-harm',
  'ending my life',
  'end my life',
];

const PHYSICAL_VIOLENCE_TRIGGERS = [
  'he hit me',
  'she hit me',
  'they hit me',
  'physically hurt',
  'punched me',
  'slapped me',
  'choked me',
  'pushed me',
  'grabbed me',
  'threatened to hurt',
  'afraid he will hurt',
  'afraid she will hurt',
  'afraid they will hurt',
  'violent',
  'bruises',
  'black eye',
];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildDynamicContext(context = {}) {
  const lines = [];

  const displayName = cleanText(context.userDisplayName);
  if (displayName) {
    lines.push(`User display name: ${displayName}`);
  }

  const relationshipStatus = cleanText(context.relationshipStatus);
  if (relationshipStatus) {
    lines.push(`Relationship status: ${relationshipStatus}`);
  }

  const situationshipName = cleanText(context.situationshipName);
  if (situationshipName) {
    const emoji = cleanText(context.situationshipEmoji);
    lines.push(`Current situationship: ${situationshipName}${emoji ? ` ${emoji}` : ''}`);
  }

  const category = cleanText(context.situationshipCategory);
  if (category) {
    lines.push(`Category: ${category}`);
  }

  if (Number.isInteger(context.situationshipRank) && context.situationshipRank >= 0) {
    lines.push(`Current ranking: #${context.situationshipRank + 1} in the user's list`);
  }

  const description = cleanText(context.situationshipDescription);
  if (description) {
    lines.push(`User notes: "${description}"`);
  }

  const friendComments = cleanText(context.friendComments);
  if (friendComments) {
    lines.push(`Key friend feedback: """${friendComments}"""`);
  }

  return lines.join('\n');
}

function buildCoachMessages({ latestUserMessage, context = {}, history = [] }) {
  const latest = cleanText(latestUserMessage);
  const dynamicContext = buildDynamicContext(context);
  const userPrompt = `${dynamicContext ? `${dynamicContext}\n\n` : ''}${USER_MESSAGE_PREAMBLE}\n\nLatest user message: """${latest}"""`;

  return [
    {
      role: 'system',
      content: `${HINTO_COACH_SYSTEM_PROMPT}\n\n${STYLE_GUIDE}`,
    },
    ...history
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .map((message) => ({
        role: message.role,
        content: cleanText(message.content),
      }))
      .filter((message) => message.content.length > 0),
    {
      role: 'user',
      content: userPrompt,
    },
  ];
}

function moderateCoachInput(content) {
  const normalized = cleanText(content).toLowerCase();

  const selfHarmTrigger = SELF_HARM_TRIGGERS.find((trigger) => normalized.includes(trigger));
  if (selfHarmTrigger) {
    return {
      flagged: true,
      category: 'self_harm',
      reason: `matched_trigger:${selfHarmTrigger}`,
      emergencyResponse: EMERGENCY_RESPONSES.selfHarm,
    };
  }

  const physicalViolenceTrigger = PHYSICAL_VIOLENCE_TRIGGERS.find((trigger) =>
    normalized.includes(trigger),
  );
  if (physicalViolenceTrigger) {
    return {
      flagged: true,
      category: 'physical_violence',
      reason: `matched_trigger:${physicalViolenceTrigger}`,
      emergencyResponse: EMERGENCY_RESPONSES.physicalViolence,
    };
  }

  return {
    flagged: false,
    category: null,
    reason: null,
    emergencyResponse: null,
  };
}

function buildSituationshipContext(situationship, userProfile) {
  return {
    userDisplayName: userProfile?.displayName ?? userProfile?.name,
    situationshipName: situationship?.name,
    situationshipEmoji: situationship?.emoji,
    situationshipCategory: situationship?.category,
    situationshipDescription: situationship?.description ?? situationship?.notes,
    situationshipRank: situationship?.rankIndex ?? situationship?.rank,
    relationshipStatus: situationship?.category ?? 'situationship',
  };
}

function generateConversationStarters(context = {}) {
  const starters = [
    "What's been on your mind about this relationship lately?",
    'How are you feeling about where things stand right now?',
    'What would you like clarity on?',
  ];

  const name = cleanText(context.situationshipName);
  if (name) {
    starters.unshift(`Tell me what's going on with ${name}`, `How are things progressing with ${name}?`);
  }

  if (context.situationshipCategory === 'ex') {
    starters.push('Are you thinking about reconnecting or moving on?');
    starters.push("What's making this ex hard to let go of?");
  } else if (context.situationshipCategory === 'dating') {
    starters.push('Where do you see this relationship heading?');
    starters.push('What are you hoping will happen next?');
  }

  return starters.slice(0, 4);
}

module.exports = {
  HINTO_AI_MODEL,
  HINTO_COACH_SYSTEM_PROMPT,
  USER_MESSAGE_PREAMBLE,
  STYLE_GUIDE,
  EMERGENCY_RESPONSES,
  buildDynamicContext,
  buildCoachMessages,
  moderateCoachInput,
  buildSituationshipContext,
  generateConversationStarters,
};
