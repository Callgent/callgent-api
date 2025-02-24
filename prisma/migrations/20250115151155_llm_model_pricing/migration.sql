-- CreateTable
CREATE TABLE "LlmModelPricing" (
    "id" SERIAL NOT NULL,
    "modelName" VARCHAR(150) NOT NULL,
    "price" JSON NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmModelPricing_modelName_key" ON "LlmModelPricing"("modelName");
