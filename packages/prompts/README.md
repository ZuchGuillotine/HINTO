# HINTO Prompts

Vendor-neutral prompt text and safety rules for the AI relationship coach.

- `src/coach.ts` builds the system prompt from the user's context (situationships, recent vote results).
- `src/safety.ts` holds the hard rules the coach must follow and a lightweight pre-send classifier for crisis language.

The API imports this package directly (`services/api/src/routes/ai.ts`). Clients never see prompt text.

Evals: see `docs/Launch_Readiness_Audit.md` (LLM Testing And Evals Required). Fixture conversations and a Jest harness should live under `packages/prompts/evals/` once a model key is available.
