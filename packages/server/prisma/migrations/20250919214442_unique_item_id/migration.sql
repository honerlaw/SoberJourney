/*
  Warnings:

  - A unique constraint covering the columns `[itemId]` on the table `Item` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Item_itemId_key" ON "public"."Item"("itemId");
