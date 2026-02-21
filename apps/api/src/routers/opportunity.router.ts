import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";
import {
  PriceAnalysisSchema,
  TrendReportSchema,
  RegulationReportSchema,
  ImpositiveReportSchema,
  MarketReportSchema,
  OpportunityReportSchema,
} from "@repo/types";
import { scoreOpportunity } from "../lib/opportunity-scorer.js";

const OpportunityInputSchema = z.object({
  price_analysis: PriceAnalysisSchema,
  trend_report: TrendReportSchema,
  regulation_report: RegulationReportSchema,
  impositive_report: ImpositiveReportSchema.nullable(),
  market_report: MarketReportSchema,
});

export const opportunityRouter = router({
  ping: publicProcedure.query(() => ({ status: "opportunity router ok" })),

  synthesize: publicProcedure
    .input(OpportunityInputSchema)
    .output(OpportunityReportSchema)
    .query(async ({ input }) => {
      console.log("[Opportunity] Synthesizing all sub-reports into opportunity score...");

      const report = await scoreOpportunity({
        priceAnalysis: input.price_analysis,
        trendReport: input.trend_report,
        regulationReport: input.regulation_report,
        impositiveReport: input.impositive_report,
        marketReport: input.market_report,
      });

      console.log(
        `[Opportunity] Score: ${report.opportunity_score}/100 — ${report.overall_verdict.slice(0, 80)}...`,
      );

      return report;
    }),
});
