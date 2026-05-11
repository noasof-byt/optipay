/**
 * Shared types for the src/lib/search/* layer.
 *
 * RawResult — output of each scraper.
 * BuyingRoute — output of the matchmaker (one per discount combination).
 */

export interface RawResult {
  store:         "bug" | "zap" | "ksp" | "payngo";
  storeName:     string;
  productName:   string;
  originalPrice: number;
  imageUrl:      string;
  productUrl:    string;
}

export interface BuyingRoute {
  id:             string;
  store:          string;
  storeName:      string;
  productName:    string;
  originalPrice:  number;
  /** e.g. "כרטיס BuyMe", "מועדון חבר 10%", "מועדון חבר + BuyMe" */
  appliedBenefit: string | null;
  discountAmount: number;
  finalPrice:     number;
  imageUrl:       string;
  productUrl:     string;
  /** true if the benefit can be combined with another — used for UI hints */
  canCombine:     boolean;
  /** DB id of the gift card that was matched (for use-route deduction) */
  giftCardId?:    string;
  /** DB id of the membership that was matched (for use-route tracking) */
  membershipId?:  string;
}
