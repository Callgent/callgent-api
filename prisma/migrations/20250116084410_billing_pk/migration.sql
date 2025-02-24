/*
  Warnings:

  - The primary key for the `LlmModelPricing` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `LlmModelPricing` table. All the data in the column will be lost.
  - The primary key for the `Tag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Tag` table. All the data in the column will be lost.
  - The primary key for the `TransactionHistory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `TransactionHistory` table. All the data in the column will be lost.
  - The primary key for the `UserBalance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserBalance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LlmModelPricing" DROP CONSTRAINT "LlmModelPricing_pkey",
DROP COLUMN "id",
ADD COLUMN     "pk" BIGSERIAL NOT NULL,
ADD CONSTRAINT "LlmModelPricing_pkey" PRIMARY KEY ("pk");

-- AlterTable
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_pkey",
DROP COLUMN "id",
ADD COLUMN     "pk" SERIAL NOT NULL,
ADD CONSTRAINT "Tag_pkey" PRIMARY KEY ("pk");

-- AlterTable
ALTER TABLE "TransactionHistory" DROP CONSTRAINT "TransactionHistory_pkey",
DROP COLUMN "id",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "pk" BIGSERIAL NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userBalanceId" SET DATA TYPE BIGINT,
ADD CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("pk");

-- AlterTable
ALTER TABLE "UserBalance" DROP CONSTRAINT "UserBalance_pkey",
DROP COLUMN "id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "pk" BIGSERIAL NOT NULL,
ADD CONSTRAINT "UserBalance_pkey" PRIMARY KEY ("pk");
