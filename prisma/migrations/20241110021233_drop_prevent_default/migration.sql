/*
Warnings:
- You are about to drop the column `preventDefault` on the `EventStore` table. All the data in the column will be lost.
*/
-- AlterTable
ALTER TABLE "EventStore" DROP COLUMN "preventDefault";

ALTER TABLE "Endpoint"
ADD COLUMN "isAsync" BOOLEAN NOT NULL,
ADD COLUMN "adaptorKey" VARCHAR(127) NOT NULL;