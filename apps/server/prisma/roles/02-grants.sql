-- 02-grants — gives the app its rows and analytics its aggregate views (step 2 of 2, after every migration).
--
-- Why: DATA-010 asks for least privilege: the app reads and writes rows but never changes the schema, and analytics
--      reads aggregates only, never a learner's row (D-109 and its amendment of 2026-11-04). The migration role owns
--      the tables, so it grants on them; ./01-roles.sql made the roles.
-- Spec: DATA-010, DATA-007, INS-006
-- Invariants:
--   - Runs as `hvli_migrator` only (checked first): ALTER DEFAULT PRIVILEGES binds to the user that runs it.
--   - Runs right after `prisma migrate deploy`, in the same deployment step, which ./00-views-down.sql opened by
--     dropping the analytics views; idempotent, so every deployment runs it.
--   - The app: SELECT, INSERT, UPDATE, DELETE on every table in `public` (also later ones, by default privileges),
--     except Prisma's `_prisma_migrations` (nothing) and the audit tables (SELECT and INSERT only). Never TRUNCATE,
--     REFERENCES, TRIGGER, CREATE or TEMPORARY.
--   - Analytics: no USAGE on `public`; SELECT on the views of schema `analytics`, which show only rows stored after
--     k-suppression (InsightSnapshot, D-106, D-107). A new view needs an amendment to D-109.
-- Collaborators: ./01-roles.sql, ./00-views-down.sql, apps/server/src/infra/databaseRolesCli.ts (`grants`),
--   docs/ops/database-roles.md.
-- Tests: apps/server/test/db/databaseRoles.int.test.ts, apps/server/test/db/databaseRolesDeploy.int.test.ts

DO $$
BEGIN
  IF current_user <> 'hvli_migrator' THEN
    RAISE EXCEPTION '02-grants.sql must run as hvli_migrator, not as %', current_user;
  END IF;
END
$$;

-- The app: rows, never the schema.
GRANT USAGE ON SCHEMA public TO hvli_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hvli_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hvli_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hvli_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hvli_app;
-- WHY: the migration history is the migrator's; the app never reads or writes it.
REVOKE ALL ON TABLE public."_prisma_migrations" FROM hvli_app;
-- SECURITY: the audit trail is append-only for the app, so a flaw in the app cannot rewrite or erase it (DATA-007).
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."AuditEvent", public."AuthAuditEvent", public."LibraryAuditEvent"
  FROM hvli_app;

-- Analytics: aggregate views only.
CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
GRANT USAGE ON SCHEMA analytics TO hvli_analytics;

-- PRIVACY: InsightSnapshot rows are stored only after k-suppression (INS-006, D-106, D-107); the view adds the
-- activity's content type and names columns in snake_case for R and Python. No learnerKey, no raw statement.
CREATE OR REPLACE VIEW analytics.insight_snapshot AS
SELECT
  s."id" AS id,
  s."contentId" AS content_id,
  c."mainLibrary" AS content_type,
  s."contextId" AS context_id,
  s."contentVersion" AS content_version,
  s."periodStart" AS period_start,
  s."periodEnd" AS period_end,
  s."k" AS k,
  s."aggregates" AS aggregates,
  s."createdAt" AS created_at
FROM public."InsightSnapshot" s
JOIN public."H5PContent" c ON c."id" = s."contentId";

REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM PUBLIC;
GRANT SELECT ON analytics.insight_snapshot TO hvli_analytics;
