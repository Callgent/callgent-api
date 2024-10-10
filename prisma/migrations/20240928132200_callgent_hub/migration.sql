/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `CallgentRealm` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CallgentRealm" DROP COLUMN "deletedAt",
ALTER COLUMN "realm" SET DATA TYPE VARCHAR(36);
