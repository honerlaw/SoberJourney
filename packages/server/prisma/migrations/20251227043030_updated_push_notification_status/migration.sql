/*
  Warnings:

  - The values [OK,RESOLVED] on the enum `PushNotificationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `ticketId` on the `UserPushNotification` table. All the data in the column will be lost.
  - Changed the type of `status` on the `UserPushNotification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PushNotificationStatus_new" AS ENUM ('PENDING', 'COMPLETE', 'ERROR');
ALTER TABLE "UserPushNotification" ALTER COLUMN "status" TYPE "PushNotificationStatus_new" USING ("status"::text::"PushNotificationStatus_new");
ALTER TYPE "PushNotificationStatus" RENAME TO "PushNotificationStatus_old";
ALTER TYPE "PushNotificationStatus_new" RENAME TO "PushNotificationStatus";
DROP TYPE "public"."PushNotificationStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "UserPushNotification" DROP COLUMN "ticketId",
DROP COLUMN "status",
ADD COLUMN     "status" "PushNotificationStatus" NOT NULL;
