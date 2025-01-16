/*
  Warnings:

  - You are about to drop the column `currency` on the `TransactionHistory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TransactionHistory" DROP COLUMN "currency",
ADD COLUMN     "usage" JSON,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(30,0);

-- AlterTable
ALTER TABLE "UserBalance" ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(30,0);
