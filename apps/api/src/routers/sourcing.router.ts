import { router, publicProcedure } from "../trpc.js";
import { SourcingSearchInputSchema, SourcingSearchResponseSchema } from "@repo/types";
import { searchAllPlatforms } from "../services/serpapi.service.js";
import { synthesizePrices } from "../lib/price-synthesizer.js";

export const sourcingRouter = router({
  search: publicProcedure
    .input(SourcingSearchInputSchema)
    .output(SourcingSearchResponseSchema)
    .query(async ({ input }) => {
      const platforms = await searchAllPlatforms(input.normalized_query);

      const totalResults = Object.values(platforms).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );

      let price_analysis;
      if (totalResults > 0) {
        price_analysis = await synthesizePrices(platforms);
      } else {
        price_analysis = {
          wholesale_floor: null,
          retail_ceiling: null,
          currency: "USD",
          gross_margin_pct_min: null,
          gross_margin_pct_max: null,
          best_source_platform: null,
          arbitrage_signal: null,
          summary: "No product results found on any platform for this query.",
        };
      }

      return { platforms, price_analysis };
    }),
});
