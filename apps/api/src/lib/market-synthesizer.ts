import { structuredComplete } from "../services/claude.service.js";
import type { TavilyResponse } from "../services/tavily.service.js";
import { MarketSourceSchema, type MarketReport } from "@repo/types";
import { z } from "zod";

const MarketReportLLMSchema = z.object({
  country_code: z.string(),
  competition_level: z.enum(["low", "medium", "high", "very_high"]),
  top_competitors: z.array(z.string()),
  top_channels: z.array(z.string()),
  positioning_tip: z.string(),
  summary: z.string(),
  sources: z.array(MarketSourceSchema),
});

const MARKET_SYNTHESIS_SYSTEM = `You are a market research analyst helping importers understand the competitive landscape for a product category in a specific country.

Your task: analyze web search results about the market for a product category in a target country. Produce a practical market intelligence report.

Guidelines:

1. **Competition Level**: Assess as "low", "medium", "high", or "very_high" based on:
   - Number and strength of existing players
   - Market saturation signals
   - Barrier to entry indicators
   - Brand dominance

2. **Top Competitors**: List the 3-8 most relevant competitors or brands in this market.
   - Include both local and international players
   - Focus on those actually selling in the target country

3. **Top Channels**: List the 3-6 best sales/distribution channels for this product in this country.
   - Include both online marketplaces and offline channels if relevant
   - Prioritize by volume and accessibility for a new entrant

4. **Positioning Tip**: One actionable paragraph (2-4 sentences) on how a new entrant should position themselves.
   - Price point strategy, differentiation angle, target segment
   - Be specific and practical, not generic

5. **Summary**: 2-3 sentence executive summary of the market opportunity.
   - Key insight about demand, competition, and timing
   - Mention any notable gaps or opportunities

6. **Sources**: Cite all sources used. Include relevance_score (0-1).

IMPORTANT:
- Only include information supported by the search results
- Be honest about competition level — don't sugarcoat a saturated market
- Focus on actionable intelligence, not academic analysis`;

export async function synthesizeMarketReport(
  countryCode: string,
  tavilyResults: TavilyResponse[],
): Promise<MarketReport> {
  const allResults = tavilyResults.flatMap((r) => r.results);
  const answers = tavilyResults
    .filter((r) => r.answer)
    .map((r) => r.answer)
    .join("\n\n");

  const userPrompt = `Analyze the market landscape for importing into country "${countryCode}":

## Tavily AI Summaries
${answers || "No AI summaries available."}

## Web Search Results
${allResults
    .map(
      (result, idx) => `
### Source ${idx + 1}: ${result.title}
URL: ${result.url}
Content: ${result.content}
`,
    )
    .join("\n---\n")}

Synthesize into a practical market intelligence report for a product importer.`;

  try {
    const result = await structuredComplete({
      system: MARKET_SYNTHESIS_SYSTEM,
      user: userPrompt,
      schema: MarketReportLLMSchema,
      maxTokens: 3072,
    });

    return {
      country_code: countryCode,
      competition_level: result.competition_level,
      top_competitors: result.top_competitors,
      top_channels: result.top_channels,
      positioning_tip: result.positioning_tip,
      summary: result.summary,
      sources: result.sources,
    };
  } catch (err) {
    console.error("Market synthesis failed:", err);

    return {
      country_code: countryCode,
      competition_level: "medium",
      top_competitors: [],
      top_channels: [],
      positioning_tip:
        "Unable to generate positioning advice. Please research the local market manually.",
      summary:
        "Unable to synthesize market data. Please consult local market research reports.",
      sources: allResults.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        domain: new URL(r.url).hostname,
        snippet: r.content.slice(0, 200),
        relevance_score: r.score,
      })),
    };
  }
}
