# Database Migrations

This directory is the production RDS PostgreSQL migration namespace.

The existing `supabase/migrations` directory remains schema history and transition support for the current route implementation. New production-oriented migrations should be added here instead of deepening Supabase-specific assumptions.

Current baseline:

- `001_platform_identity.sql`: platform users, app-user mapping, provider identities, sessions, OAuth state, email magic links, consent, and cross-app data-sharing grants.

Expected production use:

1. Provision RDS PostgreSQL.
2. Apply migrations in numeric order.
3. Point the API at RDS with `DATABASE_URL`.
4. Replace transition-era Supabase data/session access with repository access against this schema.
