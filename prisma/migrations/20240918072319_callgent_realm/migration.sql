/*
  Warnings:

  - You are about to drop the `EndpointAuth` table. If the table is not empty, all the data it contains will be lost.

*/

-- AlterTable
ALTER TABLE "CallgentFunction" ADD COLUMN     "securities" JSON;

-- AlterTable
ALTER TABLE "Endpoint" ADD COLUMN     "securities" JSON;

-- DropTable
DROP TABLE "EndpointAuth";

-- DropEnum
DROP TYPE "EndpointAuthType";

-- CreateTable
CREATE TABLE "CallgentRealm" (
    "pk" SERIAL NOT NULL,
    "callgentId" VARCHAR(36) NOT NULL,
    "authType" VARCHAR(16) NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "realm" VARCHAR(16) NOT NULL DEFAULT '',
    "scheme" JSON,
    "secret" JSON,
    "perUser" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CallgentRealm_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE INDEX "CallgentRealm_callgentId_idx" ON "CallgentRealm"("callgentId");
