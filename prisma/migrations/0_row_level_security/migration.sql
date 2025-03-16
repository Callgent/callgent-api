-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'CALLGENT');
CREATE TYPE "EventCallbackType" AS ENUM ('URL', 'EVENT');

-- CreateTable
CREATE TABLE "User" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "avatar" VARCHAR(1023),
    "locale" VARCHAR(10) DEFAULT 'en_US',
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('abac.tenantPk')::int
    ),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "User_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "pk" BIGSERIAL NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('abac.tenantPk')::int
    ),
    "provider" VARCHAR(30) NOT NULL,
    "authType" VARCHAR(16) NOT NULL,
    "uid" VARCHAR(255) NOT NULL,
    "credentials" VARCHAR(2048) NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" VARCHAR(1023),
    "info" JSONB,
    "userPk" INTEGER NOT NULL,
    "userId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("pk")
);


-- CreateTable
CREATE TABLE "Callgent" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('abac.tenantPk')::int),
    "name" VARCHAR(255) NOT NULL,
    "avatar" VARCHAR(1023),
    "summary" VARCHAR(4095),
    "instruction" VARCHAR(4095),
    "liked" INTEGER NOT NULL DEFAULT 0,
    "viewed" INTEGER NOT NULL DEFAULT 0,
    "forked" INTEGER NOT NULL DEFAULT 0,
    "favorite" INTEGER NOT NULL DEFAULT 0,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "forkedPk" BIGINT,
    "mainTagId" INTEGER,
    "createdBy" VARCHAR(30) NOT NULL DEFAULT (current_setting('abac.userId')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Callgent_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');
CREATE TABLE "Entry" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('abac.tenantPk')::int),
    "name" VARCHAR(2047) NOT NULL DEFAULT '',
    "summary" VARCHAR(4095),
    "instruction" VARCHAR(4095),
    "type" "EntryType" NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "host" VARCHAR(2047) NOT NULL,
    "initParams" JSON,
    "content" JSON,
    "securities" JSON[],
    "callgentId" VARCHAR(30) NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL DEFAULT (current_setting('abac.userId')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('abac.tenantPk')::int),
    "name" VARCHAR(1023) NOT NULL,
    "operationId" VARCHAR(1023) NOT NULL,
    "path" VARCHAR(1000) NOT NULL,
    "method" VARCHAR(15) NOT NULL,
    "summary" VARCHAR(2047),
    "description" VARCHAR(4095),
    "servers" JSON[],
    "securities" JSON[],
    "params" JSON,
    "responses" JSON,
    "rawJson" JSON,
    "callgentId" VARCHAR(30) NOT NULL,
    "entryId" VARCHAR(30) NOT NULL,
    "isAsync" BOOLEAN NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "cacheKey" VARCHAR(511),
    "cacheTtl" INTEGER DEFAULT 0,
    "createdBy" VARCHAR(30) NOT NULL DEFAULT (current_setting('abac.userId')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "CallgentRealm" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('abac.tenantPk')::int),
    "callgentId" VARCHAR(30) NOT NULL,
    "realmKey" VARCHAR(256) NOT NULL,
    "authType" VARCHAR(16) NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "realm" VARCHAR(30) DEFAULT '',
    "scheme" JSON NOT NULL,
    "secret" JSON,
    "perUser" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pricing" JSON,
    "createdBy" VARCHAR(30) NOT NULL DEFAULT (current_setting('abac.userId')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "CallgentRealm_pkey" PRIMARY KEY ("pk")
);

-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallgentRealm" ENABLE ROW LEVEL SECURITY;

-- Force Row Level Security
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Entry" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CallgentRealm" FORCE ROW LEVEL SECURITY;

-- Create row security policies

-- accessible only in same tenant
CREATE POLICY tenant_isolation_policy ON "User" USING (
    "tenantPk" = NULLIF(current_setting('abac.tenantPk', TRUE), '')::int
);
CREATE POLICY tenant_isolation_policy ON "UserIdentity" USING (
    "tenantPk" = NULLIF(current_setting('abac.tenantPk', TRUE), '')::int
);

-- readable by all
CREATE POLICY all_readable_policy ON "Callgent" FOR SELECT USING (true);
CREATE POLICY all_readable_policy ON "Entry" FOR SELECT USING (true);
CREATE POLICY all_readable_policy ON "Endpoint" FOR SELECT USING (true);
CREATE POLICY all_readable_policy ON "CallgentRealm" FOR SELECT USING (true);

-- writable by creator
CREATE POLICY creator_update_policy ON "Callgent" FOR ALL
  USING ("createdBy" = current_setting('abac.userId', TRUE));
CREATE POLICY creator_update_policy ON "Entry" FOR ALL
  USING ("createdBy" = current_setting('abac.userId', TRUE));
CREATE POLICY creator_update_policy ON "Endpoint" FOR ALL
  USING ("createdBy" = current_setting('abac.userId', TRUE));
CREATE POLICY creator_update_policy ON "CallgentRealm" FOR ALL
  USING ("createdBy" = current_setting('abac.userId', TRUE));

-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "User" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
CREATE POLICY bypass_rls_policy ON "UserIdentity" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
CREATE POLICY bypass_rls_policy ON "Callgent" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
CREATE POLICY bypass_rls_policy ON "Entry" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
CREATE POLICY bypass_rls_policy ON "Endpoint" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
CREATE POLICY bypass_rls_policy ON "CallgentRealm" USING (
    current_setting('abac.bypass_rls', TRUE) = 'on'
);
