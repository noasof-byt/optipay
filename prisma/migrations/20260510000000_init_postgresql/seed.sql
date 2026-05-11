-- OptiPay Seed Data
-- Run this in Supabase SQL Editor AFTER migration.sql and mark_applied.sql

DO $$
DECLARE
  v_buyme_id     TEXT;
  v_giftcard_id  TEXT;
  v_one1_id      TEXT;
  v_hever_id     TEXT;
  v_teachers_id  TEXT;
  v_leumi_id     TEXT;
BEGIN

  -- ── 1. Gift Card Networks ───────────────────────────────────────────────────

  INSERT INTO gift_card_networks (id, name, "nameEn", "websiteUrl", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'BuyMe', 'BuyMe', 'https://www.buyme.co.il', true, NOW(), NOW())
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_buyme_id FROM gift_card_networks WHERE name = 'BuyMe';

  INSERT INTO gift_card_networks (id, name, "nameEn", "websiteUrl", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'Giftcard', 'Giftcard.co.il', 'https://www.giftcard.co.il', true, NOW(), NOW())
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_giftcard_id FROM gift_card_networks WHERE name = 'Giftcard';

  INSERT INTO gift_card_networks (id, name, "nameEn", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'One1 Gift', 'One1', true, NOW(), NOW())
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_one1_id FROM gift_card_networks WHERE name = 'One1 Gift';

  -- ── 2. Consumer Clubs ───────────────────────────────────────────────────────

  INSERT INTO clubs (id, name, "nameEn", aliases, description, "websiteUrl", "baseDiscountPercentage", "isPaidMembership", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'הטבות חבר', 'Hever',
    '["hever","חבר","הטבות חבר"]',
    'מועדון הטבות לעובדי מדינה',
    'https://www.hever.co.il',
    10.00, false, true, NOW(), NOW()
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_hever_id FROM clubs WHERE name = 'הטבות חבר';

  INSERT INTO clubs (id, name, "nameEn", aliases, description, "baseDiscountPercentage", "isPaidMembership", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'ארגון המורים', 'Teachers Union',
    '["teachers","מורים","ארגון המורים"]',
    'הטבות לחברי ארגון המורים',
    8.00, true, true, NOW(), NOW()
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_teachers_id FROM clubs WHERE name = 'ארגון המורים';

  INSERT INTO clubs (id, name, "nameEn", aliases, description, "baseDiscountPercentage", "isPaidMembership", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'לאומי קארד', 'Leumi Card',
    '["leumi","לאומי","max"]',
    'הטבות לבעלי כרטיס לאומי קארד / מקס',
    5.00, false, true, NOW(), NOW()
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_leumi_id FROM clubs WHERE name = 'לאומי קארד';

  -- ── 3. Club ↔ Network Rules ─────────────────────────────────────────────────

  -- Hever + BuyMe: cannot combine
  INSERT INTO club_network_rules (id, "clubId", "networkId", "canCombine", "ruleDescription", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    v_hever_id, v_buyme_id,
    false,
    'אין לשלב בין כרטיסי BuyMe לבין הנחת מועדון חבר — יש לבחור מסלול אחד',
    NOW()
  )
  ON CONFLICT ("clubId", "networkId") DO NOTHING;

  -- Teachers + Giftcard: allowed to combine
  INSERT INTO club_network_rules (id, "clubId", "networkId", "canCombine", "ruleDescription", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    v_teachers_id, v_giftcard_id,
    true,
    'ניתן לשלב כרטיס מתנה Giftcard עם הנחת ארגון המורים',
    NOW()
  )
  ON CONFLICT ("clubId", "networkId") DO NOTHING;

  -- ── 4. Scraping Configs ─────────────────────────────────────────────────────

  INSERT INTO club_scraping_configs (id, "clubId", "targetUrl", "scrapeStrategy", "selectorConfig", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    v_hever_id,
    'https://www.hever.co.il/benefits',
    'playwright',
    '{"storeName":".benefit-card .store-name","discountText":".benefit-card .discount-value","restrictionText":".benefit-card .terms","paginationNext":".pagination .next"}',
    true, NOW(), NOW()
  );

  INSERT INTO club_scraping_configs (id, "clubId", "targetUrl", "scrapeStrategy", "selectorConfig", "isActive", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    v_teachers_id,
    'https://www.morim.org.il/benefits',
    'cheerio',
    '{"storeName":"table.benefits-table td.store","discountText":"table.benefits-table td.discount","restrictionText":"table.benefits-table td.terms"}',
    true, NOW(), NOW()
  );

  RAISE NOTICE 'Seed complete — clubs, networks, rules, and scraping configs inserted.';
END;
$$;
