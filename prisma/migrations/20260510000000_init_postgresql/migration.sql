-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(120),
    "phoneNumber" VARCHAR(20),
    "avatarUrl" VARCHAR(500),
    "role" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "userAgent" VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_group_members" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_shared_items" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "itemType" VARCHAR(20) NOT NULL,
    "giftCardId" TEXT,
    "membershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_shared_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120),
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "logoUrl" VARCHAR(500),
    "websiteUrl" VARCHAR(500),
    "baseDiscountPercentage" DECIMAL(5,2) NOT NULL,
    "isPaidMembership" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_networks" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120),
    "logoUrl" VARCHAR(500),
    "websiteUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_card_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameEn" VARCHAR(120),
    "logoUrl" VARCHAR(500),
    "websiteUrl" VARCHAR(500),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_branches" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "branchName" VARCHAR(200),
    "city" VARCHAR(100),
    "address" VARCHAR(500),
    "phone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_networks" (
    "storeId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_networks_pkey" PRIMARY KEY ("storeId","networkId")
);

-- CreateTable
CREATE TABLE "store_club_benefits" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "maxDiscountAmount" DECIMAL(10,2),
    "minPurchaseAmount" DECIMAL(10,2),
    "restrictions" TEXT,
    "noDoubleDiscount" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_club_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_network_rules" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "canCombine" BOOLEAN NOT NULL DEFAULT true,
    "ruleDescription" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_network_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "networkId" TEXT,
    "storeSpecificName" VARCHAR(120),
    "cardNumberEncrypted" TEXT NOT NULL,
    "cardNumberHint" VARCHAR(4),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_club_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipNumberEnc" TEXT,
    "isPaidMembership" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_usage_logs" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountDeducted" DECIMAL(10,2) NOT NULL,
    "balanceBefore" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "productName" VARCHAR(500),
    "storeId" TEXT,
    "routeSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "canonicalName" VARCHAR(500) NOT NULL,
    "brand" VARCHAR(120),
    "category" VARCHAR(120),
    "imageUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_synonyms" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "synonym" VARCHAR(450) NOT NULL,
    "language" VARCHAR(5) NOT NULL DEFAULT 'he',
    "source" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "resolvedProductId" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT,
    "productName" VARCHAR(500) NOT NULL,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "savedAmount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "routeSnapshot" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_scraping_configs" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "targetUrl" VARCHAR(1000) NOT NULL,
    "scrapeStrategy" VARCHAR(20) NOT NULL DEFAULT 'playwright',
    "selectorConfig" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_scraping_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_results" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "targetUrl" VARCHAR(1000) NOT NULL,
    "rawHtml" TEXT,
    "parsedData" TEXT NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraping_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" VARCHAR(450) NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "payload" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_replies" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isLocked_idx" ON "users"("isLocked");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_tokenHash_idx" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "family_groups_ownerId_key" ON "family_groups"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "family_group_members_userId_key" ON "family_group_members"("userId");

-- CreateIndex
CREATE INDEX "family_group_members_familyGroupId_idx" ON "family_group_members"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "family_shared_items_giftCardId_key" ON "family_shared_items"("giftCardId");

-- CreateIndex
CREATE UNIQUE INDEX "family_shared_items_membershipId_key" ON "family_shared_items"("membershipId");

