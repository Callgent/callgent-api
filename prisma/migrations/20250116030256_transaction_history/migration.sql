/*
  Warnings:

  - You are about to alter the column `amount` on the `TransactionHistory` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(30,0)`.
  - You are about to alter the column `balance` on the `UserBalance` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(30,0)`.

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
ALTER TABLE "TransactionHistory" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(30,0);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "UserBalance" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(30,0);

-- AlterTable
ALTER TABLE "UserIdentity" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);
