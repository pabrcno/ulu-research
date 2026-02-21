import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { RegulationReportSchema, ImpositiveReportSchema } from "@repo/types";
import { tavilySearch } from "../services/tavily.service.js";
import { buildRegulationQueries } from "../lib/regulation-query-builder.js";
import { buildImpositiveQueries } from "../lib/impositive-query-builder.js";
import { synthesizeRegulationReport } from "../lib/regulation-synthesizer.js";
import { synthesizeImpositiveReport } from "../lib/impositive-synthesizer.js";
import { saveSessionData } from "../lib/opportunity-db.js";

const ComplianceInputSchema = z.object({
  hs_code: z.string().min(1),
  country_code: z.string().length(2),
  regulatory_flags: z.array(z.string()).default([]),
  import_regulations: z.array(z.string()).default([]),
  impositive_regulations: z.array(z.string()).default([]),
  session_id: z.string().uuid().optional(),
});

const ImpositiveInputSchema = z.object({
  hs_code: z.string().min(1),
  product_name: z.string().min(1),
  country_code: z.string().length(2),
  impositive_regulations: z.array(z.string()).default([]),
  wholesale_floor_usd: z.number().nullable(),
  local_retail_median_usd: z.number().nullable(),
  exchange_rate: z.number(),
  local_currency_code: z.string(),
  best_source_platform: z.string().nullable(),
  session_id: z.string().uuid().optional(),
});

export const regulationsRouter = router({
  ping: publicProcedure.query(() => ({ status: "regulations router ok" })),

  research: publicProcedure
    .input(ComplianceInputSchema)
    .output(RegulationReportSchema)
    .query(async ({ input }) => {
      const {
        hs_code,
        country_code,
        regulatory_flags,
        import_regulations,
        impositive_regulations,
        session_id,
      } = input;

      const queries = buildRegulationQueries(
        hs_code,
        country_code,
        regulatory_flags,
        import_regulations,
        impositive_regulations,
      );

      console.log(
        `[Compliance] Running ${queries.length} Tavily queries for HS ${hs_code} → ${country_code}`,
      );

      const tavilyResults = await Promise.all(
        queries.map((q) =>
          tavilySearch(q.query, {
            include_domains: q.include_domains,
            search_depth: "advanced",
            max_results: 5,
            include_answer: true,
          }).catch((err) => {
            console.error(`[Compliance] Tavily query failed: ${q.purpose}`, err);
            return { query: q.query, answer: undefined, results: [] };
          }),
        ),
      );

      const report = await synthesizeRegulationReport(
        hs_code,
        country_code,
        tavilyResults,
      );

      if (session_id) {
        await saveSessionData(session_id, "regulation", report);
      }

      console.log(`[Compliance] Report ready: ${report.summary.slice(0, 80)}...`);
      return report;
    }),

  impositive: publicProcedure
    .input(ImpositiveInputSchema)
    .output(ImpositiveReportSchema)
    .query(async ({ input }) => {
      const {
        hs_code,
        product_name,
        country_code,
        impositive_regulations,
        wholesale_floor_usd,
        local_retail_median_usd,
        exchange_rate,
        local_currency_code,
        best_source_platform,
        session_id,
      } = input;

      const queries = buildImpositiveQueries(
        hs_code,
        product_name,
        country_code,
        impositive_regulations,
      );

      console.log(
        `[Impositive] Running ${queries.length} Tavily queries for HS ${hs_code} → ${country_code}` +
          (wholesale_floor_usd != null
            ? ` (wholesale $${wholesale_floor_usd.toFixed(2)})`
            : " (no pricing)"),
      );

      const tavilyResults = await Promise.all(
        queries.map((q) =>
          tavilySearch(q.query, {
            include_domains: q.include_domains,
            search_depth: "advanced",
            max_results: 5,
            include_answer: true,
          }).catch((err) => {
            console.error(`[Impositive] Tavily query failed: ${q.purpose}`, err);
            return { query: q.query, answer: undefined, results: [] };
          }),
        ),
      );

      const report = await synthesizeImpositiveReport(
        hs_code,
        country_code,
        product_name,
        {
          wholesale_floor_usd,
          local_retail_median_usd,
          exchange_rate,
          local_currency_code,
          best_source_platform,
        },
        tavilyResults,
      );

      if (session_id) {
        await saveSessionData(session_id, "impositive", report);
      }

      console.log(`[Impositive] Report ready: ${report.tax_summary.slice(0, 80)}...`);
      return report;
    }),
});
