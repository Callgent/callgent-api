/*
  Warnings:

  - The `deletedAt` column on the `Callgent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `Endpoint` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `Entry` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `EventListener` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `EventStore` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `Tenant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `deletedAt` column on the `UserIdentity` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Endpoint" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EventListener" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EventStore" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "deletedAt",
ADD COLUMN     "deletedAt" INTEGER NOT NULL DEFAULT 0;
