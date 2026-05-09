ALTER TABLE "User"
ADD COLUMN "selectedCardDeckId" TEXT NOT NULL DEFAULT 'classic-dark';

CREATE TABLE "CardDeck" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "backImageUrl" TEXT NOT NULL,
  "faceImageTemplate" TEXT NOT NULL DEFAULT '/cards/{suit}_{rank}.png',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CardDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCardDeck" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deckId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserCardDeck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCardDeck_userId_deckId_key"
ON "UserCardDeck"("userId", "deckId");

CREATE INDEX "UserCardDeck_userId_createdAt_idx"
ON "UserCardDeck"("userId", "createdAt");

CREATE INDEX "CardDeck_enabled_createdAt_idx"
ON "CardDeck"("enabled", "createdAt");

ALTER TABLE "UserCardDeck"
ADD CONSTRAINT "UserCardDeck_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCardDeck"
ADD CONSTRAINT "UserCardDeck_deckId_fkey"
FOREIGN KEY ("deckId") REFERENCES "CardDeck"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CardDeck" ("id", "name", "price", "backImageUrl", "faceImageTemplate", "enabled", "createdAt", "updatedAt")
VALUES
  ('classic-dark', 'Classic Dark', 0, '/cards/back_dark.png', '/cards/{suit}_{rank}.png', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('classic-light', 'Classic Light', 1200, '/cards/back_light.png', '/cards/{suit}_{rank}.png', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "UserCardDeck" ("id", "userId", "deckId", "createdAt")
SELECT
  concat('default-', "id"),
  "id",
  'classic-dark',
  CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("userId", "deckId") DO NOTHING;
