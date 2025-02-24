-- AlterTable
ALTER TABLE "Endpoint"
ADD COLUMN "cacheKey" VARCHAR(511),
ADD COLUMN "cacheTtl" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "Cached" (
    "pk" BIGSERIAL NOT NULL,
    "sepId" VARCHAR(36) NOT NULL,
    "sourceId" VARCHAR(36) NOT NULL,
    "cacheKey" VARCHAR(511) NOT NULL,
    "response" JSON NOT NULL,
    "eventIds" VARCHAR(36)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,


CONSTRAINT "Cached_pkey" PRIMARY KEY ("pk") );

-- CreateIndex
CREATE UNIQUE INDEX "Cached_sepId_cacheKey_key" ON "Cached" ("sepId", "cacheKey");