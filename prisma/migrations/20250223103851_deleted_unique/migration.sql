/*
  Warnings:

  - A unique constraint covering the columns `[tenantPk,name,deletedAt]` on the table `Callgent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[callgentId,name,deletedAt]` on the table `Endpoint` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,uid,deletedAt]` on the table `UserIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Callgent_tenantPk_name_key";

-- DropIndex
DROP INDEX "Endpoint_callgentId_name_key";

-- DropIndex
DROP INDEX "UserIdentity_provider_uid_key";

-- CreateIndex
CREATE UNIQUE INDEX "Callgent_tenantPk_name_deletedAt_key" ON "Callgent"("tenantPk", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_callgentId_name_deletedAt_key" ON "Endpoint"("callgentId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_uid_deletedAt_key" ON "UserIdentity"("provider", "uid", "deletedAt");
