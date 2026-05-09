ALTER TABLE "CardDeck"
ADD COLUMN "faceImageTemplate" TEXT NOT NULL DEFAULT '/cards/{suit}_{rank}.png';
