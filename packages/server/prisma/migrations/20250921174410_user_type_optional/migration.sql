/*
  Warnings:

  - You are about to drop the column `accountType` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "accountType",
ADD COLUMN     "userType" "public"."UserType";
