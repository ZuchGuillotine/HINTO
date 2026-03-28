# HINTO Contracts

This package defines request and response contracts for the restart-era API.

Current scope is intentionally narrow:

- `GET /v1/me`
- `PATCH /v1/me`
- `GET /v1/me/situationships`
- situationship create/update/delete/reorder primitives

These contracts are:

- vendor-neutral
- JSON and OpenAPI friendly
- aligned to the first backend slice only

Out of scope for this package right now:

- generated clients
- voting session contracts
- AI contracts
- provider OAuth contracts
