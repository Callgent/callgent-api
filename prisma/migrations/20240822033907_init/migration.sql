/*
  Warnings:

  - You are about to alter the column `host` on the `Endpoint` table. The data in that column could be lost. The data in that column will be cast from `Json` to `VarChar(2047)`.
  - A unique constraint covering the columns `[id]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantPk,name]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `CallgentFunction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,name]` on the table `CallgentFunction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `Endpoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[endpointId,userKey]` on the table `EndpointAuth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `EventListener` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `EventStore` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `TaskAction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,uid]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EndpointAuthType" AS ENUM ('NONE', 'APP', 'USER');

-- AlterTable
ALTER TABLE "Endpoint" ADD COLUMN     "name" VARCHAR(2047) NOT NULL DEFAULT '',
ALTER COLUMN "host" SET DATA TYPE VARCHAR(2047);

-- CreateTable
CREATE TABLE "Tenant" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "emailHost" VARCHAR(36),
    "name" VARCHAR(50),
    "avatar" VARCHAR(1023),
    "type" INTEGER NOT NULL DEFAULT 1,
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

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
CREATE TABLE "AuthToken" (
    "pk" SERIAL NOT NULL,
    "token" VARCHAR(36) NOT NULL,
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
    "pk" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "prompt" VARCHAR(4096) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmTemplate_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "LlmCache" (
    "pk" BIGSERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "prompt" VARCHAR(4096) NOT NULL,
    "result" VARCHAR(4096) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCache_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "PersistedAsync" (
    "pk" BIGSERIAL NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT -1,
    "service" VARCHAR(127) NOT NULL,
    "method" VARCHAR(127) NOT NULL,
    "parentPk" BIGINT,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PersistedAsync_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_emailHost_key" ON "Tenant"("emailHost");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMailHost_dotHost_key" ON "PublicMailHost"("dotHost");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LlmTemplate_name_key" ON "LlmTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LlmCache_prompt_name_key" ON "LlmCache"("prompt", "name");

-- CreateIndex
CREATE INDEX "PersistedAsync_parentPk_idx" ON "PersistedAsync"("parentPk");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_id_key" ON "Callgent"("id");

-- CreateIndex
CREATE INDEX "Callgent_tenantPk_idx" ON "Callgent"("tenantPk");

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_tenantPk_name_key" ON "Callgent"("tenantPk", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentFunction_id_key" ON "CallgentFunction"("id");

-- CreateIndex
CREATE INDEX "CallgentFunction_tenantPk_idx" ON "CallgentFunction"("tenantPk");

-- CreateIndex
CREATE INDEX "CallgentFunction_callgentId_idx" ON "CallgentFunction"("callgentId");

-- CreateIndex
CREATE INDEX "CallgentFunction_endpointId_idx" ON "CallgentFunction"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentFunction_callgentId_name_key" ON "CallgentFunction"("callgentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_id_key" ON "Endpoint"("id");

-- CreateIndex
CREATE INDEX "Endpoint_tenantPk_idx" ON "Endpoint"("tenantPk");

-- CreateIndex
CREATE INDEX "Endpoint_callgentId_idx" ON "Endpoint"("callgentId");

-- CreateIndex
CREATE INDEX "EndpointAuth_tenantPk_idx" ON "EndpointAuth"("tenantPk");

-- CreateIndex
CREATE INDEX "EndpointAuth_endpointId_idx" ON "EndpointAuth"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointAuth_endpointId_userKey_key" ON "EndpointAuth"("endpointId", "userKey");

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
CREATE INDEX "EventStore_targetId_idx" ON "EventStore"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_key" ON "Task"("id");

-- CreateIndex
CREATE INDEX "Task_tenantPk_idx" ON "Task"("tenantPk");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAction_id_key" ON "TaskAction"("id");

-- CreateIndex
CREATE INDEX "TaskAction_tenantPk_idx" ON "TaskAction"("tenantPk");

-- CreateIndex
CREATE INDEX "TaskAction_taskId_idx" ON "TaskAction"("taskId");

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
CREATE UNIQUE INDEX "UserIdentity_provider_uid_key" ON "UserIdentity"("provider", "uid");
