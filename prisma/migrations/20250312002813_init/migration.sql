/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[authType,provider,uid,deletedAt]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');

-- CreateEnum
CREATE TYPE "EventCallbackType" AS ENUM ('URL', 'EVENT');

-- CreateTable
CREATE TABLE "Tenant" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "emailHost" VARCHAR(30),
    "name" VARCHAR(50),
    "avatar" VARCHAR(1023),
    "type" INTEGER NOT NULL DEFAULT 1,
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "balance" DECIMAL(30,0) NOT NULL DEFAULT 0,
    "currency" VARCHAR(6) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "PublicMailHost" (
    "pk" SERIAL NOT NULL,
    "dotHost" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMailHost_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Tag" (
    "pk" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "avatar" VARCHAR(1023),
    "description" VARCHAR(1024) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Callgent" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
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
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Callgent_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "CallgentTag" (
    "pk" BIGSERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "callgentId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallgentTag_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Entry" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
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
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(1023) NOT NULL,
    "path" VARCHAR(1000) NOT NULL,
    "method" VARCHAR(15) NOT NULL,
    "summary" VARCHAR(2047),
    "description" VARCHAR(4095),
    "servers" JSON[],
    "securities" JSON[],
    "params" JSON,
    "responses" JSON,
    "rawJson" JSON NOT NULL,
    "callgentId" VARCHAR(30) NOT NULL,
    "entryId" VARCHAR(30),
    "isAsync" BOOLEAN NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "cacheKey" VARCHAR(511),
    "cacheTtl" INTEGER DEFAULT 0,
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "CallgentRealm" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
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
CREATE TABLE "AuthToken" (
    "pk" BIGSERIAL NOT NULL,
    "token" VARCHAR(30) NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "payload" JSONB NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "LlmTemplate" (
    "pk" BIGSERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "prompt" VARCHAR(8191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmTemplate_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "LlmCache" (
    "pk" BIGSERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "model" VARCHAR(127) NOT NULL,
    "prompt" VARCHAR(8191) NOT NULL,
    "result" VARCHAR(8191) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCache_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Req2ArgsRepo" (
    "pk" BIGSERIAL NOT NULL,
    "cepId" VARCHAR(30) NOT NULL,
    "sepId" VARCHAR(30) NOT NULL,
    "req2Args" VARCHAR(8192) NOT NULL,
    "createdBy" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Req2ArgsRepo_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EventListener" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "srcId" VARCHAR(30) NOT NULL,
    "eventType" VARCHAR(30) NOT NULL,
    "dataType" VARCHAR(30) NOT NULL,
    "priority" INTEGER DEFAULT 0,
    "serviceType" "ServiceType" NOT NULL,
    "serviceName" VARCHAR(255) NOT NULL,
    "funName" VARCHAR(255) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "createdBy" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "EventListener_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "EventStore" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "calledBy" VARCHAR(30),
    "paidBy" VARCHAR(30) NOT NULL,
    "title" VARCHAR(144),
    "srcId" VARCHAR(30) NOT NULL,
    "taskId" VARCHAR(35) NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "EventStore_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Cached" (
    "pk" BIGSERIAL NOT NULL,
    "sepId" VARCHAR(30) NOT NULL,
    "sourceId" VARCHAR(30) NOT NULL,
    "cacheKey" VARCHAR(511) NOT NULL,
    "response" JSON NOT NULL,
    "invokeKeys" VARCHAR(30)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cached_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "ModelPricing" (
    "pk" SERIAL NOT NULL,
    "model" VARCHAR(30) NOT NULL,
    "alias" VARCHAR(50),
    "provider" VARCHAR(50) NOT NULL DEFAULT '',
    "price" JSON NOT NULL,
    "currency" VARCHAR(6) NOT NULL DEFAULT 'USD',
    "method" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelPricing_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "pk" BIGSERIAL NOT NULL,
    "id" VARCHAR(30) NOT NULL,
    "txId" VARCHAR(150) NOT NULL,
    "refData" JSON,
    "type" VARCHAR(20) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(30,0) NOT NULL,
    "currency" VARCHAR(6) NOT NULL DEFAULT 'USD',
    "userId" VARCHAR(30) NOT NULL,
    "tenantPk_" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_emailHost_key" ON "Tenant"("emailHost");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMailHost_dotHost_key" ON "PublicMailHost"("dotHost");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_id_key" ON "Callgent"("id");

-- CreateIndex
CREATE INDEX "Callgent_tenantPk__idx" ON "Callgent"("tenantPk_");

-- CreateIndex
CREATE INDEX "Callgent_forkedPk_idx" ON "Callgent"("forkedPk");

-- CreateIndex
CREATE INDEX "Callgent_mainTagId_idx" ON "Callgent"("mainTagId");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_tenantPk__name_deletedAt_key" ON "Callgent"("tenantPk_", "name", "deletedAt");

-- CreateIndex
CREATE INDEX "Entry_tenantPk__idx" ON "Entry"("tenantPk_");

-- CreateIndex
CREATE INDEX "Endpoint_tenantPk__idx" ON "Endpoint"("tenantPk_");

-- CreateIndex
CREATE INDEX "CallgentTag_tagId_idx" ON "CallgentTag"("tagId");

-- CreateIndex
CREATE INDEX "CallgentTag_callgentId_idx" ON "CallgentTag"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentTag_callgentId_tagId_key" ON "CallgentTag"("callgentId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_id_key" ON "Entry"("id");

-- CreateIndex
CREATE INDEX "Entry_callgentId_idx" ON "Entry"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_id_key" ON "Endpoint"("id");

-- CreateIndex
CREATE INDEX "Endpoint_callgentId_idx" ON "Endpoint"("callgentId");

-- CreateIndex
CREATE INDEX "Endpoint_entryId_idx" ON "Endpoint"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_callgentId_name_deletedAt_key" ON "Endpoint"("callgentId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentRealm_id_key" ON "CallgentRealm"("id");

-- CreateIndex
CREATE INDEX "CallgentRealm_tenantPk__idx" ON "CallgentRealm"("tenantPk_");

-- CreateIndex
CREATE INDEX "CallgentRealm_callgentId_idx" ON "CallgentRealm"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentRealm_callgentId_realmKey_deletedAt_key" ON "CallgentRealm"("callgentId", "realmKey", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LlmTemplate_name_key" ON "LlmTemplate"("name");

-- CreateIndex
CREATE INDEX "LlmCache_prompt_idx" ON "LlmCache" USING HASH ("prompt");

-- CreateIndex
CREATE INDEX "LlmCache_model_name_idx" ON "LlmCache"("model", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Req2ArgsRepo_cepId_sepId_key" ON "Req2ArgsRepo"("cepId", "sepId");

-- CreateIndex
CREATE UNIQUE INDEX "EventListener_id_key" ON "EventListener"("id");

-- CreateIndex
CREATE INDEX "EventListener_srcId_idx" ON "EventListener"("srcId");

-- CreateIndex
CREATE UNIQUE INDEX "EventStore_id_key" ON "EventStore"("id");

-- CreateIndex
CREATE INDEX "EventStore_srcId_idx" ON "EventStore"("srcId");

-- CreateIndex
CREATE INDEX "EventStore_taskId_idx" ON "EventStore"("taskId");

-- CreateIndex
CREATE INDEX "EventStore_paidBy_idx" ON "EventStore"("paidBy");

-- CreateIndex
CREATE INDEX "EventStore_calledBy_idx" ON "EventStore"("calledBy");

-- CreateIndex
CREATE UNIQUE INDEX "Cached_sepId_cacheKey_key" ON "Cached"("sepId", "cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_model_provider_key" ON "ModelPricing"("model", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_key" ON "Transaction"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txId_key" ON "Transaction"("txId");

-- CreateIndex
CREATE INDEX "Transaction_tenantPk__idx" ON "Transaction"("tenantPk_");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_tenantPk_idx" ON "User"("tenantPk");

-- CreateIndex
CREATE INDEX "UserIdentity_userPk_idx" ON "UserIdentity"("userPk");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE INDEX "UserIdentity_tenantPk_idx" ON "UserIdentity"("tenantPk");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_authType_provider_uid_deletedAt_key" ON "UserIdentity"("authType", "provider", "uid", "deletedAt");
