/**
 * ZAP (zap.co.il) Real-Time Price Scraper
 *
 * Anti-bot bypass strategy:
 *   ZAP uses Cloudflare Bot Management + a custom bot token (TS**** cookies)
 *   generated via a JS challenge on first visit.  Direct HTTP requests
 *   (even with the correct session cookies from the homepage) are redirected
 *   to /error because the TS token requires JS execution to compute.
 *
 *   Solution — Playwright XHR interception:
 *   1. Load ZAP's search page in the stealth browser (passes CF + JS challenge)
 *   2. Register route handlers BEFORE navigation for the two AJAX endpoints:
 *        • /api/CatalogAPI/SearchModels   → gives us modelId
 *        • /api/CatalogAPI/GetModelPrices → gives us the price list
 *   3. Both calls succeed because the browser context has the valid TS cookies
 *   4. We resolve Promises with the JSON payloads and close the page
 *
 *   Fallback: If the XHR calls don't fire (page structure change), scrape
 *   the rendered DOM for product cards and prices.
 */

import type { Page }   from "playwright";
import { LivePrice }   from "@/types/search";
import { logger }      from "@/lib/logger";
import {
  acquirePage,
  releasePage,
  navigateTo,
  scrollToBottom,
} from "../../scraper/engine/playwrightEngine";

const ZAP_BASE = "https://www.zap.co.il";

// ZAP search page — the React SPA that issues the AJAX calls we intercept
const ZAP_SEARCH_URL = (q: string) =>
  `${ZAP_BASE}/search.aspx?keyword=${encodeURIComponent(q)}&pageindex=1`;

// URL glob patterns for route interception
const SEARCH_PATTERN = "**/api/CatalogAPI/SearchModels**";
const PRICES_PATTERN = "**/api/CatalogAPI/GetModelPrices**";

// DOM selectors used in the fallback DOM scrape
const SEL = {
  productCard:  ".ModelBox, .model-item, [data-testid='model-item'], .model-box-container",
  productName:  ".ModelName, .model-name, h2.title, [data-testid='model-name']",
  productLink:  "a.ModelName, a.model-link, .ModelBox a, .model-item a",
  priceRow:     ".PriceRow, .shop-row, [data-testid='price-row'], .price-row-item, .shopItem",
  shopName:     ".ShopName, .shop-name, [data-testid='shop-name'], .shopTitle",
  shopPrice:    ".price, .PriceVal, [data-testid='price-value'], .PriceNumber, .shopPrice",
  shopLink:     "a.shopLink, a.shop-link, .ShopLogo a, .price-link, a[href*='click']",
  cookieAccept: "#onetrust-accept-btn-handler, .cookie-accept, [aria-label='Accept']",
  popupClose:   ".modal-close, [aria-label='סגור'], .CloseBtn, .close-btn",
} as const;

// ── Types returned by ZAP's AJAX API ──────────────────────────────────────────

interface ZapModel {
  modelId:   number;
  modelName: string;
  minPrice?: number;
  seoUrl?:   string;
  url?:      string;
}

interface ZapSearchResponse {
  models?: ZapModel[];
  Models?: ZapModel[];
  data?:   { models?: ZapModel[] };
}

interface ZapPriceRow {
  shopName?:    string;
  ShopName?:    string;
  price?:       number | string;
  Price?:       number | string;
  shopLink?:    string;
  ShopLink?:    string;
  isAvailable?: boolean;
  IsAvailable?: boolean;
}

