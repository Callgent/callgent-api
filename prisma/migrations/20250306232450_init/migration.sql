/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantPk,name,deletedAt]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `CallgentRealm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,realmKey,deletedAt]` on the table `CallgentRealm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `Endpoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,name,deletedAt]` on the table `Endpoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `Entry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `EventListener` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `EventStore` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[authType,provider,uid,deletedAt]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `CallgentRealm` table without a default value. This is not possible if the table is not empty.

*/
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
CREATE TABLE "CallgentTag" (
    "pk" BIGSERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "callgentId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallgentTag_pkey" PRIMARY KEY ("pk")
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
    "currency" VARCHAR(6) NOT NULL,
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
    "amount" DECIMAL(30,0) NOT NULL,
    "currency" VARCHAR(6) NOT NULL,
    "userId" VARCHAR(30) NOT NULL,
    "tenantPk" INTEGER NOT NULL,
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
CREATE INDEX "CallgentTag_tagId_idx" ON "CallgentTag"("tagId");

-- CreateIndex
CREATE INDEX "CallgentTag_callgentId_idx" ON "CallgentTag"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentTag_callgentId_tagId_key" ON "CallgentTag"("callgentId", "tagId");

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
CREATE UNIQUE INDEX "Cached_sepId_cacheKey_key" ON "Cached"("sepId", "cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_model_provider_key" ON "ModelPricing"("model", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_key" ON "Transaction"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txId_key" ON "Transaction"("txId");

-- CreateIndex
CREATE INDEX "Transaction_tenantPk_idx" ON "Transaction"("tenantPk");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_id_key" ON "Callgent"("id");

-- CreateIndex
CREATE INDEX "Callgent_tenantPk_idx" ON "Callgent"("tenantPk");

-- CreateIndex
CREATE INDEX "Callgent_forkedPk_idx" ON "Callgent"("forkedPk");

-- CreateIndex
CREATE INDEX "Callgent_mainTagId_idx" ON "Callgent"("mainTagId");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_tenantPk_name_deletedAt_key" ON "Callgent"("tenantPk", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentRealm_id_key" ON "CallgentRealm"("id");

-- CreateIndex
CREATE INDEX "CallgentRealm_callgentId_idx" ON "CallgentRealm"("callgentId");

-- CreateIndex
CREATE INDEX "CallgentRealm_tenantPk_idx" ON "CallgentRealm"("tenantPk");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentRealm_callgentId_realmKey_deletedAt_key" ON "CallgentRealm"("callgentId", "realmKey", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_id_key" ON "Endpoint"("id");

-- CreateIndex
CREATE INDEX "Endpoint_tenantPk_idx" ON "Endpoint"("tenantPk");

-- CreateIndex
CREATE INDEX "Endpoint_callgentId_idx" ON "Endpoint"("callgentId");

-- CreateIndex
CREATE INDEX "Endpoint_entryId_idx" ON "Endpoint"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_callgentId_name_deletedAt_key" ON "Endpoint"("callgentId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_id_key" ON "Entry"("id");

-- CreateIndex
CREATE INDEX "Entry_tenantPk_idx" ON "Entry"("tenantPk");

-- CreateIndex
CREATE INDEX "Entry_callgentId_idx" ON "Entry"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventListener_id_key" ON "EventListener"("id");

-- CreateIndex
CREATE INDEX "EventListener_srcId_idx" ON "EventListener"("srcId");

-- CreateIndex
CREATE INDEX "EventListener_tenantPk_idx" ON "EventListener"("tenantPk");

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
