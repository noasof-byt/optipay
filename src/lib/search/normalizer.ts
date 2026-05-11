/**
 * Product Query Normalizer — Phase 4 implementation.
 *
 * Uses Gemini API to extract structured product information from a free-text
 * query in Hebrew or English.  Falls back to returning the raw query when the
 * API is unavailable or errors out.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface NormalizerResult {
  canonical: string;
  brand:     string;
  model:     string;
  specs:     string[];
}

const SYSTEM_PROMPT = `You are a product search normalizer for Israeli retail.
Given a user query in Hebrew or English, extract:
- canonical: the product name in ENGLISH ONLY (e.g. "iPhone 15", NOT "אייפון 15"). MUST be English.
- brand: brand name in English (e.g. "Apple", "Samsung")
- model: model number/name in English if present (e.g. "15 Pro Max", "Galaxy S24")
- specs: array of key specs in English (storage, color, size, etc.)
Return ONLY a JSON object: { canonical: string, brand: string, model: string, specs: string[] }
IMPORTANT: canonical, brand, and model MUST be in English. Never return Hebrew characters in canonical.`;

export async function normalizeQuery(query: string): Promise<NormalizerResult> {
  const fallback: NormalizerResult = {
    canonical: query,
    brand:     "",
    model:     "",
    specs:     [],
  };

  if (!process.env.GEMINI_API_KEY) return fallback;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model:            "gemini-2.5-flash",
      generationConfig: { temperature: 0, maxOutputTokens: 300 },
    });

    const result = await model.generateContent(
      `${SYSTEM_PROMPT}\n\nQuery: "${query}"`
    );

    const raw = result.response.text().trim();
    if (!raw) return fallback;

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(jsonText);

    return {
      canonical: typeof parsed.canonical === "string" && parsed.canonical
        ? parsed.canonical
        : query,
      brand:     typeof parsed.brand === "string"  ? parsed.brand  : "",
      model:     typeof parsed.model === "string"  ? parsed.model  : "",
      specs:     Array.isArray(parsed.specs)        ? parsed.specs  : [],
    };

  } catch {
    return fallback;
  }
}
