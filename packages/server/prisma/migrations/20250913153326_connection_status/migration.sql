-- CreateEnum
CREATE TYPE "public"."ConnectionStatus" AS ENUM ('INITIALIZING', 'SYNCED_INITIAL', 'SYNCED_HISTORICAL', 'ENRICHED', 'RECONNECT', 'DISCONNECTED', 'INSTITUTION_ERROR');

-- AlterTable
ALTER TABLE "public"."Connection" ADD COLUMN     "status" "public"."ConnectionStatus" NOT NULL DEFAULT 'INITIALIZING';
