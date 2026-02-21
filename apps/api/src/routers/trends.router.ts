import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";
import { TrendReportSchema } from "@repo/types";
import { getTrends } from "../services/serpapi.service.js";
import { synthesizeTrendReport } from "../lib/trend-synthesizer.js";
import { translateKeyword } from "../lib/keyword-translator.js";
import { getCountryLanguage } from "../lib/countries.js";
import { saveSessionData } from "../lib/opportunity-db.js";

const TrendsGetInputSchema = z.object({
  trend_keywords: z.array(z.string()).min(1).max(5),
  geo: z.string().length(2),
  use_regional_language: z.boolean().optional().default(false),
  session_id: z.string().uuid().optional(),
});

const TrendsGetOutputSchema = TrendReportSchema.extend({
  original_keyword: z.string().optional(),
  translated_keyword: z.string().optional(),
  language_code: z.string(),
  language_name: z.string(),
});

export const trendsRouter = router({
  ping: publicProcedure.query(() => ({ status: "trends router ok" })),

  get: publicProcedure
    .input(TrendsGetInputSchema)
    .output(TrendsGetOutputSchema)
    .query(async ({ input }) => {
      const { trend_keywords, geo, use_regional_language } = input;

      // Use the first keyword as the primary search term
      const primaryKeyword = trend_keywords[0]!;
      
      let searchKeyword = primaryKeyword;
      let originalKeyword: string | undefined;
      let translatedKeyword: string | undefined;
      let languageCode = "en";
      let languageName = "English";

      // Translate keyword if regional language is requested
      if (use_regional_language) {
        const translation = await translateKeyword(primaryKeyword, geo);
        searchKeyword = translation.translated;
        originalKeyword = primaryKeyword;
        translatedKeyword = translation.translated;
        languageCode = translation.languageCode;
        languageName = translation.languageName;
      } else {
        // Even for English search, get the language info for the country
        const language = getCountryLanguage(geo);
        languageCode = "en";
        languageName = "English";
      }

      // Fetch raw trends data from SerpApi (4 parallel calls)
      const rawData = await getTrends(searchKeyword, geo, use_regional_language ? languageCode : undefined);

      // Synthesize the raw data into a structured report using Claude
      const report = await synthesizeTrendReport(searchKeyword, geo, rawData);

      const result = {
        ...report,
        original_keyword: originalKeyword,
        translated_keyword: translatedKeyword,
        language_code: languageCode,
        language_name: languageName,
      };

      if (input.session_id) {
        await saveSessionData(input.session_id, "trends", result);
      }

      return result;
    }),
});
