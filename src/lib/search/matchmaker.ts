import "server-only";
/**
 * Matchmaker — Phase 4 route builder
 *
 * Takes raw scraper results and a user wallet, then generates every
 * permitted (store × discount) buying route.
 *
 * Per result, up to three route types are generated:
 *   A — baseline (no discount)
 *   B — best applicable gift card(s)
 *   C — best applicable club membership(s)
 *   B+C — combined, only when ClubNetworkRule.canCombine is true AND the
 *         store benefit does not set noDoubleDiscount
 *
 * All routes are sorted by finalPrice ASC; top 10 are returned.
 */

import { randomUUID } from "crypto";
import { RawResult, BuyingRoute } from "@/lib/search/types";
import {
  UserWallet,
  loadStoreContext,
} from "@/server/search/matchmaker/walletLoader";
import { resolveStoreIds } from "@/server/search/matchmaker/storeResolver";

export type { RawResult, BuyingRoute };

// ─────────────────────────────────────────────────────────────────────────────

export async function matchmaker(
  results: RawResult[],
  wallet:  UserWallet | null
): Promise<BuyingRoute[]> {
  console.log(`[MATCHMAKER] Input: ${results.length} results, wallet: { cards: ${wallet?.giftCards.length ?? 0}, memberships: ${wallet?.memberships.length ?? 0} }`);

  if (!results.length) return [];

  const allRoutes: BuyingRoute[] = [];

  // ── Resolve store names → DB IDs (needed for benefit/network lookups) ──────
  const storeNameToId = await resolveStoreIds(results.map((r) => r.storeName));
  console.log(`[MATCHMAKER] Resolved store IDs:`, Object.fromEntries(storeNameToId));

  const storeIds = [...new Set([...storeNameToId.values()])];

  // ── Load store context (club benefits + accepted networks) ─────────────────
  const storeCtx = wallet
    ? await loadStoreContext(storeIds, wallet.memberships)
    : { storeClubBenefits: [], storeNetworks: [] };

  // ── Build routes per result ────────────────────────────────────────────────
  for (const result of results) {
    const storeId    = storeNameToId.get(result.storeName);
    const basePrice  = result.originalPrice;

    // ── Route A: no discount (baseline) ──────────────────────────────────────
    allRoutes.push(makeRoute(result, storeId, null, 0, basePrice, false));
    console.log(`[MATCHMAKER] Route A: ${result.storeName} ₪${basePrice} (storeId=${storeId ?? "NOT IN DB"})`);

    if (!wallet || !storeId) {
      if (!storeId) console.log(`[MATCHMAKER] Skipping B/C routes for ${result.storeName} — store not in DB`);
      continue;
    }

    // ── Find accepted gift card networks for this store ───────────────────────
    const acceptedNetworkIds = storeCtx.storeNetworks
      .filter((sn) => sn.storeId === storeId)
      .map((sn) => sn.networkId);

    // Applicable gift cards: has balance > 0, network accepted by this store
    const applicableCards = wallet.giftCards.filter(
      (c) => c.balance > 0 && c.networkId && acceptedNetworkIds.includes(c.networkId)
    );

    // ── Route B: gift card(s) only ────────────────────────────────────────────
    for (const card of applicableCards) {
      const deducted   = Math.min(card.balance, basePrice);
      const finalPrice = Math.max(0, basePrice - deducted);
      const label      = `כרטיס ${card.networkName ?? "מתנה"}`;

      allRoutes.push(makeRoute(result, storeId, label, deducted, finalPrice, true, card.id));
    }

    // ── Route C: club membership(s) ──────────────────────────────────────────
    for (const membership of wallet.memberships) {
      const benefit = storeCtx.storeClubBenefits.find(
        (b) => b.storeId === storeId && b.clubId === membership.clubId
      );
      if (!benefit) continue;

      // Respect minimum purchase threshold
      if (benefit.minPurchase && basePrice < benefit.minPurchase) continue;

      let discount = basePrice * (benefit.discountPct / 100);
      if (benefit.maxAmount !== null) discount = Math.min(discount, benefit.maxAmount);
      discount = Math.round(discount * 100) / 100;

      const finalPrice    = Math.max(0, basePrice - discount);
      const noDouble      = benefit.noDoubleDiscount;
      const label         = `${membership.clubName} ${benefit.discountPct}%`;

      allRoutes.push(makeRoute(result, storeId, label, discount, finalPrice, !noDouble, undefined, membership.id));

      // ── Route B+C: combined (only when allowed) ───────────────────────────
      if (noDouble) continue; // store policy forbids combination

      for (const card of applicableCards) {
        // Check ClubNetworkRule
        const rule = wallet.clubNetworkRules.find(
          (r) => r.clubId === membership.clubId && r.networkId === card.networkId
        );
        if (rule && !rule.canCombine) continue; // network rule forbids combination

        const cardDeducted    = Math.min(card.balance, finalPrice);
        const combinedFinal   = Math.max(0, finalPrice - cardDeducted);
        const totalDiscount   = Math.round((basePrice - combinedFinal) * 100) / 100;
        const combinedLabel   = `${membership.clubName} + ${card.networkName ?? "כרטיס מתנה"}`;

        allRoutes.push(makeRoute(result, storeId, combinedLabel, totalDiscount, combinedFinal, true, card.id, membership.id));
      }
    }
  }

  console.log(`[MATCHMAKER] Generated ${allRoutes.length} routes before sort`);

  // ── Sort by finalPrice ASC, return top 10 ────────────────────────────────
  return allRoutes
    .sort((a, b) => a.finalPrice - b.finalPrice)
    .slice(0, 10);
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRoute(
  result:         RawResult,
  _storeId:       string | undefined,
  appliedBenefit: string | null,
  discountAmount: number,
  finalPrice:     number,
  canCombine:     boolean,
  giftCardId?:    string,
  membershipId?:  string,
): BuyingRoute {
  return {
    id:             randomUUID(),
    store:          result.store,
    storeName:      result.storeName,
    productName:    result.productName,
    originalPrice:  result.originalPrice,
    appliedBenefit,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalPrice:     Math.round(finalPrice    * 100) / 100,
    imageUrl:       result.imageUrl,
    productUrl:     result.productUrl,
    canCombine,
    ...(giftCardId   && { giftCardId }),
    ...(membershipId && { membershipId }),
  };
}
