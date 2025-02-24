/*
  Warnings:

  - You are about to drop the column `targetId` on the `EventStore` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EventStore_targetId_idx";

-- AlterTable
ALTER TABLE "Callgent" ADD COLUMN     "instruction" VARCHAR(4095);

-- AlterTable
ALTER TABLE "Endpoint" ALTER COLUMN "summary" DROP NOT NULL,
ALTER COLUMN "summary" DROP DEFAULT,
ALTER COLUMN "summary" SET DATA TYPE VARCHAR(2047),
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "description" SET DATA TYPE VARCHAR(4095);

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "instruction" VARCHAR(4095),
ADD COLUMN     "summary" VARCHAR(4095);

-- AlterTable
ALTER TABLE "EventStore" DROP COLUMN "targetId",
ADD COLUMN     "taskId" VARCHAR(36);

-- CreateIndex
CREATE INDEX "EventStore_taskId_idx" ON "EventStore"("taskId");
