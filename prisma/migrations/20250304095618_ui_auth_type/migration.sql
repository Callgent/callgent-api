/*
  Warnings:

  - A unique constraint covering the columns `[tenantPk,name,deletedAt]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,realmKey,deletedAt]` on the table `CallgentRealm` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,name,deletedAt]` on the table `Endpoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[authType,provider,uid,deletedAt]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authType` to the `UserIdentity` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CallgentRealm_callgentId_realmKey_key";

-- AlterTable
ALTER TABLE "CallgentRealm" ADD COLUMN     "deletedAt" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "pricing" JSON;

-- AlterTable
ALTER TABLE "UserIdentity" ADD COLUMN     "authType" VARCHAR(16) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_tenantPk_name_deletedAt_key" ON "Callgent"("tenantPk", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentRealm_callgentId_realmKey_deletedAt_key" ON "CallgentRealm"("callgentId", "realmKey", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_callgentId_name_deletedAt_key" ON "Endpoint"("callgentId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_authType_provider_uid_deletedAt_key" ON "UserIdentity"("authType", "provider", "uid", "deletedAt");
