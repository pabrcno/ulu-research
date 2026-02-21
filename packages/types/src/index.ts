import { z } from "zod";

// ─── Search Query ──────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  raw_query: z.string().min(1).max(500),
  country_code: z.string().length(2).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ─── Product Metadata (LLM-extracted) ──────────────────────────────

export const ProductMetadataSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  product_name: z.string(),
  product_category: z.string(),
  hs_code: z.string(),
  regulatory_flags: z.array(z.string()),
  import_regulations: z.array(z.string()),
  impositive_regulations: z.array(z.string()),
  market_search_terms: z.array(z.string()),
  trend_keywords: z.array(z.string()).min(1).max(5),
  normalized_query: z.string(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});
export type ProductMetadata = z.infer<typeof ProductMetadataSchema>;

// ─── Platform Product ──────────────────────────────────────────────

export const PlatformEnum = z.enum([
  "aliexpress",
  "wholesale",
  "amazon",
  "ebay",
  "walmart",
  "google_shopping",
  "local_retail",
]);
export type Platform = z.infer<typeof PlatformEnum>;

export const PlatformProductSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformEnum,
  external_id: z.string().optional(),
  title: z.string(),
  price_raw: z.number().nullable(),
  price_formatted: z.string(),
  currency: z.string().default("USD"),
  price_type: z.enum(["wholesale", "retail", "variable"]).optional(),
  price_local: z.number().nullable().optional(),
  local_currency_code: z.string().optional(),
  source_domain: z.string().optional(),
  moq: z.number().nullable().optional(),
  unit: z.string().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  seller_name: z.string().optional(),
  is_verified: z.boolean().optional(),
  product_url: z.string().url().optional(),
  image_url: z.string().optional(),
  condition: z.string().optional(),
  sales_volume: z.string().optional(),
});
export type PlatformProduct = z.infer<typeof PlatformProductSchema>;

// ─── Price Analysis (LLM-synthesized) ──────────────────────────────

export const PriceAnalysisSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  wholesale_floor: z.number().nullable(),
  wholesale_floor_local: z.number().nullable().optional(),
  retail_ceiling: z.number().nullable(),
  retail_ceiling_local: z.number().nullable().optional(),
  local_retail_median: z.number().nullable().optional(),
  local_retail_median_local: z.number().nullable().optional(),
  currency: z.string().default("USD"),
  local_currency_code: z.string().optional(),
  exchange_rate: z.number().optional(),
  gross_margin_pct_min: z.number().nullable(),
  gross_margin_pct_max: z.number().nullable(),
  best_source_platform: PlatformEnum.nullable(),
  arbitrage_signal: z.string().nullable(),
  summary: z.string(),
});
export type PriceAnalysis = z.infer<typeof PriceAnalysisSchema>;

// ─── Trend Report ──────────────────────────────────────────────────

export const TrendDirectionEnum = z.enum(["up", "up_right", "flat", "down_right", "down"]);

export const TrendTimeseriesPointSchema = z.object({
  week_start: z.string(),
  interest_value: z.number(),
});
export type TrendTimeseriesPoint = z.infer<typeof TrendTimeseriesPointSchema>;

export const TrendRegionSchema = z.object({
  region_name: z.string(),
  region_code: z.string().optional(),
  interest_value: z.number(),
});
export type TrendRegion = z.infer<typeof TrendRegionSchema>;

export const TrendQuerySchema = z.object({
  query_text: z.string(),
  type: z.enum(["rising", "top"]),
  value: z.string(),
});
export type TrendQuery = z.infer<typeof TrendQuerySchema>;

export const TrendTopicSchema = z.object({
  topic_title: z.string(),
  topic_type: z.string(),
  type: z.enum(["rising", "top"]),
  value: z.string(),
});
export type TrendTopic = z.infer<typeof TrendTopicSchema>;

export const TrendReportSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  keyword: z.string(),
  geo: z.string(),
  date_range: z.string().default("today 12-m"),
  trend_score: z.number().min(0).max(100),
  trend_direction: TrendDirectionEnum,
  peak_month: z.string().nullable(),
  is_seasonal: z.boolean(),
  timeseries: z.array(TrendTimeseriesPointSchema),
  regions: z.array(TrendRegionSchema),
  rising_queries: z.array(TrendQuerySchema),
  rising_topics: z.array(TrendTopicSchema),
  original_keyword: z.string().optional(),
  translated_keyword: z.string().optional(),
  language_code: z.string().optional(),
  language_name: z.string().optional(),
});
export type TrendReport = z.infer<typeof TrendReportSchema>;

// ─── Regulation Report (Import Compliance) ─────────────────────────

export const RegulationSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  snippet: z.string(),
  relevance_score: z.number().optional(),
});
export type RegulationSource = z.infer<typeof RegulationSourceSchema>;

export const ImportStepSchema = z.object({
  step_number: z.number(),
  title: z.string(),
  description: z.string(),
  estimated_time: z.string().nullable(),
  estimated_cost: z.string().nullable(),
  is_critical: z.boolean(),
});
export type ImportStep = z.infer<typeof ImportStepSchema>;

