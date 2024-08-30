/*
  Warnings:

  - You are about to drop the column `content` on the `CallgentFunction` table. All the data in the column will be lost.
  - You are about to drop the column `documents` on the `CallgentFunction` table. All the data in the column will be lost.
  - You are about to drop the column `fullCode` on the `CallgentFunction` table. All the data in the column will be lost.
  - You are about to drop the column `funName` on the `CallgentFunction` table. All the data in the column will be lost.
  - You are about to drop the column `params` on the `CallgentFunction` table. All the data in the column will be lost.
  - Added the required column `method` to the `CallgentFunction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `CallgentFunction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signature` to the `CallgentFunction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Callgent" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "CallgentFunction" DROP COLUMN "content",
DROP COLUMN "documents",
DROP COLUMN "fullCode",
DROP COLUMN "funName",
DROP COLUMN "params",
ADD COLUMN     "method" VARCHAR(15) NOT NULL,
ADD COLUMN     "path" VARCHAR(1000) NOT NULL,
ADD COLUMN     "signature" JSON NOT NULL,
ADD COLUMN     "summary" VARCHAR(511) NOT NULL DEFAULT '',
ADD COLUMN     "summary" VARCHAR(1023) NOT NULL DEFAULT '',
ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(1023);

-- AlterTable
ALTER TABLE "Endpoint" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "EndpointAuth" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "EventListener" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "TaskAction" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);

-- AlterTable
ALTER TABLE "UserIdentity" ALTER COLUMN "tenantPk" SET DEFAULT (current_setting('tenancy.tenantPk')::int);
