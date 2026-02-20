import { PriceAnalysisSchema, type PlatformProduct, type PriceAnalysis, type Platform } from "@repo/types";
import { complete } from "../services/claude.service.js";

const SYSTEM_PROMPT = `You are a wholesale sourcing analyst. You will receive product listings from up to 5 different platforms (Alibaba, Amazon, eBay, Walmart, Google Shopping). Your job is to synthesize these into a cross-platform price analysis.

You MUST respond with a single JSON object (no markdown, no explanation) matching this exact schema:
{
  "wholesale_floor": <number or null — lowest wholesale/bulk price from Alibaba or similar>,
  "retail_ceiling": <number or null — highest retail price from Amazon/Walmart>,
  "currency": "USD",
  "gross_margin_pct_min": <number or null — minimum estimated margin % between wholesale and retail>,
  "gross_margin_pct_max": <number or null — maximum estimated margin % between wholesale and retail>,
  "best_source_platform": <"alibaba"|"amazon"|"ebay"|"walmart"|"google_shopping"|null — best platform to source from>,
  "arbitrage_signal": <string or null — brief note on any arbitrage opportunity>,
  "summary": "<2-4 sentence synthesis of pricing landscape across all platforms>"
}

Guidelines:
- wholesale_floor: Use the lowest Alibaba unit price when available. If Alibaba has no results, use the lowest price from any platform.
- retail_ceiling: Use the highest price seen on Amazon or Walmart. If neither has results, use the highest price from any platform.
- gross_margin_pct: Calculate as ((retail - wholesale) / retail) * 100. Provide a range if prices vary.
- best_source_platform: The platform offering the best value for bulk sourcing (considering price, MOQ, and seller reliability).
- arbitrage_signal: Note any interesting price gaps between platforms (e.g., eBay lots significantly below retail).
- If a platform returned no results, mention that in the summary.
- All prices should be interpreted as USD unless stated otherwise.`;

export async function synthesizePrices(
  platformResults: Record<Platform, PlatformProduct[]>,
): Promise<PriceAnalysis> {
  const sections = Object.entries(platformResults)
    .map(([platform, products]) => {
      if (products.length === 0) {
        return `## ${platform.toUpperCase()}\nNo results found.`;
      }
      const lines = products.map((p, i) =>
        [
          `${i + 1}. "${p.title}"`,
          `   Price: ${p.price_formatted} (raw: ${p.price_raw ?? "N/A"})`,
          p.moq ? `   MOQ: ${p.moq} ${p.unit ?? "units"}` : null,
          p.rating != null ? `   Rating: ${p.rating}/5 (${p.review_count ?? 0} reviews)` : null,
          p.seller_name ? `   Seller: ${p.seller_name}${p.is_verified ? " ✓ verified" : ""}` : null,
          p.condition ? `   Condition: ${p.condition}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return `## ${platform.toUpperCase()} (${products.length} results)\n${lines.join("\n\n")}`;
    })
    .join("\n\n---\n\n");

  const raw = await complete<Record<string, unknown>>({
    system: SYSTEM_PROMPT,
    user: `Analyze these product listings across platforms:\n\n${sections}`,
    maxTokens: 1024,
  });

  return PriceAnalysisSchema.parse(raw);
}
