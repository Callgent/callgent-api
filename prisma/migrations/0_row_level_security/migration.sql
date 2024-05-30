-- CreateEnum
CREATE TYPE "EndpointType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'CALLGENT');

-- CreateEnum
CREATE TYPE "EventCallbackType" AS ENUM ('URL', 'EVENT');




-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255),
    "avatar" VARCHAR(1023),
    "locale" VARCHAR(10) DEFAULT 'en_US',
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "provider" VARCHAR(36) NOT NULL,
    "uid" VARCHAR(255) NOT NULL,
    "credentials" VARCHAR(2048) NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" VARCHAR(1023),
    "info" JSONB,
    "userId" INTEGER NOT NULL,
    "userUuid" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "Callgent" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "name" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(4095),
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Callgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallgentFunction" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "name" VARCHAR(255) NOT NULL,
    "funName" VARCHAR(255) NOT NULL,
    "params" VARCHAR(31)[],
    "documents" VARCHAR(4095) NOT NULL,
    "fullCode" VARCHAR(1023) NOT NULL,
    "content" JSON NOT NULL,
    "callgentUuid" VARCHAR(36) NOT NULL,
    "endpointUuid" VARCHAR(36),
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CallgentFunction_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "Endpoint" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "type" "EndpointType" NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "host" JSON NOT NULL,
    "initParams" JSON,
    "content" JSON,
    "callgentUuid" VARCHAR(36) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndpointAuth" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "endpointUuid" VARCHAR(36) NOT NULL,
    "userKey" VARCHAR(63),
    "credentials" JSON NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndpointAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventStore" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "srcId" VARCHAR(36) NOT NULL,
    "targetId" VARCHAR(36),
    "eventType" VARCHAR(36) NOT NULL,
    "dataType" VARCHAR(36) NOT NULL,
    "callback" VARCHAR(1023),
    "callbackType" "EventCallbackType" NOT NULL DEFAULT 'EVENT',
    "data" JSON,
    "context" JSON,
    "statusCode" INTEGER NOT NULL DEFAULT -1,
    "message" VARCHAR(255),
    "stopPropagation" BOOLEAN NOT NULL,
    "defaultPrevented" BOOLEAN NOT NULL,
    "listenerUuid" VARCHAR(36),
    "funName" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventStore_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "EventListener" (
    "id" SERIAL NOT NULL,
    "uuid" VARCHAR(36) NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantId')::int),
    "srcUuid" VARCHAR(36) NOT NULL,
    "eventType" VARCHAR(36) NOT NULL,
    "dataType" VARCHAR(36) NOT NULL,
    "priority" INTEGER DEFAULT 0,
    "serviceType" "ServiceType" NOT NULL,
    "serviceName" VARCHAR(255) NOT NULL,
    "funName" VARCHAR(255) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventListener_pkey" PRIMARY KEY ("id")
);






-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallgentFunction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EndpointAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventListener" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventStore" ENABLE ROW LEVEL SECURITY;

-- Force Row Level Security for table owners
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CallgentFunction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EndpointAuth" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EventListener" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EventStore" FORCE ROW LEVEL SECURITY;

-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "User" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "UserIdentity" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "Callgent" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "CallgentFunction" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "Endpoint" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "EndpointAuth" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "EventListener" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "EventStore" USING (("tenantId" = 0) OR ("tenantId" = current_setting('tenancy.tenantId', TRUE)::int));

-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "User" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "UserIdentity" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "Callgent" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "CallgentFunction" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "Endpoint" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "EndpointAuth" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "EventListener" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "EventStore" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
