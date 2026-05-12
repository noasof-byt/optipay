import { getJson } from 'serpapi';

export interface SerpResult {
  store: string;
  storeName: string;
  productName: string;
  originalPrice: number;
  imageUrl: string;
  productUrl: string;
}

const STORE_MAP: Record<string, { slug: string; name: string }> = {
  'zap.co.il':              { slug: 'zap',       name: 'ZAP' },
  'ksp.co.il':              { slug: 'ksp',       name: 'KSP' },
  'payngo.co.il':           { slug: 'payngo',    name: 'מחסני חשמל' },
  'bug.co.il':              { slug: 'bug',       name: 'BUG' },
  'alm.co.il':              { slug: 'alm',       name: 'א.ל.מ' },
  'shekem-electric.co.il':  { slug: 'shekem',    name: 'שקם אלקטריק' },
  'soferavi.co.il':         { slug: 'avisofer',  name: 'אבי סופר' },
  'lastprice.co.il':        { slug: 'lastprice', name: 'Last Price' },
  'ivory.co.il':            { slug: 'ivory',     name: 'Ivory' },
  'tms.co.il':              { slug: 'tms',       name: 'TMS' },
};

export async function searchWithSerpApi(query: string): Promise<SerpResult[]> {
  console.log('[SERP] Searching Google Shopping for:', query);

  try {
    const response = await getJson({
      engine: 'google_shopping',
      q: query,
      location: 'Israel',
      hl: 'he',
      gl: 'il',
      api_key: process.env.SERP_API_KEY,
    });

    const shoppingResults = response.shopping_results || [];
    console.log('[SERP] Raw results count:', shoppingResults.length);

    const results: SerpResult[] = [];

    for (const item of shoppingResults) {
      const source: string = (item.source || '').toLowerCase();
      const link: string = item.link || item.product_link || '';

      // Match store by domain
      let slug = 'other';
      let storeName = item.source || 'חנות';
      for (const [domain, info] of Object.entries(STORE_MAP)) {
        if (source.includes(domain.replace('.co.il', '').replace('.com', '')) || link.includes(domain)) {
          slug = info.slug;
          storeName = info.name;
          break;
        }
      }

      // Parse price
      let price = 0;
      if (item.extracted_price) {
        price = item.extracted_price;
      } else if (item.price) {
        const priceStr = String(item.price).replace(/[^\d.]/g, '');
        price = parseFloat(priceStr);
      }

      if (price <= 0 || !item.title) continue;

      results.push({
        store: slug,
        storeName,
        productName: item.title,
        originalPrice: price,
        imageUrl: item.thumbnail || '',
        productUrl: link,
      });
    }

    console.log('[SERP] Parsed', results.length, 'results from stores:', [...new Set(results.map(r => r.storeName))]);
    return results.sort((a, b) => a.originalPrice - b.originalPrice).slice(0, 10);

  } catch (error: unknown) {
    console.error('[SERP] ERROR:', error instanceof Error ? error.message : String(error));
    return [];
  }
}
