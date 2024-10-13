/*
  Warnings:

  - You are about to drop the column `defaultPrevented` on the `EventStore` table. All the data in the column will be lost.
  - You are about to drop the column `funName` on the `TaskAction` table. All the data in the column will be lost.
  - Added the required column `preventDefault` to the `EventStore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventStore" RENAME COLUMN "defaultPrevented" TO "preventDefault";

-- AlterTable
ALTER TABLE "TaskAction" RENAME COLUMN "funName" TO "epName";
