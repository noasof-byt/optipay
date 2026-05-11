import "server-only";
/**
 * Payngo / מחסני החשמל (payngo.co.il) Price Scraper
 *
 * Tries three approaches in order:
 *   1. Shopify suggest.json  (with full browser headers incl. Referer)
 *   2. Shopify GraphQL storefront API (anonymous — some stores allow it)
 *   3. Shopify products.json
 *
 * NO Playwright — fetch + JSON only (Vercel serverless constraint).
 */

import { LivePrice } from "@/types/search";
import { logger }    from "@/lib/logger";

const PAYNGO_BASE = "https://www.payngo.co.il";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Accept":          "application/json",
  "Referer":         "https://www.payngo.co.il/",
  "Accept-Language": "he-IL,he;q=0.9",
};

export async function scrapePayngo(query: string): Promise<LivePrice[]> {
  const eq = encodeURIComponent(query);

  // ── Endpoint 1: Shopify suggest.json ─────────────────────────────────────
  const ep1 = `${PAYNGO_BASE}/search/suggest.json?q=${eq}&resources[type]=product&resources[limit]=5`;
  logger.info("[PAYNGO] Trying endpoint 1 (suggest.json)", { url: ep1 });
  try {
    const res = await fetch(ep1, {
      headers:  BROWSER_HEADERS,
      signal:   AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[PAYNGO] Response preview: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const products: Record<string, unknown>[] =
        data?.resources?.results?.products ?? [];
      if (products.length) {
        // Shopify suggest prices are in cents (e.g. "109000" = ₪1090)
        const results = products.slice(0, 5).map((p) => ({
          storeName: "מחסני החשמל",
          price:     Number(p.price ?? 0) / 100,
          currency:  "ILS",
          url:       String(p.url ?? "").startsWith("http")
            ? String(p.url)
            : `${PAYNGO_BASE}${p.url ?? ""}`,
          inStock:   true,
          source:    "payngo" as const,
          fetchedAt: new Date(),
        })).filter((r) => r.price >= 10 && r.price <= 1_000_000);
        if (results.length) return results;
      }
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 1 failed", { err: String(e) });
  }

  // ── Endpoint 2: Shopify Storefront GraphQL (anonymous) ────────────────────
  const gqlUrl = `${PAYNGO_BASE}/api/2024-01/graphql.json`;
  logger.info("[PAYNGO] Trying endpoint 2 (Storefront GraphQL)", { url: gqlUrl });
  try {
    const gqlQuery = `{
      products(first: 5, query: "${query.replace(/"/g, '\\"')}") {
        edges {
          node {
            title
            priceRange { minVariantPrice { amount } }
            onlineStoreUrl
            featuredImage { url }
          }
        }
      }
    }`;
    const res = await fetch(gqlUrl, {
      method:  "POST",
      headers: {
        "Content-Type":                       "application/json",
        "Accept":                             "application/json",
        "X-Shopify-Storefront-Access-Token":  "",
      },
      body:    JSON.stringify({ query: gqlQuery }),
      signal:  AbortSignal.timeout(10_000),
    });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[PAYNGO] Response preview: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const edges: Record<string, unknown>[] =
        data?.data?.products?.edges ?? [];
      if (edges.length) {
        const results = edges.slice(0, 5).map((edge) => {
          const node = edge.node as Record<string, unknown>;
          const price = Number(
            (node.priceRange as Record<string, unknown>)
              ?.minVariantPrice
              ? ((node.priceRange as Record<string, unknown>).minVariantPrice as Record<string, unknown>).amount
              : 0
          );
          const url = String(node.onlineStoreUrl ?? PAYNGO_BASE);
          return {
            storeName: "מחסני החשמל",
            price,
            currency:  "ILS",
            url,
            inStock:   true,
            source:    "payngo" as const,
            fetchedAt: new Date(),
          };
        }).filter((r) => r.price >= 10 && r.price <= 1_000_000);
        if (results.length) return results;
      }
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 2 (GraphQL) failed", { err: String(e) });
  }

  // ── Endpoint 3: Shopify products.json ────────────────────────────────────
  const ep3 = `${PAYNGO_BASE}/collections/all/products.json?limit=5`;
  logger.info("[PAYNGO] Trying endpoint 3 (products.json)", { url: ep3 });
  try {
    const res = await fetch(ep3, {
      headers:  BROWSER_HEADERS,
      signal:   AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[PAYNGO] Response preview: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const products: Record<string, unknown>[] = data?.products ?? [];
      const queryLower = query.toLowerCase();
      // Filter to products matching the query by title
      const matching = products
        .filter((p) => String(p.title ?? "").toLowerCase().includes(queryLower))
        .slice(0, 5);
      const source = matching.length ? matching : products.slice(0, 5);
      if (source.length) {
        const results = source.map((p) => {
          const variants = (p.variants as Record<string, unknown>[] | undefined) ?? [];
          const price = variants[0]
            ? Number((variants[0] as Record<string, unknown>).price ?? 0)
            : 0;
          return {
            storeName: "מחסני החשמל",
            price,
            currency:  "ILS",
            url:       `${PAYNGO_BASE}/products/${p.handle ?? ""}`,
            inStock:   true,
            source:    "payngo" as const,
            fetchedAt: new Date(),
          };
        }).filter((r) => r.price >= 10 && r.price <= 1_000_000);
        if (results.length) return results;
      }
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 3 failed", { err: String(e) });
  }

  logger.warn("[PAYNGO] All endpoints failed", { query });
  return [];
}
