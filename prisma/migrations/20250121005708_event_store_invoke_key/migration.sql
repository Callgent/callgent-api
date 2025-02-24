/*
  Warnings:

  - You are about to drop the column `eventIds` on the `Cached` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Cached" DROP COLUMN "eventIds",
ADD COLUMN     "invokeKeys" VARCHAR(36)[];
