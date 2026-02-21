import { PriceAnalysisSchema, type PlatformProduct, type PriceAnalysis, type PlatformResults } from "@repo/types";
import { structuredComplete } from "../services/claude.service.js";

function buildSystemPrompt(localCurrencyCode: string, exchangeRate: number): string {
  return `You are a wholesale sourcing analyst. You will receive product listings from up to 7 data sources:

WHOLESALE sources:
- "aliexpress" — AliExpress (structured API data, supplier/wholesale pricing)
- "wholesale" — Other wholesale marketplaces (Alibaba, DHgate, Made-in-China, Global Sources), extracted via web search

RETAIL sources:
- "amazon", "ebay", "walmart", "google_shopping" — US retail platforms

LOCAL RETAIL:
- "local_retail" — Retail prices in the user's target market/country

EXCHANGE RATE: 1 USD = ${exchangeRate} ${localCurrencyCode}

Guidelines:
- wholesale_floor: Use the lowest price from aliexpress or wholesale sources. These are supplier prices.
- retail_ceiling: Use the highest price from Amazon, Walmart, eBay, or Google Shopping.
- local_retail_median: Compute the median from local_retail listings (in USD). If local listings have price_local but no USD price, use the exchange rate to convert.
- gross_margin_pct_min: ((local_retail_median - wholesale_floor) / local_retail_median) × 100
- gross_margin_pct_max: ((retail_ceiling - wholesale_floor) / retail_ceiling) × 100
- All "_local" fields are the USD amount × ${exchangeRate}.
- best_source_platform: Platform offering best value for bulk sourcing.
- If a source has no results, note it in the summary but still compute what you can.
- summary: 2-4 sentence synthesis covering wholesale supply, retail pricing, local market, and importable margin.`;
}

export async function synthesizePrices(
  platformResults: PlatformResults,
  localCurrencyCode: string,
  exchangeRate: number,
): Promise<PriceAnalysis> {
  const sections = (Object.entries(platformResults) as [string, PlatformProduct[]][])
    .map(([platform, products]) => {
      if (products.length === 0) {
        return `## ${platform.toUpperCase()}\nNo results found.`;
      }
      const lines = products.map((p, i) =>
        [
          `${i + 1}. "${p.title}"`,
          `   Price USD: ${p.price_formatted} (raw: ${p.price_raw ?? "N/A"})`,
          p.price_local != null ? `   Price local: ${p.price_local} ${p.local_currency_code ?? localCurrencyCode}` : null,
          p.moq ? `   MOQ: ${p.moq} ${p.unit ?? "units"}` : null,
          p.rating != null ? `   Rating: ${p.rating}/5 (${p.review_count ?? 0} reviews)` : null,
          p.seller_name ? `   Seller: ${p.seller_name}${p.is_verified ? " ✓ verified" : ""}` : null,
          p.source_domain ? `   Source: ${p.source_domain}` : null,
          p.condition ? `   Condition: ${p.condition}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return `## ${platform.toUpperCase()} (${products.length} results)\n${lines.join("\n\n")}`;
    })
    .join("\n\n---\n\n");

  return structuredComplete({
    system: buildSystemPrompt(localCurrencyCode, exchangeRate),
    user: `Analyze these product listings across all sources:\n\n${sections}`,
    schema: PriceAnalysisSchema,
    maxTokens: 1500,
  });
}
