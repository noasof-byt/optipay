import "server-only";
/**
 * Club Benefit Data
 *
 * Returns club discount data sourced exclusively from the database
 * (StoreClubBenefit rows). No third-party SERP or external lookups.
 *
 * walletLoader calls fetchMissingClubBenefits for (store, club) pairs
 * that have no static DB record. Without SERP this always returns [],
 * which means only seeded DB rows contribute club discounts.
 */

import { logger } from "@/lib/logger";

export interface LiveClubBenefit {
  storeId:     string;
  clubId:      string;
  discountPct: number;
  isLiveData:  boolean;
}

export async function fetchMissingClubBenefits(_opts: {
  stores:           { storeId: string; storeName: string }[];
  clubs:            { clubId:  string; clubName:  string }[];
  existingBenefits: { storeId: string; clubId: string }[];
}): Promise<LiveClubBenefit[]> {
  logger.info("Club benefit lookup: using DB only (no external SERP)");
  return [];
}
