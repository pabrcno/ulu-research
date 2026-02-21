import { ProductMetadataSchema, type ProductMetadata } from "@repo/types";
import { structuredComplete } from "../services/claude.service.js";

const SYSTEM_PROMPT = `You are a wholesale product research assistant. Given a raw search query and optionally a destination country, extract structured product metadata for downstream sourcing, trends, regulation, and market research.

Guidelines:
- hs_code should be the most likely 6-digit HS code. Use "000000" if truly unknown.
- regulatory_flags: product certifications and standards (FCC, CE, RoHS, FDA, etc.).
- import_regulations: rules for bringing goods into a country — customs procedures, import permits, licensing, prohibited/restricted items, country-of-origin requirements.
- impositive_regulations: tax and duty rules — HS tariff rates, duty classifications, VAT/GST applicability, excise duties, preferential agreements (e.g. USMCA, EU GSP).
- trend_keywords should be 1-5 terms ordered from most specific to broadest. Include the product name and relevant variations.
- normalized_query should be a clean, lowercase search string optimized for product search APIs (no special characters, no country references).
- extraction_confidence reflects how certain you are about the extraction (0.5 for vague queries, 0.9+ for specific products).`;

export async function extractKeywords(
  rawQuery: string,
  countryCode?: string,
): Promise<ProductMetadata> {
  const countryContext = countryCode
    ? `The user is located in ${countryCode}. Consider local regulations and market context for this country.`
    : "";

  const userPrompt = `Raw search query: "${rawQuery}"
${countryContext}

Extract the structured product metadata.`;

  return structuredComplete({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    schema: ProductMetadataSchema,
  });
}
