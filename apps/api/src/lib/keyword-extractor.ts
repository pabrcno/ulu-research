import { ProductMetadataSchema, type ProductMetadata } from "@repo/types";
import { complete } from "../services/claude.service.js";

const SYSTEM_PROMPT = `You are a wholesale product research assistant. Given a raw search query and optionally a destination country, extract structured product metadata for downstream sourcing, trends, regulation, and market research.

You MUST respond with a single JSON object (no markdown, no explanation) matching this exact schema:
{
  "product_name": "human-readable product name",
  "product_category": "broad product category",
  "hs_code": "best-guess 6-digit HS tariff code",
  "regulatory_flags": ["relevant certifications/standards like FCC, CE, RoHS, FDA, etc."],
  "import_regulations": ["import-specific rules: customs requirements, permits, licenses, restrictions, prohibited items, origin rules"],
  "impositive_regulations": ["tax/duty-related: tariff rates, duty classifications, VAT/GST applicability, excise duties, preferential trade agreements"],
  "market_search_terms": ["terms for market/competitor research"],
  "trend_keywords": ["1-5 Google Trends keywords, most specific first"],
  "normalized_query": "clean, optimized search string for product sourcing APIs",
  "extraction_confidence": 0.0-1.0
}

Guidelines:
- hs_code should be the most likely 6-digit HS code. Use "000000" if truly unknown.
- regulatory_flags: product certifications and standards (FCC, CE, RoHS, FDA, etc.).
- import_regulations: rules for bringing goods into a country — customs procedures, import permits, licensing, prohibited/restricted items, country-of-origin requirements.
- impositive_regulations: tax and duty rules — HS tariff rates, duty classifications, VAT/GST, excise duties, preferential agreements (e.g. USMCA, EU GSP).
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

Extract the structured product metadata as JSON.`;

  const raw = await complete<Record<string, unknown>>({
    system: SYSTEM_PROMPT,
    user: userPrompt,
  });

  return ProductMetadataSchema.parse(raw);
}
