/**
 * Wallet Loader
 *
 * Fetches the user's active wallet from the DB:
 *   - Active, non-archived, non-expired gift cards
 *   - Active club memberships
 *   - Pre-loads the ClubNetworkRules and StoreClubBenefits needed
 *     by the matchmaker for each store in the live price results.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

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
export async function loadStoreContext(storeIds: string[]): Promise<StoreContext> {
  if (!storeIds.length) return { storeClubBenefits: [], storeNetworks: [] };

  const [rawBenefits, rawNetworks] = await Promise.all([
    prisma.storeClubBenefit.findMany({
      where: { storeId: { in: storeIds }, isActive: true },
    }),
    prisma.storeNetwork.findMany({
      where: { storeId: { in: storeIds }, isActive: true },
    }),
  ]);

  return {
    storeClubBenefits: rawBenefits.map((b) => ({
      storeId:          b.storeId,
      clubId:           b.clubId,
      discountPct:      Number(b.discountPercentage),
      maxAmount:        b.maxDiscountAmount ? Number(b.maxDiscountAmount) : null,
      minPurchase:      b.minPurchaseAmount ? Number(b.minPurchaseAmount) : null,
      noDoubleDiscount: b.noDoubleDiscount,
      restrictions:     b.restrictions,
    })),
    storeNetworks: rawNetworks.map((n) => ({
      storeId:   n.storeId,
      networkId: n.networkId,
    })),
  };
}
