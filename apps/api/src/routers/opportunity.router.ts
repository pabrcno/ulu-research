import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { OpportunityReportSchema, type OpportunityContext } from "@repo/types";
import { scoreOpportunity } from "../lib/opportunity-scorer.js";
import {
  getAssessmentBySessionId,
  saveAssessment,
  getAllSessionData,
} from "../lib/opportunity-db.js";
import { TRPCError } from "@trpc/server";

export const opportunityRouter = router({
  ping: publicProcedure.query(() => ({ status: "opportunity router ok" })),

  get: publicProcedure
    .input(z.object({ session_id: z.string().uuid() }))
    .output(OpportunityReportSchema.nullable())
    .query(async ({ input }) => {
      const stored = await getAssessmentBySessionId(input.session_id);
      if (!stored) return null;
      return JSON.parse(stored.report_json) as z.infer<typeof OpportunityReportSchema>;
    }),

  synthesize: publicProcedure
    .input(z.object({ session_id: z.string().uuid() }))
    .output(OpportunityReportSchema)
    .mutation(async ({ input }) => {
      const { session_id } = input;

      const cached = await getAssessmentBySessionId(session_id);
      if (cached) {
        return JSON.parse(cached.report_json) as z.infer<typeof OpportunityReportSchema>;
      }

      const data = await getAllSessionData(session_id);

      if (!data.product_metadata || !data.sourcing) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Session data incomplete — sourcing and product metadata are required before synthesis.",
        });
      }

      const sourcing = data.sourcing as {
        platforms: OpportunityContext["platforms"];
        price_analysis: OpportunityContext["price_analysis"];
        local_currency_code: string;
        exchange_rate: number;
      };

      const context: OpportunityContext = {
        session_id,
        product_metadata: data.product_metadata as OpportunityContext["product_metadata"],
        platforms: sourcing.platforms,
        price_analysis: sourcing.price_analysis,
        trend_report: (data.trends ?? null) as OpportunityContext["trend_report"],
        regulation_report: (data.regulation ?? null) as OpportunityContext["regulation_report"],
        impositive_report: (data.impositive ?? null) as OpportunityContext["impositive_report"],
        market_report: (data.market ?? null) as OpportunityContext["market_report"],
        local_currency_code: sourcing.local_currency_code,
        exchange_rate: sourcing.exchange_rate,
      };

      console.log(
        `[Opportunity] Synthesizing for session ${session_id} — ` +
          `data keys: ${Object.keys(data).join(", ")}`,
      );

      const report = await scoreOpportunity(context);

      const contextJson = JSON.stringify(context);
      const reportJson = JSON.stringify(report);
      await saveAssessment(session_id, contextJson, reportJson);

      return report;
    }),
});
