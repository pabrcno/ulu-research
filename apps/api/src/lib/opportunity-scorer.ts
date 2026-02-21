import { structuredComplete } from "../services/claude.service.js";
import {
  PlatformEnum,
  type PriceAnalysis,
  type TrendReport,
  type RegulationReport,
  type ImpositiveReport,
  type MarketReport,
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

const OPPORTUNITY_SYSTEM = `You are a wholesale import opportunity analyst. You will receive four research reports about a product:

1. **Price Analysis** — wholesale floor, retail ceiling, local retail median, margins, best source platform
2. **Trend Report** — Google Trends data: direction, score, seasonality, rising queries, regional hotspots
3. **Regulation Report** — import compliance: duty rates, certifications, prohibited variants, labeling
4. **Impositive Report** — taxes, duties, landed cost breakdown, net margin after taxes
5. **Market Report** — competition level, top competitors, channels, positioning advice

Your task: synthesize ALL reports into a single opportunity assessment.

Scoring Guidelines (opportunity_score 0-100):
- 80-100: Strong opportunity. High margins, growing trend, manageable regulations, low-medium competition.
- 60-79: Good opportunity with caveats. Decent margins but some risk factors (declining trend, high competition, or complex regulations).
- 40-59: Marginal opportunity. Thin margins, flat/declining trend, or significant regulatory barriers.
- 20-39: Weak opportunity. Multiple red flags — low margins, tough competition, regulatory hurdles.
- 0-19: Avoid. Negative margins, severe regulatory blockers, or crashing demand.

Fields:
- **opportunity_score**: Overall score 0-100 using the above rubric.
- **estimated_margin_pct**: Net estimated margin percentage after landed cost. Use the impositive report's net_margin_pct if available, otherwise estimate from price analysis margins minus estimated tax burden.
- **best_source_platform**: Best platform to source from (from price analysis).
- **best_launch_month**: When to launch based on trend seasonality. Null if not seasonal.
- **keyword_gaps**: 3-5 search keywords or product variants that show rising demand but low competition (from trend rising queries + market gaps).
- **variant_suggestions**: 2-4 specific product variants, bundles, or configurations to consider.
- **risk_flags**: All identified risks — margin squeeze, declining trend, certification blockers, high competition, etc. Be thorough.
- **overall_verdict**: 3-5 sentence executive summary. State the opportunity clearly: should they import this product? Why or why not? What's the recommended strategy?

Be direct and honest. Don't inflate scores. A mediocre opportunity should score mediocre.`;

export async function scoreOpportunity(inputs: {
  priceAnalysis: PriceAnalysis;
  trendReport: TrendReport;
  regulationReport: RegulationReport;
  impositiveReport: ImpositiveReport | null;
  marketReport: MarketReport;
}): Promise<OpportunityReport> {
  const {
    priceAnalysis,
    trendReport,
    regulationReport,
    impositiveReport,
    marketReport,
  } = inputs;

  const userPrompt = `Synthesize these research reports into an opportunity assessment:

## 1. PRICE ANALYSIS
- Wholesale floor: $${priceAnalysis.wholesale_floor ?? "N/A"}
- Retail ceiling: $${priceAnalysis.retail_ceiling ?? "N/A"}
- Local retail median: $${priceAnalysis.local_retail_median ?? "N/A"}
- Gross margin range: ${priceAnalysis.gross_margin_pct_min ?? "?"}% – ${priceAnalysis.gross_margin_pct_max ?? "?"}%
- Best source platform: ${priceAnalysis.best_source_platform ?? "unknown"}
- Arbitrage signal: ${priceAnalysis.arbitrage_signal ?? "none"}
- Summary: ${priceAnalysis.summary}

## 2. TREND REPORT
- Keyword: "${trendReport.keyword}"
- Trend direction: ${trendReport.trend_direction}
- Trend score: ${trendReport.trend_score}/100
- Seasonal: ${trendReport.is_seasonal ? `Yes — peak in ${trendReport.peak_month}` : "No"}
- Rising queries: ${trendReport.rising_queries.slice(0, 5).map((q) => `"${q.query_text}" (${q.value})`).join(", ") || "none"}
- Top regions: ${trendReport.regions.slice(0, 5).map((r) => `${r.region_name} (${r.interest_value})`).join(", ") || "none"}

## 3. REGULATION REPORT
- Duty rate: ${regulationReport.duty_rate_percent != null ? `${regulationReport.duty_rate_percent}%` : "unknown"}
- Required certifications: ${regulationReport.required_certifications.join(", ") || "none identified"}
- Prohibited variants: ${regulationReport.prohibited_variants.join(", ") || "none identified"}
- Labeling requirements: ${regulationReport.labeling_requirements.length} items
- Licensing: ${regulationReport.licensing_info ?? "none required"}
- Summary: ${regulationReport.summary}

## 4. IMPOSITIVE REPORT (Taxes & Landed Cost)
${impositiveReport ? `- Import duty: ${impositiveReport.import_duty_pct ?? "?"}%
- VAT: ${impositiveReport.vat_rate_pct ?? "?"}%
- Total tax burden: ${impositiveReport.total_tax_burden_pct ?? "?"}%
- Landed cost per unit: $${impositiveReport.landed_cost.total_landed_cost_usd ?? "N/A"}
- Net margin after taxes: ${impositiveReport.landed_cost.net_margin_pct ?? "?"}%
- Tax summary: ${impositiveReport.tax_summary}` : "Not yet available — pricing data was insufficient."}

## 5. MARKET REPORT
- Competition level: ${marketReport.competition_level}
- Top competitors: ${marketReport.top_competitors.join(", ") || "none identified"}
- Best channels: ${marketReport.top_channels.join(", ") || "none identified"}
- Positioning: ${marketReport.positioning_tip}
- Summary: ${marketReport.summary}

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

    return {
      opportunity_score: 50,
      estimated_margin_pct: priceAnalysis.gross_margin_pct_min,
      best_source_platform: priceAnalysis.best_source_platform,
      best_launch_month: trendReport.peak_month,
      keyword_gaps: [],
      variant_suggestions: [],
      risk_flags: ["Opportunity analysis could not be fully synthesized — review sub-reports manually"],
      overall_verdict:
        "The opportunity scoring engine encountered an error. Please review the individual price, trend, regulation, and market reports to form your own assessment.",
    };
  }
}
