-- AlterTable
ALTER TABLE "Callgent" ADD COLUMN     "forkedPk" INTEGER,
ADD COLUMN     "mainTagId" INTEGER;

-- AlterTable
ALTER TABLE "CallgentRealm" ALTER COLUMN "realm" DROP NOT NULL;
ALTER TABLE "CallgentRealm" ALTER COLUMN "realm" TYPE varchar(16);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "avatar" VARCHAR(1023),
    "description" VARCHAR(1024) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallgentTag" (
    "pk" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "callgentId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallgentTag_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "CallgentTag_tagId_idx" ON "CallgentTag"("tagId");

-- CreateIndex
CREATE INDEX "CallgentTag_callgentId_idx" ON "CallgentTag"("callgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallgentTag_callgentId_tagId_key" ON "CallgentTag"("callgentId", "tagId");

-- CreateIndex
CREATE INDEX "Callgent_forkedPk_idx" ON "Callgent"("forkedPk");

-- CreateIndex
CREATE INDEX "Callgent_mainTagId_idx" ON "Callgent"("mainTagId");
