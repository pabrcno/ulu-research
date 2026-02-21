import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { MarketReportSchema } from "@repo/types";
import { tavilySearch } from "../services/tavily.service.js";
import { buildMarketQueries } from "../lib/market-query-builder.js";
import { synthesizeMarketReport } from "../lib/market-synthesizer.js";
import { saveSessionData } from "../lib/opportunity-db.js";

const MarketInputSchema = z.object({
  market_terms: z.array(z.string()).min(1),
  country_code: z.string().length(2),
  session_id: z.string().uuid().optional(),
});

export const marketRouter = router({
  ping: publicProcedure.query(() => ({ status: "market router ok" })),

  research: publicProcedure
    .input(MarketInputSchema)
    .output(MarketReportSchema)
    .query(async ({ input }) => {
      const { market_terms, country_code } = input;

      const queries = buildMarketQueries(market_terms, country_code);

      console.log(
        `[Market] Running ${queries.length} Tavily queries for ${market_terms.join(", ")} → ${country_code}`,
      );

      const tavilyResults = await Promise.all(
        queries.map((q) =>
          tavilySearch(q.query, {
            search_depth: "advanced",
            max_results: 5,
            include_answer: true,
          }).catch((err) => {
            console.error(`[Market] Tavily query failed: ${q.purpose}`, err);
            return { query: q.query, answer: undefined, results: [] };
          }),
        ),
      );

      const report = await synthesizeMarketReport(country_code, tavilyResults);

      if (input.session_id) {
        saveSessionData(input.session_id, "market", report);
      }

      console.log(`[Market] Report ready: ${report.summary.slice(0, 80)}...`);
      return report;
    }),
});
