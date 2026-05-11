/**
 * Wallet Loader
 *
 * Fetches the user's active wallet from the DB:
 *   - Active, non-archived, non-expired gift cards
 *   - Active club memberships
 *   - Pre-loads the ClubNetworkRules and StoreClubBenefits needed
 *     by the matchmaker for each store in the live price results.
 */

import { prisma }                    from "@/lib/prisma";
import { decrypt }                   from "@/lib/encryption";
import { fetchMissingClubBenefits }  from "../scrapers/clubBenefitScraper";

export interface WalletGiftCard {
  id:          string;
  networkId:   string | null;
  networkName: string | null;      // e.g. "BuyMe"
  storeName:   string | null;      // for store-specific cards
  balance:     number;
  expiryDate:  Date;
  hint:        string | null;
  isFavorite:  boolean;
}

export interface WalletMembership {
  id:         string;
  clubId:     string;
  clubName:   string;
  isPaid:     boolean;
  isActive:   boolean;
}

export interface ClubNetworkRule {
  clubId:     string;
  networkId:  string;
  canCombine: boolean;
  ruleDescription: string | null;
}

export interface StoreClubBenefit {
  storeId:           string;
  clubId:            string;
  discountPct:       number;
  maxAmount:         number | null;
  minPurchase:       number | null;
  noDoubleDiscount:  boolean;
  restrictions:      string | null;
}

export interface StoreNetwork {
  storeId:   string;
  networkId: string;
}

export interface UserWallet {
  giftCards:       WalletGiftCard[];
  memberships:     WalletMembership[];
  clubNetworkRules: ClubNetworkRule[];
}

export interface StoreContext {
  storeClubBenefits: StoreClubBenefit[];
  storeNetworks:     StoreNetwork[];
}

// ─────────────────────────────────────────────────────────────────────────────

export async function loadUserWallet(userId: string): Promise<UserWallet> {
  const now = new Date();

  // ── Gift cards ──────────────────────────────────────────────────────────
  const rawCards = await prisma.giftCard.findMany({
    where: {
      userId,
      isArchived: false,
      expiryDate: { gt: now },
      balance:    { gt: 0 },
    },
    include: { network: { select: { id: true, name: true } } },
    orderBy: [{ isFavorite: "desc" }, { expiryDate: "asc" }],
  });

  const giftCards: WalletGiftCard[] = rawCards.map((c) => ({
    id:          c.id,
    networkId:   c.networkId,
    networkName: c.network?.name ?? null,
    storeName:   c.storeSpecificName,
    balance:     Number(c.balance),
    expiryDate:  c.expiryDate,
    hint:        c.cardNumberHint,
    isFavorite:  c.isFavorite,
  }));

  // ── Memberships ──────────────────────────────────────────────────────────
  const rawMemberships = await prisma.userClubMembership.findMany({
    where:   { userId, isActive: true },
    include: { club: { select: { id: true, name: true, isActive: true } } },
  });

  const memberships: WalletMembership[] = rawMemberships
    .filter((m) => m.club.isActive)
    .map((m) => ({
      id:       m.id,
      clubId:   m.clubId,
      clubName: m.club.name,
      isPaid:   m.isPaidMembership,
      isActive: m.isActive,
    }));

  // ── Club ↔ Network rules — pre-load for all user's clubs × networks ──────
  const clubIds    = memberships.map((m) => m.clubId);
  const networkIds = giftCards.map((c) => c.networkId).filter(Boolean) as string[];

  const rawRules = clubIds.length && networkIds.length
    ? await prisma.clubNetworkRule.findMany({
        where: {
          clubId:    { in: clubIds },
          networkId: { in: networkIds },
        },
      })
    : [];

  const clubNetworkRules: ClubNetworkRule[] = rawRules.map((r) => ({
    clubId:          r.clubId,
    networkId:       r.networkId,
    canCombine:      r.canCombine,
    ruleDescription: r.ruleDescription,
  }));

  return { giftCards, memberships, clubNetworkRules };
}

/**
 * Load store-specific benefit and accepted-network data
 * for a list of store IDs from the live price results.
 */
export async function loadStoreContext(
  storeIds:    string[],
  memberships?: WalletMembership[],
): Promise<StoreContext> {
  if (!storeIds.length) return { storeClubBenefits: [], storeNetworks: [] };

  const [rawBenefits, rawNetworks, rawStores] = await Promise.all([
    prisma.storeClubBenefit.findMany({
      where: { storeId: { in: storeIds }, isActive: true },
    }),
    prisma.storeNetwork.findMany({
      where: { storeId: { in: storeIds }, isActive: true },
    }),
    memberships?.length
      ? prisma.store.findMany({
          where:  { id: { in: storeIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const storeClubBenefits: StoreClubBenefit[] = rawBenefits.map((b) => ({
    storeId:          b.storeId,
    clubId:           b.clubId,
    discountPct:      Number(b.discountPercentage),
    maxAmount:        b.maxDiscountAmount ? Number(b.maxDiscountAmount) : null,
    minPurchase:      b.minPurchaseAmount ? Number(b.minPurchaseAmount) : null,
    noDoubleDiscount: b.noDoubleDiscount,
    restrictions:     b.restrictions,
  }));

  // ── Supplement with live SERP benefit data for missing combos ─────────────
  // Best-effort: never let a SERP failure block the overall search response.
  if (memberships?.length && rawStores.length) {
    try {
      const liveResults = await fetchMissingClubBenefits({
        stores:           rawStores.map((s) => ({ storeId: s.id, storeName: s.name })),
        clubs:            memberships.map((m) => ({ clubId: m.clubId, clubName: m.clubName })),
        existingBenefits: storeClubBenefits,
      });

      for (const live of liveResults) {
        storeClubBenefits.push({
          storeId:          live.storeId,
          clubId:           live.clubId,
          discountPct:      live.discountPct,
          maxAmount:        null,
          minPurchase:      null,
          noDoubleDiscount: false,
          restrictions:     "נתון חי מהאינטרנט — אמת מול האתר הרשמי",
        });
      }
    } catch (err) {
      // Live benefit lookup is best-effort — log and continue without it
      const { logger } = await import("@/lib/logger");
      logger.warn("Live club benefit SERP failed — continuing without live data", { err: String(err) });
    }
  }

  return {
    storeClubBenefits,
    storeNetworks: rawNetworks.map((n) => ({
      storeId:   n.storeId,
      networkId: n.networkId,
    })),
  };
}
