import { router, publicProcedure } from "../trpc.js";
import { SourcingSearchInputSchema, SourcingSearchResponseSchema, type PlatformResults } from "@repo/types";
import { searchAllRetailPlatforms, searchGoogleShoppingWholesale } from "../services/serpapi.service.js";
import { searchAliExpress } from "../services/aliexpress.service.js";
import { searchLocalRetail } from "../lib/local-retail.js";
import { getExchangeRate, currencyForCountry } from "../lib/exchange-rate.js";
import { synthesizePrices } from "../lib/price-synthesizer.js";
import { z } from "zod";
import { saveSessionData } from "../lib/opportunity-db.js";

const SourcingInputWithSession = SourcingSearchInputSchema.extend({
  session_id: z.string().uuid().optional(),
});

export const sourcingRouter = router({
  search: publicProcedure
    .input(SourcingInputWithSession)
    .output(SourcingSearchResponseSchema)
    .query(async ({ input }) => {
      const { normalized_query, country_code, country_name, session_id } = input;

      const [
        exchangeRateResult,
        aliexpressProducts,
        wholesaleProducts,
        retailResults,
        localRetailProducts,
      ] = await Promise.all([
        getExchangeRate(country_code),
        searchAliExpress(normalized_query),
        searchGoogleShoppingWholesale(normalized_query),
        searchAllRetailPlatforms(normalized_query),
        searchLocalRetail(
          normalized_query,
          country_code,
          country_name,
          currencyForCountry(country_code),
        ),
      ]);

      const { currency_code: localCurrencyCode, rate: exchangeRate } = exchangeRateResult;

      const stampLocal = <T extends { price_raw: number | null }>(products: T[]): T[] =>
        products.map((p) => ({
          ...p,
          price_local: p.price_raw != null ? Math.round(p.price_raw * exchangeRate * 100) / 100 : null,
          local_currency_code: localCurrencyCode,
        }));

      const platforms: PlatformResults = {
        aliexpress: stampLocal(aliexpressProducts),
        wholesale: stampLocal(wholesaleProducts),
        amazon: stampLocal(retailResults.amazon),
        ebay: stampLocal(retailResults.ebay),
        walmart: stampLocal(retailResults.walmart),
        google_shopping: stampLocal(retailResults.google_shopping),
        local_retail: localRetailProducts.map((p) => ({
          ...p,
          price_local: p.price_local ?? (p.price_raw != null ? Math.round(p.price_raw * exchangeRate * 100) / 100 : null),
          local_currency_code: p.local_currency_code ?? localCurrencyCode,
        })),
      };

      const totalResults = Object.values(platforms).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );

      let price_analysis;
      if (totalResults > 0) {
        price_analysis = await synthesizePrices(platforms, localCurrencyCode, exchangeRate);
      } else {
        price_analysis = {
          wholesale_floor: null,
          wholesale_floor_local: null,
          retail_ceiling: null,
          retail_ceiling_local: null,
          local_retail_median: null,
          local_retail_median_local: null,
          currency: "USD",
          local_currency_code: localCurrencyCode,
          exchange_rate: exchangeRate,
          gross_margin_pct_min: null,
          gross_margin_pct_max: null,
          best_source_platform: null,
          arbitrage_signal: null,
          summary: "No product results found on any platform for this query.",
        };
      }

      const result = {
        platforms,
        price_analysis,
        local_currency_code: localCurrencyCode,
        exchange_rate: exchangeRate,
      };

      if (session_id) {
        saveSessionData(session_id, "sourcing", result);
      }

      return result;
    }),
});
