import { structuredComplete } from "../services/claude.service.js";
import {
  PlatformEnum,
  type OpportunityContext,
  type OpportunityReport,
} from "@repo/types";
import { z } from "zod";

const OpportunityReportLLMSchema = z.object({
  opportunity_score: z.number().min(0).max(100),
  estimated_margin_pct: z.number().nullable(),
  best_source_platform: PlatformEnum.nullable(),
  best_launch_month: z.string().nullable(),
  keyword_gaps: z.array(z.string()),
  variant_suggestions: z.array(z.string()),
  risk_flags: z.array(z.string()),
  overall_verdict: z.string(),
});

const OPPORTUNITY_SYSTEM = `You are a wholesale import opportunity analyst. You will receive a complete research context as JSON containing:

1. **Product Metadata** — product name, category, HS code, regulatory flags, market terms, trend keywords
2. **Platform Products** — raw listings from AliExpress, wholesale, Amazon, eBay, Walmart, Google Shopping, local retail (title, price, seller, rating, etc.)
3. **Price Analysis** — synthesized wholesale floor, retail ceiling, local median, margins, best source
4. **Trend Report** — Google Trends: direction, score, seasonality, rising queries, regional hotspots
5. **Regulation Report** — duty rates, certifications, prohibited variants, labeling, licensing
6. **Impositive Report** — taxes, duties, landed cost breakdown, net margin after taxes
7. **Market Report** — competition level, competitors, channels, positioning advice

Your task: analyze ALL the data and produce a single opportunity assessment. Use the raw platform products to validate pricing and spot arbitrage; use the synthesized reports for summary metrics.

Scoring Guidelines (opportunity_score 0-100):
- 80-100: Strong opportunity. High margins, growing trend, manageable regulations, low-medium competition.
- 60-79: Good opportunity with caveats. Decent margins but some risk factors.
- 40-59: Marginal opportunity. Thin margins, flat/declining trend, or regulatory barriers.
- 20-39: Weak opportunity. Multiple red flags.
- 0-19: Avoid. Negative margins, severe blockers, or crashing demand.

Fields:
- **opportunity_score**: Overall score 0-100.
- **estimated_margin_pct**: Net margin after landed cost. Use impositive net_margin_pct if available.
- **best_source_platform**: Best platform to source from.
- **best_launch_month**: When to launch based on seasonality. Null if not seasonal.
- **keyword_gaps**: 3-5 search keywords or variants with rising demand and low competition.
- **variant_suggestions**: 2-4 specific product variants, bundles, or configurations.
- **risk_flags**: All identified risks. Be thorough.
- **overall_verdict**: 3-5 sentence executive summary. Should they import? Why or why not? Recommended strategy?

Be direct and honest. Don't inflate scores.`;

export async function scoreOpportunity(context: OpportunityContext): Promise<OpportunityReport> {
  const contextJson = JSON.stringify(context, null, 2);

  const userPrompt = `Analyze this complete research context and produce an opportunity assessment:

${contextJson}

Produce a comprehensive opportunity assessment with score, risks, and actionable recommendations.`;

  try {
    const result = await structuredComplete({
      system: OPPORTUNITY_SYSTEM,
      user: userPrompt,
      schema: OpportunityReportLLMSchema,
      maxTokens: 3072,
    });

    return {
      opportunity_score: result.opportunity_score,
      estimated_margin_pct: result.estimated_margin_pct,
      best_source_platform: result.best_source_platform,
      best_launch_month: result.best_launch_month,
      keyword_gaps: result.keyword_gaps,
      variant_suggestions: result.variant_suggestions,
      risk_flags: result.risk_flags,
      overall_verdict: result.overall_verdict,
    };
  } catch (err) {
    console.error("Opportunity scoring failed:", err);

    const pa = context.price_analysis;
    const tr = context.trend_report;

    return {
      opportunity_score: 50,
      estimated_margin_pct: pa?.gross_margin_pct_min ?? null,
      best_source_platform: pa?.best_source_platform ?? null,
      best_launch_month: tr?.peak_month ?? null,
      keyword_gaps: [],
      variant_suggestions: [],
      risk_flags: ["Opportunity analysis could not be fully synthesized — review sub-reports manually"],
      overall_verdict:
        "The opportunity scoring engine encountered an error. Please review the individual reports to form your own assessment.",
    };
  }
}
