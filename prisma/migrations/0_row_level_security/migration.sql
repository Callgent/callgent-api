-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'CALLGENT');

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

-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "UserIdentity" ENABLE ROW LEVEL SECURITY;

-- Force Row Level Security for table owners
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

ALTER TABLE "UserIdentity" FORCE ROW LEVEL SECURITY;

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

-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "User" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);

CREATE POLICY bypass_rls_policy ON "UserIdentity" USING (
    current_setting('tenancy.bypass_rls', TRUE)::text = 'on'
);
