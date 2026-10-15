-- LOCAL DEVELOPMENT ONLY.
-- Creates least-privilege roles used by the app. Do not run this file in production
-- with these passwords. Production role setup is documented in docs/deploy.md.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mediscan_app') THEN
    CREATE ROLE mediscan_app LOGIN PASSWORD 'mediscan_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mediscan_admin') THEN
    CREATE ROLE mediscan_admin LOGIN PASSWORD 'mediscan_admin_dev' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
