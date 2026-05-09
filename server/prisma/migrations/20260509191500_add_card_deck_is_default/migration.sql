ALTER TABLE "CardDeck"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CardDeck"
SET "isDefault" = true
WHERE "id" = 'classic-dark';
