-- 01-roles — creates the three database roles and gives the migration role the schema (step 1 of 2).
--
-- Why: DATA-010 asks for separate roles for the app, for migrations and for read-only analytics, so a flaw in the
--      app cannot change the schema and an analyst cannot read a learner's rows (D-109 and its amendment of
--      2026-11-04). This file makes the roles; ./02-grants.sql, run by the migration role after every migration,
--      gives each role its privileges on the tables.
-- Spec: DATA-010
-- Invariants:
--   - Idempotent: a role that exists is kept and only its attributes are reset; run it again at any time.
--   - Holds no password. Set them afterwards with psql's `\password <role>` (sent hashed) or use certificates.
--   - Run once per database, connected to that database, as a superuser or as the database owner with CREATEROLE
--     (who then needs `GRANT hvli_migrator TO <you>` before the ALTER SCHEMA below).
--   - Runs in one transaction (the runner sends it as one script; psql: `--single-transaction`).
-- Collaborators: ./02-grants.sql, apps/server/src/infra/databaseRolesCli.ts (`roles`), docs/ops/database-roles.md.
-- Tests: apps/server/test/db/databaseRoles.int.test.ts

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hvli_migrator') THEN
    CREATE ROLE hvli_migrator;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hvli_app') THEN
    CREATE ROLE hvli_app;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hvli_analytics') THEN
    CREATE ROLE hvli_analytics;
  END IF;
END
$$;

-- SECURITY: none of the three may become anyone else or bypass a privilege (DATA-010).
ALTER ROLE hvli_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE hvli_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE hvli_analytics WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- WHY: a guard against mistakes, not a barrier (a session may turn it off); the barrier is ./02-grants.sql.
ALTER ROLE hvli_analytics SET default_transaction_read_only = on;

-- SECURITY: only the three roles reach this database; only the migrator may create a schema in it (`analytics`,
-- and Prisma's `CREATE SCHEMA IF NOT EXISTS`), and nobody may create temporary tables.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO hvli_migrator, hvli_app, hvli_analytics', current_database());
  EXECUTE format('GRANT CREATE ON DATABASE %I TO hvli_migrator', current_database());
END
$$;

-- WHY: the owner of `public` creates and changes its tables; the app and analytics get what ./02-grants.sql grants.
ALTER SCHEMA public OWNER TO hvli_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
