# OptiPay — Database Architecture Notes

## Entity Relationship Summary

```
User ──< UserSession
     ──< PasswordResetToken
     ──< GiftCard ──< CardUsageLog
     ──< UserClubMembership
     ──< SavingsRecord
     ──< SearchHistory
     ──< PushSubscription
     ──< Notification
     ──< SupportTicket ──< TicketReply
     ──  FamilyGroupMember >── FamilyGroup ──< FamilySharedItem

Club ──< UserClubMembership
     ──< StoreClubBenefit >── Store ──< StoreBranch
     ──< ClubNetworkRule   >── GiftCardNetwork ──< GiftCard
     ──< ClubScrapingConfig ──< ScrapingJob ──< ScrapingResult

Product ──< ProductSynonym
```

## Key Design Decisions

### 1. AES-256 Encryption (Application Layer)
`GiftCard.cardNumberEncrypted` and `UserClubMembership.membershipNumberEnc`
are encrypted **before** they reach Prisma. The key is held in `ENCRYPTION_KEY`
env var (32-byte hex). We also store `cardNumberHint` (last 4 digits, plain)
so the UI can display "•••• 4321" without decrypting on every list render.

### 2. "No Double Dipping" — Two-table approach
- `StoreClubBenefit.noDoubleDiscount` — store-level flag scraped from the
  club's own website (e.g. "לא בכפל מבצעים").
- `ClubNetworkRule.canCombine` — system-level rule governing whether a
  specific club discount can be combined with a specific gift-card network.

The **Matchmaker Engine** (Step 4) reads BOTH tables before building routes:
1. Get all `ClubNetworkRule` rows for this user's clubs × their card networks.
2. For each store, get `StoreClubBenefit.noDoubleDiscount`.
3. Generate separate, non-combined "buying routes" wherever `canCombine=false`
   OR `noDoubleDiscount=true`.

### 3. Soft Deletes
Users: `isDeleted + deletedAt` — GDPR "right to erasure" → we anonymise PII
then mark deleted rather than hard-deleting, preserving referential integrity
for audit logs.

GiftCards: `isArchived + archivedAt` — expired cards are auto-moved here by a
nightly CRON, never deleted, so users can restore or view history.

### 4. Family Sharing
`FamilySharedItem` is a join table with a nullable FK to either `GiftCard` or
`UserClubMembership`. Exactly one FK is populated per row (enforced by
`@unique` on both FKs). The consuming user sees shared items in their wallet
view but cannot edit balance or details.

### 5. Scraping Data Flow
```
ClubScrapingConfig (what to scrape + how)
  ↓ CRON triggers
ScrapingJob (one execution record)
  ↓ Playwright/Cheerio runs
ScrapingResult (raw HTML + parsed JSON stored)
  ↓ applyScrapingResult() service
StoreClubBenefit rows updated / created
StoreBranch rows updated
```

### 6. Savings Dashboard
`SavingsRecord` stores a `routeSnapshot` JSON blob — a point-in-time copy of
the BuyingRoute chosen by the user. This means historical savings data never
changes even if store prices or benefits are updated later.

## Indexes Strategy
- `users.email` — unique lookup on login
- `gift_cards.(userId, isArchived, expiryDate)` — wallet list queries
- `savings_records.(userId, purchasedAt)` — monthly/yearly aggregations
- `search_history.(userId, createdAt)` — recent searches
- `scraping_jobs.(status, createdAt)` — CRON monitoring queries
- `notifications.(userId, isRead)` — unread badge count