interface ZapPricesResponse {
  prices?: ZapPriceRow[];
  Prices?: ZapPriceRow[];
  data?:   { prices?: ZapPriceRow[] };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeZap(
  hebrewQuery: string,
  storageGB?:  number,
): Promise<LivePrice[]> {
  const page = await acquirePage();

  try {
    // ── Set up XHR interception before navigation ─────────────────────────
    let resolveSearch!: (d: ZapSearchResponse) => void;
    let resolvePrices!: (d: ZapPricesResponse) => void;

    const searchPromise = new Promise<ZapSearchResponse>((r) => { resolveSearch = r; });
    const pricesPromise = new Promise<ZapPricesResponse>((r) => { resolvePrices = r; });

    await page.route(SEARCH_PATTERN, async (route) => {
      try {
        const response = await route.fetch();
        const json: ZapSearchResponse = await response.json().catch(() => ({}));
        resolveSearch(json);
        await route.fulfill({ response });
      } catch {
        await route.continue();
      }
    });

    await page.route(PRICES_PATTERN, async (route) => {
      try {
        const response = await route.fetch();
        const json: ZapPricesResponse = await response.json().catch(() => ({}));
        resolvePrices(json);
        await route.fulfill({ response });
      } catch {
        await route.continue();
      }
    });

    // ── Navigate (passes Cloudflare because of stealth browser) ───────────
    logger.info("ZAP: navigating to search page", { query: hebrewQuery });
    await navigateTo(page, ZAP_SEARCH_URL(hebrewQuery));
    await dismissOverlays(page);

    // Wait up to 15 s for the SearchModels XHR to fire
    const searchData = await Promise.race([
      searchPromise,
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]);

    if (searchData) {
      const models: ZapModel[] =
        searchData.models ?? searchData.Models ?? searchData.data?.models ?? [];
      const model = pickBestModel(models, hebrewQuery, storageGB);

      if (model) {
        logger.info("ZAP: XHR search intercepted", { modelId: model.modelId, name: model.modelName });

        // The prices XHR fires when the user clicks a product — wait a bit
        // in case it fires automatically, otherwise it arrives after clicking
        const pricesData = await Promise.race([
          pricesPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 8_000)),
        ]);

        if (pricesData) {
          const rows: ZapPriceRow[] =
            pricesData.prices ?? pricesData.Prices ?? pricesData.data?.prices ?? [];
          if (rows.length) {
            logger.info("ZAP: XHR prices intercepted", { rows: rows.length });
            return parsePriceRows(rows);
          }
        }

        // Prices XHR didn't auto-fire — navigate to the model page to trigger it
        const modelUrl = model.seoUrl ?? model.url;
        if (modelUrl) {
          const fullModelUrl = modelUrl.startsWith("http")
            ? modelUrl
            : `${ZAP_BASE}${modelUrl}`;

          logger.info("ZAP: navigating to model page to trigger prices XHR", { fullModelUrl });
          await navigateTo(page, fullModelUrl);
          await dismissOverlays(page);

          const pricesData2 = await Promise.race([
            pricesPromise,
            new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
          ]);

          if (pricesData2) {
            const rows: ZapPriceRow[] =
              pricesData2.prices ?? pricesData2.Prices ?? pricesData2.data?.prices ?? [];
            if (rows.length) {
              logger.info("ZAP: prices XHR captured after model navigation", { rows: rows.length });
              return parsePriceRows(rows);
            }
          }
        }
      }
    }

