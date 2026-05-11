/**
 * OptiPay Search Types
 * Shared between server search engine and client UI.
 */

// ── Live price result from a scraper ─────────────────────────────────────────
export interface LivePrice {
  storeName:   string;
  storeId?:    string;    // set after matching against the DB
  price:       number;    // NIS — base price before any benefits
  currency:    string;    // always "ILS"
  url:         string;    // direct product URL at the store
  inStock:     boolean;
  source:      "zap" | "ksp" | "bug" | "payngo" | "ivory" | "terminalx" | "manual" | "mock";
  fetchedAt:   Date;
}

// ── Parsed product attributes (from NLP) ─────────────────────────────────────
export interface ParsedProduct {
  canonicalQuery:   string;    // cleaned, normalised query sent to scrapers
  brand?:           string;
  model?:           string;
  storageGB?:       number;
  color?:           string;
  category?:        string;
  attributes:       Record<string, string>;  // any other NLP-extracted k/v
}

// ── A single discount step applied within a route ────────────────────────────
export interface AppliedDiscount {
  type:            "club" | "gift_card";
  label:           string;       // e.g. "הטבות חבר 10%"
  clubId?:         string;
  giftCardId?:     string;
  networkName?:    string;
  amountDeducted:  number;       // NIS
  percentUsed?:    number;
}

// ── One complete buying route ─────────────────────────────────────────────────
export interface BuyingRoute {
  id:               string;      // uuid — used for "I used this route" action
  storeName:        string;
  storeId?:         string;
  originalPrice:    number;
  discounts:        AppliedDiscount[];
  finalPrice:       number;
  savedAmount:      number;      // originalPrice - finalPrice
  savedPercent:     number;
  storeUrl:         string;
  noDoubleDiscount: boolean;     // true if a restriction was applied
  warning?:         string;      // Hebrew warning text shown in UI
  source:           LivePrice["source"];
}

// ── Full search response ──────────────────────────────────────────────────────
export interface SearchResponse {
  query:          string;
  parsedProduct:  ParsedProduct;
  routes:         BuyingRoute[];   // sorted cheapest → most expensive
  fetchedAt:      string;          // ISO timestamp
  errors:         string[];        // non-fatal scrape errors shown in UI
}
