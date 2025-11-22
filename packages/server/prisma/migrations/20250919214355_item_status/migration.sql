-- CreateEnum
CREATE TYPE "public"."ItemStatus" AS ENUM ('INITIALIZING', 'SYNCED', 'RECONNECT');

-- AlterTable
ALTER TABLE "public"."Item" ADD COLUMN     "status" "public"."ItemStatus" NOT NULL DEFAULT 'INITIALIZING';
