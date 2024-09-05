/*
  Warnings:

  - You are about to drop the column `signature` on the `CallgentFunction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CallgentFunction" DROP COLUMN "signature",
ADD COLUMN     "params" JSON,
ADD COLUMN     "responses" JSON;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "statusCode" SET DEFAULT 1;
