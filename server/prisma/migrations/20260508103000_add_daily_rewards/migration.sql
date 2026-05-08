ALTER TABLE "User"
ADD COLUMN "lastDailyLoginAt" TEXT;

CREATE TABLE "DailyTaskClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "claimDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyTaskClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyTaskClaim_userId_taskKey_claimDate_key"
ON "DailyTaskClaim"("userId", "taskKey", "claimDate");

CREATE INDEX "DailyTaskClaim_userId_claimDate_idx"
ON "DailyTaskClaim"("userId", "claimDate");

ALTER TABLE "DailyTaskClaim"
ADD CONSTRAINT "DailyTaskClaim_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
