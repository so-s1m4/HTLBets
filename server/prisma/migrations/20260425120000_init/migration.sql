-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('ROULETTE', 'BLACKJACK', 'POKER');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('IDLE', 'WAITING_ACTION', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "username" TEXT,
  "balance" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameType" "GameType" NOT NULL,
  "status" "GameSessionStatus" NOT NULL DEFAULT 'IDLE',
  "currentBet" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameType" "GameType" NOT NULL,
  "betAmount" INTEGER NOT NULL,
  "result" TEXT NOT NULL,
  "balanceChange" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_email_used_expiresAt_idx" ON "EmailVerificationCode"("email", "used", "expiresAt");

-- CreateIndex
CREATE INDEX "GameSession_userId_gameType_status_idx" ON "GameSession"("userId", "gameType", "status");

-- CreateIndex
CREATE INDEX "GameHistory_userId_createdAt_idx" ON "GameHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameSession"
ADD CONSTRAINT "GameSession_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameHistory"
ADD CONSTRAINT "GameHistory_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
