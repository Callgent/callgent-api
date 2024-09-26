-- AlterTable
ALTER TABLE "Callgent" ADD COLUMN     "duplicatePk" INTEGER;

-- AlterTable
ALTER TABLE "CallgentRealm" ALTER COLUMN "realm" DROP NOT NULL;
