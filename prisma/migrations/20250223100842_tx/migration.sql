/*
  Warnings:
*/
-- AlterTable
ALTER TABLE "AuthToken" ALTER COLUMN "token" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Cached" ALTER COLUMN "sepId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "sourceId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "invokeKeys" SET DATA TYPE VARCHAR(30)[];

-- AlterTable
ALTER TABLE "Callgent" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER COLUMN "callgentId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "realm" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "CallgentTag" ALTER COLUMN "callgentId" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Endpoint" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "callgentId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "entryId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Entry" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "callgentId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "EventListener" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "srcId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "eventType" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "dataType" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "EventStore" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "srcId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "eventType" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "dataType" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "listenerId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "taskId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "calledBy" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "paidBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Req2ArgsRepo" ALTER COLUMN "cepId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "sepId" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "createdBy" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "balance" DECIMAL(30,0) NOT NULL DEFAULT 0,
ADD COLUMN     "currency" VARCHAR(6) NOT NULL DEFAULT 'USD',
ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "emailHost" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(30),

-- AlterTable
ALTER COLUMN "provider" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(30);

-- DropTable
DROP TABLE "LlmModelPricing";

-- DropTable
DROP TABLE "TransactionHistory";

-- DropTable
DROP TABLE "UserBalance";

-- DropEnum
DROP TYPE "TransactionHistoryType";

-- CreateTable
CREATE TABLE "ModelPricing" (
    "pk" BIGSERIAL NOT NULL,
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
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelPricing_model_provider_key" ON "ModelPricing"("model", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_key" ON "Transaction"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txId_key" ON "Transaction"("txId");

-- CreateIndex
CREATE INDEX "Transaction_tenantPk_idx" ON "Transaction"("tenantPk");

-- CreateIndex
CREATE INDEX "EventStore_paidBy_idx" ON "EventStore"("paidBy");

-- CreateIndex
CREATE INDEX "EventStore_calledBy_idx" ON "EventStore"("calledBy");
