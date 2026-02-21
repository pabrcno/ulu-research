import { structuredComplete } from "../services/claude.service.js";
import type { TavilyResponse } from "../services/tavily.service.js";
import {
  RegulationSourceSchema,
  ImportStepSchema,
  type RegulationReport,
} from "@repo/types";
import { z } from "zod";

const RegulationReportLLMSchema = z.object({
  country_code: z.string(),
  hs_code: z.string(),
  duty_rate_percent: z.number().nullable(),
  required_certifications: z.array(z.string()),
  prohibited_variants: z.array(z.string()),
  labeling_requirements: z.array(z.string()),
  quota_info: z.string().nullable(),
  licensing_info: z.string().nullable(),
  import_steps: z.array(ImportStepSchema),
  summary: z.string(),
  sources: z.array(RegulationSourceSchema),
});

const REGULATION_SYNTHESIS_SYSTEM = `You are an international trade compliance specialist helping importers understand EXACTLY what they need to do to legally import a product.

Your task: analyze web search results about import regulations for a product (by HS code) into a target country. Produce a practical, actionable compliance report.

Guidelines:

1. **Duty Rate**: Extract the import duty/tariff rate as a percentage from official sources. Set to null if not found.

2. **Required Certifications**: All certifications, standards, or approvals needed BEFORE the product can enter the country.
   - Be specific: "FCC Part 15 certification" not just "FCC"
   - Include testing lab requirements if mentioned

3. **Prohibited Variants**: Product variants or configurations that are BANNED from import.
   - Be specific about what is prohibited and why

4. **Labeling Requirements**: Mandatory labeling, packaging, marking requirements.
   - Language requirements, warning labels, origin marking, nutrition facts, etc.

5. **Quota/Licensing Info**: Any quotas, quantity limits, or special permits required.

6. **Import Steps**: THIS IS CRITICAL. Generate a practical step-by-step import checklist that answers "what do I need to do, in what order, to legally import this product?" Steps should include:
   - Obtaining certifications/testing (with estimated time and cost if available)
   - Registering with customs authorities
   - Required documentation (commercial invoice, packing list, certificate of origin, etc.)
   - Pre-shipment inspections if required
   - Customs clearance process
   - Post-entry requirements (record keeping, etc.)
   - Mark critical steps (is_critical: true) that could block the entire import if missed
   - Order steps chronologically (what to do first → last)

7. **Summary**: 2-3 sentences on the key compliance hurdles. Be direct — tell the importer what will be hardest/most expensive to comply with.

8. **Sources**: Cite all sources. Prioritize .gov domains. Include relevance_score (0-1).

IMPORTANT:
- Only include information explicitly in the search results
- For import_steps, you CAN provide general import process knowledge for the country even if not in the sources (customs documentation is universal)
- Be practical — this is for someone who wants to actually import, not an academic paper`;

export async function synthesizeRegulationReport(
  hsCode: string,
  countryCode: string,
  tavilyResults: TavilyResponse[],
): Promise<RegulationReport> {
  const allResults = tavilyResults.flatMap((r) => r.results);
  const answers = tavilyResults
    .filter((r) => r.answer)
    .map((r) => r.answer)
    .join("\n\n");

  const userPrompt = `Analyze import compliance requirements for HS Code "${hsCode}" into country "${countryCode}":

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

Synthesize into a practical compliance report with step-by-step import checklist. Focus on what an importer needs to DO.`;

  try {
    const result = await structuredComplete({
      system: REGULATION_SYNTHESIS_SYSTEM,
      user: userPrompt,
      schema: RegulationReportLLMSchema,
      maxTokens: 4096,
    });

    return {
      country_code: countryCode,
      hs_code: hsCode,
      duty_rate_percent: result.duty_rate_percent,
      required_certifications: result.required_certifications,
      prohibited_variants: result.prohibited_variants,
      labeling_requirements: result.labeling_requirements,
      quota_info: result.quota_info,
      licensing_info: result.licensing_info,
      import_steps: result.import_steps,
      summary: result.summary,
      sources: result.sources,
    };
  } catch (err) {
    console.error("Regulation synthesis failed:", err);

    return {
      country_code: countryCode,
      hs_code: hsCode,
      duty_rate_percent: null,
      required_certifications: [],
      prohibited_variants: [],
      labeling_requirements: [],
      quota_info: null,
      licensing_info: null,
      import_steps: [],
      summary:
        "Unable to synthesize regulation data. Please consult official customs authorities.",
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
