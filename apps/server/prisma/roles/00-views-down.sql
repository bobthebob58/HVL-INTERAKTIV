-- 00-views-down — drops the analytics views right before every `prisma migrate deploy`; ./02-grants.sql, run right
-- after the migration, builds them again.
--
-- Why: PostgreSQL refuses a migration that retypes or drops a column a view reads (SQLSTATE 0A000, 2BP01). The
--      development database and CI have no views, so such a migration would fail first in a production deployment
--      (D-109 amendment of 2026-11-05). The views hold no data, so dropping them loses nothing; analysts miss them only
--      while the deployment runs.
-- Spec: DATA-010
-- Invariants:
--   - Runs as `hvli_migrator` only (checked first), in the deployment's migrate step: `views-down`, then
--     `prisma migrate deploy`, then `grants`. On a new database ./01-roles.sql runs once before all three.
--   - Drops the views of schema `analytics` and nothing else: no table, no schema, no grant, and no object that
--     depends on a view (it fails instead). Idempotent: with no schema or no view there is nothing to do.
--   - Runs in one transaction (the runner sends it as one script), so it drops every view or none.
-- Collaborators: ./02-grants.sql, apps/server/src/infra/databaseRolesCli.ts (`views-down`), docs/ops/database-roles.md.
-- Tests: apps/server/test/db/databaseRolesDeploy.int.test.ts

DO $$
DECLARE
  views text;
BEGIN
  IF current_user <> 'hvli_migrator' THEN
    RAISE EXCEPTION '00-views-down.sql must run as hvli_migrator, not as %', current_user;
  END IF;
  SELECT string_agg(format('analytics.%I', c.relname), ', ') INTO views
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'analytics' AND c.relkind = 'v';
  -- WHY: one statement without CASCADE: views built on one another go together, and anything else that depends on
  -- them (which would be dropped with CASCADE) makes it fail instead.
  IF views IS NOT NULL THEN
    EXECUTE 'DROP VIEW ' || views;
  END IF;
END
$$;
