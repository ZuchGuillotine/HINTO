# HINTO API Scaffold

This directory contains the first backend scaffold for the restart architecture.

Current scope:

- versioned HTTP surface rooted at `/v1`
- environment/config loading
- structured JSON logging
- request ID assignment and propagation
- stable application error shape
- health route

Out of scope for this scaffold:

- full auth/session implementation
- business routes
- persistence wiring
- provider OAuth flows

## API Style

The scaffold assumes:

- explicit HTTP JSON endpoints
- OpenAPI-friendly request and response shapes
- business logic organized behind route handlers and services

This intentionally avoids:

- tRPC as the contract foundation
- direct reuse of Amplify GraphQL models
- client-specific branching

## Route Layout

- `GET /health`
- `GET /v1/health`
- `GET /v1`

Planned next business slice:

- `GET /v1/me`
- `PATCH /v1/me`
- situationship CRUD and reorder routes

## Environment Contract

Supported environment variables:

- `API_HOST`
- `API_PORT`
- `API_LOG_LEVEL`
- `API_NAME`
- `NODE_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Only `API_*` and `NODE_ENV` are used by the scaffold today. Supabase and AI keys are declared now so the config contract is visible before auth and business modules land.

## Error Envelope

Errors use a machine-readable JSON envelope:

```json
{
  "error": {
    "code": "internal_error",
    "message": "Unexpected server error",
    "requestId": "..."
  }
}
```

Successful health-style responses currently use:

```json
{
  "data": {
    "...": "..."
  },
  "meta": {
    "requestId": "..."
  }
}
```

## Logging

All logs are JSON and include:

- timestamp
- level
- service name
- request ID when available

## Local Use

Build:

```bash
npm run api:build
```

Run:

```bash
npm run api:start
```

Dev watch:

```bash
npm run api:watch
```
