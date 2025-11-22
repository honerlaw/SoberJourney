/*
  Warnings:

  - You are about to drop the `Connection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('PRODUCTION', 'SANDBOX');

-- DropForeignKey
ALTER TABLE "public"."Connection" DROP CONSTRAINT "Connection_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SessionToken" DROP CONSTRAINT "SessionToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "accountType" "public"."UserType" NOT NULL DEFAULT 'PRODUCTION';

-- DropTable
DROP TABLE "public"."Connection";

-- DropTable
DROP TABLE "public"."SessionToken";

-- DropTable
DROP TABLE "public"."Transaction";

-- DropEnum
DROP TYPE "public"."ConnectionStatus";
