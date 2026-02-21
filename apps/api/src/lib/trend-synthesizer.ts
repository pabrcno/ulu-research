import { structuredComplete } from "../services/claude.service.js";
import type { TrendsRawData } from "../services/serpapi.service.js";
import { 
  TrendReportSchema, 
  TrendDirectionEnum,
  TrendTimeseriesPointSchema,
  TrendRegionSchema,
  TrendQuerySchema,
  TrendTopicSchema,
  type TrendReport 
} from "@repo/types";
import { z } from "zod";

// LLM output schema - excludes database fields (id, session_id) and language fields
const TrendReportLLMSchema = z.object({
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
});

const TREND_SYNTHESIS_SYSTEM = `You are a market research analyst specializing in Google Trends data interpretation.

Your task is to analyze 4 Google Trends data payloads (TIMESERIES, GEO_MAP, RELATED_QUERIES, RELATED_TOPICS) and synthesize them into a structured trend report.

Guidelines:
1. **Trend Direction**: Analyze the timeseries data to determine if the trend is:
   - "up" (strong upward growth)
   - "up_right" (moderate upward growth)
   - "flat" (stable, no significant change)
   - "down_right" (moderate decline)
   - "down" (strong decline)

2. **Trend Score**: Assign a score from 0-100 based on:
   - Current interest level (0-100 scale from Google)
   - Growth trajectory over the period
   - Consistency of interest (avoid volatile trends)
   - Regional breadth (more regions = higher score)

3. **Seasonality**: Determine if the product shows seasonal patterns:
   - Look for recurring peaks/valleys in timeseries
   - Identify the peak month if seasonal (e.g., "November", "December")
   - Set is_seasonal to true/false

4. **Rising Queries & Topics**: Extract the most valuable rising queries and topics:
   - Focus on "rising" items (not just "top")
   - Include the query/topic text and its growth value
   - Prioritize queries with high growth percentages
   - If queries are in a non-English language, keep them in their original language

5. **Regional Hotspots**: Identify top regions by interest:
   - Extract region names and codes
   - Include interest values (0-100)
   - Sort by interest level (highest first)

6. **Timeseries Data**: Extract weekly interest values:
   - Format week_start as ISO date string (YYYY-MM-DD)
   - Include interest_value (0-100)

7. **Language Handling**: 
   - If the search keyword is in a non-English language, preserve all related queries and topics in their original language
   - Regional data will naturally reflect local search behavior
   - This provides authentic insights into how local markets search for products

Return a complete TrendReport with all fields populated. If data is missing for any section, return empty arrays but maintain the structure.`;

export async function synthesizeTrendReport(
  keyword: string,
  geo: string,
  rawData: TrendsRawData,
): Promise<TrendReport> {
  const userPrompt = `Analyze the following Google Trends data for keyword "${keyword}" in region "${geo}":

## TIMESERIES DATA
${JSON.stringify(rawData.timeseries, null, 2)}

## GEO MAP DATA (Regional Interest)
${JSON.stringify(rawData.geoMap, null, 2)}

## RELATED QUERIES
${JSON.stringify(rawData.relatedQueries, null, 2)}

## RELATED TOPICS
${JSON.stringify(rawData.relatedTopics, null, 2)}

Synthesize this data into a comprehensive TrendReport. Focus on actionable insights for product sourcing decisions.`;

  try {
    const result = await structuredComplete({
      system: TREND_SYNTHESIS_SYSTEM,
      user: userPrompt,
      schema: TrendReportLLMSchema,
      maxTokens: 4096,
    });

    // Return the result with the correct structure (no id/session_id from LLM)
    return {
      keyword,
      geo,
      date_range: "today 12-m",
      trend_score: result.trend_score,
      trend_direction: result.trend_direction,
      peak_month: result.peak_month,
      is_seasonal: result.is_seasonal,
      timeseries: result.timeseries,
      regions: result.regions,
      rising_queries: result.rising_queries,
      rising_topics: result.rising_topics,
    };
  } catch (err) {
    console.error("Trend synthesis failed:", err);
    
    // Return a minimal fallback report
    return {
      keyword,
      geo,
      date_range: "today 12-m",
      trend_score: 50,
      trend_direction: "flat" as const,
      peak_month: null,
      is_seasonal: false,
      timeseries: [],
      regions: [],
      rising_queries: [],
      rising_topics: [],
    };
  }
}