    // ── Fallback: DOM scrape ───────────────────────────────────────────────
    logger.info("ZAP: XHR not captured — falling back to DOM scrape", { query: hebrewQuery });
    return await scrapeDom(page, hebrewQuery, storageGB);

  } catch (err) {
    logger.warn("ZAP scraper failed", { err: String(err) });
    return [];
  } finally {
    await releasePage(page);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePriceRows(rows: ZapPriceRow[]): LivePrice[] {
  return rows
    .slice(0, 6)
    .map((row): LivePrice | null => {
      const shopName = row.shopName ?? row.ShopName;
      if (!shopName) return null;

      const priceRaw = row.price ?? row.Price;
      const price    = parsePriceILS(String(priceRaw ?? ""));
      if (!price) return null;

      const href    = row.shopLink ?? row.ShopLink ?? "";
      const url     = href.startsWith("http") ? href : `${ZAP_BASE}${href}`;
      const inStock = row.isAvailable ?? row.IsAvailable ?? true;

      return {
        storeName: shopName,
        price,
        currency:  "ILS",
        url,
        inStock,
        source:    "zap",
        fetchedAt: new Date(),
      };
    })
    .filter((r): r is LivePrice => r !== null);
}

function pickBestModel(
  models:    ZapModel[],
  query:     string,
  storageGB?: number,
): ZapModel | null {
  if (!models.length) return null;
  if (!storageGB)     return models[0];

  const candidates = models.filter((m) => {
    const name = (m.modelName ?? "").toLowerCase();
    return [
      `${storageGB}gb`, `${storageGB} gb`,
      `${storageGB}ג`,  `${storageGB} גיגה`,
      storageGB >= 1024 ? `${storageGB / 1024}tb` : "",
    ].filter(Boolean).some((p) => name.includes(p));
  });

  return candidates[0] ?? models[0];
}

async function scrapeDom(
  page:       Page,
  query:      string,
  storageGB?: number,
): Promise<LivePrice[]> {
  await scrollToBottom(page);
  const results: LivePrice[] = [];

  const modelUrl = await pickBestProductFromPage(page, query, storageGB);
  if (!modelUrl) {
    logger.warn("ZAP DOM: no matching product found", { query });
    return [];
  }

  logger.info("ZAP DOM: navigating to model page", { modelUrl });
  await navigateTo(page, modelUrl);
  await dismissOverlays(page);
  await page
    .waitForSelector(SEL.priceRow, { timeout: 15_000 })
    .catch(() => {});
  await scrollToBottom(page);

  const rows = await page.$$(SEL.priceRow);
  for (const row of rows) {
    try {
      const nameEl    = await row.$(SEL.shopName);
      const storeName = nameEl ? (await nameEl.innerText()).trim() : null;
      if (!storeName) continue;

      const priceEl = await row.$(SEL.shopPrice);
      if (!priceEl) continue;
      const price = parsePriceILS((await priceEl.innerText()).trim());
      if (!price || price <= 0) continue;

      const linkEl   = await row.$(SEL.shopLink);
      const href     = linkEl ? (await linkEl.getAttribute("href") ?? "") : "";
      const storeUrl = href.startsWith("http") ? href : `${ZAP_BASE}${href}`;

      results.push({
        storeName,
        price,
        currency:  "ILS",
        url:       storeUrl,
        inStock:   true,
        source:    "zap",
        fetchedAt: new Date(),
      });
    } catch { /* skip bad row */ }
  }

  logger.info("ZAP DOM scrape complete", { query, prices: results.length });
  return results;
}

async function pickBestProductFromPage(
  page:       Page,
  query:      string,
  storageGB?: number,
): Promise<string | null> {
  const cards = await page.$$(SEL.productCard);
  if (!cards.length) return null;

  const queryLower = query.toLowerCase();

  for (const card of cards) {
    const nameEl = await card.$(SEL.productName);
    if (!nameEl) continue;
    const name = (await nameEl.innerText()).toLowerCase();

    if (storageGB) {
      const hasStorage = [
        `${storageGB}gb`, `${storageGB} gb`,
        `${storageGB}ג`,  `${storageGB} גיגה`,
      ].some((p) => name.includes(p));
      if (!hasStorage) continue;
    }

    const terms   = queryLower.split(/\s+/).filter((t) => t.length > 1);
    const matched = terms.filter((t) => name.includes(t));
    if (!matched.length) continue;

    const linkEl = await card.$(SEL.productLink);
    if (!linkEl) continue;
    const href = await linkEl.getAttribute("href");
    if (!href) continue;
    return href.startsWith("http") ? href : `${ZAP_BASE}${href}`;
  }

  // Fallback: first link
  const first = await page.$(SEL.productLink);
  if (!first) return null;
  const href  = await first.getAttribute("href");
  return href ? (href.startsWith("http") ? href : `${ZAP_BASE}${href}`) : null;
}

async function dismissOverlays(page: Page): Promise<void> {
  for (const sel of [SEL.cookieAccept, SEL.popupClose]) {
    const el = await page.$(sel).catch(() => null);
    if (el) {
      await el.click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

function parsePriceILS(raw: string): number | null {
  const cleaned = raw.replace(/[₪\s,]/g, "").replace(/ש["׳]ח/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
