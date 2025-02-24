/*
  Warnings:

  - You are about to drop the column `endpointId` on the `CallgentFunction` table. All the data in the column will be lost.
  - You are about to drop the column `cepId` on the `TaskAction` table. All the data in the column will be lost.
  - You are about to drop the `Endpoint` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('CLIENT', 'SERVER', 'EVENT');

-- DropIndex
DROP INDEX "CallgentFunction_endpointId_idx";

-- AlterTable
ALTER TABLE "CallgentFunction" DROP COLUMN "endpointId",
ADD COLUMN     "entryId" VARCHAR(36);

-- AlterTable
ALTER TABLE "TaskAction" DROP COLUMN "cepId",
ADD COLUMN     "ceId" VARCHAR(36);

-- DropTable
DROP TABLE "Endpoint";

-- DropEnum
DROP TYPE "EndpointType";

-- CreateTable
CREATE TABLE "Entry" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(2047) NOT NULL DEFAULT '',
    "type" "EntryType" NOT NULL,
    "adaptorKey" VARCHAR(127) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "host" VARCHAR(2047) NOT NULL,
    "initParams" JSON,
    "content" JSON,
    "securities" JSON[],
    "callgentId" VARCHAR(36) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entry_id_key" ON "Entry"("id");

-- CreateIndex
CREATE INDEX "Entry_tenantPk_idx" ON "Entry"("tenantPk");

-- CreateIndex
CREATE INDEX "Entry_callgentId_idx" ON "Entry"("callgentId");

-- CreateIndex
CREATE INDEX "CallgentFunction_entryId_idx" ON "CallgentFunction"("entryId");

-- Enable Row Level Security
ALTER TABLE "Entry" ENABLE ROW LEVEL SECURITY;
-- Force Row Level Security for table owners
ALTER TABLE "Entry" FORCE ROW LEVEL SECURITY;
-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "Entry" USING ("tenantPk" = 0 or "tenantPk" = COALESCE(NULLIF(current_setting('tenancy.tenantPk', TRUE), ''), '0')::int);
-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "Entry" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
