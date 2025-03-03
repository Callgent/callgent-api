-- to create a non-super user, to support multi-tenancy by rls
-- consist with db user/pass in .env.dev
CREATE USER callgent WITH PASSWORD 'cAllgent123';
ALTER ROLE callgent CREATEDB;
CREATE DATABASE callgent;
GRANT ALL PRIVILEGES ON DATABASE callgent TO callgent;
GRANT USAGE, CREATE ON SCHEMA public TO callgent;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO callgent;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO callgent;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO callgent;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO callgent;
