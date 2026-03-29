# AGENTS.md

## Project: HINTO
## Language: JavaScript/TypeScript
## Build: npm install
## Test: npx jest
## Lint: npm run lint

## Architecture
This repo is the canonical HINTO product repo during a restart and unification phase.

Current implementation still contains a legacy Expo/React Native app and AWS Amplify backend artifacts:
- App shell and product UI live under `apps/hnnt-app/src/`
- React Navigation setup lives under `apps/hnnt-app/src/navigation/`
- Business state is primarily in React context/hooks under `apps/hnnt-app/src/context/` and `apps/hnnt-app/src/hooks/`
- Legacy backend schema and infra live under `amplify/`
- Native iOS shell exists under `ios/` as reference material, not as the finished target architecture
- Product and restart direction lives in `docs/`, especially `docs/Restart_Unification_Plan.md`

Target direction is not “continue the old stack as-is.” The active plan is to salvage product logic and flows while moving toward:
- native iOS in Swift
- web app in JS
- a smaller HTTP API contract
- simpler auth and backend choices than the current Amplify/Cognito setup

Treat the current repo as a salvage-and-transition codebase. Preserve reusable product logic, domain vocabulary, prompts, flows, and selected UI ideas. Be skeptical of old infrastructure assumptions.

## Boundaries
- Do not widen the AWS Amplify/Cognito/AppSync footprint unless explicitly asked.
- Prefer documenting and isolating legacy infrastructure rather than deepening coupling to it.
- `amplify/` is legacy-heavy. Changes there should be rare and intentional.
- `ios/` is reference material for the restart, not proof that the current native architecture is complete.
- Product restart decisions should align with `docs/Restart_Unification_Plan.md`.
- When proposing new structure, favor the planned shape:
  `/apps/ios`, `/apps/web`, `/services/api`, `/packages/domain`, `/packages/contracts`, `/packages/prompts`, `/legacy`
- Avoid large repo-wide moves or deletions unless the task explicitly calls for migration work.
- Keep changes scoped. Do not mix product-direction rewrites with incidental refactors.

## Conventions
- Read the restart docs before making architecture-level decisions.
- Prefer small, reviewable changes over broad rewrites.
- Preserve useful domain language from the current schema and screens even when replacing platform scaffolding.
- When touching frontend code, follow existing local patterns inside `apps/hnnt-app/src/` unless the task is explicitly part of the restart migration.
- New tests should be added for non-trivial logic changes when practical.
- If a task depends on assumptions about future Swift/web/API structure that do not exist yet, document the assumption instead of silently inventing a full implementation.

## Known Issues
- The repo still reflects an older Expo + Amplify architecture that no longer matches the intended end state.
- Drag-and-drop/reanimated work has prior compatibility debt noted in project docs.
- Testing is not fully standardized in `package.json`; Jest exists in dependencies but is not wired as an npm script.
- Some docs describe historical implementation attempts rather than the intended forward path.

## Repo Intelligence
Graph at `.codegraph/graph.db`. Rebuild after major structural changes.

Before modifying code:
1. `codegraph where <symbol>` to locate definitions.
2. `codegraph context <symbol>` to inspect callers and related symbols.
3. `codegraph fn-impact <symbol>` to estimate blast radius.
