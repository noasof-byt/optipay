/**
 * Buying Route Builder — The "No Double Dipping" Engine
 *
 * Core algorithm for a single (store, price) pair:
 *
 *   1. Collect all applicable club discounts for this store.
 *   2. Collect all applicable gift cards accepted by this store.
 *   3. Classify every possible (club, card) pair:
 *        COMBINED   → canCombine=true  AND noDoubleDiscount=false
 *        SEPARATE   → canCombine=false OR  noDoubleDiscount=true
 *   4. Build one route per permitted combination / standalone usage.
 *   5. Return all routes; the outer sorter will rank them cheapest first.
 *
 * Discount calculation order (industry standard):
 *   a. Apply club % discount to the base price first.
 *   b. Apply gift card balance to the discounted price.
 *   c. Respect maxDiscountAmount and minPurchase thresholds.
 */

import { randomUUID } from "crypto";
import {
  UserWallet,
  StoreContext,
  WalletGiftCard,
  WalletMembership,
  StoreClubBenefit,
} from "./walletLoader";
import { LivePrice, BuyingRoute, AppliedDiscount } from "@/types/search";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApplicableClub {
  membership:  WalletMembership;
  benefit:     StoreClubBenefit;
}

interface ApplicableCard {
  card:       WalletGiftCard;
  acceptedBy: boolean;  // true if store explicitly accepts this network
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildRoutesForStore(
  livePrice:   LivePrice,
  wallet:      UserWallet,
  storeCtx:    StoreContext,
  storeId?:    string
): BuyingRoute[] {
  const routes: BuyingRoute[] = [];
  const basePrice  = livePrice.price;
  const storeName  = livePrice.storeName;

  console.log(`[MATCHMAKER] buildRoutesForStore: ${storeName} ₪${basePrice} (storeId=${storeId ?? "NOT IN DB"})`);
  console.log(`[MATCHMAKER] storeCtx: ${storeCtx.storeNetworks.filter(n => n.storeId === storeId).length} networks, ${storeCtx.storeClubBenefits.filter(b => b.storeId === storeId).length} club benefits for this store`);

  // ── 1. Find applicable club discounts ─────────────────────────────────────
  const applicableClubs: ApplicableClub[] = [];

  if (storeId) {
    for (const membership of wallet.memberships) {
      const benefit = storeCtx.storeClubBenefits.find(
        (b) => b.storeId === storeId && b.clubId === membership.clubId
      );
      if (!benefit) {
        console.log(`[MATCHMAKER] Club ${membership.clubName} no match for store ${storeName}`);
        continue;
      }
      // Respect minimum purchase
      if (benefit.minPurchase && basePrice < benefit.minPurchase) {
        console.log(`[MATCHMAKER] Club ${membership.clubName} skipped for ${storeName} — price ₪${basePrice} below minPurchase ₪${benefit.minPurchase}`);
        continue;
      }
      const discount = Math.min(
        basePrice * (benefit.discountPct / 100),
        benefit.maxAmount ?? Infinity
      );
      console.log(`[MATCHMAKER] Club ${membership.clubName} matches store ${storeName} → ${benefit.discountPct}% discount ₪${Math.round(discount * 100) / 100}`);
      applicableClubs.push({ membership, benefit });
    }
  }

  // ── 2. Find applicable gift cards ─────────────────────────────────────────
  const acceptedNetworkIds = storeCtx.storeNetworks
    .filter((sn) => sn.storeId === storeId)
    .map((sn) => sn.networkId);

  console.log(`[MATCHMAKER] ${storeName} accepts networkIds: [${acceptedNetworkIds.join(", ")}]`);

  const applicableCards: ApplicableCard[] = wallet.giftCards
    .filter((card) => card.balance > 0)
    .map((card) => {
      const acceptedBy = card.networkId ? acceptedNetworkIds.includes(card.networkId) : false;
      if (acceptedBy) {
        const discount = Math.min(card.balance, basePrice);
        console.log(`[MATCHMAKER] Card ${card.networkName ?? card.networkId} matches store ${storeName} → discount ₪${discount}`);
      } else {
        console.log(`[MATCHMAKER] Card ${card.networkName ?? card.networkId} (networkId=${card.networkId}) no match for store ${storeName}`);
      }
      return { card, acceptedBy };
    })
    .filter((ac) => ac.acceptedBy);

  // ── 3. Route: no benefits (baseline) ─────────────────────────────────────
  routes.push(makeRoute(livePrice, storeId, basePrice, [], false));

  // ── 4. Routes: club discount only ────────────────────────────────────────
  for (const { membership, benefit } of applicableClubs) {
    const discountAmount = calcClubDiscount(basePrice, benefit);
    const finalPrice     = Math.max(0, basePrice - discountAmount);

    routes.push(
      makeRoute(livePrice, storeId, finalPrice, [
        {
          type:           "club",
          label:          `${membership.clubName} ${benefit.discountPct}%`,
          clubId:         membership.clubId,
          amountDeducted: discountAmount,
          percentUsed:    benefit.discountPct,
        },
      ], benefit.noDoubleDiscount, benefit.restrictions ?? undefined)
    );
  }

  // ── 5. Routes: gift card only ─────────────────────────────────────────────
  for (const { card } of applicableCards) {
    const deducted   = Math.min(card.balance, basePrice);
    const finalPrice = Math.max(0, basePrice - deducted);

    routes.push(
      makeRoute(livePrice, storeId, finalPrice, [
        {
          type:           "gift_card",
          label:          `${card.networkName ?? "כרטיס מתנה"} (••••${card.hint ?? ""})`,
          giftCardId:     card.id,
          networkName:    card.networkName ?? undefined,
          amountDeducted: deducted,
        },
      ], false)
    );
  }

  // ── 6. Routes: club + gift card (only when permitted) ─────────────────────
  for (const { membership, benefit } of applicableClubs) {
    for (const { card } of applicableCards) {
      const rule = wallet.clubNetworkRules.find(
        (r) => r.clubId === membership.clubId && r.networkId === card.networkId
      );

      const canCombine      = rule ? rule.canCombine : true;  // default: can combine if no rule
      const noDoubleStore   = benefit.noDoubleDiscount;

      if (!canCombine || noDoubleStore) {
        // Already generated individual routes above — skip combined
        continue;
      }

      // Apply club discount first, then gift card to the discounted price
      const clubDiscount   = calcClubDiscount(basePrice, benefit);
      const priceAfterClub = Math.max(0, basePrice - clubDiscount);
      const cardDeducted   = Math.min(card.balance, priceAfterClub);
      const finalPrice     = Math.max(0, priceAfterClub - cardDeducted);

      routes.push(
        makeRoute(livePrice, storeId, finalPrice, [
          {
            type:           "club",
            label:          `${membership.clubName} ${benefit.discountPct}%`,
            clubId:         membership.clubId,
            amountDeducted: clubDiscount,
            percentUsed:    benefit.discountPct,
          },
          {
            type:           "gift_card",
            label:          `${card.networkName ?? "כרטיס מתנה"} (••••${card.hint ?? ""})`,
            giftCardId:     card.id,
            networkName:    card.networkName ?? undefined,
            amountDeducted: cardDeducted,
          },
        ], false)
      );
    }
  }

  // ── 7. Deduplicate identical final prices, keep best discounts ────────────
  const deduplicated = deduplicateRoutes(routes);
  console.log(`[MATCHMAKER] Final: ${deduplicated.length} total routes generated for ${storeName}`);
  return deduplicated;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcClubDiscount(basePrice: number, benefit: StoreClubBenefit): number {
  let discount = basePrice * (benefit.discountPct / 100);
  if (benefit.maxAmount !== null) {
    discount = Math.min(discount, benefit.maxAmount);
  }
  return Math.round(discount * 100) / 100; // round to 2 decimal places
}

function makeRoute(
  livePrice:        LivePrice,
  storeId:          string | undefined,
  finalPrice:       number,
  discounts:        AppliedDiscount[],
  noDoubleDiscount: boolean,
  warning?:         string
): BuyingRoute {
  const savedAmount  = Math.max(0, livePrice.price - finalPrice);
  const savedPercent = livePrice.price > 0
    ? Math.round((savedAmount / livePrice.price) * 100)
    : 0;

  return {
    id:               randomUUID(),
    storeName:        livePrice.storeName,
    storeId,
    originalPrice:    livePrice.price,
    discounts,
    finalPrice:       Math.round(finalPrice * 100) / 100,
    savedAmount:      Math.round(savedAmount * 100) / 100,
    savedPercent,
    storeUrl:         livePrice.url,
    noDoubleDiscount,
    warning:          warning ?? (noDoubleDiscount ? "לא בכפל מבצעים — מסלולים מחושבים בנפרד" : undefined),
    source:           livePrice.source,
  };
}

/**
 * Remove routes with identical (storeName, finalPrice, discountTypes) fingerprint.
 * When two routes are identical in cost, prefer the one with more discounts applied.
 */
function deduplicateRoutes(routes: BuyingRoute[]): BuyingRoute[] {
  const seen = new Map<string, BuyingRoute>();

  for (const route of routes) {
    const key = `${route.storeName}::${route.finalPrice}`;
    const existing = seen.get(key);
    if (!existing || route.discounts.length > existing.discounts.length) {
      seen.set(key, route);
    }
  }

  return Array.from(seen.values());
}
