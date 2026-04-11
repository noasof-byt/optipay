/**
 * Benefit Parser
 *
 * Extracts structured benefit data from raw Hebrew/English scraped text.
 * Handles discount percentages, restriction rules, and store names.
 *
 * All regex patterns are designed to be permissive about whitespace and
 * Hebrew/English number mixing common in Israeli retail copy.
 */

export interface ParsedBenefit {
  storeName: string;
  discountPercentage: number | null;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  noDoubleDiscount: boolean;
  restrictions: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
}

// ── Discount percentage patterns ─────────────────────────────────────────────
// Matches: "10%", "10 %", "10 אחוז", "הנחה של 15%", "10% off"
const DISCOUNT_PATTERNS = [
  /(\d{1,3}(?:\.\d{1,2})?)\s*%/,
  /(\d{1,3}(?:\.\d{1,2})?)\s*אחוז/,
  /הנחה(?:\s+של)?\s+(\d{1,3}(?:\.\d{1,2})?)/,
  /discount\s+of\s+(\d{1,3}(?:\.\d{1,2})?)/i,
];

// ── "No double dipping" restriction phrases ───────────────────────────────────
const NO_DOUBLE_DISCOUNT_PHRASES = [
  /לא\s+בכפל\s+מבצעים/,
  /אין\s+כפל\s+מבצעים/,
  /איסור\s+כפל\s+מבצעים/,
  /לא\s+כולל\s+מבצעים/,
  /לא\s+ניתן\s+לצרף/,
  /לא\s+לשילוב/,
  /לא\s+בשילוב\s+עם/,
  /cannot\s+be\s+combined/i,
  /no\s+double\s+dipping/i,
  /not\s+valid\s+with\s+other\s+offers/i,
];

// ── Max discount amount ───────────────────────────────────────────────────────
// Matches: "עד 50 ש\"ח", "up to ₪100", "maximum ₪50"
const MAX_AMOUNT_PATTERNS = [
  /עד\s+(\d+(?:\.\d{2})?)\s*(?:ש[״"]ח|שקל|₪)/,
  /מקסימום\s+(\d+(?:\.\d{2})?)\s*(?:ש[״"]ח|שקל|₪)/,
  /up\s+to\s+(?:₪|ils)?\s*(\d+(?:\.\d{2})?)/i,
  /maximum\s+(?:₪|ils)?\s*(\d+(?:\.\d{2})?)/i,
];

// ── Minimum purchase ──────────────────────────────────────────────────────────
// Matches: "בקנייה מ-100 ש\"ח", "minimum purchase ₪50"
const MIN_PURCHASE_PATTERNS = [
  /בקנייה\s+(?:מ(?:על|ינימום)?[-–]?\s*)(\d+(?:\.\d{2})?)\s*(?:ש[״"]ח|שקל|₪)/,
  /לקנייה\s+מינימלית\s+(?:של\s+)?(\d+(?:\.\d{2})?)\s*(?:ש[״"]ח|שקל|₪)/,
  /minimum\s+purchase\s+(?:of\s+)?(?:₪|ils)?\s*(\d+(?:\.\d{2})?)/i,
];

// ── Date patterns ─────────────────────────────────────────────────────────────
// Matches: "עד 31.12.2025", "until 31/12/2025", "תוקף עד 31.12.25"
const VALID_UNTIL_PATTERNS = [
  /(?:עד|בתוקף\s+עד|תוקף\s+עד)\s+(\d{1,2})[./](\d{1,2})[./](\d{2,4})/,
  /(?:until|valid\s+until)\s+(\d{1,2})[./](\d{1,2})[./](\d{2,4})/i,
];

// ─────────────────────────────────────────────────────────────────────────────

function parsePercentage(text: string): number | null {
  for (const pattern of DISCOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0 && value <= 100) return value;
    }
  }
  return null;
}

function parseAmount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  return null;
}

function parseValidUntil(text: string): Date | null {
  for (const pattern of VALID_UNTIL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const day   = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
      let year    = parseInt(match[3], 10);
      if (year < 100) year += 2000;
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

function hasNoDoubleDiscount(text: string): boolean {
  return NO_DOUBLE_DISCOUNT_PHRASES.some((pattern) => pattern.test(text));
}

/**
 * Parse a single raw benefit text block into a structured `ParsedBenefit`.
 * `storeName` must be passed in from the outer scraper context.
 */
export function parseBenefit(
  storeName: string,
  rawText: string
): ParsedBenefit {
  const text = rawText.trim();

  return {
    storeName:          storeName.trim(),
    discountPercentage: parsePercentage(text),
    maxDiscountAmount:  parseAmount(text, MAX_AMOUNT_PATTERNS),
    minPurchaseAmount:  parseAmount(text, MIN_PURCHASE_PATTERNS),
    noDoubleDiscount:   hasNoDoubleDiscount(text),
    restrictions:       text.length > 0 ? text : null,
    validFrom:          null, // most clubs don't publish start dates
    validUntil:         parseValidUntil(text),
  };
}

/**
 * Parse an array of raw [storeName, benefitText] pairs in bulk.
 * Filters out entries where no discount could be extracted and the
 * storeName is empty — these are usually navigation noise.
 */
export function parseBenefits(
  rows: Array<{ storeName: string; rawText: string }>
): ParsedBenefit[] {
  return rows
    .map(({ storeName, rawText }) => parseBenefit(storeName, rawText))
    .filter(
      (b) => b.storeName.length > 0 && (b.discountPercentage !== null || b.restrictions !== null)
    );
}
