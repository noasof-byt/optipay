/**
 * Hebrew/English Product Query Normalizer + NLP Parser
 *
 * Uses Google Gemini to:
 *   1. Detect the canonical product the user is asking about
 *   2. Extract structured attributes (brand, model, storage, color, etc.)
 *   3. Return a cleaned English search query for scrapers
 *      AND a Hebrew query for ZAP
 *
 * Also maintains a local regex-based fast path for common patterns
 * (storage sizes, common brand name variants) to reduce API calls
 * and latency.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedProduct } from "@/types/search";
import { logger } from "@/lib/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ── Fast-path local rules (no API call needed) ────────────────────────────────

const STORAGE_PATTERN = /(\d+)\s*(?:gb|גיגה|ג["׳]|tb|טרה)/i;

const BRAND_ALIASES: Record<string, string> = {
  // Hebrew → canonical
  "אפל":       "Apple",
  "סמסונג":    "Samsung",
  "סוני":      "Sony",
  "שיאומי":    "Xiaomi",
  "הואווי":    "Huawei",
  "אלג'י":     "LG",
  "אל-ג'י":    "LG",
  "אונר":      "Honor",
  "גוגל":      "Google",
  // English slang / typo variants
  "iphone":    "Apple iPhone",
  "ipad":      "Apple iPad",
  "macbook":   "Apple MacBook",
  "airpods":   "Apple AirPods",
  "galaxy":    "Samsung Galaxy",
  "pixel":     "Google Pixel",
};

const STORAGE_WORDS: Record<string, number> = {
  "128": 128, "256": 256, "512": 512,
  "1tb": 1024, "1 tb": 1024, "1טרה": 1024,
  "2tb": 2048, "2 tb": 2048,
};

function extractStorageLocal(query: string): number | undefined {
  for (const [key, val] of Object.entries(STORAGE_WORDS)) {
    if (query.toLowerCase().includes(key)) return val;
  }
  const match = query.match(STORAGE_PATTERN);
  return match ? parseInt(match[1], 10) : undefined;
}

function normalizeBrandsLocal(query: string): string {
  let result = query;
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    const regex = new RegExp(`\\b${alias}\\b`, "gi");
    result = result.replace(regex, canonical);
  }
  return result;
}

// ── Gemini NLP ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a product search assistant for an Israeli price-comparison app.
The user will give you a product query in Hebrew or English (or mixed).
Your job is to extract structured product information and return ONLY valid JSON.

Return this exact shape:
{
  "canonicalQuery": "string — the best English search query for price scrapers (short, no fluff)",
  "hebrewQuery": "string — the best Hebrew search query for ZAP.co.il",
  "brand": "string or null",
  "model": "string or null",
  "storageGB": "number or null",
  "color": "string or null — in English",
  "category": "string or null — e.g. smartphone, laptop, headphones, tv, appliance",
  "attributes": "object — any other relevant k/v like screenSize, ram, etc."
}

Rules:
- canonicalQuery must be in English and suitable for a URL query string
- hebrewQuery should be natural Hebrew as a ZAP user would type it
- storageGB must be a number (convert TB to GB: 1TB=1024)
- Do NOT invent attributes that are not mentioned
- Respond with ONLY the JSON object, no markdown, no explanation`;

export interface NlpResult extends ParsedProduct {
  hebrewQuery: string;
}

export async function parseProductQuery(rawQuery: string): Promise<NlpResult> {
  // ── Fast path: local extraction before calling Gemini ───────────────────
  const storageGB  = extractStorageLocal(rawQuery);
  const normalised = normalizeBrandsLocal(rawQuery);

  // If no API key configured, skip the API call
  if (!process.env.GEMINI_API_KEY) {
    return { canonicalQuery: normalised, hebrewQuery: rawQuery, storageGB, attributes: {} };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0, maxOutputTokens: 400 },
    });

    const result = await model.generateContent(
      `${SYSTEM_PROMPT}\n\nQuery: "${rawQuery}"`
    );

    const raw = result.response.text().trim();
    if (!raw) throw new Error("Empty Gemini response");

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed   = JSON.parse(jsonText);

    return {
      canonicalQuery: parsed.canonicalQuery ?? normalised,
      hebrewQuery:    parsed.hebrewQuery    ?? rawQuery,
      brand:          parsed.brand          ?? undefined,
      model:          parsed.model          ?? undefined,
      storageGB:      parsed.storageGB      ?? storageGB,
      color:          parsed.color          ?? undefined,
      category:       parsed.category       ?? undefined,
      attributes:     parsed.attributes     ?? {},
    };

  } catch (err) {
    logger.warn("Gemini NLP failed — using local fallback", { err: String(err) });

    return {
      canonicalQuery: normalised,
      hebrewQuery:    rawQuery,
      storageGB,
      attributes:     {},
    };
  }
}
