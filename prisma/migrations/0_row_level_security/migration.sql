-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'CALLGENT');

-- CreateEnum
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
        current_setting('tenancy.tenantPk')::int
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
        current_setting('tenancy.tenantPk')::int
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
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(255) NOT NULL,
    "avatar" VARCHAR(1023),
    "summary" VARCHAR(4095),
    "favorite" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "forked" INTEGER NOT NULL DEFAULT 0,
    "forkedPk" BIGINT,
    "instruction" VARCHAR(4095),
    "liked" INTEGER NOT NULL DEFAULT 0,
    "mainTagId" INTEGER,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "viewed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Callgent_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Entry" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('tenancy.tenantPk')::int
    ),
    "name" VARCHAR(2047) NOT NULL DEFAULT '',
    "type" "EntryType" NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "summary" VARCHAR(4095),
    "instruction" VARCHAR(4095),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "host" VARCHAR(2047) NOT NULL,
    "initParams" JSON,
    "content" JSON,
    "securities" JSON[],
    "callgentId" VARCHAR(30) NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Entry_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('tenancy.tenantPk')::int
    ),
    "adaptorKey" VARCHAR(127) NOT NULL,
    "callgentId" VARCHAR(30) NOT NULL,
    "cacheKey" VARCHAR(511),
    "cacheTtl" INTEGER DEFAULT 0,
    "description" VARCHAR(4095),
    "entryId" VARCHAR(30),
    "isAsync" BOOLEAN NOT NULL,
    "method" VARCHAR(15) NOT NULL,
    "name" VARCHAR(1023) NOT NULL,
    "params" JSON,
    "path" VARCHAR(1000) NOT NULL,
    "rawJson" JSON NOT NULL,
    "responses" JSON,
    "securities" JSON[],
    "servers" JSON[],
    "summary" VARCHAR(2047),
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "CallgentRealm" (
    "pk" BIGSERIAL NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('tenancy.tenantPk')::int
    ),
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "CallgentRealm_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EventStore" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "srcId" VARCHAR(30) NOT NULL,
    "eventType" VARCHAR(30) NOT NULL,
    "dataType" VARCHAR(30) NOT NULL,
    "callback" VARCHAR(1023),
    "callbackType" "EventCallbackType" NOT NULL DEFAULT 'EVENT',
    "context" JSON,
    "statusCode" INTEGER NOT NULL DEFAULT 1,
    "message" VARCHAR(2047),
    "stopPropagation" BOOLEAN NOT NULL,
    "listenerId" VARCHAR(30),
    "funName" VARCHAR(255),
    "calledBy" VARCHAR(30),
    "paidBy" VARCHAR(30) NOT NULL,
    "taskId" VARCHAR(35) NOT NULL,
    "title" VARCHAR(144),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "EventStore_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EventListener" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (
        current_setting('tenancy.tenantPk')::int
    ),
    "srcId" VARCHAR(30) NOT NULL,
    "eventType" VARCHAR(30) NOT NULL,
    "dataType" VARCHAR(30) NOT NULL,
    "priority" INTEGER DEFAULT 0,
    "serviceType" "ServiceType" NOT NULL,
    "serviceName" VARCHAR(255) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "funName" VARCHAR(255) NOT NULL,
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "EventListener_pkey" PRIMARY KEY ("pk")
);

-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "UserIdentity" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Callgent" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Entry" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Endpoint" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CallgentRealm" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "EventListener" ENABLE ROW LEVEL SECURITY;

-- Force Row Level Security for table owners
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

ALTER TABLE "UserIdentity" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Callgent" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Entry" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Endpoint" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CallgentRealm" FORCE ROW LEVEL SECURITY;

ALTER TABLE "EventListener" FORCE ROW LEVEL SECURITY;

-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "User" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "UserIdentity" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "Callgent" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "Entry" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "Endpoint" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "CallgentRealm" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

CREATE POLICY tenant_isolation_policy ON "EventListener" USING (
    "tenantPk" = 0
    or "tenantPk" = COALESCE(
        NULLIF(
            current_setting('tenancy.tenantPk', TRUE),
            ''
        ),
        '0'
    )::int
);

-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "User" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "UserIdentity" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "Callgent" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "Entry" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "Endpoint" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "CallgentRealm" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "EventListener" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);