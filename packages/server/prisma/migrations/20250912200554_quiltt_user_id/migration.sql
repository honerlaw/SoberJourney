/*
  Warnings:

  - A unique constraint covering the columns `[quilttUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "quilttUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_quilttUserId_key" ON "public"."User"("quilttUserId");
