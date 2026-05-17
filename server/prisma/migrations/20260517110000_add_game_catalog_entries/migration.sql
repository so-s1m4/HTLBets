CREATE TABLE "GameCatalogEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCatalogEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameCatalogEntry_enabled_sortOrder_idx" ON "GameCatalogEntry"("enabled", "sortOrder");
