import { structuredComplete } from "../services/claude.service.js";
import type { TavilyResponse } from "../services/tavily.service.js";
import {
  RegulationSourceSchema,
  TaxLineItemSchema,
  LandedCostBreakdownSchema,
  type ImpositiveReport,
} from "@repo/types";
import { z } from "zod";

export interface PricingContext {
  wholesale_floor_usd: number | null;
  local_retail_median_usd: number | null;
  exchange_rate: number;
  local_currency_code: string;
  best_source_platform: string | null;
}

const ImpositiveReportLLMSchema = z.object({
  country_code: z.string(),
  hs_code: z.string(),
  import_duty_pct: z.number().nullable(),
  vat_rate_pct: z.number().nullable(),
  additional_taxes: z.array(TaxLineItemSchema),
  total_tax_burden_pct: z.number().nullable(),
  landed_cost: LandedCostBreakdownSchema,
  tax_summary: z.string(),
  importer_tips: z.array(z.string()),
  sources: z.array(RegulationSourceSchema),
});

function buildSystemPrompt(pricing: PricingContext): string {
  return `You are an international trade cost analyst specializing in import taxation and landed cost calculation.

Your task: analyze web search results about import taxes/duties for a product, then compute a REALISTIC landed cost breakdown using REAL wholesale pricing data provided.

## REAL PRICING DATA (from live marketplace search)
- Wholesale floor price (best sourcing price found): ${pricing.wholesale_floor_usd != null ? `$${pricing.wholesale_floor_usd.toFixed(2)} USD` : "Not available"}
- Local retail median (what it sells for in target market): ${pricing.local_retail_median_usd != null ? `$${pricing.local_retail_median_usd.toFixed(2)} USD` : "Not available"}
- Best sourcing platform: ${pricing.best_source_platform ?? "Unknown"}
- Exchange rate: 1 USD = ${pricing.exchange_rate} ${pricing.local_currency_code}

## INSTRUCTIONS

### Tax Rates
1. **import_duty_pct**: The customs duty rate for this HS code. Extract from official sources. If multiple rates exist (MFN, preferential), use MFN as default.
2. **vat_rate_pct**: Standard VAT/sales tax/IVA rate applied to imports in the target country. This is usually a fixed national rate (e.g., 19% Chile, 21% Argentina, 20% UK, 0-10% US state-level).
3. **additional_taxes**: Any other taxes — anti-dumping duties, luxury tax, environmental levies, customs processing fees, port handling. Include name, rate, description, and what base it applies to (CIF value, FOB value, etc.).
4. **total_tax_burden_pct**: Effective total tax rate on the import (duty + VAT + additional, compounded if applicable).

### Landed Cost Calculation
Using the REAL wholesale price provided, compute per-unit costs:
- **wholesale_unit_price_usd**: Use the wholesale floor price above
- **estimated_shipping_per_unit_usd**: Estimate realistic shipping cost per unit (typically 10-20% of product cost for small goods via air, 3-8% for sea freight). State your assumption.
- **cif_value_usd**: wholesale + shipping (Cost, Insurance, Freight)
- **duty_amount_usd**: cif_value × duty_rate
- **vat_amount_usd**: (cif_value + duty_amount) × vat_rate (VAT is typically charged on CIF + duty)
- **other_fees_usd**: Sum of any additional taxes/fees
- **total_landed_cost_usd**: cif + duty + vat + other_fees
- **total_landed_cost_local**: total_landed_cost_usd × exchange_rate
- **effective_tax_rate_pct**: ((total_landed_cost - wholesale_price) / wholesale_price) × 100
- **net_margin_pct**: If local retail median is available: ((local_retail_median - total_landed_cost) / local_retail_median) × 100
- **local_retail_price_usd**: The local retail median from above

If wholesale price is not available, set all landed_cost numeric fields to null but still extract tax rates.

### Tax Summary
Write a 2-3 sentence summary explaining the total tax burden in plain language. Example: "Importing this product to Chile carries a 6% customs duty plus 19% IVA, resulting in roughly 26% added cost on top of CIF value. With a wholesale price of $4.50 and estimated shipping of $0.90, your total landed cost is approximately $6.80 per unit."

### Importer Tips
Provide 3-5 practical tips specifically about managing import costs:
- Free trade agreements that could reduce duty
- Bulk shipping strategies to reduce per-unit cost
- VAT recovery if applicable
- Customs valuation strategies
- Timing considerations

### Sources
Extract and cite relevant sources with title, URL, domain, and snippet.

IMPORTANT:
- Use ONLY rates and information from the provided search results
- If a specific rate isn't found, use null — do NOT guess rates
- The landed cost calculation must use the real wholesale price provided
- Be precise with tax compounding (VAT is usually on CIF + duty, not just CIF)`;
}

export async function synthesizeImpositiveReport(
  hsCode: string,
  countryCode: string,
  productName: string,
  pricing: PricingContext,
  tavilyResults: TavilyResponse[],
): Promise<ImpositiveReport> {
  const allResults = tavilyResults.flatMap((r) => r.results);
  const answers = tavilyResults
    .filter((r) => r.answer)
    .map((r) => r.answer)
    .join("\n\n");

  const userPrompt = `Analyze import taxes and compute landed cost for:
- Product: ${productName}
- HS Code: ${hsCode}
- Target Country: ${countryCode}

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

Extract all tax rates, compute the full landed cost breakdown using the real wholesale pricing, and provide practical importer tips.`;

  try {
    const result = await structuredComplete({
      system: buildSystemPrompt(pricing),
      user: userPrompt,
      schema: ImpositiveReportLLMSchema,
      maxTokens: 4096,
    });

    return {
      country_code: countryCode,
      hs_code: hsCode,
      import_duty_pct: result.import_duty_pct,
      vat_rate_pct: result.vat_rate_pct,
      additional_taxes: result.additional_taxes,
      total_tax_burden_pct: result.total_tax_burden_pct,
      landed_cost: result.landed_cost,
      tax_summary: result.tax_summary,
      importer_tips: result.importer_tips,
      sources: result.sources,
    };
  } catch (err) {
    console.error("Impositive synthesis failed:", err);

    return {
      country_code: countryCode,
      hs_code: hsCode,
      import_duty_pct: null,
      vat_rate_pct: null,
      additional_taxes: [],
      total_tax_burden_pct: null,
      landed_cost: {
        wholesale_unit_price_usd: pricing.wholesale_floor_usd,
        estimated_shipping_per_unit_usd: null,
        cif_value_usd: null,
        duty_amount_usd: null,
        vat_amount_usd: null,
        other_fees_usd: null,
        total_landed_cost_usd: null,
        total_landed_cost_local: null,
        effective_tax_rate_pct: null,
        net_margin_pct: null,
        local_retail_price_usd: pricing.local_retail_median_usd,
      },
      tax_summary:
        "Unable to compute landed cost at this time. Please consult a customs broker for accurate tax calculations.",
      importer_tips: [],
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
