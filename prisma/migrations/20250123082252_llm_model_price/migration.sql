/*
  Warnings:

  - The `type` column on the `TransactionHistory` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `pricingMethod` to the `LlmModelPricing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionHistoryType" AS ENUM ('PAYMENT', 'TOKEN');

-- AlterTable
ALTER TABLE "LlmModelPricing" ADD COLUMN     "pricingMethod" VARCHAR(150) NOT NULL;

-- AlterTable
ALTER TABLE "TransactionHistory" DROP COLUMN "type",
ADD COLUMN     "type" "TransactionHistoryType" NOT NULL DEFAULT 'PAYMENT';
