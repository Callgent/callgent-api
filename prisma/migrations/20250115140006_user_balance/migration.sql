-- CreateTable
CREATE TABLE "TransactionHistory" (
    "id" SERIAL NOT NULL,
    "userBalanceId" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "stripeId" VARCHAR(50),
    "price" JSONB NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionHistory_stripeId_key" ON "TransactionHistory"("stripeId");

-- CreateIndex
CREATE INDEX "TransactionHistory_userBalanceId_idx" ON "TransactionHistory"("userBalanceId");
