/*
  Warnings:

  - Added the required column `paidBy` to the `EventStore` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventStore" ADD COLUMN     "calledBy" VARCHAR(36),
ADD COLUMN     "paidBy" VARCHAR(36) NOT NULL,
ADD COLUMN     "title" VARCHAR(144);
