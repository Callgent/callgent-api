/*
  Warnings:

  - You are about to drop the `CallgentFunction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CallgentFunction";

-- CreateTable
CREATE TABLE "Endpoint" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "name" VARCHAR(1023) NOT NULL,
    "path" VARCHAR(1000) NOT NULL,
    "method" VARCHAR(15) NOT NULL,
    "summary" VARCHAR(511) NOT NULL DEFAULT '',
    "description" VARCHAR(1023) NOT NULL DEFAULT '',
    "securities" JSON[],
    "params" JSON,
    "responses" JSON,
    "rawJson" JSON NOT NULL,
    "callgentId" VARCHAR(36) NOT NULL,
    "entryId" VARCHAR(36),
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_id_key" ON "Endpoint"("id");

-- CreateIndex
CREATE INDEX "Endpoint_tenantPk_idx" ON "Endpoint"("tenantPk");

-- CreateIndex
CREATE INDEX "Endpoint_callgentId_idx" ON "Endpoint"("callgentId");

-- CreateIndex
CREATE INDEX "Endpoint_entryId_idx" ON "Endpoint"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_callgentId_name_key" ON "Endpoint"("callgentId", "name");

-- Enable Row Level Security
ALTER TABLE "Endpoint" ENABLE ROW LEVEL SECURITY;
-- Force Row Level Security for table owners
ALTER TABLE "Endpoint" FORCE ROW LEVEL SECURITY;
-- Create row security policies
CREATE POLICY tenant_isolation_policy ON "Endpoint" USING ("tenantPk" = 0 or "tenantPk" = COALESCE(NULLIF(current_setting('tenancy.tenantPk', TRUE), ''), '0')::int);
-- Create policies to bypass RLS (optional)
CREATE POLICY bypass_rls_policy ON "Endpoint" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
