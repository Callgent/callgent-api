/*
  Warnings:

  - You are about to drop the column `currency` on the `TransactionHistory` table. All the data in the column will be lost.

*/
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
ALTER TABLE "TransactionHistory" DROP COLUMN "currency",
ADD COLUMN     "usage" JSON,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "UserBalance" ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "UserIdentity" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);
