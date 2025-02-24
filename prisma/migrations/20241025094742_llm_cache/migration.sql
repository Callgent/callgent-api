/*
  Warnings:

  - A unique constraint covering the columns `[prompt,model,name]` on the table `LlmCache` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `model` to the `LlmCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LlmCache_prompt_name_key";

-- AlterTable
ALTER TABLE "LlmCache" ADD COLUMN     "model" VARCHAR(127) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LlmCache_prompt_model_name_key" ON "LlmCache"("prompt", "model", "name");
