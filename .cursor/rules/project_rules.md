Project Rules for **HNNT (He's Not Not Taken / He Is Not The One)**
*Last updated: 2025-05-12*

---

## Overview

HNNT is a **React + TypeScript web/mobile application** that helps young women navigate modern dating via group-chat-style "is-he-into-me?" discussions, social voting, and AI-powered coaching.
Key technologies & conventions:

| Layer                       | Tech / Library                                    | Notes                                              |
| --------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| **Framework**               | React 18 + Vite                                   | SPA & PWA builds; React Native may follow          |
| **Language**                | TypeScript 5.x                                    | `strict` mode on                                   |
| **Routing**                 | React Router DOM v6                               | File-based routes in `src/pages`                   |
| **State**                   | Zustand for global, React Context for transient   | No Redux                                           |
| **Data Fetching & Caching** | TanStack Query                                    | Automatic re-tries & optimistic updates            |
| **Styling / UI**            | Tailwind CSS 3 + shadcn/ui + Lucide icons         | Design tokens in `/src/styles`                     |
| **Backend**                 | Node.js 20 + Express + Prisma ORM                 | PostgreSQL / Supabase; REST today, GraphQL planned |
| **Auth**                    | Supabase Auth (JWT)                               | OAuth (Apple, Google), magic-link                  |
| **Validation**              | Zod everywhere (API, forms, hooks)                |                                                    |
| **Testing**                 | Vitest + React-Testing-Library, Cypress e2e       | 90 % coverage target                               |
| **Lint / Format**           | ESLint (Airbnb + Tailwind plugin) & Prettier      | Enforced via Husky pre-commit                      |
| **AI Agent Integration**    | OpenAI functions, prompt cascade defined in `/ai` | Use streaming chat endpoints                       |

These rules keep human and AI collaborators in-sync with HNNT's conventions, architecture, and roadmap.

---

## Core Principles

1. **Consistency** — follow the patterns codified in this file and in `/docs/technical.md`.
2. **Context Awareness** — always inspect `@docs/architecture.md`, `@docs/status.md`, and relevant code before generating changes.
3. **Minimal Disruption** — prefer additive PRs; refactor only with compelling reason & tests.
4. **Clarity** — when suggesting code, include concise rationale and concrete examples.
5. **Validation** — run linter, unit tests, and type-checks before marking a task complete.

---

## Project Context (SYSTEM_CONTEXT)

```txt
You are a senior full-stack developer on **HNNT**.  
Before generating or modifying code you MUST:

1. Parse @docs/architecture.md to understand module boundaries, data-flow, and shared types.
2. Check @tasks/tasks.md for current sprint items and acceptance criteria.
3. Validate proposals against @docs/technical.md (lint rules, naming scheme, design tokens).
4. Update @docs/status.md with progress, blockers, and test coverage after work is complete.
5. Never leak PII or secrets; follow HIPAA-adjacent privacy guidance for any user-generated content.
```

---

## Required Startup Files

* `@docs/architecture.md`
* `@docs/technical.md`
* `@docs/status.md`
* `@tasks/tasks.md`

---

## Canonical File Structure

```
src/
  api/          # API service functions (TanStack Query wrappers)
  components/   # Reusable UI (PascalCase directories)
  hooks/        # Custom React hooks
  pages/        # Route-level components
  styles/       # Tailwind config, design tokens, global.css
  utils/        # Helpers (dates, validators, formatters)
  ai/           # Prompt templates, function schemas
tests/          # Unit & integration tests mirroring src/
e2e/            # Cypress specs
docs/
  architecture.md
  technical.md
  status.md
tasks/
  tasks.md
.cursor/
  rules/        # This file + granular rule YAMLs if needed
```

---

## Cursor Rule Definitions

Below are the rule blocks read by Cursor's agent.
(If you split these into individual YAML files under `.cursor/rules/`, preserve names.)

### 1. Coding Standards

```yaml
name: coding_standards
description: Enforce HNNT coding conventions
filters:
  - type: file_extension
    pattern: "\\.(ts|tsx|js|jsx)$"
actions:
  - type: enforce
    message: |
      HNNT coding standards:
      • Naming – camelCase for vars & functions, PascalCase for React components, kebab-case for file names.
      • Components – Prefer functional components with hooks; no class components.
      • Imports – Absolute paths via `@/` alias (configured in tsconfig & vite).
      • Types – Always type inputs & outputs; never use `any` outside generated code.
      • Hooks – Prefix with `use`; keep pure, single-responsibility.
      • Error Handling – try/catch around async; surface QA-friendly messages with Zod-parsed errors.
      • Lint & Format – ESLint (Airbnb + Tailwind) & Prettier must pass.
      • Tests – Unit tests for all exported functions/components; snapshot major UI.
```

### 2. File Management

```yaml
name: file_management
description: Enforce directory placement & naming
filters:
  - type: event
    pattern: "file_create|file_update"
actions:
  - type: reject
    conditions:
      - pattern: "^(?!.*(src/|tests/|e2e/|docs/|tasks/)).*\\.(ts|tsx|js|jsx)$"
    message: "Place source files under src/, tests/, e2e/, or docs/."
  - type: suggest
    message: |
      Placement checklist:
      • UI component → src/components/
      • Page route → src/pages/
      • Reusable hook → src/hooks/
      • API/TanStack Query wrapper → src/api/
      • Utility function → src/utils/
```

### 3. Error Handling

```yaml
name: error_handling
description: Robust async error strategy
filters:
  - type: content
    pattern: "(async|await)"
actions:
  - type: enforce
    message: |
      Async guidelines:
      • Wrap awaits in try/catch.
      • Use `Result<T, E>` (fp-ts) or throw typed errors; never swallow.
      • Log to Supabase Edge Functions (prod) or console (dev).
      • Return user-friendly error strings from API hooks; map to toasts/snackbars centrally.
```

### 4. Task Workflow

```yaml
name: task_workflow
description: Structured task execution
filters:
  - type: event
    pattern: "task_start"
actions:
  - type: enforce
    message: |
      Workflow:
      1. Read tasks.md entry – note dependencies & acceptance criteria.
      2. Sketch tests first (Vitest) under tests/ mirroring src path.
      3. Implement code; keep PR < 400 LOC where possible.
      4. Run `pnpm test && pnpm lint && pnpm typecheck`.
      5. Update docs/status.md with coverage %, notes, blockers.
```

### 5. Database Access

```yaml
name: database_access
description: Secure DB interaction via Prisma
filters:
  - type: content
    pattern: "(SELECT|INSERT|UPDATE|DELETE|prisma\\.)"
actions:
  - type: enforce
    message: |
      Use Prisma Client only.
      • No raw SQL unless in src/utils/db.raw.ts with parameterized safety.
      • Paginate large lists; never return more than 100 records per request.
      • All Prisma calls live in src/api/ or server-side functions; not in components.
```

### 6. Security Standards

```yaml
name: security_standards
description: Secure auth & data practices
filters:
  - type: content
    pattern: "(auth|login|password|token|jwt)"
actions:
  - type: enforce
    message: |
      Security checklist:
      • JWT secret in env; never commit `.env`.
      • Use Supabase row-level security; verify in serverless functions.
      • Sanitize all form inputs with Zod; escape HTML in user-generated content.
      • Set CSP, X-Frame-Options, and secure cookies in Express.
```

### 7. Verification Steps

```yaml
name: verification_steps
description: Pre-commit & CI gates
filters:
  - type: event
    pattern: "code_generate|code_update"
actions:
  - type: enforce
    message: |
      Before finalizing:
      1. `pnpm lint --fix`
      2. `pnpm typecheck`
      3. `pnpm test --run`
      4. For UI changes run `pnpm cypress run --component`
      5. Confirm docs/status.md reflects new coverage & storybook updates.
```

### 8. Deprecated Patterns

```yaml
name: deprecated_patterns
description: Block outdated styles
filters:
  - type: content
    pattern: ".*"
actions:
  - type: reject
    message: |
      Deprecated – do NOT use:
      • React class components
      • Deprecated React lifecycle methods
      • Global `moment.js` (use dayjs)
      • Raw SQL strings outside prisma.$queryRaw
      • Any usage of `any` or `// @ts-ignore` without explanation
```

### 9. Agent Mode Instructions

```yaml
name: agent_mode
description: Constraints for autonomous agents
filters:
  - type: event
    pattern: "agent_mode"
actions:
  - type: enforce
    message: |
      In agent_mode:
      • Work on tasks listed as `@tasks/in-progress`.
      • Reference docs/architecture.md on every reasoning step.
      • Log actions and file deltas to docs/status.md under "Agent Log".
      • Touch only files matching task glob patterns.
      • Mark task complete → await human approval before merging.
```

---

## Additional Recommendations

* **Design Language** — follow the Figma design kit; border-radius `rounded-2xl`, shadow `shadow-md`, spacing multiples of 4 px.
* **Accessibility** — all interactive elements need `aria-label`s; color contrast AA+.
* **Performance Budgets** — LCP < 2.5 s on mid-range Android; bundle ≤ 250 kB per route.
* **LLM Costs** — all agent prompts live in `/ai/prompts`; token budget annotated in comments.

## Amplify Configuration Management

To prevent parameter drift and deployment issues:

1. **Naming Consistency**
   * Use consistent resource naming across all Amplify files (e.g., `HINTO` vs `HITNO`)
   * Document resource naming convention in `docs/technical.md`
   * Never manually edit `amplify/backend/*/build/` files

2. **Parameter Validation**
   * Run `amplify status` before pushes to detect drift
   * Keep `team-provider-info.json` in version control
   * Document all custom parameters in `docs/amplify-params.md`

3. **Deployment Checklist**
   * Verify `backend-config.json` matches `parameters.json`
   * Check auth triggers and dependencies are consistent
   * Run `amplify validate` before pushing changes

4. **Common Pitfalls**
   * Avoid manual edits to build artifacts
   * Don't mix CLI and console changes
   * Keep environment variables in sync with Amplify params

---

**End of HNNT .cursor/rules file**
