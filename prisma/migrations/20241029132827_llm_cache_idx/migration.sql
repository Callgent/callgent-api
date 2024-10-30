-- DropIndex
DROP INDEX "LlmCache_prompt_model_name_key";

-- CreateIndex
CREATE INDEX "LlmCache_prompt_idx" ON "LlmCache" USING HASH ("prompt");

-- CreateIndex
CREATE INDEX "LlmCache_model_name_idx" ON "LlmCache"("model", "name");
