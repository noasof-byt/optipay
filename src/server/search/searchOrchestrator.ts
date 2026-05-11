/**
 * Search Orchestrator — Main Entry Point
 *
 * Ties together all Step 4 components:
 *
 *   rawQuery
 *     → NLP (hebrewNormalizer)       — structured product + Hebrew/English queries
 *     → fetchLivePrices              — parallel scrape of ZAP, KSP, Bug
 *     → resolveStoreIds              — map scraper names → DB store IDs
 *     → loadUserWallet               — user's gift cards + memberships + rules
 *     → loadStoreContext             — per-store club benefits + accepted networks
 *     → buildRoutesForStore          — No-Double-Dipping route builder (per store)
 *     → sort cheapest → most expensive
 *     → persist SearchHistory entry
 *     → return SearchResponse
 */

import { parseProductQuery }     from "./nlp/hebrewNormalizer";
import { fetchLivePrices }       from "./scrapers/livePriceFetcher";
import { resolveStoreIds }        from "./matchmaker/storeResolver";
import { loadUserWallet, loadStoreContext } from "./matchmaker/walletLoader";
import { buildRoutesForStore }   from "./matchmaker/routeBuilder";
import { prisma }                from "@/lib/prisma";
import { logger }                from "@/lib/logger";
import { SearchResponse, BuyingRoute } from "@/types/search";

export async function runSearch(
  rawQuery: string,
  userId:   string
): Promise<SearchResponse> {
  const startedAt = Date.now();
  const errors:    string[] = [];

  logger.info("Search started", { query: rawQuery, userId });

  // ── Step 1: NLP ──────────────────────────────────────────────────────────
  const parsed = await parseProductQuery(rawQuery);
  logger.info("NLP complete", { canonicalQuery: parsed.canonicalQuery });

  // ── Step 2: Live prices ──────────────────────────────────────────────────
  const { prices, errors: scraperErrors } = await fetchLivePrices(parsed);
  errors.push(...scraperErrors);

  if (!prices.length) {
    logger.warn("No live prices found for query", { query: rawQuery, scraperErrors: errors });
    return {
      query:         rawQuery,
      parsedProduct: parsed,
      routes:        [],
      fetchedAt:     new Date().toISOString(),
      errors:        errors.length
        ? errors
        : ["לא נמצאו תוצאות. נסה לחפש עם מילות מפתח שונות."],
    };
  }

  // ── Step 3: Resolve store names → IDs ───────────────────────────────────
  const storeNameToId = await resolveStoreIds(prices.map((p) => p.storeName));

  // Attach storeIds to live prices
  for (const price of prices) {
    price.storeId = storeNameToId.get(price.storeName);
  }

  // ── Step 4: Load user wallet ─────────────────────────────────────────────
  const wallet = await loadUserWallet(userId);

  // ── Step 5: Load store-specific benefit/network context ─────────────────
  const storeIds = [...new Set(
    prices.map((p) => p.storeId).filter(Boolean) as string[]
  )];
  const storeCtx = await loadStoreContext(storeIds, wallet.memberships);

  // ── Step 6: Build buying routes for every store ──────────────────────────
  const allRoutes: BuyingRoute[] = [];

  for (const livePrice of prices) {
    try {
      const routes = buildRoutesForStore(
        livePrice,
        wallet,
        storeCtx,
        livePrice.storeId
      );
      allRoutes.push(...routes);
    } catch (err) {
      logger.warn("Route builder error", { store: livePrice.storeName, err: String(err) });
    }
  }

  // ── Step 7: Sort all routes cheapest → most expensive ───────────────────
  allRoutes.sort((a, b) => {
    // Primary: final price
    if (a.finalPrice !== b.finalPrice) return a.finalPrice - b.finalPrice;
    // Secondary: more discounts applied = better
    return b.discounts.length - a.discounts.length;
  });

  const elapsed = Date.now() - startedAt;
  logger.info("Search complete", {
    query:  rawQuery,
    routes: allRoutes.length,
    ms:     elapsed,
  });

  // ── Step 8: Persist search history ──────────────────────────────────────
  prisma.searchHistory.create({
    data: {
      userId,
      query:       rawQuery,
      resultCount: allRoutes.length,
    },
  }).catch(() => {}); // fire-and-forget, never block response

  return {
    query:         rawQuery,
    parsedProduct: parsed,
    routes:        allRoutes,
    fetchedAt:     new Date().toISOString(),
    errors,
  };
}
