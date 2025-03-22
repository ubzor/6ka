-- CreateTable
CREATE TABLE "GenericProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- CreateTable
CREATE TABLE "GenericProductAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "genericProductId" INTEGER NOT NULL,
    CONSTRAINT "GenericProductAlias_genericProductId_fkey" FOREIGN KEY ("genericProductId") REFERENCES "GenericProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecificProduct" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "genericProductId" INTEGER NOT NULL,
    CONSTRAINT "SpecificProduct_genericProductId_fkey" FOREIGN KEY ("genericProductId") REFERENCES "GenericProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GenericProductAlias_name_key" ON "GenericProductAlias"("name");

-- CreateIndex
CREATE INDEX "GenericProductAlias_genericProductId_idx" ON "GenericProductAlias"("genericProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificProduct_name_key" ON "SpecificProduct"("name");

-- CreateIndex
CREATE INDEX "SpecificProduct_genericProductId_idx" ON "SpecificProduct"("genericProductId");
