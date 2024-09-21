/*
  Warnings:

  - You are about to drop the `EndpointAuth` table. If the table is not empty, all the data it contains will be lost.

*/

-- AlterTable
ALTER TABLE "CallgentFunction" ADD COLUMN     "securities" JSON[];

-- AlterTable
ALTER TABLE "Endpoint" ADD COLUMN     "securities" JSON[];

-- DropTable
DROP TABLE "EndpointAuth";

-- DropEnum
DROP TYPE "EndpointAuthType";

-- CreateTable
CREATE TABLE "CallgentRealm" (
    "pk" SERIAL NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "callgentId" VARCHAR(36) NOT NULL,
    "realmKey" VARCHAR(256) NOT NULL,
    "authType" VARCHAR(16) NOT NULL,
    "realm" VARCHAR(16) NOT NULL DEFAULT '',
    "scheme" JSON NOT NULL,
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
CREATE UNIQUE INDEX "CallgentRealm_callgentId_realmKey_key" ON "CallgentRealm"("callgentId", "realmKey");
-- CreateIndex
CREATE INDEX "CallgentRealm_tenantPk_idx" ON "CallgentRealm"("tenantPk");

-- Enable Row Level Security
ALTER TABLE "CallgentRealm" ENABLE ROW LEVEL SECURITY;
-- Force Row Level Security for table owners
ALTER TABLE "CallgentRealm" FORCE ROW LEVEL SECURITY;
-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "CallgentRealm" USING ("tenantPk" = COALESCE(NULLIF(current_setting('tenancy.tenantPk', TRUE), ''), '0')::int);
-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "CallgentRealm" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
