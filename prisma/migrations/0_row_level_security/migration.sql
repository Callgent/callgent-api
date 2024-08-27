-- CreateEnum
CREATE TYPE "EndpointType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'CALLGENT');

-- CreateEnum
CREATE TYPE "EventCallbackType" AS ENUM ('URL', 'EVENT');




-- CreateTable
CREATE TABLE "User" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255),
    "avatar" VARCHAR(1023),
    "locale" VARCHAR(10) DEFAULT 'en_US',
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "pk" SERIAL NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "provider" VARCHAR(36) NOT NULL,
    "uid" VARCHAR(255) NOT NULL,
    "credentials" VARCHAR(2048) NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "avatar" VARCHAR(1023),
    "info" JSONB,
    "userPk" INTEGER NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("pk")
);


-- CreateTable
CREATE TABLE "Callgent" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(255) NOT NULL,
    "summary" VARCHAR(4095),
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Callgent_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "CallgentFunction" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(255) NOT NULL,
    "funName" VARCHAR(255) NOT NULL,
    "params" VARCHAR(31)[],
    "documents" VARCHAR(4095) NOT NULL,
    "fullCode" VARCHAR(1023) NOT NULL,
    "content" JSON NOT NULL,
    "callgentId" VARCHAR(36) NOT NULL,
    "endpointId" VARCHAR(36),
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CallgentFunction_pkey" PRIMARY KEY ("pk")
);


-- CreateTable
CREATE TABLE "Endpoint" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "type" "EndpointType" NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "host" JSON NOT NULL,
    "initParams" JSON,
    "content" JSON,
    "callgentId" VARCHAR(36) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EndpointAuth" (
    "pk" SERIAL NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "endpointId" VARCHAR(36) NOT NULL,
    "userKey" VARCHAR(63),
    "credentials" JSON NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndpointAuth_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EventStore" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
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
    "listenerId" VARCHAR(36),
    "funName" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventStore_pkey" PRIMARY KEY ("pk")
);


-- CreateTable
CREATE TABLE "EventListener" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "srcId" VARCHAR(36) NOT NULL,
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

    CONSTRAINT "EventListener_pkey" PRIMARY KEY ("pk")
);

CREATE TABLE "Task" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "statusCode" INTEGER NOT NULL DEFAULT -1,
    "name" VARCHAR(64),
    "brief" VARCHAR(255),
    "content" JSONB,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "TaskAction" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "cepId" VARCHAR(36),
    "funName" VARCHAR(255),
    "cAdaptor" VARCHAR(36) NOT NULL,
    "callback" JSON,
    "progressive" VARCHAR(36),
    "returns" BOOLEAN NOT NULL DEFAULT false,
    "req" JSON NOT NULL,
    "res" JSON,
    "stage" INTEGER NOT NULL DEFAULT -1,
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "message" VARCHAR(255),
    "taskId" VARCHAR(36) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TaskAction_pkey" PRIMARY KEY ("pk")
);






-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallgentFunction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EndpointAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventListener" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAction" ENABLE ROW LEVEL SECURITY;

-- Force Row Level Security for table owners
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserIdentity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Callgent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CallgentFunction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Endpoint" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EndpointAuth" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EventListener" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Task" FORCE ROW LEVEL SECURITY;
ALTER TABLE "TaskAction" FORCE ROW LEVEL SECURITY;

-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "User" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "UserIdentity" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "Callgent" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "CallgentFunction" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "Endpoint" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "EndpointAuth" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "EventListener" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "Task" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));
CREATE POLICY tenant_isolation_policy ON "TaskAction" USING (("tenantPk" = 0) OR ("tenantPk" = current_setting('tenancy.tenantPk', TRUE)::int));

-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "User" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "UserIdentity" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "Callgent" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "CallgentFunction" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "Endpoint" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "EndpointAuth" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "EventListener" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "Task" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
CREATE POLICY bypass_rls_policy ON "TaskAction" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
