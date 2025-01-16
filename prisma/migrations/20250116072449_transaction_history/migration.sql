-- AlterTable
ALTER TABLE "Callgent" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "CallgentRealm" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "Endpoint" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "Entry" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "EventListener" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "UserIdentity" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- CreateTable
CREATE TABLE "Task" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "statusCode" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(64),
    "brief" VARCHAR(255),
    "content" JSONB,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "TaskAction" (
    "pk" SERIAL NOT NULL,
    "id" VARCHAR(36) NOT NULL,
    "tenantPk" INTEGER NOT NULL DEFAULT (current_setting('tenancy.tenantPk')::int),
    "ceId" VARCHAR(36),
    "epName" VARCHAR(255),
    "cAdaptor" VARCHAR(36) NOT NULL,
    "callback" JSON,
    "progressive" VARCHAR(36),
    "returns" BOOLEAN NOT NULL DEFAULT false,
    "req" JSON NOT NULL,
    "res" JSON,
    "stage" INTEGER NOT NULL DEFAULT -1,
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "message" VARCHAR(255),
    "taskId" VARCHAR(36) NOT NULL,
    "createdBy" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TaskAction_pkey" PRIMARY KEY ("pk")
);

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
