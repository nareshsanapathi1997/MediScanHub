-- Create app databases if missing. Connect as a superuser to the postgres database.
SELECT 'CREATE DATABASE mediscan_hub OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mediscan_hub')\gexec

SELECT 'CREATE DATABASE mediscan_test OWNER postgres'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mediscan_test')\gexec
