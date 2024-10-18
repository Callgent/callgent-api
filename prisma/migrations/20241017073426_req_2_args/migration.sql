/*
  Warnings:

  - You are about to drop the `PersistedAsync` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "PersistedAsync";

-- CreateTable
CREATE TABLE "Req2ArgsRepo" (
    "pk" BIGSERIAL NOT NULL,
    "cepId" VARCHAR(36) NOT NULL,
    "sepId" VARCHAR(36) NOT NULL,
    "req2Args" VARCHAR(8192) NOT NULL,
    "createdBy" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Req2ArgsRepo_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Req2ArgsRepo_cepId_sepId_key" ON "Req2ArgsRepo"("cepId", "sepId");
