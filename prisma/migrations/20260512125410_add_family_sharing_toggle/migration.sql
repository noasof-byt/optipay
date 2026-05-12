-- AlterTable
ALTER TABLE "gift_cards" ADD COLUMN     "isSharedWithFamily" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_club_memberships" ADD COLUMN     "isSharedWithFamily" BOOLEAN NOT NULL DEFAULT false;
