/*
  Warnings:

  - You are about to alter the column `prompt` on the `LlmCache` table. The data in that column could be lost. The data in that column will be cast from `VarChar(8192)` to `VarChar(8191)`.
  - You are about to alter the column `result` on the `LlmCache` table. The data in that column could be lost. The data in that column will be cast from `VarChar(8192)` to `VarChar(8191)`.
  - You are about to alter the column `prompt` on the `LlmTemplate` table. The data in that column could be lost. The data in that column will be cast from `VarChar(9191)` to `VarChar(8191)`.

*/
-- AlterTable
ALTER TABLE "LlmCache" ALTER COLUMN "prompt" SET DATA TYPE VARCHAR(8191),
ALTER COLUMN "result" SET DATA TYPE VARCHAR(8191);

-- AlterTable
ALTER TABLE "LlmTemplate" ALTER COLUMN "prompt" SET DATA TYPE VARCHAR(8191);