export const RegulationReportSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  country_code: z.string(),
  hs_code: z.string(),
  duty_rate_percent: z.number().nullable(),
  required_certifications: z.array(z.string()),
  prohibited_variants: z.array(z.string()),
  labeling_requirements: z.array(z.string()),
  quota_info: z.string().nullable(),
  licensing_info: z.string().nullable(),
  import_steps: z.array(ImportStepSchema).optional(),
  summary: z.string(),
  sources: z.array(RegulationSourceSchema),
});
export type RegulationReport = z.infer<typeof RegulationReportSchema>;

// ─── Impositive Report (Taxes, Duties & Landed Cost) ───────────────

export const LandedCostBreakdownSchema = z.object({
  wholesale_unit_price_usd: z.number().nullable(),
  estimated_shipping_per_unit_usd: z.number().nullable(),
  cif_value_usd: z.number().nullable(),
  duty_amount_usd: z.number().nullable(),
  vat_amount_usd: z.number().nullable(),
  other_fees_usd: z.number().nullable(),
  total_landed_cost_usd: z.number().nullable(),
  total_landed_cost_local: z.number().nullable(),
  effective_tax_rate_pct: z.number().nullable(),
  net_margin_pct: z.number().nullable(),
  local_retail_price_usd: z.number().nullable(),
});
export type LandedCostBreakdown = z.infer<typeof LandedCostBreakdownSchema>;

export const TaxLineItemSchema = z.object({
  name: z.string(),
  rate_pct: z.number().nullable(),
  description: z.string(),
  applies_to: z.string(),
});
export type TaxLineItem = z.infer<typeof TaxLineItemSchema>;

export const ImpositiveReportSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
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
export type ImpositiveReport = z.infer<typeof ImpositiveReportSchema>;

// ─── Market Report ─────────────────────────────────────────────────

export const MarketSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  snippet: z.string(),
  relevance_score: z.number().optional(),
});
export type MarketSource = z.infer<typeof MarketSourceSchema>;

export const MarketReportSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  country_code: z.string(),
  competition_level: z.enum(["low", "medium", "high", "very_high"]),
  top_competitors: z.array(z.string()),
  top_channels: z.array(z.string()),
  positioning_tip: z.string(),
  summary: z.string(),
  sources: z.array(MarketSourceSchema),
});
export type MarketReport = z.infer<typeof MarketReportSchema>;

// ─── Opportunity Report ────────────────────────────────────────────

export const OpportunityReportSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  opportunity_score: z.number().min(0).max(100),
  estimated_margin_pct: z.number().nullable(),
  best_source_platform: PlatformEnum.nullable(),
  best_launch_month: z.string().nullable(),
  keyword_gaps: z.array(z.string()),
  variant_suggestions: z.array(z.string()),
  risk_flags: z.array(z.string()),
  overall_verdict: z.string(),
});
export type OpportunityReport = z.infer<typeof OpportunityReportSchema>;

// ─── Sourcing Search I/O ────────────────────────────────────────────

export const SourcingSearchInputSchema = z.object({
  normalized_query: z.string().min(1),
  country_code: z.string().length(2),
  country_name: z.string().min(1),
});
export type SourcingSearchInput = z.infer<typeof SourcingSearchInputSchema>;

export const PlatformResultsSchema = z.object({
  aliexpress: z.array(PlatformProductSchema),
  wholesale: z.array(PlatformProductSchema),
  amazon: z.array(PlatformProductSchema),
  ebay: z.array(PlatformProductSchema),
  walmart: z.array(PlatformProductSchema),
  google_shopping: z.array(PlatformProductSchema),
  local_retail: z.array(PlatformProductSchema),
});
export type PlatformResults = z.infer<typeof PlatformResultsSchema>;

export const SourcingSearchResponseSchema = z.object({
  platforms: PlatformResultsSchema,
  price_analysis: PriceAnalysisSchema,
  local_currency_code: z.string(),
  exchange_rate: z.number(),
});
export type SourcingSearchResponse = z.infer<typeof SourcingSearchResponseSchema>;

// ─── Opportunity Context (full data passed to Claude) ─────────────────

export const OpportunityContextSchema = z.object({
  session_id: z.string().uuid(),
  product_metadata: ProductMetadataSchema,
  platforms: PlatformResultsSchema,
  price_analysis: PriceAnalysisSchema,
  trend_report: TrendReportSchema.nullable(),
  regulation_report: RegulationReportSchema.nullable(),
  impositive_report: ImpositiveReportSchema.nullable(),
  market_report: MarketReportSchema.nullable(),
  local_currency_code: z.string(),
  exchange_rate: z.number(),
});
export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;

// ─── Geolocation ───────────────────────────────────────────────────

export const GeolocationSchema = z.object({
  country_code: z.string(),
  country_name: z.string(),
  city: z.string().optional(),
  timezone: z.string().optional(),
});
export type Geolocation = z.infer<typeof GeolocationSchema>;

// ─── Session Init Response ─────────────────────────────────────────

export const SessionInitResponseSchema = z.object({
  session_id: z.string().uuid(),
  geolocation: GeolocationSchema,
  product_metadata: ProductMetadataSchema,
});
export type SessionInitResponse = z.infer<typeof SessionInitResponseSchema>;
