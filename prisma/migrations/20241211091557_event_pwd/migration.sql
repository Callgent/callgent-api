/*
  Warnings:

  - Added the required column `pwd` to the `EventStore` table without a default value. This is not possible if the table is not empty.
  - Made the column `taskId` on table `EventStore` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EventStore" ALTER COLUMN "taskId" SET NOT NULL;