-- CreateIndex
CREATE INDEX "family_shared_items_familyGroupId_idx" ON "family_shared_items"("familyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_name_key" ON "clubs"("name");

-- CreateIndex
CREATE INDEX "clubs_isActive_idx" ON "clubs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "gift_card_networks_name_key" ON "gift_card_networks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");

-- CreateIndex
CREATE INDEX "store_branches_storeId_idx" ON "store_branches"("storeId");

-- CreateIndex
CREATE INDEX "store_branches_city_idx" ON "store_branches"("city");

-- CreateIndex
CREATE INDEX "store_club_benefits_storeId_idx" ON "store_club_benefits"("storeId");

-- CreateIndex
CREATE INDEX "store_club_benefits_clubId_idx" ON "store_club_benefits"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "store_club_benefits_storeId_clubId_key" ON "store_club_benefits"("storeId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "club_network_rules_clubId_networkId_key" ON "club_network_rules"("clubId", "networkId");

-- CreateIndex
CREATE INDEX "gift_cards_userId_idx" ON "gift_cards"("userId");

-- CreateIndex
CREATE INDEX "gift_cards_expiryDate_idx" ON "gift_cards"("expiryDate");

-- CreateIndex
CREATE INDEX "gift_cards_isArchived_idx" ON "gift_cards"("isArchived");

-- CreateIndex
CREATE INDEX "user_club_memberships_userId_idx" ON "user_club_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_club_memberships_userId_clubId_key" ON "user_club_memberships"("userId", "clubId");

-- CreateIndex
CREATE INDEX "card_usage_logs_giftCardId_idx" ON "card_usage_logs"("giftCardId");

-- CreateIndex
CREATE INDEX "card_usage_logs_userId_idx" ON "card_usage_logs"("userId");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE UNIQUE INDEX "product_synonyms_synonym_key" ON "product_synonyms"("synonym");

-- CreateIndex
CREATE INDEX "product_synonyms_productId_idx" ON "product_synonyms"("productId");

-- CreateIndex
CREATE INDEX "search_history_userId_idx" ON "search_history"("userId");

-- CreateIndex
CREATE INDEX "search_history_createdAt_idx" ON "search_history"("createdAt");

-- CreateIndex
CREATE INDEX "savings_records_userId_idx" ON "savings_records"("userId");

-- CreateIndex
CREATE INDEX "savings_records_purchasedAt_idx" ON "savings_records"("purchasedAt");

-- CreateIndex
CREATE INDEX "club_scraping_configs_clubId_idx" ON "club_scraping_configs"("clubId");

-- CreateIndex
CREATE INDEX "scraping_jobs_configId_idx" ON "scraping_jobs"("configId");

-- CreateIndex
CREATE INDEX "scraping_jobs_status_idx" ON "scraping_jobs"("status");

-- CreateIndex
CREATE INDEX "scraping_jobs_createdAt_idx" ON "scraping_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "scraping_results_jobId_idx" ON "scraping_results"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "ticket_replies_ticketId_idx" ON "ticket_replies"("ticketId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_groups" ADD CONSTRAINT "family_groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_group_members" ADD CONSTRAINT "family_group_members_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_group_members" ADD CONSTRAINT "family_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_shared_items" ADD CONSTRAINT "family_shared_items_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_shared_items" ADD CONSTRAINT "family_shared_items_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_shared_items" ADD CONSTRAINT "family_shared_items_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "family_shared_items" ADD CONSTRAINT "family_shared_items_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "user_club_memberships"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_branches" ADD CONSTRAINT "store_branches_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_networks" ADD CONSTRAINT "store_networks_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_networks" ADD CONSTRAINT "store_networks_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "gift_card_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_club_benefits" ADD CONSTRAINT "store_club_benefits_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "store_club_benefits" ADD CONSTRAINT "store_club_benefits_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "club_network_rules" ADD CONSTRAINT "club_network_rules_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "club_network_rules" ADD CONSTRAINT "club_network_rules_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "gift_card_networks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "gift_card_networks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_club_memberships" ADD CONSTRAINT "user_club_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_club_memberships" ADD CONSTRAINT "user_club_memberships_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_usage_logs" ADD CONSTRAINT "card_usage_logs_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_synonyms" ADD CONSTRAINT "product_synonyms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "savings_records" ADD CONSTRAINT "savings_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "savings_records" ADD CONSTRAINT "savings_records_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "club_scraping_configs" ADD CONSTRAINT "club_scraping_configs_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_configId_fkey" FOREIGN KEY ("configId") REFERENCES "club_scraping_configs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scraping_results" ADD CONSTRAINT "scraping_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "scraping_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

