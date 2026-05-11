-- Phase 3: Wallet API Routes — Schema additions

-- 1. Soft-delete support for gift_cards
ALTER TABLE "gift_cards" ADD COLUMN "deletedAt" TIMESTAMPTZ;
CREATE INDEX "gift_cards_deletedAt_idx" ON "gift_cards"("deletedAt");

-- 2. Monthly fee tracking for user_club_memberships
ALTER TABLE "user_club_memberships" ADD COLUMN "monthlyFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 3. Purchase / benefit-use tracking on search_history
ALTER TABLE "search_history" ADD COLUMN "productName"   VARCHAR(500);
ALTER TABLE "search_history" ADD COLUMN "storeName"     VARCHAR(200);
ALTER TABLE "search_history" ADD COLUMN "originalPrice" DECIMAL(10,2);
ALTER TABLE "search_history" ADD COLUMN "finalPrice"    DECIMAL(10,2);
ALTER TABLE "search_history" ADD COLUMN "savingsAmount" DECIMAL(10,2);
ALTER TABLE "search_history" ADD COLUMN "benefitUsed"   VARCHAR(200);
ALTER TABLE "search_history" ADD COLUMN "giftCardId"    TEXT;
ALTER TABLE "search_history" ADD COLUMN "membershipId"  TEXT;

ALTER TABLE "search_history"
  ADD CONSTRAINT "search_history_giftCardId_fkey"
  FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "search_history"
  ADD CONSTRAINT "search_history_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "user_club_memberships"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "search_history_giftCardId_idx"  ON "search_history"("giftCardId");
CREATE INDEX "search_history_membershipId_idx" ON "search_history"("membershipId");
