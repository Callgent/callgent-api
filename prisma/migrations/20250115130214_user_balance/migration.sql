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
ALTER TABLE "Task" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "TaskAction" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "UserBalance" ALTER COLUMN "userId" SET DATA TYPE VARCHAR(36);

-- AlterTable
ALTER TABLE "UserIdentity" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);
