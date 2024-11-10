/*
  Warnings:

  - You are about to drop the column `preventDefault` on the `EventStore` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EventStore" DROP COLUMN "preventDefault";
