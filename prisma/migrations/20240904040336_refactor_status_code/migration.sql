-- AlterTable
ALTER TABLE "EventStore" ALTER COLUMN "statusCode" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "PersistedAsync" ALTER COLUMN "statusCode" SET DEFAULT 1;
